# RMS Risk Mitigation Dashboard

AD Domain Security Assessment Dashboard with automated reporting.

## Features

- **AD Secure Score Collector** - 45+ security checks across 7 categories
- **Domain Admin Account Risk Assessment** - Identifies and auto-disables inactive privileged accounts
- **Automated Email Reports** - Results sent via Office 365 SMTP
- **Interactive Dashboard** - Visualize security posture over time
- **Client Management** - Store and compare multiple client assessments

## Prerequisites

### For Dashboard (React/Next.js)
- Node.js 18+ 
- npm or yarn
- Windows Server or workstation with IIS/Apache (for production)

### For Data Collection Scripts
- Windows Server 2016+ or Windows 10/11
- Active Directory module for PowerShell (RSAT)
- Domain Admin credentials (for security scans)
- Network access to all DCs and servers

### For Email Notifications
- Office 365 account with SMTP access
- Credentials configured in scripts (default: RMSNotifications@ftechkzn.co.za)

## Quick Start

### 1. Clone the Repository
```powershell
git clone https://github.com/Nish-H/RMS-Risk-Mitigation-Dashboard.git
cd RMS-Risk-Mitigation-Dashboard
```

### 2. Install Dashboard Dependencies
```powershell
npm install
```

### 3. Run Dashboard Locally
```powershell
npm run dev
```
Dashboard runs at: http://localhost:3000

### 4. Run AD Security Scan
```powershell
cd C:\FTSupport\adreports\SecureScore
.\N1-Invoke-ADSecureScoreCollectorV8.6.ps1 -EmailTo "your@email.co.za"
```

## PowerShell Scripts

### AD Secure Score Collector v8.6
Collects 45+ security checks across 7 categories:

| Category | Checks |
|----------|--------|
| Identity & Access | Kerberoastable, Stale Admins, Dual-use, Protected Users, MFA |
| Password & Auth | Min Password Length, FGPP, Reversible Encryption, AS-REP Roasting, Password Age |
| GPO & Hardening | Default Domain Policy, LAPS, SMBv1, NTLMv1, Audit Policy, AppLocker |
| DC Health | FSMO Roles, Replication, DFSR, Functional Level, DNS, NTP |
| Hygiene | Stale Computers, Duplicate SPNs, Inactive Users, Guest Account, KRBTGT |
| Monitoring | Event Log Size, Log Retention, SIEM Forwarding, AV Coverage |
| Infrastructure | Server Uptime, Windows Update Status, Server AV Coverage |

**Usage:**
```powershell
# Basic run (sends email automatically)
.\N1-Invoke-ADSecureScoreCollectorV8.6.ps1

# Skip email
.\N1-Invoke-ADSecureScoreCollectorV8.6.ps1 -DisableEmail

# Custom recipient
.\N1-Invoke-ADSecureScoreCollectorV8.6.ps1 -EmailTo "security@company.co.za"

# Generate HTML report
.\N1-Invoke-ADSecureScoreCollectorV8.6.ps1 -GenerateHTML
```

### RMS Risk Mitigation (Domain Admin Accounts)
Scans domain for privileged accounts and auto-disables inactive FTech accounts.

**Usage:**
```powershell
.\RMS-RiskMitigation-FTechDomainAdminAccV16.3.ps1 -IncludeAllUsers
```

## Scoring Rules

### Minimum Password Length
- 14+ characters: 100% (Pass)
- 12 characters: 50% (Pass)
- 11 or below: 0% (Fail)

### Server Uptime (excludes Hyper-V hosts)
- < 10% needing reboot: Pass
- 10-25%: Warning
- > 25%: Fail

### Windows Update Status
- < 10% overdue: Pass
- 10-25%: Warning
- > 25%: Fail

### Service Account Restrictions
- GPO with logon restrictions: 100%
- Security group exists: 75% (Warning)
- No protection: 30% (Fail)

## Configuration

### Email Settings (in scripts)
```powershell
$EmailTo = "rmsreports@ftechkzn.co.za"  # Default recipient
$emailFrom = "RMSNotifications@ftechkzn.co.za"
# SMTP: smtp.office365.com:587
```

### Output Paths
```powershell
$OutputPath = "C:\FTSupport\adreports\SecureScore"
```

## Client Data

Client JSON files are stored in `ADSecureScoreData/` folder:
```
ADSecureScoreData/
├── ad_secure_score_clientname_2026-01-01.json
├── ad_secure_score_clientname_2026-02-01.json
└── securescore_history.json
```

To add a new client:
1. Run the collector script on client's domain
2. Import the JSON via Dashboard Import button

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/ad-secure-clients` | List all clients |
| `/api/ad-secure-import` | Import new JSON data |
| `/api/ad-secure-save` | Save assessment data |

## Troubleshooting

### RSAT Not Installed
```powershell
# Install RSAT via PowerShell
Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
```

### Script Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

### Cannot Connect to Remote Servers
- Ensure WinRM is enabled: `Enable-PSRemoting`
- Check firewall rules
- Verify network connectivity

## License

Internal use only - First Technology KwaZulu-Natal