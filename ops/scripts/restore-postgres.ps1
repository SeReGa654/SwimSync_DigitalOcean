param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$ContainerName = "swimsync-postgres",
  [string]$DbName = "swimsync",
  [string]$DbUser = "swimsync"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

docker cp $BackupFile "$ContainerName`:/tmp/swimsync.restore.dump"
docker exec $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists /tmp/swimsync.restore.dump | Out-Null
docker exec $ContainerName rm -f /tmp/swimsync.restore.dump | Out-Null

Write-Host "PostgreSQL restore completed into DB: $DbName"
