#Requires -Version 5.1

$Container = "finally-app"

$ContainerExists = docker container inspect $Container 2>$null
if ($ContainerExists) {
    Write-Host "Stopping $Container..."
    docker stop $Container | Out-Null
    docker rm $Container | Out-Null
    Write-Host "Container stopped. Data volume preserved."
} else {
    Write-Host "Container $Container is not running."
}
