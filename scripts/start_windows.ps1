#Requires -Version 5.1
param(
    [switch]$Build
)

$Image = "finally"
$Container = "finally-app"
$Volume = "finally-data"
$Port = 8000
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot ".env"

# Build image if it doesn't exist or -Build was passed
$ImageExists = docker image inspect $Image 2>$null
if ($Build -or -not $ImageExists) {
    Write-Host "Building $Image image..."
    docker build -t $Image $ProjectRoot
}

# Stop and remove existing container if it exists
$ContainerExists = docker container inspect $Container 2>$null
if ($ContainerExists) {
    Write-Host "Stopping existing $Container container..."
    docker stop $Container | Out-Null
    docker rm $Container | Out-Null
}

# Start the container
Write-Host "Starting $Container..."
docker run -d `
    --name $Container `
    -v "${Volume}:/app/db" `
    -p "${Port}:8000" `
    --env-file $EnvFile `
    $Image

Write-Host ""
Write-Host "FinAlly is running at http://localhost:$Port"
Write-Host "Stop with: .\scripts\stop_windows.ps1"
