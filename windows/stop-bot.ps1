$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "run\bot.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "No hay PID guardado. El bot no parece estar corriendo desde esta carpeta."
  exit 0
}

$pidValue = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if (-not $pidValue) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "El archivo PID esta vacio."
  exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if (-not $process) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "El proceso ya no estaba corriendo."
  exit 0
}

Stop-Process -Id $pidValue -Force
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Bot detenido (PID $pidValue)."
