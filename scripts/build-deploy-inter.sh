#!/bin/bash

# input parameters
info() {
  echo -e "\033[0;32m$1\033[0m"
}

warn() {
  echo -e "\033[0;93m$1\033[0m"
}

error() {
  echo -e "\033[0;91m$1\033[0m" >&2
}

#Default Variable setup for build script
DOCKER_IMG_NAME_SERVER=pegaverse-portal-server
DOCKER_IMG_NAME_CLIENT=pegaverse-portal-client
DOCKER_IMG_NAME_CYPRESS=pegaverse-portal-cypress
DOCKER_IMG_NAME_PHIDIAS_STANDALONE=phidias-standalone
DOCKER_IMG_NAME_PHIDIAS_STATIC=phidias-static

LOCAL_DOCKER_HUB=ctrdc-dev-dockerhub.pegatroncorp.com
DOCKER_HUB=mcpdc-dockerhub.pegatroncorp.com
DOCKER_PRJ_NAME=pegaverse
DOCKER_IMG_NAME=$DOCKER_IMG_NAME_CLIENT
DOCKER_TAG_NAME=latest #should be tag name or commit id
DOCKER_FILE_NAME=Dockerfiles/Dockerfile-client
DOCKER_BUILD_FOLDER=client
DOCKER_TAG_NAME=latest

PROJECT_DIR=code_protect/project.txt
EXCLUDE_FILES=code_protect/exclude.txt

DEPLOY_TAMPLE_FILE=scripts/k8s-deploy-sample-inter.yaml
NEXT_DEPLOY_TEMPLATE_FILE=scripts/k8s-deploy-standalone-sample-inter.yaml
STATIC_DEPLOY_TEMPLATE_FILE=scripts/k8s-deploy-static-sample-inter.yaml
gitOpsYamlName='app-portal.yaml'
site_list="HQ"


DEPLOY_TO_SITE=""
DEPLOY_SITE=""
BUILD_IMAGE=""
PUSH_IMAGE=""
BUILD_YAML=""
BUILD_STATIC_YAML=""
DEPLOY_STATIC=""
BUILD_NEXT_YAML=""
DEPLOY_NEXT=""

# usage function
usage() {
  local SELF="basename $0"
  cat <<EOF
USAGE:
  $SELF -h,--help                                : show this message

Options:
  --build-target, -bt      <target-name>              : build-target (default: test, Supported: test, staging, production)
  --build-image, -bi       <target-name>              : build-target (default: client, Supported: client, server, cypress)
  --build-image-only,      <target-name>              : build docker image only
  --deploy-only,           <target-name>              : deploy to site only, need to setup --build-target
  --tag, -t,               <target-name>              : Tag-name for the image, if no set, will use latest
  --name, -n,              <branch-name>              : Branch name for deployment identification
  --cleanup-deployment                                : Cleanup deployment for the given branch name
EOF
}

CLEANUP_DEPLOYMENT=false
BRANCH_NAME=""
FORCE_UPDATE_SERVICE=false
STATIC_TAG_MINIMAL=""

# Assume the running folder is the root of the project
# Step 1: build client bash

build::docker_image() {
  info "Docker login to $LOCAL_DOCKER_HUB"
  docker login $LOCAL_DOCKER_HUB -u $DOCKER_ACCOUNT --password $DOCKER_PWD || exit 1
  info "Remove old docker image:"
  docker rmi $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME || true
  # Generate .env.production for Phidias client
  #
  # apiBaseUrl 運作模式說明:
  # - Standalone 模式: apiBaseUrl 為空字串，前端 /phidias/* 會透過 Next.js rewrites 導向到
  #   本地端的 src/app/api/phidias/* (即 Next.js server 自己)，不依賴外部後端。
  # - Static/Web Component 模式: apiBaseUrl 在 build-time 寫入 .env.production，
  #   讓前端直接呼叫外部後端服務 (e.g., http://172.18.246.239:xxx/api/v1)。
  # - Web Component Runtime: 由 createConfigWebComponent() 在 runtime 時從 custom element
  #   的 HTML attributes (api-base-url) 讀取並賦值給 Zustand store。
  #
  if [ "$1" == "phidias-client" ]; then
    info "Baking .env.production for Phidias standalone client"
    
    # We need to know the target server port. If not allocated yet, fallback to parsing config.ini
    if [ -z "$ALLOCATED_PHIDIAS_SERVER_PORT" ]; then
        source ./scripts/parse_ini.sh ./config/"$DEPLOY_SITE".ini
        local BASE_SERVER_PORT=${COMMON_NODEPORT}
        ALLOCATED_PHIDIAS_SERVER_PORT=$((BASE_SERVER_PORT + 1))
    fi
    
    # Identify the correct host IP from the config (e.g., using REACT_APP_TOOL_URL as a base IP, or standard test IP)
    local TARGET_API_URL="http://172.18.246.239:${ALLOCATED_PHIDIAS_SERVER_PORT}/api/v1"
    
    # Write to the specific build folder
    echo "NEXT_PUBLIC_API_BASE_URL=${TARGET_API_URL}" > "${DOCKER_BUILD_FOLDER}/.env.production"
    echo "NEXT_PUBLIC_HOST_APP=phidias-standalone" >> "${DOCKER_BUILD_FOLDER}/.env.production"
    
    info "Generated ${DOCKER_BUILD_FOLDER}/.env.production with NEXT_PUBLIC_API_BASE_URL=${TARGET_API_URL}"
  fi

  # For phidias-static: pull previous image to use as BASE_STATIC_IMAGE so accumulated
  # content-hashed tag JS files are inherited (Plan B layered image strategy).
  # --tag-minimal skips accumulation so the image starts clean from nginx:alpine.
  local BASE_STATIC_IMAGE_ARG=""
  if [ "$DOCKER_IMG_NAME" == "$DOCKER_IMG_NAME_PHIDIAS_STATIC" ]; then
    if [ "$STATIC_TAG_MINIMAL" == "true" ]; then
      info "Tag-minimal build: skipping BASE_STATIC_IMAGE accumulation (clean nginx:alpine base)"
    else
      local PREV_STATIC_IMAGE="$LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME_PHIDIAS_STATIC:steady_latest"
      if docker pull "$PREV_STATIC_IMAGE" 2>/dev/null; then
        info "Using previous phidias-static image as base: $PREV_STATIC_IMAGE"
        BASE_STATIC_IMAGE_ARG="--build-arg BASE_STATIC_IMAGE=$PREV_STATIC_IMAGE"
      else
        info "No previous phidias-static image found — using nginx:alpine as base (first build)"
      fi
    fi
  fi

  DOCKER_BUILDKIT=1 docker build --cpu-period=200000 --cpu-quota=200000 -m 4g \
    -t $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME \
    --build-arg BUILD_FOLDER="$DOCKER_BUILD_FOLDER" \
    --build-arg http_proxy="${Gitlab_http_proxy}" \
    --build-arg https_proxy="${Gitlab_http_proxy}" \
    --build-arg HTTP_PROXY="${Gitlab_http_proxy}" \
    --build-arg HTTPS_PROXY="${Gitlab_http_proxy}" \
    --build-arg CICD_PUBLISH_TOKEN="${CICD_PUBLISH_TOKEN}" \
    ${BASE_STATIC_IMAGE_ARG} \
    -f $DOCKER_FILE_NAME ./ || exit 1

  # Only run code protection when adding tag
  if [ "$DOCKER_BUILD_FOLDER" == "server" ] && [ -n "$CI_COMMIT_TAG" ]; then
    info "Run code protection"
    bash ci_utils/tools/code_protection/code_protection.sh \
      --project-txt $PROJECT_DIR \
      --exclude-txt $EXCLUDE_FILES \
      --image $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME \
      --proxy "${Gitlab_http_proxy}" \
      --nproc 20 || exit 1
  fi
}

function exists_in_list() {
  LIST=$1
  DELIMITER=$2
  VALUE=$3
  [[ "$LIST" =~ ($DELIMITER|^)$VALUE($DELIMITER|$) ]]
}

push::docker_image() {
  info "push docker image:  $DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME"
  docker tag $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME $DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME
  docker login $DOCKER_HUB -u $DOCKER_ACCOUNT --password $DOCKER_PWD
  docker push $DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME || exit 1
}

allocate::nodeports() {
  source ./scripts/parse_ini.sh ./config/"$DEPLOY_SITE".ini

  local BASE_CLIENT_PORT=${COMMON_C_NODEPORT}
  local BASE_SERVER_PORT=${COMMON_NODEPORT}
  local PORT_RANGE_START=30000
  local PORT_RANGE_END=32767

  info "Allocating NodePorts for branch: ${BRANCH_NAME}"
  info "Base ports - Client: ${BASE_CLIENT_PORT}, Server: ${BASE_SERVER_PORT}"

  local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"

  # 如果有 BRANCH_NAME，先嘗試讀取已存在的 service nodePort
  if [ -n "$BRANCH_NAME" ] && [ "$BRANCH_NAME" != "master" ]; then
    local CLIENT_SVC="pegaverse-portal-client-${BRANCH_NAME}-ext"
    local SERVER_SVC="pegaverse-portal-server-${BRANCH_NAME}-ext"

    local EXISTING_CLIENT_PORT
    EXISTING_CLIENT_PORT=$(tools/kubectl get service "$CLIENT_SVC" \
      --kubeconfig "$KUBECONFIG_FILE" -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

    local EXISTING_SERVER_PORT
    EXISTING_SERVER_PORT=$(tools/kubectl get service "$SERVER_SVC" \
      --kubeconfig "$KUBECONFIG_FILE" -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

    if [ -n "$EXISTING_CLIENT_PORT" ] && [ -n "$EXISTING_SERVER_PORT" ]; then
      info "Found existing services for branch ${BRANCH_NAME}, reusing NodePorts."
      info "  Client NodePort: ${EXISTING_CLIENT_PORT}"
      info "  Server NodePort: ${EXISTING_SERVER_PORT}"
      export ALLOCATED_CLIENT_PORT=$EXISTING_CLIENT_PORT
      export ALLOCATED_SERVER_PORT=$EXISTING_SERVER_PORT
      return 0
    fi
    info "Partial or no existing services found; will allocate missing ports if needed."
  fi

  info "Fetching existing NodePorts from Kubernetes..."
  local KUBECTL_OUTPUT
  KUBECTL_OUTPUT=$(tools/kubectl get services \
    --kubeconfig "$KUBECONFIG_FILE" \
    --all-namespaces \
    -o jsonpath='{range .items[*]}{.spec.ports[*].nodePort}{"\n"}{end}' 2>&1)

  local KUBECTL_EXIT_CODE=$?
  if [ $KUBECTL_EXIT_CODE -ne 0 ]; then
    error "Failed to fetch services from Kubernetes. Exit code: ${KUBECTL_EXIT_CODE}"
    error "kubectl output: ${KUBECTL_OUTPUT}"
    exit 1
  fi

  local USED_PORTS
  USED_PORTS=$(echo "$KUBECTL_OUTPUT" | grep -v '^$' | sort -n | uniq)

  if [ -z "$USED_PORTS" ]; then
    warn "No existing NodePorts found in cluster (this might be normal for first deployment)"
  else
    info "Currently used NodePorts:"
    echo "$USED_PORTS" | while read -r port; do
      info "  - ${port}"
    done
  fi

  # 如果先前偵測到部分存在的 port，先使用它
  local NEW_CLIENT_PORT=""
  local NEW_SERVER_PORT=""

  if [ -n "$EXISTING_CLIENT_PORT" ]; then
    NEW_CLIENT_PORT=$EXISTING_CLIENT_PORT
  else
    NEW_CLIENT_PORT=$BASE_CLIENT_PORT
    while echo "$USED_PORTS" | grep -q "^${NEW_CLIENT_PORT}$"; do
      NEW_CLIENT_PORT=$((NEW_CLIENT_PORT + 1))
      if [ $NEW_CLIENT_PORT -gt $PORT_RANGE_END ]; then
        error "No available NodePort for client (exceeded range)"
        exit 1
      fi
    done
  fi

  if [ -n "$EXISTING_SERVER_PORT" ]; then
    NEW_SERVER_PORT=$EXISTING_SERVER_PORT
  else
    NEW_SERVER_PORT=$BASE_SERVER_PORT
    while echo "$USED_PORTS" | grep -q "^${NEW_SERVER_PORT}$" || [ "$NEW_SERVER_PORT" -eq "$NEW_CLIENT_PORT" ]; do
      NEW_SERVER_PORT=$((NEW_SERVER_PORT + 1))
      if [ $NEW_SERVER_PORT -gt $PORT_RANGE_END ]; then
        error "No available NodePort for server (exceeded range)"
        exit 1
      fi
    done
  fi

  # 3. Phidias ports
  NEW_PHIDIAS_CLIENT_PORT=$((NEW_CLIENT_PORT + 1))
  NEW_PHIDIAS_SERVER_PORT=$((NEW_SERVER_PORT + 1))

  info "Allocated Client NodePort: ${NEW_CLIENT_PORT}"
  info "Allocated Server NodePort: ${NEW_SERVER_PORT}"
  info "Allocated Phidias Client NodePort: ${NEW_PHIDIAS_CLIENT_PORT}"
  info "Allocated Phidias Server NodePort: ${NEW_PHIDIAS_SERVER_PORT}"

  export ALLOCATED_CLIENT_PORT=$NEW_CLIENT_PORT
  export ALLOCATED_SERVER_PORT=$NEW_SERVER_PORT
  export ALLOCATED_PHIDIAS_CLIENT_PORT=$NEW_PHIDIAS_CLIENT_PORT
  export ALLOCATED_PHIDIAS_SERVER_PORT=$NEW_PHIDIAS_SERVER_PORT
}

# allocate::nodeports_use_existing
# Similar to allocate::nodeports but: if existing services for the branch
# are found, reuse their nodePort values without performing +1 allocation.
# If no existing services are found, fall back to the values in the ini file.
allocate::nodeports_use_existing() {
  source ./scripts/parse_ini.sh ./config/"$DEPLOY_SITE".ini

  local BASE_CLIENT_PORT=${COMMON_C_NODEPORT}
  local BASE_SERVER_PORT=${COMMON_NODEPORT}

  info "Allocating NodePorts (use-existing-only) for branch: ${BRANCH_NAME}"
  info "Base ports - Client: ${BASE_CLIENT_PORT}, Server: ${BASE_SERVER_PORT}"

  local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"

  # If branch specified (and not master), try to read existing service nodePorts
  if [ -n "$BRANCH_NAME" ] && [ "$BRANCH_NAME" != "master" ]; then
    local CLIENT_SVC="pegaverse-portal-client-${BRANCH_NAME}-ext"
    local SERVER_SVC="pegaverse-portal-server-${BRANCH_NAME}-ext"

    local EXISTING_CLIENT_PORT
    EXISTING_CLIENT_PORT=$(tools/kubectl get service "$CLIENT_SVC" \
      --kubeconfig "$KUBECONFIG_FILE" -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

    local EXISTING_SERVER_PORT
    EXISTING_SERVER_PORT=$(tools/kubectl get service "$SERVER_SVC" \
      --kubeconfig "$KUBECONFIG_FILE" -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

    if [ -n "$EXISTING_CLIENT_PORT" ] && [ -n "$EXISTING_SERVER_PORT" ]; then
      info "Found existing services for branch ${BRANCH_NAME}, reusing NodePorts (no increment)."
      info "  Client NodePort: ${EXISTING_CLIENT_PORT}"
      info "  Server NodePort: ${EXISTING_SERVER_PORT}"
      export ALLOCATED_CLIENT_PORT=$EXISTING_CLIENT_PORT
      export ALLOCATED_SERVER_PORT=$EXISTING_SERVER_PORT
      return 0
    fi

    info "No existing services found for branch ${BRANCH_NAME}; falling back to ini defaults."
    export ALLOCATED_CLIENT_PORT=$BASE_CLIENT_PORT
    export ALLOCATED_SERVER_PORT=$BASE_SERVER_PORT
    return 0
  fi

  # For master or no branch, simply use ini defaults
  export ALLOCATED_CLIENT_PORT=$BASE_CLIENT_PORT
  export ALLOCATED_SERVER_PORT=$BASE_SERVER_PORT
}



build::yaml() {
  info "Begin Kubernetes deploy"
  info "Execute folder:  ${PWD}"

  source ./scripts/parse_ini.sh ./config/"$DEPLOY_SITE".ini
  ORIGINAL_CLIENT_PORT=${COMMON_C_NODEPORT}
  ORIGINAL_SERVER_PORT=${COMMON_NODEPORT}

  # 根據是否有 BRANCH_NAME 決定資源命名
  if [ -n "$BRANCH_NAME" ] && [ "$BRANCH_NAME" != "master" ]; then
    info "Entering issue branch mode"
    # Issue branch: 使用 branch name 作為後綴
    local DEPLOYMENT_SUFFIX="-${BRANCH_NAME}"
    local CONFIGMAP_NAME="config-ini-${BRANCH_NAME}-configmaps"

    # 為 issue branch 動態分配 NodePort
    allocate::nodeports
    CLIENT_NODEPORT=$ALLOCATED_CLIENT_PORT
    SERVER_NODEPORT=$ALLOCATED_SERVER_PORT
    PHIDIAS_CLIENT_NODEPORT=$ALLOCATED_PHIDIAS_CLIENT_PORT
    PHIDIAS_SERVER_NODEPORT=$ALLOCATED_PHIDIAS_SERVER_PORT
  else
    info "Entering master branch mode"
    # Master branch: 使用原始命名
    local DEPLOYMENT_SUFFIX=""
    local CONFIGMAP_NAME="config-ini-configmaps"
    CLIENT_NODEPORT=${COMMON_C_NODEPORT}
    SERVER_NODEPORT=${COMMON_NODEPORT}
    PHIDIAS_CLIENT_NODEPORT=$((CLIENT_NODEPORT + 1))
    PHIDIAS_SERVER_NODEPORT=$((SERVER_NODEPORT + 1))
  fi

  client_img_name=$DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME_CLIENT:$DOCKER_TAG_NAME
  server_img_name=$DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME_SERVER:$DOCKER_TAG_NAME
  echo $client_img_name
  echo $server_img_name
  echo "Git Commit SHA"
  export COMMIT_ID=${CI_COMMIT_SHORT_SHA,,}
  export CONFIGMAP_NAME=${CONFIGMAP_NAME}
  export DEPLOYMENT_SUFFIX=${DEPLOYMENT_SUFFIX}

  sed_cmd="s/__HUB__/${DOCKER_HUB}/g; \
      s/__CLCPU__/${COMMON_C_CPU_LIMIT}/g; \
      s/__CLMEM__/${COMMON_C_MEM_LIMIT}/g; \
      s/__CRCPU__/${COMMON_C_CPU_REQ}/g; \
      s/__CRMEM__/${COMMON_C_MEM_REQ}/g; \
      s/__SLCPU__/${COMMON_CPU_LIMIT}/g; \
      s/__SLMEM__/${COMMON_MEM_LIMIT}/g; \
      s/__SRCPU__/${COMMON_CPU_REQ}/g; \
      s/__SRMEM__/${COMMON_MEM_REQ}/g; \
      s/__CNODEPORT__/${CLIENT_NODEPORT}/g; \
      s/__SNODEPORT__/${SERVER_NODEPORT}/g; \
      s/__PCNODEPORT__/${PHIDIAS_CLIENT_NODEPORT}/g; \
      s/__PSNODEPORT__/${PHIDIAS_SERVER_NODEPORT}/g; \
      s/__CLIENT_IMG_NAME__/${DOCKER_IMG_NAME_CLIENT}/g; \
      s/__SERVER_IMG_NAME/${DOCKER_IMG_NAME_SERVER}/g; \
      s/__CONFIG_INI__/${CONFIGMAP_NAME}/g; \
      s/__DEPLOYMENT_SUFFIX__/${DEPLOYMENT_SUFFIX}/g; \
      s/__GIT_COMMIT_TIME__/$(date +'%Y%m%d%H%M%S')/g; \
      s/__TAG__/$DOCKER_TAG_NAME/g"

  sed "$sed_cmd" "$DEPLOY_TAMPLE_FILE" >"${PWD}/local_output/${DEPLOY_SITE}.yaml" || exit 1
  cp "config/${DEPLOY_SITE}.ini" "config/config.ini"

  # 替換 config.ini 中的 port 為動態分配的 port
  sed -i "s/${ORIGINAL_CLIENT_PORT}/${CLIENT_NODEPORT}/g" "config/config.ini"
  sed -i "s/${ORIGINAL_SERVER_PORT}/${SERVER_NODEPORT}/g" "config/config.ini"
  info "Updated config.ini with allocated ports: Client=${CLIENT_NODEPORT}, Server=${SERVER_NODEPORT}"

  tools/kubectl create configmap $CONFIGMAP_NAME -n pegaverse --from-file="config/config.ini" --output='yaml' --dry-run='client' >>"${PWD}/local_output/${DEPLOY_SITE}.yaml" || exit 1
  tools/yq -i e '.metadata.labels.gitCommit = strenv(COMMIT_ID)' "${PWD}/local_output/${DEPLOY_SITE}.yaml"

  # 印出分配的 port 資訊
  info "Deployment YAML generated with following NodePorts:"
  info "  Client NodePort: ${CLIENT_NODEPORT}"
  info "  Server NodePort: ${SERVER_NODEPORT}"
  info "  Phidias Client NodePort: ${PHIDIAS_CLIENT_NODEPORT}"
  info "  Phidias Server NodePort: ${PHIDIAS_SERVER_NODEPORT}"
}

deploy::manifest() {
  info "deploy to manifest"

  # 判斷是否為 issue branch
  if [ -n "$BRANCH_NAME" ] && [ "$ISSUE_BRANCH" == "TRUE" ] && [ "$BRANCH_NAME" != "master" ]; then
    info "Deploying issue branch '${BRANCH_NAME}' directly to Kubernetes..."

    # 檢查部署類型
    if [[ $DEPLOY_TYPE != "test" ]]; then
      error "Issue branches can only be deployed to 'test' environment"
      exit 1
    fi

    # 檢查 YAML 檔案是否存在
    local DEPLOY_YAML="${PWD}/local_output/HQ.yaml" # temp way to fix yaml name
    if [ ! -f "$DEPLOY_YAML" ]; then
      error "Deployment YAML not found: $DEPLOY_YAML"
      error "Please run with --build-yaml-only first"
      exit 1
    fi

    info "Applying deployment YAML: $DEPLOY_YAML"
    info "Target namespace: pegaverse"

    local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"
    tools/kubectl apply -f "$DEPLOY_YAML" \
      --kubeconfig "$KUBECONFIG_FILE" \
      -n pegaverse || {
      error "Failed to deploy to Kubernetes"
      exit 1
    }

    info "Deployment successful for branch: ${BRANCH_NAME}"

    # 顯示部署狀態
    info "Checking deployment status..."
    tools/kubectl get deployments \
      --kubeconfig "$KUBECONFIG_FILE" \
      -n pegaverse \
      -l "app in (pegaverse-portal-client-${BRANCH_NAME},pegaverse-portal-server-${BRANCH_NAME})" || true

    info "Checking services..."
    tools/kubectl get services \
      --kubeconfig "$KUBECONFIG_FILE" \
      -n pegaverse | grep "${BRANCH_NAME}" || true

    # 取得 NodePort 資訊
    local CLIENT_NODEPORT=$(tools/kubectl get service "pegaverse-portal-client-${BRANCH_NAME}-ext" \
      --kubeconfig "$KUBECONFIG_FILE" \
      -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")

    local SERVER_NODEPORT=$(tools/kubectl get service "pegaverse-portal-server-${BRANCH_NAME}-ext" \
      --kubeconfig "$KUBECONFIG_FILE" \
      -n pegaverse \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")

    info "===== Deployment Summary ====="
    info "Branch Name:       ${BRANCH_NAME}"
    info "Client NodePort:   ${CLIENT_NODEPORT}"
    info "Server NodePort:   ${SERVER_NODEPORT}"
    info "Namespace:         pegaverse"
    info "=============================="

  else
    info "Deploying master branch via GitOps..."

    export filename=local_output/overall_manifest.yaml
    ls -alF local_output/*.yaml
    echo "" >${filename}
    for x in local_output/*.yaml; do
      echo "---" >>${filename}
      cat $x >>${filename}
    done

    #$k8s_command get node
    if [[ $DEPLOY_TYPE = "test" ]]; then
      ls ci_utils
      bash ci_utils/update_manifests_dev_yml.sh --yml $filename --cluster-path apps/PEGAVERSE/portal/base
    elif [[ $DEPLOY_TYPE = "production" ]]; then
      bash ci_utils/update_manifests_yml.sh --yml $filename --cluster-path apps/PEGAVERSE/portal/base
    else
      error "deploy manifest only support test and production"
    fi

    info "GitOps manifest updated successfully"
  fi
}

cleanup::deployment() {
  if [ -z "$BRANCH_NAME" ]; then
    error "Branch name is required for cleanup"
    exit 1
  fi

  info "Cleaning up deployment for branch: ${BRANCH_NAME}"

  # 設定資源名稱（對應 YAML 中的命名規則）
  local CLIENT_DEPLOYMENT_NAME="pegaverse-portal-client-${BRANCH_NAME}"
  local SERVER_DEPLOYMENT_NAME="pegaverse-portal-server-${BRANCH_NAME}"
  local CLIENT_SERVICE_NAME="pegaverse-portal-client-${BRANCH_NAME}"
  local CLIENT_SERVICE_EXT_NAME="pegaverse-portal-client-${BRANCH_NAME}-ext"
  local SERVER_SERVICE_NAME="pegaverse-portal-server-${BRANCH_NAME}"
  local SERVER_SERVICE_EXT_NAME="pegaverse-portal-server-${BRANCH_NAME}-ext"
  local CONFIGMAP_NAME="config-ini-${BRANCH_NAME}-configmaps"
  local NAMESPACE="pegaverse"

  info "Deleting Kubernetes resources in namespace: ${NAMESPACE}"
  local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"
  # 刪除 Deployments
  tools/kubectl delete deployment --kubeconfig ${KUBECONFIG_FILE} ${CLIENT_DEPLOYMENT_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Client deployment not found"
  tools/kubectl delete deployment --kubeconfig ${KUBECONFIG_FILE} ${SERVER_DEPLOYMENT_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Server deployment not found"

  # 刪除 Services
  tools/kubectl delete service --kubeconfig ${KUBECONFIG_FILE} ${CLIENT_SERVICE_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Client service not found"
  tools/kubectl delete service --kubeconfig ${KUBECONFIG_FILE} ${CLIENT_SERVICE_EXT_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Client external service not found"
  tools/kubectl delete service --kubeconfig ${KUBECONFIG_FILE} ${SERVER_SERVICE_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Server service not found"
  tools/kubectl delete service --kubeconfig ${KUBECONFIG_FILE} ${SERVER_SERVICE_EXT_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "Server external service not found"

  # 刪除 ConfigMap
  tools/kubectl delete configmap --kubeconfig ${KUBECONFIG_FILE} ${CONFIGMAP_NAME} -n ${NAMESPACE} --ignore-not-found=true || warn "ConfigMap not found"

#  # 刪除本地 Docker images（可選）
#  info "Removing local Docker images"
#  docker rmi ${LOCAL_DOCKER_HUB}/${DOCKER_PRJ_NAME}/${DOCKER_IMG_NAME_SERVER}:${BRANCH_NAME} || warn "Server image not found locally"
#  docker rmi ${LOCAL_DOCKER_HUB}/${DOCKER_PRJ_NAME}/${DOCKER_IMG_NAME_CLIENT}:${BRANCH_NAME} || warn "Client image not found locally"

  info "Cleanup completed for branch: ${BRANCH_NAME}"
}

build::static_yaml() {
  info "Build phidias-static deployment YAML"
  info "Execute folder: ${PWD}"

  mkdir -p "${PWD}/local_output"

  if [ -n "$BRANCH_NAME" ] && [ "$BRANCH_NAME" != "master" ]; then
    local DEPLOYMENT_SUFFIX="-${BRANCH_NAME}"
  else
    local DEPLOYMENT_SUFFIX=""
  fi

  export COMMIT_ID=${CI_COMMIT_SHORT_SHA,,}
  export DEPLOYMENT_SUFFIX=${DEPLOYMENT_SUFFIX}

  local sed_cmd="s/__HUB__/${DOCKER_HUB}/g; \
      s/__PHIDIAS_STATIC_IMG_NAME__/${DOCKER_IMG_NAME_PHIDIAS_STATIC}/g; \
      s/__TAG__/$DOCKER_TAG_NAME/g; \
      s/__DEPLOYMENT_SUFFIX__/${DEPLOYMENT_SUFFIX}/g; \
      s/__GIT_COMMIT_TIME__/$(date +'%Y%m%d%H%M%S')/g"

  sed "$sed_cmd" "$STATIC_DEPLOY_TEMPLATE_FILE" > "${PWD}/local_output/phidias-static.yaml" || exit 1
  tools/yq -i e '.metadata.labels.gitCommit = strenv(COMMIT_ID)' "${PWD}/local_output/phidias-static.yaml" 2>/dev/null || true

  info "Static deployment YAML generated: local_output/phidias-static.yaml"
}

deploy::static_manifest() {
  local DEPLOY_YAML="${PWD}/local_output/phidias-static.yaml"

  if [ ! -f "$DEPLOY_YAML" ]; then
    error "Static deployment YAML not found: $DEPLOY_YAML"
    error "Please run with --build-static-yaml-only first"
    exit 1
  fi

  local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"

  info "Applying static deployment YAML: $DEPLOY_YAML"
  tools/kubectl apply -f "$DEPLOY_YAML" --kubeconfig "$KUBECONFIG_FILE" -n phidias || {
    error "Failed to deploy phidias-static to Kubernetes"
    exit 1
  }

  info "Deployment status:"
  tools/kubectl get deployment,service,ingress \
    --kubeconfig "$KUBECONFIG_FILE" \
    -n phidias \
    -l "app=phidias-static${BRANCH_NAME:+-${BRANCH_NAME}}" 2>/dev/null || true

  info "Static deployment successful"
}


build::next_yaml() {
  info "Build phidias-standalone deployment YAML"
  info "Execute folder: ${PWD}"

  source ./scripts/parse_ini.sh ./config/"$DEPLOY_SITE".ini

  # phidias-standalone uses a fixed NodePort (aligned with Helm chart values.yaml).
  # No per-branch dynamic allocation needed — single deployment, always the same port.
  PHIDIAS_NEXT_NODEPORT=${COMMON_PHIDIAS_NODEPORT}
  local DEPLOYMENT_SUFFIX=""

  mkdir -p "${PWD}/local_output"
  export COMMIT_ID=${CI_COMMIT_SHORT_SHA,,}
  export DEPLOYMENT_SUFFIX=${DEPLOYMENT_SUFFIX}

  local sed_cmd="s/__HUB__/${DOCKER_HUB}/g; \
      s/__PHIDIAS_NEXT_IMG_NAME__/${DOCKER_IMG_NAME_PHIDIAS_STANDALONE}/g; \
      s/__TAG__/$DOCKER_TAG_NAME/g; \
      s/__DEPLOYMENT_SUFFIX__/${DEPLOYMENT_SUFFIX}/g; \
      s/__PHIDIAS_NODEPORT__/${PHIDIAS_NEXT_NODEPORT}/g; \
      s/__SLCPU__/${COMMON_CPU_LIMIT}/g; \
      s/__SLMEM__/${COMMON_MEM_LIMIT}/g; \
      s/__SRCPU__/${COMMON_CPU_REQ}/g; \
      s/__SRMEM__/${COMMON_MEM_REQ}/g; \
      s/__GIT_COMMIT_TIME__/$(date +'%Y%m%d%H%M%S')/g"

  sed "$sed_cmd" "$NEXT_DEPLOY_TEMPLATE_FILE" > "${PWD}/local_output/phidias-standalone.yaml" || exit 1
  tools/yq -i e '.metadata.labels.gitCommit = strenv(COMMIT_ID)' "${PWD}/local_output/phidias-standalone.yaml" 2>/dev/null || true

  info "Deployment NodePort: ${PHIDIAS_NEXT_NODEPORT}"
  info "Standalone deployment YAML generated: local_output/phidias-standalone.yaml"
}

deploy::next_manifest() {
  local DEPLOY_YAML="${PWD}/local_output/phidias-standalone.yaml"

  if [ ! -f "$DEPLOY_YAML" ]; then
    error "Standalone deployment YAML not found: $DEPLOY_YAML"
    error "Please run with --build-next-yaml-only first"
    exit 1
  fi

  local KUBECONFIG_FILE="tools/kubeconfig/pegaverse-test2.kubeconfig"

  info "Applying next deployment YAML: $DEPLOY_YAML"
  tools/kubectl apply -f "$DEPLOY_YAML" --kubeconfig "$KUBECONFIG_FILE" -n phidias || {
    error "Failed to deploy phidias-standalone to Kubernetes"
    exit 1
  }

  info "Deployment status:"
  tools/kubectl get deployment,service \
    --kubeconfig "$KUBECONFIG_FILE" \
    -n phidias \
    -l "app=phidias-standalone${BRANCH_NAME:+-${BRANCH_NAME}}" 2>/dev/null || true

  info "Next deployment successful"
}

set::build_target() {
  echo "${1}" "${2}"
  # Absolute path to this script, e.g. /home/user/bin/foo.sh
  SCRIPT=$(readlink -f "$0")
  # Absolute path this script is in, thus /home/user/bin
  current_folder=$(dirname "$SCRIPT")
  echo $current_folder
  project_folder=$(readlink -f "$current_folder/../")
  echo $project_folder
  source $project_folder/scripts/parse_ini.sh $project_folder/config/config.ini

  # DOCKER_HUB comes from config.ini and switches between CTRDC and MCPDC based on
  # the deploy target (test → ctrdc-dev-dockerhub, production → mcpdc-dockerhub).
  #
  # DOCKER_ACCOUNT and registry passwords are read from CI env vars — NOT from the
  # ini — because parse_ini.sh uses eval which strips $ from robot$pegaverse.
  #
  # DOCKER_PWD_CTRDC / DOCKER_MCPDC_PWD are distinct CI variables so the correct
  # token is always selected without requiring per-job overrides.
  DOCKER_HUB=${COMMON_docker_server}
  DOCKER_ACCOUNT=${DOCKER_ACCOUNT:-${COMMON_docker_account}}
  # Select the registry token that matches the target server.
  # A CTRDC token is not valid for MCPDC (and vice versa); using the wrong one
  # produces "unauthorized: authentication required" at docker login time.
  if [ "$DOCKER_HUB" = "mcpdc-dockerhub.pegatroncorp.com" ]; then
    DOCKER_PWD=${DOCKER_MCPDC_PWD}
  else
    DOCKER_PWD=${DOCKER_PWD_CTRDC:-${COMMON_docker_pwd}}
  fi

#  case "${1}_${2}" in
#  "HQ_test")
#    info "build_target: test"
#    DOCKER_HUB=ctrdc-dev-dockerhub.pegatroncorp.com
#    DOCKER_ACCOUNT='robot$pegaverse'
#    DOCKER_PWD='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDM0MTkzNjQsImlzcyI6ImhhcmJvci10b2tlbi1kZWZhdWx0SXNzdWVyIiwiaWQiOjYxNCwicGlkIjo2MTEsImFjY2VzcyI6W3siUmVzb3VyY2UiOiIvcHJvamVjdC82MTEvcmVwb3NpdG9yeSIsIkFjdGlvbiI6InB1c2giLCJFZmZlY3QiOiIifSx7IlJlc291cmNlIjoiL3Byb2plY3QvNjExL2hlbG0tY2hhcnQiLCJBY3Rpb24iOiJyZWFkIiwiRWZmZWN0IjoiIn0seyJSZXNvdXJjZSI6Ii9wcm9qZWN0LzYxMS9oZWxtLWNoYXJ0LXZlcnNpb24iLCJBY3Rpb24iOiJjcmVhdGUiLCJFZmZlY3QiOiIifV19.g2vrryrJh8zNkVzC0hc7WXWUj4aD9UWcsPrJSiaz-wd06fopmEYIrOOoog07LGRW7W8bWGHhkeEmfZO7c4Lx4hXDQqqGEjrmig1GBGXuNOAw6C-MXzA0XKbMCo4jfYkvxtL8LbDXOmJ6IPbkoR_UNCF1yfFXoTV0GG0kJiQKwAt7oxCF6ujlvaZcWLPOJBkoG-1yXlBcyjcyxEchd_7jU4mWOQAQRnoHbZXLdaipOqtLXjLsfQ8e6zZOtEt1VM37lXl4kjoKcMYKWVnsN5tQPd5hlZi2KP8bVxW_vrWDNrH7IAfPdd9nuab1qXXzEIPu8WCX3s12DjF0FEjz6TM760N-LwgF67_7WeAX572KdtPhW9rg5h9ySKyKwyNawIFcyLyHxcCURxwf4cfewlpd42KODuZo1w1Dyn-WdHxTLWyFaHLzpakeNsNdJdLpRug5d7359mXK-j4EKfIeTME1Je8QAiPPeQFdmG5YxsRFU-kIGFRGkb1R_mRMO-KkXJSYm79c0HAAJQHozd7iOGQzActPstgTG2oiTasNR114mElvuzjBIqoo79vZxda0T1-fRZ4Gr5BZLcG2wukS2L0zDhe8XObQ-cYnkUWTG3qFzEKNlw6ms-iLzqFaz6SK-Lh496H4C3yOFwbtN5UK-N4sbJvCdh0__-mmrx5K1FFBfXg'
#    ;;
#  "HQ_staging")
#    DOCKER_HUB=mcpdc-dockerhub.pegatroncorp.com
#    DOCKER_ACCOUNT='robot$pegaverse'
#    DOCKER_PWD='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDM0MTk3MjUsImlzcyI6ImhhcmJvci10b2tlbi1kZWZhdWx0SXNzdWVyIiwiaWQiOjcxMywicGlkIjo0MzA0LCJhY2Nlc3MiOlt7IlJlc291cmNlIjoiL3Byb2plY3QvNDMwNC9yZXBvc2l0b3J5IiwiQWN0aW9uIjoicHVzaCIsIkVmZmVjdCI6IiJ9LHsiUmVzb3VyY2UiOiIvcHJvamVjdC80MzA0L2hlbG0tY2hhcnQiLCJBY3Rpb24iOiJyZWFkIiwiRWZmZWN0IjoiIn0seyJSZXNvdXJjZSI6Ii9wcm9qZWN0LzQzMDQvaGVsbS1jaGFydC12ZXJzaW9uIiwiQWN0aW9uIjoiY3JlYXRlIiwiRWZmZWN0IjoiIn1dfQ.EW0iqNVCY8ceRhTg-73X6F7xjfjK_OnvOMFlZ5XiuDwPkJZ1q9pN5NyDLYKfAvBddHUgOuS6NnoFSaIpaNq3Tu-TCUOmDw4PlWa_Eo4J-2ixsByo8del-G2qTTQ3NeYDANgqMDppGNRr7ze5ACooxASXX4PjumERus7HJVMQ4lLMrytPdmTpAvSeFGCw8XLm3UG1r-ZTcjFYuPI51Po3LHpf9XLsobATHX3b3YG191uYvEbn-f3VSyzu8r8O-Tp_xEGg986kdXLwC-a0d9xIWlgAid88nKKfvc_a-_9NL1HIfuQiwPiwxmaVO0p5Fnr0XrfPkkmcJnAdIyM_M3PRHKt8eqo8Ztad9QtRL0kYZlJGqyLZ7AUVkJOmoHTolAK80NKsJhf24cr5izQEqOo4ZqJVfaFIvdc3kcmgeAxZhKfExiBBqcsp3fvQWXdcAlgCM6oVXXgbNUhCX0NYQ42DuPA2FJUcSwAX7fhT1VysMaVEo753UKa0WxA4EuwaioA2wc1ZYJ0BmO38SmB--_oJdDbBqtZWPdTbEeJWZvpfKASIhKnRMB0IDSZG68WSfPOE4jllaaCGlrR7DUIbXO7HFMMioe6xVkt2HjXWfhn4D6ag9I_WIdjiQhPnzxWDUzAonS_XmJEa546GBn0xsnQVxiHfymfjxj2yufv-i6ftmzU'
#    ;;
#  "HQ_production")
#    info "build_target: production"
#    DOCKER_HUB=mcpdc-dockerhub.pegatroncorp.com
#    DOCKER_ACCOUNT='robot$pegaverse'
#    DOCKER_PWD='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDM0MTk3MjUsImlzcyI6ImhhcmJvci10b2tlbi1kZWZhdWx0SXNzdWVyIiwiaWQiOjcxMywicGlkIjo0MzA0LCJhY2Nlc3MiOlt7IlJlc291cmNlIjoiL3Byb2plY3QvNDMwNC9yZXBvc2l0b3J5IiwiQWN0aW9uIjoicHVzaCIsIkVmZmVjdCI6IiJ9LHsiUmVzb3VyY2UiOiIvcHJvamVjdC80MzA0L2hlbG0tY2hhcnQiLCJBY3Rpb24iOiJyZWFkIiwiRWZmZWN0IjoiIn0seyJSZXNvdXJjZSI6Ii9wcm9qZWN0LzQzMDQvaGVsbS1jaGFydC12ZXJzaW9uIiwiQWN0aW9uIjoiY3JlYXRlIiwiRWZmZWN0IjoiIn1dfQ.EW0iqNVCY8ceRhTg-73X6F7xjfjK_OnvOMFlZ5XiuDwPkJZ1q9pN5NyDLYKfAvBddHUgOuS6NnoFSaIpaNq3Tu-TCUOmDw4PlWa_Eo4J-2ixsByo8del-G2qTTQ3NeYDANgqMDppGNRr7ze5ACooxASXX4PjumERus7HJVMQ4lLMrytPdmTpAvSeFGCw8XLm3UG1r-ZTcjFYuPI51Po3LHpf9XLsobATHX3b3YG191uYvEbn-f3VSyzu8r8O-Tp_xEGg986kdXLwC-a0d9xIWlgAid88nKKfvc_a-_9NL1HIfuQiwPiwxmaVO0p5Fnr0XrfPkkmcJnAdIyM_M3PRHKt8eqo8Ztad9QtRL0kYZlJGqyLZ7AUVkJOmoHTolAK80NKsJhf24cr5izQEqOo4ZqJVfaFIvdc3kcmgeAxZhKfExiBBqcsp3fvQWXdcAlgCM6oVXXgbNUhCX0NYQ42DuPA2FJUcSwAX7fhT1VysMaVEo753UKa0WxA4EuwaioA2wc1ZYJ0BmO38SmB--_oJdDbBqtZWPdTbEeJWZvpfKASIhKnRMB0IDSZG68WSfPOE4jllaaCGlrR7DUIbXO7HFMMioe6xVkt2HjXWfhn4D6ag9I_WIdjiQhPnzxWDUzAonS_XmJEa546GBn0xsnQVxiHfymfjxj2yufv-i6ftmzU'
#    ;;
#  *)
#    error "set::build_target: Invalid input for build_image"
#    exit 1
#    ;;
#  esac
  info "[Completed] set::build_target"
}

set::build_image() {

  case "$1" in
  client)
    DOCKER_IMG_NAME=$DOCKER_IMG_NAME_CLIENT
    DOCKER_FILE_NAME=Dockerfiles/Dockerfile-client
    DOCKER_BUILD_FOLDER=client
    ;;
  server)
    DOCKER_IMG_NAME=$DOCKER_IMG_NAME_SERVER
    DOCKER_FILE_NAME=Dockerfiles/Dockerfile-server
    DOCKER_BUILD_FOLDER=server
    ;;
  cypress)
    DOCKER_IMG_NAME=$DOCKER_IMG_NAME_CYPRESS
    DOCKER_FILE_NAME=Dockerfiles/Dockerfile-cypress
    DOCKER_BUILD_FOLDER=./
    ;;
  phidias-standalone)
    # Next.js app hosting both frontend and backend (SSR + API proxy)
    DOCKER_IMG_NAME=$DOCKER_IMG_NAME_PHIDIAS_STANDALONE
    DOCKER_FILE_NAME=Dockerfiles/Dockerfile-standalone-next
    DOCKER_BUILD_FOLDER=
    ;;
  phidias-static)
    # nginx image serving the steady-channel WC bundle (dist/)
    DOCKER_IMG_NAME=$DOCKER_IMG_NAME_PHIDIAS_STATIC
    DOCKER_FILE_NAME=Dockerfiles/Dockerfile-standalone-static
    DOCKER_BUILD_FOLDER=
    ;;
  *)
    error "set::build_image: Invalid input for build_image"
    exit 1
    ;;
  esac

  info "[Completed] set::build_image"
}

main() {
  local cmd=''
  while (("$#")); do
    case "${1:-}" in
    -h | --help)
      info "dump usage"
      usage
      exit 0
      ;;
    -bs | --build-site)
      shift
      cmd=${1}

      if exists_in_list "$site_list" " " $cmd; then
        info "Build target: $cmd"
        DEPLOY_SITE=$cmd
      else
        error "(-bs / --build-site) Currently Only support ${site_list}"
      fi
      ;;
    -dt | --deploy-type)
      shift
      cmd=${1}

      if [[ "$cmd" == *"test"* || "$cmd" == *"staging"* || "$cmd" == *"production"* ]]; then
        info "Deploy type: $cmd"
        DEPLOY_TYPE=$cmd
      else
        error "(-dt / --deploy-type) Only support test / staging / production"
      fi
      ;;
    -bi | --build-image)
      shift
      echo "$1"
      cmd=${1}
      if [[ "$cmd" == *"client"* || "$cmd" == *"server"* || "$cmd" == *"cypress"* || "$cmd" == "phidias-standalone" || "$cmd" == "phidias-static" ]]; then
        info "Build image: $cmd"
        set::build_image "$cmd"
      else
        error "(-bi / --build-image) Only support client / server / cypress / phidias-standalone / phidias-static"
      fi
      ;;
    --tag-minimal)
      STATIC_TAG_MINIMAL=true
      info "Tag-minimal mode enabled: clean base, steady-only manifest, no source maps"
      ;;
    --build-image-only)
      cmd=${1}
      BUILD_IMAGE=true
      info "Build image only, will not create yaml or deploy to site"
      ;;
    --push-image-only)
      cmd=${1}
      PUSH_IMAGE=true
      info "Build image only, will not create yaml or deploy to site"
      ;;
    --build-yaml-only)
      cmd=${1}
      BUILD_YAML=true
      info "Build image only, will not create yaml or deploy to site"
      ;;
    --build-static-yaml-only)
      cmd=${1}
      BUILD_STATIC_YAML=true
      info "Build static yaml only"
      ;;
    --deploy-static-only)
      cmd=${1}
      DEPLOY_STATIC=true
      info "Deploy phidias-static to Kubernetes"
      ;;
    --build-next-yaml-only)
      cmd=${1}
      BUILD_NEXT_YAML=true
      info "Build phidias-next deployment yaml only"
      ;;
    --deploy-next-only)
      cmd=${1}
      DEPLOY_NEXT=true
      info "Deploy phidias-next to Kubernetes"
      ;;
    --deploy-only)
      cmd=${1}
      DEPLOY_TO_SITE=true
      info "Build image only, will not create yaml or deploy to site"
      ;;
    --cleanup-deployment)
      CLEANUP_DEPLOYMENT=true
      info "Cleanup deployment mode enabled"
      ;;
    -t | --tag)
      shift
      cmd=${1}
      if [ -z "$cmd" ]; then
        info "Tagname is not assigned, use latest"
        cmd=latest
      fi
      DOCKER_TAG_NAME="$cmd"
      info "tag name: $DOCKER_TAG_NAME"
      ;;
    -n | --name)
      shift
      cmd=${1}
      # limit branch name to 30 characters
      if [ -n "$cmd" ]; then
        if [ "${#cmd}" -gt 30 ]; then
          warn "Branch name longer than 30 chars; truncating to 30 chars"
          cmd="${cmd:0:30}"
        fi
      fi
      BRANCH_NAME="$cmd"
      info "Branch name: $BRANCH_NAME"
      ;;
    -ib | --issue-branch)
      shift
      cmd=${1}
      ISSUE_BRANCH="$cmd"
      info "Issue branch: $ISSUE_BRANCH"
      ;;
    --force-update-service)
      # Support both: "--force-update-service" (boolean true) and
      # "--force-update-service <true|false>" (next token) and
      # "--force-update-service=true" (handled by the pattern below).
      next_arg="${2:-}"
      if [ -n "$next_arg" ] && [[ ! "$next_arg" =~ ^- ]]; then
        # consume next token as value
        shift
        val="$next_arg"
      else
        val="true"
      fi
      if [ "$val" = "true" ] || [ "$val" = "TRUE" ]; then
        FORCE_UPDATE_SERVICE=true
      else
        FORCE_UPDATE_SERVICE=false
      fi
      info "Force update service: $FORCE_UPDATE_SERVICE"
      ;;
    --force-update-service=*)
      val="${1#*=}"
      if [ "$val" = "true" ] || [ "$val" = "TRUE" ]; then
        FORCE_UPDATE_SERVICE=true
      else
        FORCE_UPDATE_SERVICE=false
      fi
      info "Force update service: $FORCE_UPDATE_SERVICE"
      ;;
    esac
    shift || info "dump usge, ${1}" || (
      usage
      exit 1
    )
  done

  # 如果是清理模式，執行清理後直接退出
  if [ "$CLEANUP_DEPLOYMENT" = "true" ]; then
    cleanup::deployment
    exit 0
  fi

  #set build docker information
  if [[ -n "$DEPLOY_SITE" && -n "$DEPLOY_TYPE" ]]; then
    info "Build image now"
    set::build_target "$DEPLOY_SITE" "$DEPLOY_TYPE"
  fi

  #build docker image
  if [ -n "$BUILD_IMAGE" ]; then
    info "Build image now"
    build::docker_image "$cmd"
  fi

  #push docker image
  if [ -n "$PUSH_IMAGE" ]; then
    info "push image now"
    push::docker_image
  fi

  #build yaml
  if [ -n "$BUILD_YAML" ]; then
    build::yaml
  fi

  #build static yaml (phidias-static nginx ingress deployment)
  if [ -n "$BUILD_STATIC_YAML" ]; then
    build::static_yaml
  fi

  #deploy manifest
  if [ -n "$DEPLOY_TO_SITE" ]; then
    deploy::manifest
  fi

  #deploy static manifest (phidias-static nginx ingress deployment)
  if [ -n "$DEPLOY_STATIC" ]; then
    deploy::static_manifest
  fi

  #build next yaml (phidias-standalone-next deployment)
  if [ -n "$BUILD_NEXT_YAML" ]; then
    build::next_yaml
  fi

  #deploy next manifest (phidias-standalone-next deployment)
  if [ -n "$DEPLOY_NEXT" ]; then
    deploy::next_manifest
  fi
  #return $DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME

}

main "$@"
