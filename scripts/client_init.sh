#!/bin/bash

CONFIG="/app/config/config.ini"
GENERAL_CONFIG="/app/config/general_config.ini"

if [ -f "$CONFIG" ]; then
  echo "Initial with specific config by site, bu and deployment."
  . /opt/scripts/parse_client_ini.sh /app/config/config.ini
else
  echo "Initial with default general config."
  . /opt/scripts/parse_client_ini.sh /app/config/general_config.ini
fi

export
npx serve -s dist -p 3000
