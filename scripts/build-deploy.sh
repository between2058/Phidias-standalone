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

DEPLOY_TAMPLE_FILE=scripts/k8s-deploy-sample.yaml
gitOpsYamlName='app-portal.yaml'
site_list="HQ"

      # Before applying, detect nodePort ownership conflicts and optionally resolve them
      info "Checking NodePort ownership for services in $DEPLOY_YAML"
      # Extract service name + nodePort pairs from the yaml (requires tools/yq)
      mapfile -t SVC_PORTS < <(tools/yq e '. | select(.kind == "Service") | (.metadata.name + " " + (.spec.ports[]? | (.nodePort|tostring)))' "$DEPLOY_YAML" 2>/dev/null || true)

      if [ ${#SVC_PORTS[@]} -gt 0 ]; then
        for entry in "${SVC_PORTS[@]}"; do
          svc_name=$(echo "$entry" | awk '{print $1}')
          nodeport=$(echo "$entry" | awk '{print $2}')
          if [ -z "$nodeport" ]; then
            continue
          fi

          # Find any services in cluster that currently report this nodePort
          owners=$(tools/kubectl get svc --all-namespaces --kubeconfig "$KUBECONFIG_FILE" -o jsonpath='{range .items[*]}{.metadata.namespace} " " {.metadata.name} " " {.spec.ports[*].nodePort} "\n"{end}' 2>/dev/null | awk -v p="$nodeport" '$NF==p {print $1" "$2}')

          if [ -n "$owners" ]; then
            while read -r onamespace oname; do
              # If owner is same name in same namespace pegaverse -> OK
              if [ "$onamespace" = "pegaverse" ] && [ "$oname" = "$svc_name" ]; then
                info "NodePort ${nodeport} already owned by same service ${onamespace}/${oname} - OK"
                continue
              fi

              # Conflict: different service owns this nodePort
              if [ "$FORCE_UPDATE_SERVICE" = "true" ]; then
                info "Conflict: nodePort ${nodeport} owned by ${onamespace}/${oname}. Backing up and deleting because --force-update-service=true"
                tools/kubectl get svc "$oname" -n "$onamespace" --kubeconfig "$KUBECONFIG_FILE" -o yaml > "/tmp/backup-svc-${onamespace}-${oname}.yaml" || warn "Failed to backup ${onamespace}/${oname}"
                tools/kubectl delete svc "$oname" -n "$onamespace" --kubeconfig "$KUBECONFIG_FILE" || { error "Failed to delete conflicting service ${onamespace}/${oname}"; exit 1; }
              else
                error "NodePort ${nodeport} in ${DEPLOY_YAML} is already allocated by ${onamespace}/${oname}. Aborting. Use --force-update-service to remove conflicting service automatically (dangerous)."
                exit 1
              fi
            done <<< "$owners"
          fi
        done
      fi
DEPLOY_TO_SITE=""
DEPLOY_SITE=""
BUILD_IMAGE=""
PUSH_IMAGE=""
BUILD_YAML=""

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

# Assume the running folder is the root of the project
# Step 1: build client bash

build::docker_image() {
  info "Docker login to $LOCAL_DOCKER_HUB"
  docker login $LOCAL_DOCKER_HUB -u $DOCKER_ACCOUNT --password $DOCKER_PWD || exit 1
  info "Remove old docker image:"
  docker rmi $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME || true
  info "Build docker image: $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME"
  docker build --cpu-period=200000 --cpu-quota=200000 -m 4g \
    -t $LOCAL_DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME \
    --build-arg BUILD_FOLDER="$DOCKER_BUILD_FOLDER" \
    --build-arg http_proxy="${Gitlab_http_proxy}" \
    --build-arg https_proxy="${Gitlab_http_proxy}" \
    --build-arg HTTP_PROXY="${Gitlab_http_proxy}" \
    --build-arg HTTPS_PROXY="${Gitlab_http_proxy}" \
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

  info "Allocated Client NodePort: ${NEW_CLIENT_PORT}"
  info "Allocated Server NodePort: ${NEW_SERVER_PORT}"

  export ALLOCATED_CLIENT_PORT=$NEW_CLIENT_PORT
  export ALLOCATED_SERVER_PORT=$NEW_SERVER_PORT
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
  else
    info "Entering master branch mode"
    # Master branch: 使用原始命名
    local DEPLOYMENT_SUFFIX=""
    local CONFIGMAP_NAME="config-ini-configmaps"
    CLIENT_NODEPORT=${COMMON_C_NODEPORT}
    SERVER_NODEPORT=${COMMON_NODEPORT}
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

  DOCKER_HUB=${COMMON_docker_server}
  DOCKER_ACCOUNT=${COMMON_docker_account}
  DOCKER_PWD=${COMMON_docker_pwd}

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
      if [[ "$cmd" == *"client"* || "$cmd" == *"server"* || "$cmd" == *"cypress"* ]]; then
        info "Build image: $cmd"
        set::build_image "$cmd"
      else
        error "(-bi / --build-image) Only support front / server / cypress"
      fi
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
    build::docker_image
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

  #deploy manifest
  if [ -n "$DEPLOY_TO_SITE" ]; then
    deploy::manifest
  fi
  #return $DOCKER_HUB/$DOCKER_PRJ_NAME/$DOCKER_IMG_NAME:$DOCKER_TAG_NAME

}

main "$@"
