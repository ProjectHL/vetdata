$ErrorActionPreference = 'Stop'
$composeFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../docker-compose.phase7-verify.yml'))
function Invoke-Compose {
    & docker compose -f $composeFile @args
    if ($LASTEXITCODE -ne 0) { throw "Phase 7 verification command failed (exit $LASTEXITCODE)" }
}
function Wait-Healthy([string]$service) {
    $container = & docker compose -f $composeFile ps -q $service
    if ($LASTEXITCODE -ne 0 -or !$container) { throw "Missing fixture service: $service" }
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $health = & docker inspect --format '{{.State.Health.Status}}' $container
        if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { return }
        Start-Sleep -Seconds 1
    }
    throw "Fixture service did not become healthy: $service"
}
# Only this dedicated fixture project is cleaned. Never use production Compose.
Invoke-Compose down --volumes
Invoke-Compose up --build -d db setup recovery restored-api web proxy
Wait-Healthy 'restored-api'
Invoke-Compose run --rm --no-deps smoke
Invoke-Compose run --rm --no-deps --entrypoint sh recovery /ops/verify-alerts.sh
Invoke-Compose restart db
Wait-Healthy 'db'
Invoke-Compose restart restored-api
Wait-Healthy 'restored-api'
Invoke-Compose run --rm --no-deps smoke
Write-Output 'PASS: recovery, authenticated HTTPS and persistent DB/API restart'
Write-Output 'Fixture services retained for inspection; clean with this exact Compose file and down --volumes.'
