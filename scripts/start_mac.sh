#!/usr/bin/env bash
set -euo pipefail

IMAGE="finally"
CONTAINER="finally-app"
VOLUME="finally-data"
PORT=8000

# Parse --build flag
FORCE_BUILD=false
for arg in "$@"; do
    [[ "$arg" == "--build" ]] && FORCE_BUILD=true
done

# Build image if it doesn't exist or --build was passed
if [[ "$FORCE_BUILD" == "true" ]] || ! docker image inspect "$IMAGE" &>/dev/null; then
    echo "Building $IMAGE image..."
    docker build -t "$IMAGE" "$(dirname "$0")/.."
fi

# Stop and remove existing container if running
if docker container inspect "$CONTAINER" &>/dev/null; then
    echo "Stopping existing $CONTAINER container..."
    docker stop "$CONTAINER" && docker rm "$CONTAINER"
fi

# Start the container
echo "Starting $CONTAINER..."
docker run -d \
    --name "$CONTAINER" \
    -v "$VOLUME:/app/db" \
    -p "$PORT:8000" \
    --env-file "$(dirname "$0")/../.env" \
    "$IMAGE"

echo ""
echo "FinAlly is running at http://localhost:$PORT"
echo "Stop with: ./scripts/stop_mac.sh"
