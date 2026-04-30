#!/bin/bash
# to generate CPE Test site config
usage() {
  me=$(basename "$0")
  printf "usage: bash $me -h [-s SITE] [-d DEPLOY] [-w WDIR] [-i INIT_KERBEROS] [-t UNIT_TEST]
      -s SITE               HQ/SZ/PSH...etc
      -d DEPLOY             test/staging/production/cypress
      -w WDIR               working dir
      -i INIT_KERBEROS      init Kerberos (TRUE: to init kerberos, others: don't init kerberos)
      -t UNIT_TEST          unit test (TRUE: to run unittest, others: don't run unittest)
      -h                    help message\n"
}
# option configuration
while getopts s:d:b:w:i:t:h option; do
  case "${option}" in

  s) SITE=${OPTARG} ;;
  d) DEPLOY=${OPTARG} ;;
  w) WDIR=${OPTARG} ;;
  i) INIT_KERBEROS=${OPTARG} ;;
  t) UNIT_TEST=${OPTARG} ;;
  h)
    usage
    exit 1
    ;;
  *)
    shift
    usage
    exit 1
    ;;
  esac
done

# dump args
echo "Args: site=$SITE, deploy=$DEPLOY"
# config env and generate site_config.py
export SITE=$SITE
export DEPLOY=$DEPLOY
export BUILD_TYPE=$DEPLOY
export WORKING_DIR=$WDIR

if [ "${DEPLOY}" == "test" ]; then
  export DOCKER_VERSION="dev_latest"
elif [ "${DEPLOY}" == "cypress" ]; then
  export DOCKER_VERSION="dev_latest"
elif [ "${DEPLOY}" == "staging" ]; then
  export DOCKER_VERSION="production_latest"
elif [ "${DEPLOY}" == "production" ]; then
  if [ "${CI_BUILD_REF_NAME}" == "" ]; then
    export DOCKER_VERSION="wrong_production_latest"
    echo "Error: if deploy==production, should set CI_BUILD_REF_NAME variable."
    exit 1
  else
    export DOCKER_VERSION=${CI_BUILD_REF_NAME}
  fi
else
  echo "Error: Unsupported deploy: $DEPLOY"
  exit 1
fi

echo "DOCKER_VERSION=$DOCKER_VERSION"

export WORKING_DIR=$(pwd)

echo "working_dir=$WORKING_DIR"

export PYTHONPATH=$WORKING_DIR:${WORKING_DIR}/server:${WORKING_DIR}/server/modules/push_metrics_module/src:${WORKING_DIR}/server/app:${WORKING_DIR}/server/modules/all_modules/src:/usr/lib/python3.11/site-packages


if [ "${INIT_KERBEROS}" == "TRUE" ]; then
  echo "Enable KERBEROS"
  KERBEROS_INIT=" -i"
else
  echo "Disable KERBEROS"
  KERBEROS_INIT=""
fi

if [ "${UNIT_TEST}" == "TRUE" ]; then
  echo "Enable test"
  TEST_INIT=" -t"
else
  echo "Disable test"
  TEST_INIT=""
fi

echo "Run python3 $WORKING_DIR/config_scripts/generate_site_config.py"
echo "python3 $WORKING_DIR/config_scripts/generate_site_config.py$KERBEROS_INIT$TEST_INIT "
python3 $WORKING_DIR/config_scripts/generate_site_config.py$KERBEROS_INIT$TEST_INIT || exit 1

echo "Setup local configuration finish"
