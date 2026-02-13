# Remote Access Setup for RMS-WEB01
# Run this script once on both your laptop and the server

# ============================================
# PART 1: Run on RMS-WEB01 Server
# ============================================

function Setup-Server {
    Write-Host "Setting up RMS-WEB01 for remote access..." -ForegroundColor Green

    # Enable PowerShell Remoting
    Enable-PSRemoting -Force

    # Configure WinRM
    Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force

    # Allow WinRM through firewall
    Enable-NetFirewallRule -DisplayName "Windows Remote Management (HTTP-In)"

    # Set WinRM service to automatic
    Set-Service WinRM -StartupType Automatic
    Start-Service WinRM

    # Verify
    $wsmanTest = Test-WSMan
    if ($wsmanTest) {
        Write-Host "✓ WinRM is configured and running" -ForegroundColor Green
    } else {
        Write-Host "✗ WinRM configuration failed" -ForegroundColor Red
    }

    # Optional: Enable SSH (if not already enabled)
    Write-Host "Do you want to enable SSH server? (Y/N)" -ForegroundColor Yellow
    $enableSSH = Read-Host
    if ($enableSSH -eq "Y") {
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
        Start-Service sshd
        Set-Service -Name sshd -StartupType 'Automatic'
        Write-Host "✓ SSH Server enabled" -ForegroundColor Green
    }
}

# ============================================
# PART 2: Run on Your Laptop
# ============================================

function Setup-Client {
    param(
        [string]$ServerName = "rms-web01.rmslabs.local"
    )

    Write-Host "Setting up client for remote access to $ServerName..." -ForegroundColor Green

    # Add server to trusted hosts
    $currentHosts = (Get-Item WSMan:\localhost\Client\TrustedHosts).Value
    if ($currentHosts -notlike "*$ServerName*") {
        Set-Item WSMan:\localhost\Client\TrustedHosts -Value $ServerName -Concatenate -Force
        Write-Host "✓ Added $ServerName to trusted hosts" -ForegroundColor Green
    } else {
        Write-Host "✓ $ServerName already in trusted hosts" -ForegroundColor Green
    }

    # Test connection
    Write-Host "Testing connection to $ServerName..." -ForegroundColor Yellow
    try {
        Test-WSMan -ComputerName $ServerName
        Write-Host "✓ Connection successful!" -ForegroundColor Green
    } catch {
        Write-Host "✗ Connection failed: $_" -ForegroundColor Red
        Write-Host "Make sure WinRM is enabled on the server" -ForegroundColor Yellow
    }
}

# ============================================
# Main Menu
# ============================================

Write-Host @"
╔════════════════════════════════════════════╗
║  RMS-WEB01 Remote Access Setup            ║
╚════════════════════════════════════════════╝

Select your role:
1. Server (Run on RMS-WEB01)
2. Client (Run on your laptop)
3. Exit

"@ -ForegroundColor Cyan

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" { Setup-Server }
    "2" { Setup-Client }
    "3" { exit }
    default { Write-Host "Invalid choice" -ForegroundColor Red }
}
