# to skip build, please set the variable to != 0
export SKIP_BUILD=0

mkdir -p tmp/badges tmp/lint || exit 1

current_folder=$(dirname "$SCRIPT")
project_folder=$(readlink -f "$current_folder/../pegaverse-portal")

if [ $SKIP_BUILD != 0 ]
then
  anybadge --overwrite --label pylint --value=skip --file=tmp/badges/pylint.svg --color=lightgrey || exit 1
  exit 0
fi

pylint --exit-zero --output-format=text:tmp/pylint.txt,json:tmp/lint/pylint.json  --recursive=true $project_folder/app || exit 1
cat tmp/pylint.txt || exit 1
sed -n 's/^Your code has been rated at \([-0-9.]*\)\/.*/\1/p' tmp/pylint.txt > tmp/badges/pylint.score || exit 1
pylint-json2html tmp/lint/pylint.json -o tmp/lint/pylint.html  || exit 1

anybadge --overwrite --label pylint --value=$(cat tmp/badges/pylint.score) --file=tmp/badges/pylint.svg 4=red 6=orange 8=yellow 10=green  || exit 1
echo "Your score is: $(cat tmp/badges/pylint.score)"
