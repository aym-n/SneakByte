#!/bin/bash

NUM_BOTS=$1
START_PORT=8081

if [ -z "$NUM_BOTS" ]; then
  echo "Usage: ./run-discovery.sh <number_of_bots>"
  exit 1
fi

mkdir -p logs

for (( i=0; i<$NUM_BOTS; i++ ))
do
  PORT=$((START_PORT + i))
  BOT_NAME="Bot$i"

  if command -v uuidgen >/dev/null 2>&1; then
    BOT_ID=$(uuidgen | cut -d'-' -f1)
  else
    BOT_ID=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 6 | head -n 1)
  fi

  echo "[BOT] Starting $BOT_NAME (ID: $BOT_ID) on port $PORT"

  BOT_ID=$BOT_ID BOT_NAME=$BOT_NAME WS_PORT=$PORT node Bots/dummy.js > logs/${BOT_NAME}.log 2>&1 &

  PIDS[$i]=$!
done

sleep 1

echo "[HOST] Starting host discovery"
node Backend/discovery.js

