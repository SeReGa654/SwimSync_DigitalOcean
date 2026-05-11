param(
  [string]$SourcePath = "backend\prisma\dev.db",
  [string]$BackupDir = "backups\sqlite"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourcePath)) {
  throw "SQLite DB not found at $SourcePath"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $BackupDir "dev-$timestamp.db"
Copy-Item -Path $SourcePath -Destination $target -Force
Write-Host "SQLite backup created: $target"
