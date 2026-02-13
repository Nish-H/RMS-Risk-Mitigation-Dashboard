# Remote Command Execution Scripts for RMS-WEB01
# Use these from your laptop to manage the server

$ServerName = "rms-web01.rmslabs.local"
$ProjectPath = "R:\"

# ============================================
# Helper Functions
# ============================================

function Get-ServerCredential {
    if (-not $global:ServerCred) {
        Write-Host "Enter credentials for $ServerName" -ForegroundColor Yellow
        $global:ServerCred = Get-Credential
    }
    return $global:ServerCred
}

function Invoke-RemoteCommand {
    param(
        [string]$Command,
        [string]$Description
    )

    Write-Host "`n$Description..." -ForegroundColor Cyan
    $cred = Get-ServerCredential

    try {
        Invoke-Command -ComputerName $ServerName -Credential $cred -ScriptBlock {
            param($path, $cmd)
            cd $path
            Invoke-Expression $cmd
        } -ArgumentList $ProjectPath, $Command
        Write-Host "✓ Success" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed: $_" -ForegroundColor Red
    }
}

# ============================================
# NPM Commands
# ============================================

function Start-DevServer {
    Invoke-RemoteCommand -Command "npm run dev" -Description "Starting development server"
}

function Start-ProdServer {
    Invoke-RemoteCommand -Command "npm start" -Description "Starting production server"
}

function Build-Project {
    Invoke-RemoteCommand -Command "npm run build" -Description "Building project"
}

function Install-Dependencies {
    Invoke-RemoteCommand -Command "npm install" -Description "Installing dependencies"
}

# ============================================
# Git Commands
# ============================================

function Update-FromGit {
    Invoke-RemoteCommand -Command "git pull" -Description "Pulling latest changes from Git"
}

function Get-GitStatus {
    Invoke-RemoteCommand -Command "git status" -Description "Getting Git status"
}

# ============================================
# Service Management
# ============================================

function Restart-NodeService {
    param([string]$ServiceName = "YourNodeServiceName")

    $cred = Get-ServerCredential
    Invoke-Command -ComputerName $ServerName -Credential $cred -ScriptBlock {
        param($svc)
        Restart-Service -Name $svc -Force
    } -ArgumentList $ServiceName
    Write-Host "✓ Service restarted" -ForegroundColor Green
}

function Stop-NodeProcess {
    Invoke-RemoteCommand -Command "Get-Process node | Stop-Process -Force" -Description "Stopping all Node processes"
}

# ============================================
# File Operations
# ============================================

function Get-RemoteFiles {
    param([string]$Pattern = "*")

    Invoke-RemoteCommand -Command "Get-ChildItem -Path . -Filter '$Pattern' | Select-Object Name, Length, LastWriteTime" -Description "Listing files"
}

function Get-RemoteLogs {
    param([int]$Lines = 50)

    Invoke-RemoteCommand -Command "Get-Content .\Logs\*.log -Tail $Lines" -Description "Getting recent logs"
}

# ============================================
# Full Deployment
# ============================================

function Deploy-Application {
    Write-Host @"
╔════════════════════════════════════════════╗
║  Full Deployment to RMS-WEB01             ║
╚════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

    $cred = Get-ServerCredential

    Invoke-Command -ComputerName $ServerName -Credential $cred -ScriptBlock {
        param($path)
        cd $path

        Write-Host "1. Stopping processes..." -ForegroundColor Yellow
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

        Write-Host "2. Pulling latest changes..." -ForegroundColor Yellow
        git pull

        Write-Host "3. Installing dependencies..." -ForegroundColor Yellow
        npm install

        Write-Host "4. Building application..." -ForegroundColor Yellow
        npm run build

        Write-Host "5. Starting production server..." -ForegroundColor Yellow
        Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "start"

        Write-Host "`n✓ Deployment complete!" -ForegroundColor Green
    } -ArgumentList $ProjectPath
}

# ============================================
# Interactive Session
# ============================================

function Enter-RemoteSession {
    Write-Host "Connecting to $ServerName..." -ForegroundColor Cyan
    Write-Host "Type 'exit' to disconnect`n" -ForegroundColor Yellow

    $cred = Get-ServerCredential
    Enter-PSSession -ComputerName $ServerName -Credential $cred
}

# ============================================
# Main Menu
# ============================================

function Show-Menu {
    Clear-Host
    Write-Host @"
╔════════════════════════════════════════════╗
║  RMS-WEB01 Remote Management              ║
║  Server: $ServerName
╚════════════════════════════════════════════╝

NPM Commands:
  1. Start Dev Server (npm run dev)
  2. Start Prod Server (npm start)
  3. Build Project (npm run build)
  4. Install Dependencies (npm install)

Git Commands:
  5. Pull Latest Changes (git pull)
  6. Show Git Status

Process Management:
  7. Stop All Node Processes
  8. Full Deployment (pull, build, start)

File Operations:
  9. List Files
 10. View Recent Logs

Advanced:
 11. Enter Interactive Session
 12. Custom Command

  0. Exit

"@ -ForegroundColor Cyan

    $choice = Read-Host "Enter choice"

    switch ($choice) {
        "1"  { Start-DevServer; pause }
        "2"  { Start-ProdServer; pause }
        "3"  { Build-Project; pause }
        "4"  { Install-Dependencies; pause }
        "5"  { Update-FromGit; pause }
        "6"  { Get-GitStatus; pause }
        "7"  { Stop-NodeProcess; pause }
        "8"  { Deploy-Application; pause }
        "9"  { Get-RemoteFiles; pause }
        "10" { Get-RemoteLogs; pause }
        "11" { Enter-RemoteSession }
        "12" {
            $cmd = Read-Host "Enter command to execute"
            Invoke-RemoteCommand -Command $cmd -Description "Running custom command"
            pause
        }
        "0"  { exit }
        default { Write-Host "Invalid choice" -ForegroundColor Red; pause }
    }

    if ($choice -ne "0" -and $choice -ne "11") {
        Show-Menu
    }
}

# ============================================
# Quick Functions (can be called directly)
# ============================================

# Example: .\remote-commands.ps1 -QuickDeploy
param(
    [switch]$QuickDeploy,
    [switch]$QuickBuild,
    [switch]$QuickStart,
    [switch]$Interactive
)

if ($QuickDeploy) {
    Deploy-Application
} elseif ($QuickBuild) {
    Build-Project
} elseif ($QuickStart) {
    Start-ProdServer
} elseif ($Interactive) {
    Enter-RemoteSession
} else {
    # Show interactive menu
    Show-Menu
}
