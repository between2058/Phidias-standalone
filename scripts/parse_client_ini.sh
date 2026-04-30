#!/bin/bash
#ref: https://stackoverflow.com/a/47047583
set +a
while read p; do
  reSec='^\[(.*)\]$'
  #reNV='[ ]*([^ ]*)+[ ]*=(.*)'     #Remove only spaces around name
  reNV='[ ]*([^ ]*)+[ ]*=[ ]*(.*)' #Remove spaces around name and spaces before value
  if [[ $p =~ $reSec ]]; then
    section=${BASH_REMATCH[1]}
  elif [[ $p =~ $reNV ]]; then
    sNm=${BASH_REMATCH[1]}
    sVa=${BASH_REMATCH[2]}
    set -a
    if [[ "$section" == "COMMON" && "$sNm" == "bu" ]]; then
      eval "$(echo "BU"=\""$sVa"\")"
    fi
    set +a
  fi
done <$1
client_env=""
set +a
while read p; do
  reSec='^\[(.*)\]$'
  #reNV='[ ]*([^ ]*)+[ ]*=(.*)'     #Remove only spaces around name
  reNV='[ ]*([^ ]*)+[ ]*=[ ]*(.*)' #Remove spaces around name and spaces before value
  if [[ $p =~ $reSec ]]; then
    section=${BASH_REMATCH[1]}
  elif [[ $p =~ $reNV ]]; then
    #    sNm=${section}_${BASH_REMATCH[1]}
    sNm=${BASH_REMATCH[1]}
    sVa=${BASH_REMATCH[2]}
    set -a
    if [[ "$section" == "COMMON_C" ]]; then
      # eval "$(echo "$sNm"=\""$sVa"\")"
      client_env="$client_env $sNm=\"$sVa\""
    fi
    set +a
  fi

done <$1
echo $client_env
mkdir -p /app/dist
eval "$(echo "$client_env pnpm exec react-inject-env set -d /app/dist")"
