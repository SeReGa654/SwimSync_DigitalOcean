param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$TargetPath = "backend\prisma\dev.db"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$targetDir = Split-Path -Parent $TargetPath
if ($targetDir) {
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

Copy-Item -Path $BackupFile -Destination $TargetPath -Force
Write-Host "SQLite restore completed: $TargetPath"
