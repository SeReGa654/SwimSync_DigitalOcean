param(
  [string]$TaskName = "SwimSync-Recovery-Drill",
  [ValidateSet("DAILY", "WEEKLY")]
  [string]$Frequency = "WEEKLY",
  [string]$At = "03:00",
  [ValidateSet("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")]
  [string]$WeekDay = "Sunday",
  [string]$ContainerName = "swimsync-postgres",
  [string]$DbName = "swimsync",
  [string]$DbUser = "swimsync"
)

$ErrorActionPreference = "Stop"

$drillScript = Join-Path $PSScriptRoot "drill-recovery.ps1"
if (-not (Test-Path $drillScript)) {
  throw "Recovery drill script not found: $drillScript"
}

$actionArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$drillScript`"",
  "-ContainerName", "`"$ContainerName`"",
  "-DbName", "`"$DbName`"",
  "-DbUser", "`"$DbUser`""
) -join " "

$trigger = if ($Frequency -eq "DAILY") {
  New-ScheduledTaskTrigger -Daily -At $At
} else {
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek $WeekDay -At $At
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -StartWhenAvailable

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "SwimSync periodic disaster-recovery drill using ops/scripts/drill-recovery.ps1" | Out-Null

Write-Host "Scheduled task '$TaskName' registered ($Frequency at $At)."
