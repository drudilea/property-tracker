$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $root "logs"
$runDir = Join-Path $root "run"
$pidFile = Join-Path $runDir "bot.pid"
$logFile = Join-Path $logsDir "bot.log"
$errorFile = Join-Path $logsDir "bot-error.log"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Host "El bot ya esta corriendo (PID $existingPid)."
      exit 0
    }
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host "Node.js no esta instalado o no esta en PATH."
  exit 1
}

$process = Start-Process -FilePath $nodeCommand.Source `
  -ArgumentList "dist/bot.js" `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorFile `
  -PassThru

Set-Content -Path $pidFile -Value $process.Id
Write-Host "Bot iniciado en segundo plano (PID $($process.Id))."
Write-Host "Logs: $logFile"
