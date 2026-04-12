# 1. Define the action script content
$TaskActionScript = {
    # Start the npm process in a new window so it stays running
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'P:\PRODUCTION\DomainAdminRiskDashBoard'; npm run dev"
    
    # Wait for the service to initialize
    Start-Sleep -Seconds 120
    
    # Open the dashboard
    Start-Process "http://10.1.55.10:3000"
}

# Convert the script block to a string for the task
$ScriptPath = "C:\Scripts\LaunchDashboard.ps1"
if (!(Test-Path "C:\Scripts")) { New-Item -ItemType Directory -Path "C:\Scripts" }
$TaskActionScript.ToString() | Out-File -FilePath $ScriptPath -Encoding utf8

# 2. Configure the Scheduled Task
$TaskName = "Launch_DomainAdminRiskDashBoard"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File $ScriptPath"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$User = "SYSTEM" # Or "DOMAIN\AdminUser" if the P: drive is a network mapping

# 3. Register the Task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -RunLevel Highest -User $User