param(
  [string]$ContainerName = "swimsync-postgres",
  [string]$DbName = "swimsync",
  [string]$DbUser = "swimsync"
)

$ErrorActionPreference = "Stop"

Write-Host "Starting disaster-recovery drill..."

$backupScript = Join-Path $PSScriptRoot "backup-postgres.ps1"
& $backupScript -ContainerName $ContainerName -DbName $DbName -DbUser $DbUser

$latestBackup = Get-ChildItem -Path "backups\postgres" -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latestBackup) {
  throw "No PostgreSQL backup found after backup step."
}

$restoreScript = Join-Path $PSScriptRoot "restore-postgres.ps1"
& $restoreScript -BackupFile $latestBackup.FullName -ContainerName $ContainerName -DbName $DbName -DbUser $DbUser

docker exec $ContainerName psql -U $DbUser -d $DbName -c "SELECT NOW();" | Out-Null
Write-Host "Disaster-recovery drill completed successfully."
