#!/usr/bin/env bash
set -euo pipefail

CONTAINER="finally-app"

if docker container inspect "$CONTAINER" &>/dev/null; then
    echo "Stopping $CONTAINER..."
    docker stop "$CONTAINER"
    docker rm "$CONTAINER"
    echo "Container stopped. Data volume preserved."
else
    echo "Container $CONTAINER is not running."
fi
