#!/bin/bash

site=$1
deploy=$2
echo "Run unit test (Deploy=$deploy, SITE=$site), Current PWD = $(pwd)"

# stop pipeline if pytest fail, please set STOP_ON_FAIL=1
export STOP_ON_FAIL=1

# Absolute path to this script, e.g. /home/user/bin/foo.sh
SCRIPT=$(readlink -f "$0")
# Absolute path this script is in, thus /home/user/bin
current_folder=$(dirname "$SCRIPT")
echo $current_folder
project_folder=$(readlink -f "$current_folder/../pegaverse-portal")
echo $project_folder
COV_DIR="${project_folder}/tmp_data/coverage"
mkdir -p ${COV_DIR}


echo $COV_DIR
#COV_SCORE_FN="tmp_data/badges/coverage.score"

coverage erase || exit 1

source $project_folder/setup_local_config.sh -s $site -d $deploy -t TRUE || exit 1

export

source $project_folder/setup_local_config.sh -s $site -d $deploy -b $bu -t TRUE || exit 1

python3 -m pytest -v --cov=$project_folder/app -c $project_folder/pytest.ini -s \
  --html=${COV_DIR}/pytest_report.html --self-contained-html $project_folder/tests || exit 1

PYTEST_ERR=$?

coverage report >"${project_folder}/tmp_data/badges/coverage.score" || exit 1
coverage html -d ${COV_DIR} || exit 1

python3 $project_folder/../scripts/ci_utils.py -f regex -i $project_folder/tmp_data/badges/coverage.score -r "TOTAL.+?(\d+\%)$" -o "tmp_data/badges/coverage.score" || exit 1
anybadge --overwrite --label coverage --value=$(cat tmp_data/badges/coverage.score) --suffix="%" --file=tmp_data/badges/coverage.svg 40=red 60=orange 80=yellow 100=green || exit 1

if [ $PYTEST_ERR == 1 ]; then
  echo "run pytest fail"
  anybadge --overwrite --label coverage --value=fail --file=tmp_data/badges/coverage.svg --color=red || exit 1
fi

if [ $STOP_ON_FAIL != 0 ]; then
  if [ $PYTEST_ERR == 1 ]; then
    echo "return error code"
    exit $PYTEST_ERR
  fi
fi
