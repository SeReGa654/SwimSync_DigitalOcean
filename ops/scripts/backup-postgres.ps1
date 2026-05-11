param(
  [string]$ContainerName = "swimsync-postgres",
  [string]$DbName = "swimsync",
  [string]$DbUser = "swimsync",
  [string]$BackupDir = "backups\postgres"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $BackupDir "swimsync-$timestamp.dump"

docker exec $ContainerName pg_dump -U $DbUser -d $DbName -Fc -f /tmp/swimsync.dump | Out-Null
docker cp "$ContainerName`:/tmp/swimsync.dump" $target
docker exec $ContainerName rm -f /tmp/swimsync.dump | Out-Null

Write-Host "PostgreSQL backup created: $target"
