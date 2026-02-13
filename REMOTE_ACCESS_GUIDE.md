# Remote Access Guide for RMS-WEB01

## Overview
Manage RMS-WEB01 server remotely from your laptop without RDP, using PowerShell Remoting.

## Prerequisites
- RMS-WEB01 is accessible via network (DNS resolves via lmhost)
- You have admin credentials for RMS-WEB01
- Both machines can communicate over network

---

## Quick Start (5 Minutes Setup)

### **Step 1: Enable Remote Access on RMS-WEB01**

RDP to RMS-WEB01 **one last time** and run:

```powershell
# Run PowerShell as Administrator
Enable-PSRemoting -Force
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
```

### **Step 2: Configure Your Laptop**

On your laptop, run PowerShell as Administrator:

```powershell
# Add server to trusted hosts
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "rms-web01.rmslabs.local" -Force

# Test connection (enter RMS-WEB01 credentials when prompted)
Test-WSMan -ComputerName rms-web01.rmslabs.local
```

### **Step 3: You're Done! Start Using Remote Commands**

---

## Usage Examples

### **Interactive Session (Like SSH)**

```powershell
# From your laptop
$cred = Get-Credential  # Enter RMS-WEB01 credentials
Enter-PSSession -ComputerName rms-web01.rmslabs.local -Credential $cred

# Now you're on the server!
PS C:\> cd R:\
PS R:\> npm run dev
PS R:\> exit  # Disconnect
```

### **One-Time Commands**

```powershell
# Save credentials once
$cred = Get-Credential

# Run single command
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    cd R:\
    npm run build
}
```

### **Multiple Commands**

```powershell
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    cd R:\
    git pull
    npm install
    npm run build
    npm start
}
```

---

## Using the Helper Scripts

Two PowerShell scripts have been created for you:

### **1. Remote Setup Script**

**Location**: `R:\scripts\remote-setup.ps1`

Run this once to configure remote access:

```powershell
# On RMS-WEB01:
.\scripts\remote-setup.ps1
# Choose option 1 (Server)

# On your laptop:
.\scripts\remote-setup.ps1
# Choose option 2 (Client)
```

### **2. Remote Commands Script**

**Location**: `R:\scripts\remote-commands.ps1`

Interactive menu with common operations:

```powershell
# From your laptop (after copying the script)
.\remote-commands.ps1
```

**Menu Options:**
- Start Dev Server
- Start Prod Server
- Build Project
- Install Dependencies
- Pull Git Changes
- Stop Node Processes
- Full Deployment
- View Logs
- Interactive Session

**Quick Commands:**
```powershell
# Quick deployment
.\remote-commands.ps1 -QuickDeploy

# Quick build
.\remote-commands.ps1 -QuickBuild

# Interactive session
.\remote-commands.ps1 -Interactive
```

---

## Common Tasks

### **Deploy Latest Changes**

```powershell
$cred = Get-Credential
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    cd R:\
    git pull
    npm install
    npm run build
}
```

### **Restart the Application**

```powershell
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    cd R:\
    Get-Process node | Stop-Process -Force
    Start-Process npm -ArgumentList "start" -NoNewWindow
}
```

### **View Logs**

```powershell
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    Get-Content R:\Logs\*.log -Tail 50
}
```

### **Check Server Status**

```powershell
Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {
    Get-Process node
    Get-Service | Where-Object {$_.Name -like "*node*"}
}
```

---

## Troubleshooting

### **"Access Denied" Error**

Make sure you're using admin credentials for RMS-WEB01:
```powershell
$cred = Get-Credential -UserName "RMSLABS\AdminUser"
```

### **"Target Machine Actively Refused Connection"**

WinRM not enabled on server. RDP to server and run:
```powershell
Enable-PSRemoting -Force
```

### **"The WinRM client cannot process the request"**

Add server to trusted hosts:
```powershell
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "rms-web01.rmslabs.local" -Force
```

### **DNS Resolution Issues**

Use IP address instead:
```powershell
Enter-PSSession -ComputerName 192.168.x.x -Credential $cred
```

### **Firewall Blocking**

On RMS-WEB01:
```powershell
Enable-NetFirewallRule -DisplayName "Windows Remote Management (HTTP-In)"
```

---

## Security Considerations

### **Credential Storage**

Don't hardcode passwords! Use credential storage:

```powershell
# Save credentials securely (one time)
$cred = Get-Credential
$cred | Export-Clixml -Path "$env:USERPROFILE\rms-web01-cred.xml"

# Load credentials
$cred = Import-Clixml -Path "$env:USERPROFILE\rms-web01-cred.xml"
```

### **Restrict Trusted Hosts**

Instead of wildcard, use specific hosts:
```powershell
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "rms-web01.rmslabs.local,laptop1,laptop2"
```

### **Use HTTPS for WinRM** (Advanced)

Configure WinRM with SSL certificate for encrypted communication.

---

## Alternative: SSH Access

If you prefer SSH over PowerShell Remoting:

### **Enable SSH on RMS-WEB01**

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'

# Allow through firewall
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

### **Connect from Laptop**

```bash
ssh username@rms-web01.rmslabs.local

# Then navigate and run commands
cd /mnt/r
npm run dev
```

---

## Automation Examples

### **Scheduled Deployment Script**

Save this on your laptop to automate deployments:

```powershell
# deploy-to-rms.ps1
param([switch]$AutoStart)

$server = "rms-web01.rmslabs.local"
$cred = Import-Clixml -Path "$env:USERPROFILE\rms-web01-cred.xml"

Write-Host "Deploying to $server..." -ForegroundColor Cyan

Invoke-Command -ComputerName $server -Credential $cred -ScriptBlock {
    param($autoStart)

    cd R:\

    # Stop running processes
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

    # Pull latest code
    git pull

    # Install dependencies
    npm install

    # Build
    npm run build

    # Start if requested
    if ($autoStart) {
        npm start
    }

} -ArgumentList $AutoStart

Write-Host "✓ Deployment complete!" -ForegroundColor Green
```

**Usage:**
```powershell
.\deploy-to-rms.ps1 -AutoStart
```

---

## Best Practices

1. **Save Credentials**: Use `Export-Clixml` to save credentials securely
2. **Test First**: Always test with `Test-WSMan` before running commands
3. **Error Handling**: Wrap commands in try/catch blocks
4. **Logging**: Keep logs of remote operations
5. **Backup**: Always backup before deployment
6. **Version Control**: Use Git to track changes

---

## Quick Reference

| Task | Command |
|------|---------|
| Interactive Session | `Enter-PSSession -ComputerName rms-web01.rmslabs.local -Credential $cred` |
| Run Command | `Invoke-Command -ComputerName rms-web01.rmslabs.local -Credential $cred -ScriptBlock {...}` |
| Copy Files TO Server | `Copy-Item -Path local.txt -Destination \\rms-web01.rmslabs.local\R$\ -Credential $cred` |
| Copy Files FROM Server | `Copy-Item -Path \\rms-web01.rmslabs.local\R$\file.txt -Destination . -Credential $cred` |
| Test Connection | `Test-WSMan -ComputerName rms-web01.rmslabs.local` |

---

**Support**: Contact NishenH for issues or questions about remote access.

**Last Updated**: November 2025
