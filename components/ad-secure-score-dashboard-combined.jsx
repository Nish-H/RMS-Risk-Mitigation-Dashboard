
import { useState, useRef, useCallback, useEffect } from "react";
import { deriveClientNameFromDomain } from "../clientNameUtils";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "identity",   label: "Identity & Access", weight: 22, color: "#00d4ff", icon: "🔐" },
  { id: "password",   label: "Password & Auth",   weight: 18, color: "#ff6b35", icon: "🔑" },
  { id: "gpo",        label: "GPO & Hardening",   weight: 18, color: "#a855f7", icon: "🛡️" },
  { id: "dchealth",   label: "DC Health",          weight: 18, color: "#22c55e", icon: "🖥️" },
  { id: "hygiene",    label: "AD Hygiene",          weight: 9, color: "#f59e0b", icon: "🧹" },
  { id: "monitoring", label: "Monitoring & Logs",   weight: 5,  color: "#ec4899", icon: "📊" },
  { id: "infrastructure", label: "Infrastructure", weight: 10, color: "#f43f5e", icon: "🏗️" },
];

const SEV_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" };
const statusColor = s => s === "Pass" ? "#22c55e" : s === "Warning" ? "#eab308" : "#ef4444";
const scoreColor  = s => s >= 85 ? "#22c55e" : s >= 70 ? "#eab308" : s >= 50 ? "#f97316" : "#ef4444";
const scoreLabel  = s => s >= 85 ? "Good" : s >= 70 ? "Average" : s >= 50 ? "High Risk" : "Critical";

// ─── Remediation Library ──────────────────────────────────────────────────────

const REMEDIATION_LIBRARY = {
  kerberoastable: {
    title: "Remove SPNs from Privileged Accounts",
    steps: [
      "Enumerate all SPNs on privileged accounts: Get-ADUser -Filter {ServicePrincipalName -like '*'} -Properties ServicePrincipalName,MemberOf",
      "Identify which SPNs are legitimate service accounts vs privileged user accounts",
      "Migrate services to Group Managed Service Accounts (gMSA): New-ADServiceAccount -Name 'svc-app' -DNSHostName 'app.domain.com' -PrincipalsAllowedToRetrieveManagedPassword 'Domain Computers'",
      "Remove SPNs from privileged accounts: Set-ADUser -Identity <account> -ServicePrincipalNames @{Remove='<SPN>'}",
      "Validate no privileged accounts retain SPNs post-migration",
    ],
    cmd: `# Step 1 — Find all Kerberoastable privileged accounts
Get-ADUser -Filter {ServicePrincipalName -like "*" -and Enabled -eq $true} \`
  -Properties ServicePrincipalName,MemberOf,AdminCount | \`
  Where {$_.AdminCount -eq 1 -or $_.MemberOf -match "Domain Admins"} | \`
  Select Name,SamAccountName,ServicePrincipalName | \`
  Export-Csv C:\\Temp\\KerberoastableAccounts.csv -NoTypeInformation

# Step 2 — Remove SPN from account (replace values)
Set-ADUser -Identity "svc-account" \`
  -ServicePrincipalNames @{Remove="MSSQLSvc/server.domain.com:1433"}

# Step 3 — Create gMSA replacement
New-ADServiceAccount -Name "gmsa-sqlsvc" \`
  -DNSHostName "sql.domain.com" \`
  -PrincipalsAllowedToRetrieveManagedPassword "SQL_Servers"
Install-ADServiceAccount -Identity "gmsa-sqlsvc"`,
    effort: "Medium", priority: 1, tags: ["Identity", "Kerberos", "Tier0"]
  },
  pwdNeverExpires: {
    title: "Enforce Password Expiry Policy",
    steps: [
      "Export all accounts with PasswordNeverExpires = True",
      "Identify legitimate service accounts — migrate to gMSA where possible",
      "For remaining service accounts, document the business justification",
      "Enforce password expiry on all non-service accounts",
      "Create a Fine-Grained Password Policy (PSO) for documented service accounts",
    ],
    cmd: `# Audit non-expiring accounts
Get-ADUser -Filter {PasswordNeverExpires -eq $true -and Enabled -eq $true} \`
  -Properties PasswordNeverExpires,PasswordLastSet,LastLogonDate,Description | \`
  Sort PasswordLastSet | \`
  Select Name,SamAccountName,PasswordLastSet,Description | \`
  Export-Csv C:\\Temp\\NeverExpireAudit.csv -NoTypeInformation

# Enforce expiry on all non-service accounts (review CSV first)
# Exclude accounts matching 'svc','service','gmsa' naming patterns
Get-ADUser -Filter {PasswordNeverExpires -eq $true -and Enabled -eq $true} | \`
  Where {$_.SamAccountName -notmatch "svc|service|gmsa|krbtgt"} | \`
  Set-ADUser -PasswordNeverExpires $false

# Verify
Get-ADUser -Filter {PasswordNeverExpires -eq $true} | Measure-Object`,
    effort: "Low", priority: 2, tags: ["Identity", "Password", "Policy"]
  },
  staleAdmins: {
    title: "Remediate Stale Admin Accounts",
    steps: [
      "Run stale admin account discovery (no logon >90 days)",
      "Contact account owners / line managers for each stale account",
      "Disable accounts with no valid business justification",
      "Move disabled accounts to 'Disabled Accounts' OU",
      "After 30-day hold: delete accounts and remove group memberships",
      "Implement quarterly admin account review process",
    ],
    cmd: `# Find stale privileged accounts
$cutoff = (Get-Date).AddDays(-90)
Get-ADUser -Filter {Enabled -eq $true -and AdminCount -eq 1} \`
  -Properties LastLogonDate,MemberOf,Description | \`
  Where {$_.LastLogonDate -lt $cutoff -or $null -eq $_.LastLogonDate} | \`
  Select Name,SamAccountName,LastLogonDate,Description | \`
  Export-Csv C:\\Temp\\StaleAdmins.csv -NoTypeInformation

# Disable stale admin accounts (review CSV first!)
$staleAdmins = Import-Csv C:\\Temp\\StaleAdmins.csv
foreach ($admin in $staleAdmins) {
    Disable-ADAccount -Identity $admin.SamAccountName
    Set-ADUser -Identity $admin.SamAccountName \`
      -Description "DISABLED: Stale admin - $(Get-Date -Format 'yyyy-MM-dd') - Review by ITSec"
    Write-Host "Disabled: $($admin.SamAccountName)"
}`,
    effort: "Low", priority: 1, tags: ["Identity", "Privileged Access", "Hygiene"]
  },
  reversibleEncrypt: {
    title: "Disable Reversible Password Encryption",
    steps: [
      "Identify all accounts with AllowReversiblePasswordEncryption = True",
      "Disable the attribute on all affected accounts",
      "Force password reset on affected accounts (encryption change requires new password)",
      "Audit domain password policy — ensure it does not enable reversible encryption",
    ],
    cmd: `# Find accounts with reversible encryption
Get-ADUser -Filter {AllowReversiblePasswordEncryption -eq $true} \`
  -Properties AllowReversiblePasswordEncryption | \`
  Select Name,SamAccountName | Export-Csv C:\\Temp\\ReversibleEncryption.csv

# Disable reversible encryption
Get-ADUser -Filter {AllowReversiblePasswordEncryption -eq $true} | \`
  Set-ADUser -AllowReversiblePasswordEncryption $false

# Force password change at next logon (required for change to take effect)
Get-ADUser -Filter {AllowReversiblePasswordEncryption -eq $true} | \`
  Set-ADUser -ChangePasswordAtLogon $true

# Verify clear
Get-ADUser -Filter {AllowReversiblePasswordEncryption -eq $true} | Measure-Object`,
    effort: "Low", priority: 1, tags: ["Password", "Encryption", "Critical"]
  },
  asrepRoastable: {
    title: "Enable Kerberos Pre-Authentication",
    steps: [
      "Find all accounts with DoesNotRequirePreAuth = True",
      "Enable Kerberos pre-authentication on all accounts",
      "Verify no applications depend on pre-auth being disabled (rare legacy case)",
      "Monitor for new accounts created with this flag",
    ],
    cmd: `# Find AS-REP roastable accounts
Get-ADUser -Filter {DoesNotRequirePreAuth -eq $true -and Enabled -eq $true} \`
  -Properties DoesNotRequirePreAuth | \`
  Select Name,SamAccountName | Export-Csv C:\\Temp\\ASREPRoastable.csv

# Enable pre-authentication (removes the vulnerable flag)
Get-ADUser -Filter {DoesNotRequirePreAuth -eq $true} | \`
  Set-ADUser -KerberosEncryptionType AES256

# Verify
Get-ADUser -Filter {DoesNotRequirePreAuth -eq $true} | \`
  Select Name,SamAccountName`,
    effort: "Low", priority: 1, tags: ["Password", "Kerberos", "Critical"]
  },
  laps: {
    title: "Deploy LAPS Across All Endpoints",
    steps: [
      "Download and install LAPS.x64.msi on management workstation",
      "Extend AD schema: Update-AdmPwdADSchema",
      "Set AD permissions on OUs: Set-AdmPwdComputerSelfPermission -OrgUnit <OU>",
      "Configure LAPS GPO: Computer Configuration > Admin Templates > LAPS",
      "Set password complexity, length (25+ chars), and expiry interval (30 days)",
      "Restrict ms-Mcs-AdmPwd read access to specific admin groups only",
      "Deploy GPO to all OUs containing workstations and servers",
      "Validate with: Get-AdmPwdPassword -ComputerName <name>",
    ],
    cmd: `# LAPS Schema Extension (run once as Schema Admin)
Import-Module AdmPwd.PS
Update-AdmPwdADSchema

# Grant computers permission to update their own password
Set-AdmPwdComputerSelfPermission -OrgUnit "OU=Workstations,DC=domain,DC=com"
Set-AdmPwdComputerSelfPermission -OrgUnit "OU=Servers,DC=domain,DC=com"

# Grant helpdesk read access
Set-AdmPwdReadPasswordPermission -OrgUnit "OU=Workstations,DC=domain,DC=com" \`
  -AllowedPrincipals "DOMAIN\\HelpDesk"

# Restrict admin access (remove Everyone)
# Configure via GPO: LAPS > Password Settings
# - Password complexity: Large letters + small letters + numbers + specials
# - Password length: 25
# - Password age: 30 days

# Verify coverage
Get-ADComputer -Filter {Enabled -eq $true} -Properties 'ms-Mcs-AdmPwd','ms-Mcs-AdmPwdExpirationTime' | \`
  Where {$_.'ms-Mcs-AdmPwd' -ne $null} | Measure-Object`,
    effort: "High", priority: 2, tags: ["GPO", "Local Admin", "LAPS"]
  },
  smbv1: {
    title: "Disable SMBv1 Domain-Wide",
    steps: [
      "Audit network for SMBv1 traffic first (use Event ID 3000 in SMB Server operational log)",
      "Disable SMBv1 on all Domain Controllers immediately",
      "Deploy GPO to disable SMBv1 on all domain-joined systems",
      "Test legacy applications (old scanners, NAS devices, printers) for breakage",
      "Address legacy device exceptions with VLAN isolation, not SMBv1 re-enablement",
    ],
    cmd: `# IMMEDIATE: Disable on all DCs (run on each DC)
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
Set-SmbClientConfiguration -EnableBandwidthThrottling $false -Force

# Verify
Get-SmbServerConfiguration | Select EnableSMB1Protocol

# GPO Registry setting for all domain computers:
# HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters
# Value: SMB1  Type: DWORD  Data: 0

# Audit SMBv1 connections before disabling (Event Log)
Get-WinEvent -LogName "Microsoft-Windows-SMBServer/Audit" \`
  -FilterHashtable @{Id=3000} -MaxEvents 100 | \`
  Select TimeCreated,Message | Format-List

# Check which systems still use SMBv1
Invoke-Command -ComputerName (Get-ADComputer -Filter * | Select -Exp Name) \`
  -ScriptBlock {Get-SmbServerConfiguration | Select PSComputerName,EnableSMB1Protocol}`,
    effort: "Medium", priority: 1, tags: ["GPO", "Network", "SMB", "Critical"]
  },
  ntlmv1: {
    title: "Enforce NTLMv2-Only Authentication",
    steps: [
      "Audit NTLM usage via Event IDs 4776 (NTLM auth) on DCs",
      "Set LmCompatibilityLevel = 3 first (send NTLMv2, accept all) — observe for 2 weeks",
      "Escalate to Level 5 (send NTLMv2 only, refuse LM and NTLM) after validation",
      "Deploy via GPO: Computer Config > Windows Settings > Security Settings > Local Policies > Security Options",
      "Address legacy systems incapable of NTLMv2 with vendor upgrades or isolation",
    ],
    cmd: `# Check current NTLM level on DCs
Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" \`
  -Name "LmCompatibilityLevel" -ErrorAction SilentlyContinue

# Audit NTLM authentication events
Get-WinEvent -FilterHashtable @{LogName='Security';Id=4776} -MaxEvents 50 | \`
  Where {$_.Message -match "NTLM"} | Select TimeCreated,Message | Format-List

# Set NTLMv2 only (Level 5) - deploy via GPO for domain-wide enforcement
Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" \`
  -Name "LmCompatibilityLevel" -Value 5 -Type DWord

# GPO path: Computer Config > Windows Settings > Security Settings >
# Local Policies > Security Options > 
# "Network security: LAN Manager authentication level"
# Set to: "Send NTLMv2 response only. Refuse LM & NTLM"`,
    effort: "Medium", priority: 2, tags: ["GPO", "NTLM", "Authentication", "Critical"]
  },
  krbtgt: {
    title: "Rotate KRBTGT Account Password",
    steps: [
      "CRITICAL: This must be done TWICE with 10+ hours between resets (max DC replication time)",
      "Verify AD replication health before starting: repadmin /replsummary",
      "Document current KRBTGT password last set date",
      "Reset #1: Use New-KrbtgtKeys.ps1 or Set-ADAccountPassword",
      "Wait for full AD replication across all DCs (check with repadmin /showrepl)",
      "Reset #2: Repeat the password reset 10+ hours later",
      "Monitor for Kerberos authentication failures post-reset",
      "Schedule recurring 180-day rotation reminder",
    ],
    cmd: `# Pre-check: Verify replication health
repadmin /replsummary
repadmin /showrepl

# Check current KRBTGT password age
Get-ADUser krbtgt -Properties PasswordLastSet | \`
  Select Name,PasswordLastSet,@{N='AgeDays';E={(New-TimeSpan $_.PasswordLastSet (Get-Date)).Days}}

# RESET #1 — Generate secure random password
$newPwd = ConvertTo-SecureString \`
  ([System.Web.Security.Membership]::GeneratePassword(32, 8)) \`
  -AsPlainText -Force

Set-ADAccountPassword -Identity krbtgt -Reset -NewPassword $newPwd
Write-Host "Reset #1 complete: $(Get-Date)" -ForegroundColor Yellow
Write-Host "WAIT 10+ HOURS before Reset #2" -ForegroundColor Red

# After 10+ hours — RESET #2
$newPwd2 = ConvertTo-SecureString \`
  ([System.Web.Security.Membership]::GeneratePassword(32, 8)) \`
  -AsPlainText -Force
Set-ADAccountPassword -Identity krbtgt -Reset -NewPassword $newPwd2
Write-Host "Reset #2 complete: $(Get-Date)" -ForegroundColor Green

# Monitor for errors
Get-WinEvent -FilterHashtable @{LogName='System';Id=@(6,7,11)} \`
  -ComputerName (Get-ADDomainController -Filter *).Name | Select TimeCreated,Id,Message`,
    effort: "Medium", priority: 2, tags: ["Hygiene", "Kerberos", "Golden Ticket", "KRBTGT"]
  },
  dfsr: {
    title: "Migrate SYSVOL from FRS to DFSR",
    steps: [
      "Verify all DCs are Windows Server 2008 R2 or higher",
      "Run dfsrmig /GetGlobalState to check current migration state",
      "Stage 1 — Prepared state: dfsrmig /SetGlobalState 1",
      "Wait for all DCs to reach Prepared state: dfsrmig /GetMigrationState",
      "Stage 2 — Redirected: dfsrmig /SetGlobalState 2 (DFSR takes over SYSVOL)",
      "Stage 3 — Eliminated: dfsrmig /SetGlobalState 3 (FRS service removed)",
      "Validate SYSVOL replication with DFSR: Get-DfsReplicatedFolder",
    ],
    cmd: `# Check current migration state
dfsrmig /GetGlobalState
dfsrmig /GetMigrationState

# Start migration — Stage 0 (Start)
dfsrmig /SetGlobalState 0
# Wait for all DCs...
dfsrmig /GetMigrationState

# Stage 1 — Prepared
dfsrmig /SetGlobalState 1
# Verify all DCs in Prepared state, then continue...

# Stage 2 — Redirected (DFSR serves SYSVOL)
dfsrmig /SetGlobalState 2

# Stage 3 — Eliminated (FRS fully removed)  
dfsrmig /SetGlobalState 3

# Validate DFSR replication
Get-DfsReplicatedFolder -GroupName "Domain System Volume"
Get-DfsrMember

# Confirm SYSVOL is DFSR-based
Get-ItemProperty \`
  "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\DFSR\\Parameters\\SysVols\\Seeding SysVols\\*"`,
    effort: "High", priority: 3, tags: ["DC Health", "DFSR", "SYSVOL", "Replication"]
  },
  dnsScavenge: {
    title: "Enable DNS Aging & Scavenging",
    steps: [
      "Identify all primary forward lookup zones on each DNS server",
      "Enable aging on each zone with 7-day no-refresh and 7-day refresh interval",
      "Enable server-level scavenging on the designated scavenging server (typically PDC)",
      "Set scavenging interval to 7 days",
      "Monitor DNS for legitimate record deletions over first 30 days",
    ],
    cmd: `# View all zones and their aging status
Get-DnsServerZone | Where {-not $_.IsReverseLookupZone -and $_.ZoneType -eq "Primary"} | \`
  Select ZoneName,Aging,RefreshInterval,NoRefreshInterval | Format-Table

# Enable aging on all AD-integrated zones
$dc = $env:COMPUTERNAME
Get-DnsServerZone -ComputerName $dc | \`
  Where {-not $_.IsReverseLookupZone -and $_.ZoneType -eq "Primary" -and $_.IsDsIntegrated} | \`
  ForEach {
    Set-DnsServerZoneAging -Name $_.ZoneName \`
      -Aging $true \`
      -NoRefreshInterval 7.00:00:00 \`
      -RefreshInterval 7.00:00:00 \`
      -ComputerName $dc
    Write-Host "Enabled aging: $($_.ZoneName)"
  }

# Enable server-level scavenging
Set-DnsServerScavenging -ComputerName $dc \`
  -ScavengingState $true \`
  -ScavengingInterval 7.00:00:00

# Verify
Get-DnsServerScavenging -ComputerName $dc`,
    effort: "Low", priority: 3, tags: ["DC Health", "DNS", "Hygiene"]
  },
  avCoverage: {
    title: "Ensure Defender Coverage on All DCs",
    steps: [
      "Verify Windows Defender is running on all DCs",
      "Enable real-time protection if disabled",
      "Apply Microsoft-recommended AD exclusions (KB822158)",
      "Configure Defender for Identity (MDI) for advanced threat detection",
      "Set up scheduled scans (weekly full scan, daily quick scan)",
      "Ensure signature updates are current (should be <24 hours old)",
    ],
    cmd: `# Check Defender status on all DCs
$dcs = (Get-ADDomainController -Filter *).Name
Invoke-Command -ComputerName $dcs -ScriptBlock {
  Get-MpComputerStatus | Select PSComputerName,
    AMRunningMode,
    RealTimeProtectionEnabled,
    AntivirusSignatureLastUpdated,
    AntivirusSignatureVersion
}

# Enable real-time protection (if disabled)
Set-MpPreference -DisableRealtimeMonitoring $false

# Apply recommended AD exclusions (per KB822158)
$adExclusions = @(
  "$env:SystemRoot\\NTDS\\ntds.dit",
  "$env:SystemRoot\\NTDS\\ntds.jfm",
  "$env:SystemRoot\\NTDS\\edb*.log",
  "$env:SystemRoot\\SYSVOL",
  "$env:SystemRoot\\System32\\dns"
)
foreach ($path in $adExclusions) {
  Add-MpPreference -ExclusionPath $path
}

# Update signatures immediately
Update-MpSignature
Get-MpComputerStatus | Select AntivirusSignatureLastUpdated,AntivirusSignatureVersion`,
    effort: "Low", priority: 2, tags: ["Monitoring", "Defender", "AV", "DC Security"]
  },
};

// ─── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_FINDINGS = [
  { checkId:"kerberoastable",  category:"identity",   label:"Kerberoastable SPNs",      severity:"Critical", score:25, status:"Fail",    threshold:"0 privileged accounts with SPN",  actualValue:"3 accounts",         description:"Privileged accounts with SPN set", recommendation:"Remove SPNs from privileged accounts. Use gMSA." },
  { checkId:"pwdNeverExpires", category:"identity",   label:"Password Never Expires",   severity:"High",     score:65, status:"Warning", threshold:"<5% of accounts",                 actualValue:"68 accounts (8.1%)", description:"Accounts with non-expiring passwords", recommendation:"Migrate service accounts to gMSA. Enforce expiry on regular accounts." },
  { checkId:"staleAdmins",     category:"identity",   label:"Stale Admin Accounts",     severity:"Critical", score:40, status:"Fail",    threshold:"0 stale accounts",               actualValue:"4 stale accounts",   description:"Admin accounts inactive >90 days", recommendation:"Disable stale admin accounts immediately." },
  { checkId:"dualUseAdmin",    category:"identity",   label:"Dual-use Admin Accounts",  severity:"Critical", score:60, status:"Warning", threshold:"0 dual-use",                      actualValue:"2 potential",        description:"DA members not clearly admin-only accounts", recommendation:"Implement Tiered Administration model." },
  { checkId:"protectedUsers",  category:"identity",   label:"Protected Users Group",    severity:"High",     score:55, status:"Warning", threshold:"100% Tier-0 admins",             actualValue:"6 of 12 (50%)",      description:"Tier-0 admins in Protected Users group", recommendation:"Add all Tier-0 admins to Protected Users group." },
  { checkId:"defaultAdmin",    category:"identity",   label:"Default Admin Account",    severity:"High",     score:50, status:"Warning", threshold:"Renamed & Disabled",             actualValue:"Name: Administrator, Enabled: True", description:"Built-in RID-500 account status", recommendation:"Rename and disable built-in Administrator account." },
  { checkId:"minPwdLength",    category:"password",   label:"Minimum Password Length",  severity:"Critical", score:30, status:"Fail",    threshold:"14+ (100%), 12 (50%), 11- (0%)",             actualValue:"8 characters",       description:"Domain password policy minimum length", recommendation:"Set minimum password length to 14+ characters." },
  { checkId:"fgpp",            category:"password",   label:"Fine-Grained PSO",         severity:"High",     score:0,  status:"Fail",    threshold:"PSO for all admin groups",        actualValue:"No PSOs found",      description:"Password Settings Objects for admin accounts", recommendation:"Create PSO for admin accounts with stricter policy." },
  { checkId:"reversibleEncrypt",category:"password",  label:"Reversible Encryption",    severity:"Critical", score:100,status:"Pass",    threshold:"0 accounts",                      actualValue:"0 accounts",         description:"AllowReversiblePasswordEncryption enabled", recommendation:"No action required." },
  { checkId:"asrepRoastable",  category:"password",   label:"AS-REP Roastable",         severity:"Critical", score:85, status:"Pass",    threshold:"0 accounts",                      actualValue:"1 account (fixed)",  description:"Pre-auth disabled accounts", recommendation:"Monitor for regression." },
  { checkId:"pwdAge",          category:"password",   label:"Password Age Compliance",  severity:"High",     score:70, status:"Warning", threshold:"<2% of accounts",                 actualValue:"4.2% aged >365d",    description:"Accounts with password >365 days", recommendation:"Force password reset for non-compliant accounts." },
  { checkId:"mfaCoverage",     category:"password",   label:"MFA Enforcement",          severity:"High",     score:55, status:"Warning", threshold:"95%+ coverage",                   actualValue:"Manual verification required", description:"MFA coverage across accounts", recommendation:"Verify in Azure AD portal. Deploy Conditional Access." },
  { checkId:"ddpModified",     category:"gpo",        label:"Default Domain Policy",    severity:"Medium",   score:75, status:"Warning", threshold:"DDP: password/Kerberos only",      actualValue:"38 settings detected",description:"DDP settings beyond baseline", recommendation:"Move non-baseline settings to dedicated GPOs." },
  { checkId:"orphanedGPO",     category:"gpo",        label:"Orphaned GPOs",            severity:"Low",      score:80, status:"Pass",    threshold:"0 unlinked GPOs",                 actualValue:"2 unlinked GPOs",    description:"GPOs with no OU links", recommendation:"Review and clean up unlinked GPOs." },
  { checkId:"laps",            category:"gpo",        label:"LAPS Deployment",          severity:"Critical", score:20, status:"Fail",    threshold:"95%+ endpoints",                  actualValue:"LAPS schema NOT present", description:"LAPS deployment coverage", recommendation:"Deploy LAPS across all domain-joined endpoints." },
  { checkId:"serviceAccountLogonRestrict", category:"gpo", label:"Service Account Interactive Logon", severity:"Critical", score:30, status:"Fail", threshold:"Service accounts denied interactive/RDP logon via GPO", actualValue:"No logon restrictions detected", description:"Service accounts should be restricted from interactive logon and RDP access", recommendation:"Create GPO denying 'Allow log on locally' and 'Allow log on through Remote Desktop Services' for service accounts." },
  { checkId:"appLocker",       category:"gpo",        label:"AppLocker / WDAC",         severity:"High",     score:35, status:"Fail",    threshold:"All servers covered",             actualValue:"Not detected",       description:"Application control policy deployment", recommendation:"Deploy AppLocker in audit mode, then enforce." },
  { checkId:"smbv1",           category:"gpo",        label:"SMBv1 Disabled",           severity:"Critical", score:0,  status:"Fail",    threshold:"Disabled on all systems",         actualValue:"ENABLED on 2 DCs",   description:"SMBv1 protocol enabled — EternalBlue risk", recommendation:"Disable SMBv1 immediately via GPO and directly." },
  { checkId:"ntlmv1",          category:"gpo",        label:"NTLMv1 Disabled",          severity:"Critical", score:40, status:"Fail",    threshold:"LmCompatibilityLevel = 5",        actualValue:"Level = 2 (NTLMv1 allowed)", description:"NTLM authentication level", recommendation:"Set LmCompatibilityLevel to 5 via GPO." },
  { checkId:"auditPolicy",     category:"gpo",        label:"Advanced Audit Policy",    severity:"High",     score:55, status:"Warning", threshold:"All 9 categories",                actualValue:"5 of 9 categories",  description:"Audit policy configuration", recommendation:"Enable all 9 Advanced Audit Policy categories via GPO." },
  { checkId:"fsmoRoles",       category:"dchealth",   label:"FSMO Role Health",         severity:"Critical", score:100,status:"Pass",    threshold:"All 5 FSMO holders online",       actualValue:"5/5 responding",     description:"FSMO role holders reachable", recommendation:"No action required." },
  { checkId:"replErrors",      category:"dchealth",   label:"AD Replication Errors",    severity:"Critical", score:75, status:"Warning", threshold:"0 replication errors",            actualValue:"2 error indicators", description:"AD replication health", recommendation:"Run repadmin /replsummary and investigate errors." },
  { checkId:"dfsr",            category:"dchealth",   label:"DFSR (SYSVOL)",            severity:"High",     score:30, status:"Fail",    threshold:"DFSR only — no FRS",              actualValue:"FRS detected",       description:"SYSVOL replication mechanism", recommendation:"Migrate from FRS to DFSR using dfsrmig." },
  { checkId:"flevel",          category:"dchealth",   label:"Functional Level",         severity:"High",     score:60, status:"Warning", threshold:"Windows Server 2016+",            actualValue:"Domain: 2012 R2",    description:"Domain/Forest functional level", recommendation:"Upgrade functional level to 2016 after DC upgrades." },
  { checkId:"dcEOL",           category:"dchealth",   label:"DC OS Version",            severity:"Critical", score:80, status:"Pass",    threshold:"No EOL OS on DCs",                actualValue:"All DCs on 2019",    description:"Domain Controllers on EOL OS", recommendation:"No action required." },
  { checkId:"dnsScavenge",     category:"dchealth",   label:"DNS Scavenging",           severity:"Medium",   score:40, status:"Fail",    threshold:"All zones with aging enabled",    actualValue:"2/8 zones (25%)",    description:"DNS aging and scavenging enabled", recommendation:"Enable aging on all AD-integrated zones." },
  { checkId:"ntp",             category:"dchealth",   label:"NTP Hierarchy",            severity:"High",     score:85, status:"Pass",    threshold:"PDC syncing external NTP",        actualValue:"pool.ntp.org — OK",  description:"Time synchronisation hierarchy", recommendation:"No action required." },
  { checkId:"tombstone",       category:"dchealth",   label:"Tombstone Lifetime",       severity:"Medium",   score:50, status:"Warning", threshold:"180 days minimum",                actualValue:"60 days (default)",  description:"AD tombstone lifetime value", recommendation:"Set tombstone lifetime to 180 days." },
  { checkId:"staleComputers",  category:"hygiene",    label:"Stale Computer Accounts",  severity:"Medium",   score:70, status:"Warning", threshold:"<3% of computers",                actualValue:"7.4% (42 stale)",    description:"Computers inactive >90 days", recommendation:"Disable stale computer accounts." },
  { checkId:"duplicateSPN",    category:"hygiene",    label:"Duplicate SPNs",           severity:"High",     score:65, status:"Warning", threshold:"0 duplicates",                    actualValue:"3 duplicate SPNs",   description:"Duplicate Service Principal Names", recommendation:"Run setspn -X -F and remove duplicates." },
  { checkId:"inactiveUsers",   category:"hygiene",    label:"Inactive User Accounts",   severity:"Medium",   score:60, status:"Warning", threshold:"<5% of users",                    actualValue:"9.2% (87 inactive)", description:"Users inactive >60 days", recommendation:"Implement automated 60-day inactivity policy." },
  { checkId:"guestAccount",    category:"hygiene",    label:"Guest Account Disabled",   severity:"High",     score:100,status:"Pass",    threshold:"Disabled",                        actualValue:"Disabled",           description:"Built-in Guest account status", recommendation:"No action required." },
  { checkId:"krbtgt",          category:"hygiene",    label:"KRBTGT Password Age",      severity:"High",     score:30, status:"Fail",    threshold:"<180 days",                       actualValue:"412 days since last change", description:"KRBTGT account password age", recommendation:"Reset KRBTGT password twice (10 hours apart)." },
  { checkId:"eventLogSize",    category:"monitoring", label:"Security Event Log Size",  severity:"Medium",   score:40, status:"Fail",    threshold:"≥1024MB on DCs",                  actualValue:"64MB configured",    description:"Security event log maximum size", recommendation:"Set Security log to 1GB minimum." },
  { checkId:"logRetention",    category:"monitoring", label:"Log Retention Policy",     severity:"High",     score:30, status:"Fail",    threshold:"AutoBackup + 90d retention",      actualValue:"Overwrite as needed", description:"Log retention and archiving", recommendation:"Enable auto-archive. Forward to SIEM." },
  { checkId:"siemForwarding",  category:"monitoring", label:"SIEM / Log Forwarding",    severity:"High",     score:20, status:"Fail",    threshold:"All DCs forwarding",              actualValue:"No WEF or SIEM detected", description:"Centralised log collection", recommendation:"Deploy WEF or SIEM agent on all DCs." },
  { checkId:"avCoverage",      category:"monitoring", label:"AV / Defender Coverage",   severity:"Critical", score:75, status:"Warning", threshold:"Running + real-time on all DCs",   actualValue:"Running, RT: Partial",description:"Defender coverage on DCs", recommendation:"Enable real-time protection. Apply AD exclusions." },
  { checkId:"serverAvCoverage", category:"infrastructure", label:"Server AV / EDR Coverage", severity:"High", score:55, status:"Fail", threshold:"100% of servers with AV/EDR", actualValue:"AV Coverage: 0/0 servers", description:"Antivirus and EDR coverage across domain-joined servers", recommendation:"Deploy AV/EDR to ALL servers." },
  { checkId:"legacyOS",         category:"infrastructure", label:"Legacy / EOL Operating Systems", severity:"High", score:60, status:"Warning", threshold:"0 EOL systems", actualValue:"EOL Servers: 0 | EOL Workstations: 0", description:"End-of-life OS detection across all domain computers", recommendation:"Upgrade EOL systems." },
  { checkId:"serverUptime",     category:"infrastructure", label:"Server Uptime / Reboot Required", severity:"High", score:65, status:"Warning", threshold:"< 10% servers needing reboot", actualValue:"Servers needing reboot: 0/0", description:"Servers requiring reboot due to high uptime (excludes Hyper-V hosts)", recommendation:"Reboot servers with high uptime." },
  { checkId:"serverWindowsUpdate", category:"infrastructure", label:"Windows Update / Patching Status", severity:"High", score:65, status:"Warning", threshold:"< 10% servers with overdue updates", actualValue:"Servers needing updates: 0/0", description:"Servers with overdue Windows updates (excludes Hyper-V hosts)", recommendation:"Deploy pending Windows updates." },
];

const SEED_HISTORY = [
  { date:"2025-09", overallScore:38, categoryScores:{identity:35,password:30,gpo:28,dchealth:55,hygiene:40,monitoring:22} },
  { date:"2025-10", overallScore:43, categoryScores:{identity:40,password:35,gpo:32,dchealth:60,hygiene:45,monitoring:25} },
  { date:"2025-11", overallScore:49, categoryScores:{identity:44,password:40,gpo:38,dchealth:65,hygiene:50,monitoring:28} },
  { date:"2025-12", overallScore:52, categoryScores:{identity:48,password:43,gpo:42,dchealth:68,hygiene:54,monitoring:32} },
  { date:"2026-01", overallScore:55, categoryScores:{identity:51,password:46,gpo:44,dchealth:72,hygiene:57,monitoring:35} },
  { date:"2026-02", overallScore:57, categoryScores:{identity:53,password:50,gpo:47,dchealth:74,hygiene:59,monitoring:37} },
  { date:"2026-03", overallScore:61, categoryScores:{identity:57,password:53,gpo:51,dchealth:78,hygiene:62,monitoring:41} },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeWeighted(findings) {
  const catMap = {};
  CATEGORIES.forEach(c => {
    const checks = findings.filter(f => f.category === c.id);
    catMap[c.id] = checks.length > 0 ? Math.round(checks.reduce((s,f) => s+f.score, 0) / checks.length) : 0;
  });
  const overall = Math.round(CATEGORIES.reduce((s,c) => s + catMap[c.id] * (c.weight/100), 0));
  return { catMap, overall };
}

// ─── UI Components ────────────────────────────────────────────────────────────

function CircularGauge({ score, size=160, stroke=14, color }) {
  const r = (size - stroke*2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score/100)*c;
  const col = color || scoreColor(score);
  return (
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col}
          strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size>120?28:18,fontWeight:800,color:col,fontFamily:"'Courier New',monospace"}}>{score}</span>
        <span style={{fontSize:9,color:"#64748b",letterSpacing:"0.1em",textTransform:"uppercase"}}>{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

function HorizontalGauge({ score, size="medium", showDetails=true }) {
  const col = scoreColor(score);
  const passed = Math.round((score/100) * 100);
  const remaining = 100 - passed;
  
  // Determine risk level
  const getRiskLevel = (s) => {
    if (s >= 85) return { level: 'Good', color: '#22c55e', bg: '#22c55e30' };
    if (s >= 70) return { level: 'Average', color: '#eab308', bg: '#eab30830' };
    if (s >= 50) return { level: 'High Risk', color: '#f97316', bg: '#f9731630' };
    return { level: 'Critical', color: '#ef4444', bg: '#ef444430' };
  };
  
  const risk = getRiskLevel(score);
  
  const containerStyle = {
    width: '100%',
    padding: '20px 0'
  };
  
  const barContainerStyle = {
    height: 24,
    background: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
  };
  
  const barStyle = {
    height: '100%',
    width: `${score}%`,
    background: `linear-gradient(90deg, ${col} 0%, ${col}dd 100%)`,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 12,
    boxShadow: `0 0 15px ${col}40`,
    transition: 'width 0.8s ease'
  };
  
  const scoreDisplayStyle = {
    fontSize: 32,
    fontWeight: 800,
    color: col,
    fontFamily: "'Courier New',monospace",
    textShadow: `0 0 20px ${col}60`
  };
  
  const labelStyle = {
    fontSize: 11,
    color: '#94a3b8',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginTop: 4
  };
  
  const legendStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 12,
    fontSize: 11
  };
  
  const riskBadgeStyle = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: risk.bg,
    color: risk.color,
    marginTop: 8,
    letterSpacing: '0.05em',
    boxShadow: `0 0 10px ${risk.color}30`
  };
  
  return (
    <div style={containerStyle}>
      {/* Score Display */}
      <div style={{textAlign: 'center', marginBottom: 16}}>
        <div style={scoreDisplayStyle}>{score}</div>
        <div style={labelStyle}>Secure Score</div>
        <div style={riskBadgeStyle}>{risk.level}</div>
      </div>
      
      {/* Horizontal Bar */}
      <div style={barContainerStyle}>
        <div style={barStyle}>
          <span style={{fontSize: 12, fontWeight: 700, color: '#fff'}}>{score}%</span>
        </div>
      </div>
      
      {/* Legend */}
      {showDetails && (
        <div style={legendStyle}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <div style={{width: 8, height: 8, borderRadius: 2, background: col}}/>
            <span style={{color: '#e2e8f0'}}>Secured: {passed}%</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <div style={{width: 8, height: 8, borderRadius: 2, background: '#334155'}}/>
            <span style={{color: '#94a3b8'}}>Remaining: {remaining}%</span>
          </div>
        </div>
      )}
      
      {/* Scale markers */}
      {showDetails && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 16,
          padding: '8px 12px',
          background: '#0f172a',
          borderRadius: 8,
          fontSize: 10,
          color: '#64748b'
        }}>
          <div style={{textAlign: 'center'}}>
            <div style={{color: '#ef4444', fontWeight: 700}}>0-49%</div>
            <div>Critical</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{color: '#f97316', fontWeight: 700}}>50-69%</div>
            <div>High Risk</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{color: '#eab308', fontWeight: 700}}>70-84%</div>
            <div>Average</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{color: '#22c55e', fontWeight: 700}}>85-100%</div>
            <div>Good</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, color }) {
  return <span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:`${color}25`,color}}>{label}</span>;
}

const TABS = [
  {id:"dashboard",label:"Overview",icon:"◈"},
  {id:"categories",label:"Categories",icon:"◉"},
  {id:"checks",label:"All Checks",icon:"◎"},
  {id:"trend",label:"Trend",icon:"◆"},
  {id:"remediation",label:"Remediation Library",icon:"⚙"},
  {id:"import",label:"Import Data",icon:"↑"},
];

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [findings, setFindings] = useState(SEED_FINDINGS);
  const [history, setHistory] = useState(SEED_HISTORY);
  const [activeFinding, setActiveFinding] = useState(null);
  const [remFilter, setRemFilter] = useState("All");
  const [importStatus, setImportStatus] = useState(null);
  const [clients, setClients] = useState([]); // Array of {id, name, data: {findings, history}}
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const { catMap, overall } = computeWeighted(findings);

  // Load client data from server API
  const loadClientData = useCallback(async () => {
    try {
      // Fetch clients from API - loads from ADSecureScoreData folder on server
      const response = await fetch('/api/ad-secure-clients');
      const result = await response.json();
      
      if (result.clients && Array.isArray(result.clients)) {
        setClients(result.clients);
        
        // Auto-select first client if none selected
        if (result.clients.length > 0) {
          // Only auto-select if no client is currently selected
          setSelectedClientId(prev => {
            if (!prev && result.clients[0]) {
              // Load first client's data with score normalization
              if (result.clients[0].data?.findings?.length > 0) {
                const normalizedFindings = normalizeScores(result.clients[0].data.findings);
                setFindings(normalizedFindings);
                const clientHistory = result.clients[0].data?.history;
                setHistory(clientHistory && clientHistory.length > 0 ? clientHistory : SEED_HISTORY);
              }
              return result.clients[0].id;
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('Error loading client data:', error);
      setClients([]);
    }
  }, []);

  // Normalize scores based on current scoring rules (applies to legacy data)
  const normalizeScores = (findings) => {
    return findings.map(f => {
      if (f.checkId === "minPwdLength") {
        const match = f.actualValue?.match(/(\d+)\s*character/);
        if (match) {
          const len = parseInt(match[1], 10);
          let newScore = 0, newStatus = "Fail";
          if (len >= 14) { newScore = 100; newStatus = "Pass"; }
          else if (len === 12) { newScore = 50; newStatus = "Pass"; }
          return { ...f, score: newScore, status: newStatus };
        }
      }
      return f;
    });
  };

  // Load selected client's data when client selection changes
  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const selectedClient = clients.find(client => client.id === selectedClientId);
      if (selectedClient) {
        if (selectedClient.data?.findings?.length > 0) {
          const normalizedFindings = normalizeScores(selectedClient.data.findings);
          setFindings(normalizedFindings);
        }
        // Always set history - use client's history or fall back to SEED_HISTORY
        const clientHistory = selectedClient.data?.history;
        if (clientHistory && clientHistory.length > 0) {
          setHistory(clientHistory);
        } else {
          setHistory(SEED_HISTORY);
        }
        setImportStatus({ ok: true, msg: `Loaded data for ${selectedClient.name}` });
        setTab("dashboard");
      }
    }
  }, [selectedClientId, clients]);

  // Load client data on initial mount
  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  // ── JSON Import ──
  const handleImport = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.findings && Array.isArray(data.findings)) {
          // Derive name from domain if possible
          const domain = data.meta?.domain || '';
          const derived = deriveClientNameFromDomain(domain);
          let clientName = derived || data.meta?.domain;
          
          if (!clientName) {
            // Fallback to filename-derived name
            clientName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            clientName = clientName.replace(/^ad_secure_score_/i, '');
            clientName = clientName.replace(/_ad_secure_score_/g, ' ');
            clientName = clientName.replace(/Shiplakes_College_/i, 'Shiplakes College ');
            clientName = clientName.replace(/_/g, ' ');
            clientName = clientName.replace(/\s+/g, ' ').trim();
          }
          
          // Ensure we have a valid name string
          if (!clientName || clientName === '') {
            clientName = 'Unknown Client';
          }
          
          const clientId = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '');
          // Debug: log import mapping for this file
          if (typeof console !== 'undefined') {
            console.log(`[Import] file=${file} domain=${domain} derivedName=${derived} clientName=${clientName} clientId=${clientId}`);
          }
          
          // Check if client already exists - merge history if it does
          const existingClient = clients.find(c => c.id === clientId);
          let mergedHistory = data.history || SEED_HISTORY;
          
          if (existingClient && existingClient.data?.history && data.history) {
            // Merge histories - append new entries to existing history
            const existingHistory = existingClient.data.history;
            const newHistory = data.history;
            
            // Combine and sort by date
            const combinedHistory = [...existingHistory, ...newHistory];
            // Remove duplicates by date, keeping the latest entry for each date
            const historyMap = new Map();
            combinedHistory.forEach(h => historyMap.set(h.date, h));
            mergedHistory = Array.from(historyMap.values()).sort((a, b) => 
              new Date(a.date) - new Date(b.date)
            );
          }
          
          const existingClientIndex = clients.findIndex(c => c.id === clientId);
          if (existingClientIndex >= 0) {
            // Update existing client with merged history
            const updatedClients = [...clients];
            updatedClients[existingClientIndex] = {
              id: clientId,
              name: clientName,
              data: {
                findings: data.findings,
                history: mergedHistory
              }
            };
            setClients(updatedClients);
          } else {
            // Add new client
            setClients(prev => [...prev, {
              id: clientId,
              name: clientName,
              data: {
                findings: data.findings,
                history: mergedHistory
              }
            }]);
          }
          
          // Select this client
          setSelectedClientId(clientId);
           
           // Load the data into the dashboard with merged history (normalized)
           const normalizedDataFindings = normalizeScores(data.findings);
           setFindings(normalizedDataFindings);
           setHistory(mergedHistory);
          
          setImportStatus({ ok: true, msg: `Loaded ${data.findings.length} checks for ${clientName}` });
          setTab("dashboard");
          
          // Save to server so it's available to all devices
          try {
            await fetch('/api/ad-secure-import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId: clientId,
                clientName: clientName,
                findings: data.findings,
                history: data.history,
                meta: data.meta,
                scores: data.scores
              })
            });
            // Reload client list from server
            loadClientData();
          } catch (saveErr) {
            console.error('Error saving to server:', saveErr);
          }
        } else { 
          setImportStatus({ ok: false, msg: "Invalid JSON: missing findings array" }); 
        }
      } catch (err) { 
        setImportStatus({ ok: false, msg: "JSON parse error: " + err.message }); 
      }
    };
    reader.readAsText(file);
  }, [clients]);

  // ── Trend data ──
  const trendData = [...history.map(h => ({
    month: h.date,
    score: h.overallScore,
    ...h.categoryScores
  }))];

  const critFails = findings.filter(f => f.status==="Fail" && f.severity==="Critical");
  const highFails = findings.filter(f => f.status==="Fail" && f.severity==="High");
  const passing   = findings.filter(f => f.score>=80).length;
  const prevScore = history.length > 1 ? history[history.length-2].overallScore : overall;
  const delta     = overall - prevScore;

  // ── Export HTML ──
  const exportHTML = () => {
    const clientName = selectedClientId ? (clients.find(c => c.id === selectedClientId)?.name || 'Unknown Client') : 'AD Secure Score';
    const reportDate = new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"});
    const col = scoreColor(overall);
    
    const getScoreColor = (s) => s >= 85 ? "#22c55e" : s >= 70 ? "#eab308" : s >= 50 ? "#f97316" : "#ef4444";
    const getScoreLabel = (s) => s >= 85 ? "Good" : s >= 70 ? "Average" : s >= 50 ? "High Risk" : "Critical";
    
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AD Secure Score Report - ${clientName}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:40px;max-width:1100px;margin:0 auto}
.header{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:30px;border-radius:12px;margin-bottom:30px}
.header h1{color:#00d4ff;margin:0 0 10px 0;font-size:28px;border:none;padding:0}
.header .subtitle{color:#94a3b8;font-size:14px}
.header .client-name{color:#f8fafc;font-size:20px;font-weight:700;margin-top:10px}
.header .date{color:#94a3b8;font-size:12px;margin-top:5px}
h2{color:#0f172a;border-bottom:2px solid #00d4ff;padding-bottom:10px;margin-top:30px}
table{width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
th{background:#0f172a;color:#fff;padding:12px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
td{padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:12px}
tr:hover{background:#f1f5f9}
.score-good{color:#22c55e;font-weight:700}
.score-average{color:#eab308;font-weight:700}
.score-high{color:#f97316;font-weight:700}
.score-critical{color:#ef4444;font-weight:700}
.status-pass{background:#dcfce7;color:#166534;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.status-warning{background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.status-fail{background:#fee2e2;color:#dc2626;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.severity-critical{background:#fee2e2;color:#dc2626;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.severity-high{background:#ffedd5;color:#c2410c;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.severity-medium{background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.severity-low{background:#dcfce7;color:#166534;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}
.kpi{padding:24px;border-radius:12px;text-align:center;background:linear-gradient(145deg,#1e293b,#0f172a);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 4px 15px rgba(0,0,0,0.2)}
.kpi-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em}
.kpi-val{font-size:38px;font-weight:800;margin:8px 0}
.kpi-sub{font-size:11px;color:#e2e8f0}
.score-bar-container{margin:30px 0;padding:20px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.score-bar-track{height:24px;background:#e2e8f0;border-radius:12px;overflow:hidden;position:relative}
.score-bar-fill{height:100%;background:linear-gradient(90deg,${col},${col}dd);border-radius:12px;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;box-shadow:0 0 15px ${col}40}
.score-bar-fill span{color:#fff;font-weight:700;font-size:12px}
.score-display{text-align:center;margin-bottom:15px}
.score-display .number{font-size:48px;font-weight:800;color:${col}}
.score-display .label{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em}
.score-display .status{display:inline-block;margin-top:8px;padding:4px 16px;background:${col}25;color:${col};border-radius:20px;font-weight:600;font-size:12px}
.legend-bar{display:flex;justify-content:space-between;margin-top:20px;padding:15px;background:#f1f5f9;border-radius:8px;font-size:11px}
.legend-item{text-align:center}
.legend-item .range{font-weight:700}
.legend-item.critical .range{color:#ef4444}
.legend-item.high .range{color:#f97316}
.legend-item.average .range{color:#eab308}
.legend-item.good .range{color:#22c55e}
.footer{text-align:center;margin-top:40px;padding:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b}
</style></head><body>
<div class="header">
  <h1>AD Secure Score Report</h1>
  <div class="subtitle">Domain Security Assessment</div>
  <div class="client-name">${clientName}</div>
  <div class="date">Report Date: ${reportDate}</div>
</div>

<h2>Overall Security Score</h2>
<div class="score-bar-container">
  <div class="score-display">
    <div class="number">${overall}</div>
    <div class="label">Secure Score</div>
    <div class="status">${scoreLabel(overall)}</div>
  </div>
  <div class="score-bar-track">
    <div class="score-bar-fill" style="width:${overall}%">
      <span>${overall}%</span>
    </div>
  </div>
  <div class="legend-bar">
    <div class="legend-item critical"><div class="range">0-49%</div><div>Critical</div></div>
    <div class="legend-item high"><div class="range">50-69%</div><div>High Risk</div></div>
    <div class="legend-item average"><div class="range">70-84%</div><div>Average</div></div>
    <div class="legend-item good"><div class="range">85-100%</div><div>Good</div></div>
  </div>
</div>

<h2>Key Metrics</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Overall Score</div><div class="kpi-val" style="color:${scoreColor(overall)}">${overall}</div><div class="kpi-sub">${scoreLabel(overall)}</div></div>
  <div class="kpi"><div class="kpi-label">Critical Findings</div><div class="kpi-val" style="color:#ef4444">${critFails.length}</div><div class="kpi-sub">Require action</div></div>
  <div class="kpi"><div class="kpi-label">High Risk</div><div class="kpi-val" style="color:#f97316">${highFails.length}</div><div class="kpi-sub">Urgent attention</div></div>
  <div class="kpi"><div class="kpi-label">Passing</div><div class="kpi-val" style="color:#22c55e">${passing}/${findings.length}</div><div class="kpi-sub">Score 50+</div></div>
</div>

<h2>All Assessment Findings</h2>
<table><thead><tr><th>Check</th><th>Category</th><th>Severity</th><th>Client Score</th><th>Client Status</th><th>Client Finding</th><th>Recommendation</th></tr></thead><tbody>
${findings.map(f=>`<tr>
  <td><strong>${f.label}</strong></td>
  <td>${f.category}</td>
  <td><span class="severity-${f.severity.toLowerCase()}">${f.severity}</span></td>
  <td class="score-${f.score >= 85 ? 'good' : f.score >= 70 ? 'average' : f.score >= 50 ? 'high' : 'critical'}">${f.score}</td>
  <td><span class="status-${f.status.toLowerCase()}">${f.status}</span></td>
  <td>${f.actualValue}</td>
  <td>${f.recommendation}</td>
</tr>`).join("")}
</tbody></table>

<div class="footer">
  RMS L4 Systems Engineering - Nishen Harichunder - First Technology KwaZulu-Natal
</div>
</body></html>`], {type:"text/html"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`AD_Secure_Score_Report_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split("T")[0]}.html`; a.click();
  };

  const S = {
    page: { minHeight:"100vh", background:"#0f172a", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#e2e8f0" },
    nav:  { background:"linear-gradient(135deg,#0a1628,#0d1f3c)", borderBottom:"1px solid #1e3a5f", padding:"0 24px" },
    navInner: { maxWidth:1300, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 },
    card: { background:"linear-gradient(145deg,#1e293b,#0f172a)", border:"1px solid #334155", borderRadius:12, padding:24, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 15px rgba(0,0,0,0.4)" },
    body: { maxWidth:1300, margin:"0 auto", padding:"24px" },
    sTitle: { fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, paddingBottom:8, borderBottom:"1px solid #334155" },
  };

  const SEVERITY_COLORS = {
    Critical: "#ef4444",
    High: "#f97316",
    Medium: "#eab308",
    Low: "#22c55e",
  };

  // Password prompt modal
  const PasswordPrompt = () => {
    if (!showPasswordPrompt) return null;
    
    const [password, setPassword] = useState("");
    
    const handleSave = async () => {
      setSaving(true);
      setPasswordError("");
      
      try {
        // Get original findings before changes
        const originalFindings = clients.find(c => c.id === selectedClientId)?.data?.findings || [];
        
        const response = await fetch('/api/ad-secure-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClientId,
            findings: findings,
            adminPassword: password,
            originalFindings: originalFindings
          })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          setPendingChanges(false);
          setShowPasswordPrompt(false);
          setPassword("");
          
          // Update local client data immediately with the new findings
          const updatedClients = clients.map(c => {
            if (c.id === selectedClientId) {
              return { ...c, data: { ...c.data, findings: findings } };
            }
            return c;
          });
          setClients(updatedClients);
          
          // Small delay then refresh from server to verify saved data
          setTimeout(async () => {
            await loadClientData();
          }, 500);
          
          alert(`Changes saved successfully! ${result.changesCount} adjustments saved. Saved to: ${result.savedToFile}`);
        } else {
          setPasswordError(result.error || "Invalid password");
        }
      } catch (err) {
        setPasswordError("Error saving changes: " + err.message);
      } finally {
        setSaving(false);
      }
    };
    
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }} onClick={() => setShowPasswordPrompt(false)}>
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: "90%"
        }} onClick={e => e.stopPropagation()}>
          <div style={{fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 8}}>Admin Authorization Required</div>
          <div style={{fontSize: 12, color: "#94a3b8", marginBottom: 16}}>Enter admin password to save score adjustments</div>
          
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 6,
              border: passwordError ? "1px solid #ef4444" : "1px solid #334155",
              background: "#0f172a",
              color: "#f8fafc",
              fontSize: 14,
              marginBottom: 12
            }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
          
          {passwordError && <div style={{color: "#ef4444", fontSize: 12, marginBottom: 12}}>{passwordError}</div>}
          
          <div style={{display: "flex", gap: 12}}>
            <button
              onClick={() => setShowPasswordPrompt(false)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                border: "1px solid #334155",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !password}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                border: "none",
                background: saving ? "#334155" : "linear-gradient(135deg,#f97316,#ef4444)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600
              }}
            >
              {saving ? "Saving..." : "Confirm Save"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.page}>
      <PasswordPrompt />
      {/* ── NAV ── */}
      <div style={S.nav}>
        <div style={S.navInner}>
           <div style={{display:"flex",alignItems:"center",gap:12}}>
             <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#00d4ff,#0066ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900}}>⬡</div>
             <div>
               <div style={{fontSize:14,fontWeight:700,letterSpacing:"0.05em",color:"#f8fafc"}}>AD SECURE SCORE</div>
               <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.12em",textTransform:"uppercase"}}>Domain Security Assessment Platform</div>
             </div>
           </div>
            <div style={{display:"flex",gap:2, alignItems:"center"}}>
              {/* Client Selector */}
              {selectedClientId && (
                <span style={{fontSize: 14, fontWeight: 600, color: '#00d4ff', marginRight: 8}}>
                  {clients.find(c => c.id === selectedClientId)?.name || ''}
                </span>
              )}
               <div style={{position: "relative", marginRight: "16px"}}>
                <select 
                  value={selectedClientId || ""}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "2px solid #00d4ff",
                    background: "#020c1b",
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 600,
                    minWidth: "140px",
                    cursor: "pointer",
                    "&:focus": {
                      outline: "none",
                      borderColor: "#00d4ff",
                      boxShadow: "0 0 0 3px rgba(0, 212, 255, 0.2)"
                    }
                  }}
                >
                  {clients.length > 0 ? (
                    <>
                      <option value="">Select Client</option>
              {clients.map(client => {
                    const display = deriveClientNameFromDomain(client?.data?.meta?.domain) || client.name;
                    return (
                      <option key={client.id} value={client.id}>{display}</option>
                    );
              })}
                    </>
                  ) : (
                    <option value="" disabled>No clients loaded - Import a JSON file to get started</option>
                  )}
                </select>
                {selectedClientId && (
                  <span style={{position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#00d4ff", fontWeight: 600}}>
                    ●
                  </span>
                )}
              </div>
              
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  padding:"8px 14px", borderRadius:6, border:"none", cursor:"pointer",
                  background: tab===t.id ? "rgba(0,212,255,0.15)" : "transparent",
                  color: tab===t.id ? "#00d4ff" : "#94a3b8",
                  borderBottom: tab===t.id ? "2px solid #00d4ff" : "2px solid transparent",
                  fontSize:11, fontWeight:600, letterSpacing:"0.04em", transition:"all 0.2s"
               }}>{t.icon} {t.label}</button>
             ))}
           </div>
          <button onClick={exportHTML} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #1e3a5f",background:"transparent",color:"#00d4ff",cursor:"pointer",fontSize:11,fontWeight:600}}>
            ⬇ Export HTML Report
          </button>
        </div>
      </div>

      <div style={S.body}>

        {/* ═══════════════ DASHBOARD ═══════════════ */}
        {tab==="dashboard" && (
          <div>
            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
              {[
                {label:"Overall Secure Score",value:`${overall}/100`,sub:scoreLabel(overall),color:scoreColor(overall),extra:`${delta>=0?"▲":"▼"} ${Math.abs(delta)}pts MoM`, highlight:true},
                {label:"Critical Findings",value:critFails.length,sub:"Require immediate action",color:"#ef4444"},
                {label:"High Risk Items",value:highFails.length,sub:"Require urgent attention",color:"#f97316"},
                {label:"Checks Passing",value:`${passing}/${findings.length}`,sub:"Score ≥80",color:"#22c55e"},
              ].map((k,i)=>(
                <div key={i} style={{
                  ...S.card,
                  borderTop:`4px solid ${k.color}`,
                  padding:20,
                  boxShadow: k.highlight 
                    ? "0 0 25px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 25px rgba(0,0,0,0.4)" 
                    : S.card.boxShadow,
                  border: k.highlight ? "1px solid rgba(0,212,255,0.4)" : S.card.border
                }}>
                  <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{k.label}</div>
                  <div style={{fontSize:38,fontWeight:800,color:k.color,fontFamily:"'Courier New',monospace"}}>{k.value}</div>
                  <div style={{fontSize:12,color:"#e2e8f0",marginTop:6,fontWeight:600}}>{k.sub}</div>
                  {k.extra && <div style={{fontSize:11,color:delta>=0?"#22c55e":"#ef4444",marginTop:6,fontWeight:600}}>{k.extra}</div>}
                </div>
              ))}
            </div>

            {/* Radar + Gauge */}
            <div style={{display:"grid",gridTemplateColumns:"1.3fr 0.7fr",gap:16,marginBottom:16}}>
              <div style={S.card}>
                <div style={S.sTitle}>Security Posture Radar</div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={CATEGORIES.map(c=>({subject:c.label,score:catMap[c.id],fullMark:100}))}>
                    <PolarGrid stroke="#334155"/>
                    <PolarAngleAxis dataKey="subject" tick={{fill:"#e2e8f0",fontSize:11}}/>
                    <PolarRadiusAxis angle={90} domain={[0,100]} tick={{fill:"#94a3b8",fontSize:9}}/>
                    <Radar name="Score" dataKey="score" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.25} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{
                  ...S.card,
                  flex:1,
                  display:"flex",
                  flexDirection:"column",
                  alignItems:"center",
                  justifyContent:"center", 
                  border:"1px solid rgba(0,212,255,0.4)", 
                  boxShadow:"0 0 25px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 15px rgba(0,0,0,0.4)"
                }}>
                  <HorizontalGauge score={overall} showDetails={true}/>
                  <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8}}>
                    Weighted across {CATEGORIES.length} categories
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.sTitle}>Failing by Severity</div>
                  {["Critical","High","Medium","Low"].map(sev => {
                    const t = findings.filter(f=>f.severity===sev).length;
                    const fail = findings.filter(f=>f.severity===sev&&f.status!=="Pass").length;
                    if (t===0) return null;
                    return (
                      <div key={sev} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{width:10,height:10,borderRadius:3,background:SEV_COLORS[sev], boxShadow:`0 0 8px ${SEV_COLORS[sev]}40`}}/>
                        <span style={{fontSize:12,color:"#e2e8f0",flex:1,fontWeight:500}}>{sev}</span>
                        <span style={{fontSize:12,color:SEV_COLORS[sev],fontWeight:700,fontFamily:"monospace"}}>{fail}/{t}</span>
                        <div style={{width:70,background:"#0f172a",borderRadius:4,height:8}}>
                          <div style={{width:`${(fail/t)*100}%`,height:"100%",borderRadius:4,background:SEV_COLORS[sev]}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category Bar */}
            <div style={{...S.card,marginBottom:16}}>
              <div style={S.sTitle}>Score by Category (Weighted)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={CATEGORIES.map(c=>({name:c.label,score:catMap[c.id],color:c.color}))} margin={{left:-20}}>
                  <XAxis dataKey="name" tick={{fill:"#e2e8f0",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,fontSize:11}} formatter={v=>[`${v}/100`,"Score"]}/>
                  <Bar dataKey="score" radius={[6,6,0,0]} maxBarSize={60}>
                    {CATEGORIES.map((c,i)=><Cell key={i} fill={c.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Priority Findings */}
            <div style={S.card}>
              <div style={S.sTitle}>⚠ Priority Remediation Items</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[...findings].sort((a,b)=>a.score-b.score).filter(f=>f.status!=="Pass").slice(0,10).map((f,i)=>(
                  <div key={i} onClick={()=>{setTab("remediation");setActiveFinding(f.checkId);}} style={{
                    background:"#020c1b",border:`1px solid ${SEV_COLORS[f.severity]}30`,
                    borderLeft:`3px solid ${SEV_COLORS[f.severity]}`,borderRadius:8,padding:"12px 16px",
                    cursor:"pointer",transition:"background 0.2s",display:"flex",alignItems:"center",justifyContent:"space-between"
                  }}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",marginBottom:2}}>{f.label}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{CATEGORIES.find(c=>c.id===f.category)?.label} · {f.threshold}</div>
                      <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{f.actualValue}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                      <div style={{fontSize:22,fontWeight:800,color:SEV_COLORS[f.severity],fontFamily:"monospace"}}>{f.score}</div>
                      <div style={{fontSize:9,color:SEV_COLORS[f.severity],textTransform:"uppercase"}}>{f.severity}</div>
                      <div style={{fontSize:9,color:"#00d4ff",marginTop:2}}>→ Remediate</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ CATEGORIES ═══════════════ */}
        {tab==="categories" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {CATEGORIES.map(cat=>{
              const cs = catMap[cat.id];
              return (
                <div key={cat.id} style={{...S.card,borderTop:`3px solid ${cat.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                    <div>
                      <div style={{fontSize:20}}>{cat.icon}</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{cat.label}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>Weight: {cat.weight}% · {findings.filter(f=>f.category===cat.id&&f.status==="Pass").length}/{findings.filter(f=>f.category===cat.id).length} passing</div>
                    </div>
                    <CircularGauge score={cs} size={90} stroke={9} color={cat.color}/>
                  </div>
                  {findings.filter(f=>f.category===cat.id).map((check,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer"}}
                         onClick={()=>{setTab("remediation");setActiveFinding(check.checkId);}}>
                      <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:scoreColor(check.score)}}/>
                      <div style={{flex:1,fontSize:11,color:"#94a3b8"}}>{check.label}</div>
                      <Pill label={check.severity} color={SEV_COLORS[check.severity]}/>
                      <div style={{width:70,background:"#020c1b",borderRadius:4,height:6}}>
                        <div style={{width:`${check.score}%`,height:"100%",borderRadius:4,background:scoreColor(check.score),transition:"width 0.5s"}}/>
                      </div>
                      <div style={{fontSize:11,color:"#e2e8f0",fontFamily:"monospace",width:24,textAlign:"right"}}>{check.score}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════ ALL CHECKS ═══════════════ */}
        {tab==="checks" && (
          <div style={{...S.card,padding:0,overflow:"hidden"}}>
            <div style={{padding:"16px", borderBottom:"1px solid #334155", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#0f172a"}}>
              <div>
                <div style={{fontSize:12, color:"#94a3b8"}}>Adjust scores using the sliders. Click Save to persist changes.</div>
                {pendingChanges && <div style={{fontSize:11, color:"#f97316", marginTop:4}}>● You have unsaved changes</div>}
              </div>
              <button 
                onClick={() => setShowPasswordPrompt(true)}
                disabled={saving}
                style={{
                  padding:"10px 20px",
                  borderRadius:6,
                  border:"none",
                  background: pendingChanges ? "linear-gradient(135deg,#f97316,#ef4444)" : "#334155",
                  color:"#fff",
                  cursor: pendingChanges ? "pointer" : "not-allowed",
                  fontSize:12,
                  fontWeight:700,
                  opacity: saving ? 0.7 : 1,
                  transition:"all 0.2s"
                }}
              >
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#0f172a"}}>
                  {["Check","Category","Threshold","Client Finding","Severity","Client Score","Client Status","Adjust Score"].map(h=>(
                    <th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid #334155"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.map((f,i)=>{
                  const cat = CATEGORIES.find(c=>c.id===f.category);
                  return (
                    <tr key={i} style={{borderBottom:"1px solid #1e293b"}}>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#f8fafc"}}>{f.label}</div>
                        <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>{f.description}</div>
                      </td>
                      <td style={{padding:"11px 14px"}}><Pill label={cat?.label||f.category} color={cat?.color||"#64748b"}/></td>
                      <td style={{padding:"11px 14px",fontSize:11,color:"#e2e8f0",maxWidth:140}}>{f.threshold}</td>
                      <td style={{padding:"11px 14px",fontSize:11,color:"#cbd5e1",maxWidth:140}}>{f.actualValue}</td>
                      <td style={{padding:"11px 14px"}}><Pill label={f.severity} color={SEVERITY_COLORS[f.severity]}/></td>
                      <td style={{padding:"11px 14px",fontSize:20,fontWeight:800,color:scoreColor(f.score),fontFamily:"monospace"}}>{f.score}</td>
                      <td style={{padding:"11px 14px"}}><Pill label={f.status} color={statusColor(f.status)}/></td>
                      <td style={{padding:"11px 14px"}}>
                        <input type="range" min={0} max={100} value={f.score} style={{width:80,accentColor:scoreColor(f.score)}}
                          onChange={e => {
                            setFindings(prev => prev.map((p,j) => j===i ? {...p, score:+e.target.value, status: +e.target.value>=85?"Pass":+e.target.value>=70?"Warning":+e.target.value>=50?"Warning":"Fail"} : p));
                            setPendingChanges(true);
                          }}/>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════ TREND ═══════════════ */}
        {tab==="trend" && (
          <div>
            <div style={{...S.card,marginBottom:16}}>
              <div style={S.sTitle}>Overall Secure Score — Month-over-Month Trend</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData} margin={{left:-20,top:10}}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
                  <XAxis dataKey="month" tick={{fill:"#e2e8f0",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#0d1f3c",border:"1px solid #1e3a5f",borderRadius:8,fontSize:11}} formatter={v=>[`${v}/100`,"Score"]}/>
                  <Area type="monotone" dataKey="score" stroke="#00d4ff" strokeWidth={3} fill="url(#scoreGrad)" dot={{fill:"#00d4ff",r:4}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{...S.card,marginBottom:16}}>
              <div style={S.sTitle}>Category Score Trends</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{left:-20,top:10}}>
                  <CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3"/>
                  <XAxis dataKey="month" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{fill:"#94a3b8",fontSize:9}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#0d1f3c",border:"1px solid #1e3a5f",borderRadius:8,fontSize:10}} formatter={(v,n)=>[`${v}`,(CATEGORIES.find(c=>c.id===n)||{label:n}).label]}/>
                  {CATEGORIES.map(c=><Line key={c.id} type="monotone" dataKey={c.id} stroke={c.color} strokeWidth={2} dot={false}/>)}
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:12}}>
                {CATEGORIES.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:3,background:c.color,borderRadius:2}}/><span style={{fontSize:10,color:"#64748b"}}>{c.label}</span></div>)}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {CATEGORIES.map(cat=>{
                const prev = history.length>1 ? (history[history.length-2].categoryScores?.[cat.id]||0) : catMap[cat.id];
                const d = catMap[cat.id] - prev;
                return (
                  <div key={cat.id} style={{...S.card}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <span>{cat.icon}</span>
                      <span style={{fontSize:11,color:d>=0?"#22c55e":"#ef4444",fontWeight:700}}>{d>=0?"▲":"▼"} {Math.abs(d)}pts MoM</span>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0",marginBottom:4}}>{cat.label}</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:28,fontWeight:800,color:cat.color,fontFamily:"monospace"}}>{catMap[cat.id]}</span>
                      <span style={{fontSize:11,color:"#94a3b8"}}>prev: {prev}</span>
                    </div>
                    <div style={{marginTop:8,background:"#020c1b",borderRadius:4,height:4}}>
                      <div style={{width:`${catMap[cat.id]}%`,height:"100%",borderRadius:4,background:cat.color,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════ REMEDIATION LIBRARY ═══════════════ */}
        {tab==="remediation" && (
          <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
            {/* Sidebar */}
            <div>
              <div style={{...S.card,padding:16,marginBottom:12}}>
                <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Filter by Tag</div>
                {["All","Critical","High","Identity","Password","GPO","DC Health","Hygiene","Monitoring"].map(f=>(
                  <button key={f} onClick={()=>setRemFilter(f)} style={{
                    display:"block",width:"100%",textAlign:"left",padding:"8px 12px",borderRadius:6,
                    border:"none",cursor:"pointer",marginBottom:4,fontSize:11,fontWeight:600,
                    background:remFilter===f?"rgba(0,212,255,0.15)":"transparent",
                    color:remFilter===f?"#00d4ff":"#94a3b8",
                    borderLeft:remFilter===f?"3px solid #00d4ff":"3px solid transparent"
                  }}>{f}</button>
                ))}
              </div>
              <div style={{...S.card,padding:16}}>
                <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Quick Select — Failing Checks</div>
                {findings.filter(f=>f.status!=="Pass").sort((a,b)=>a.score-b.score).map((f,i)=>(
                  <div key={i} onClick={()=>setActiveFinding(f.checkId)} style={{
                    padding:"10px 12px",borderRadius:6,cursor:"pointer",marginBottom:4,
                    background:activeFinding===f.checkId?"rgba(0,212,255,0.1)":"#0f172a",
                    borderLeft:`4px solid ${SEV_COLORS[f.severity]}`
                  }}>
                    <div style={{fontSize:12,fontWeight:600,color:"#f8fafc"}}>{f.label}</div>
                    <div style={{display:"flex",gap:6,marginTop:4}}>
                      <Pill label={f.severity} color={SEV_COLORS[f.severity]}/>
                      <span style={{fontSize:10,color:scoreColor(f.score),fontFamily:"monospace",fontWeight:600}}>{f.score}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Remediation Detail */}
            <div>
              {activeFinding && REMEDIATION_LIBRARY[activeFinding] ? (() => {
                const rem = REMEDIATION_LIBRARY[activeFinding];
                const finding = findings.find(f=>f.checkId===activeFinding);
                return (
                  <div>
                    <div style={{...S.card,marginBottom:14,borderLeft:`5px solid ${finding?SEV_COLORS[finding.severity]:"#00d4ff"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div>
                          <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",marginBottom:8}}>{rem.title}</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {rem.tags.map(t=><Pill key={t} label={t} color="#00d4ff"/>)}
                            <Pill label={`Effort: ${rem.effort}`} color="#64748b"/>
                            <Pill label={`Priority: ${rem.priority}`} color="#f59e0b"/>
                          </div>
                        </div>
                        {finding && (
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:36,fontWeight:800,color:scoreColor(finding.score),fontFamily:"monospace"}}>{finding.score}/100</div>
                            <Pill label={finding.severity} color={SEV_COLORS[finding.severity]}/>
                          </div>
                        )}
                      </div>
                      {finding && (
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14,padding:14,background:"#0f172a",borderRadius:8}}>
                          <div><div style={{fontSize:10,color:"#94a3b8",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Current State</div><div style={{fontSize:13,color:"#f87171",fontWeight:600}}>{finding.actualValue}</div></div>
                          <div><div style={{fontSize:10,color:"#94a3b8",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Target Threshold</div><div style={{fontSize:13,color:"#4ade80",fontWeight:600}}>{finding.threshold}</div></div>
                        </div>
                      )}
                    </div>

                    <div style={{...S.card,marginBottom:14}}>
                      <div style={S.sTitle}>Remediation Steps</div>
                      {rem.steps.map((step,i)=>(
                        <div key={i} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                          <div style={{width:24,height:24,borderRadius:12,background:"rgba(0,212,255,0.15)",border:"1px solid #00d4ff30",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,fontWeight:700,color:"#00d4ff"}}>{i+1}</div>
                          <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,paddingTop:2}}>{step}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{...S.card}}>
                      <div style={S.sTitle}>PowerShell Remediation Commands</div>
                      <pre style={{fontSize:11,color:"#22c55e",background:"#020c1b",borderRadius:8,padding:16,overflowX:"auto",lineHeight:1.7,fontFamily:"'Courier New',monospace",whiteSpace:"pre-wrap"}}>{rem.cmd}</pre>
                      <button onClick={()=>navigator.clipboard.writeText(rem.cmd)} style={{marginTop:10,padding:"8px 18px",borderRadius:6,border:"1px solid #00d4ff50",background:"rgba(0,212,255,0.1)",color:"#00d4ff",cursor:"pointer",fontSize:11,fontWeight:600}}>
                        ⎘ Copy to Clipboard
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div style={{...S.card,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:400,color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:16}}>⚙</div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>Select a Finding</div>
                  <div style={{fontSize:12}}>Choose a failing check from the left panel to view remediation steps and PowerShell commands</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ IMPORT ═══════════════ */}
        {tab==="import" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={S.card}>
              <div style={S.sTitle}>Import Collector JSON</div>
              <div style={{padding:"40px 24px",border:"2px dashed #1e3a5f",borderRadius:10,textAlign:"center",cursor:"pointer",marginBottom:16}} onClick={()=>fileRef.current?.click()}>
                <div style={{fontSize:32,marginBottom:12}}>📂</div>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:6}}>Drop JSON file or click to browse</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>Output from Invoke-ADSecureScoreCollector.ps1</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:4}}>ad_secure_score_YYYY-MM-DD.json</div>
              </div>
              <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
              {importStatus && (
                <div style={{padding:"12px 16px",borderRadius:8,background:importStatus.ok?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${importStatus.ok?"#22c55e30":"#ef444430"}`,color:importStatus.ok?"#22c55e":"#ef4444",fontSize:12}}>
                  {importStatus.ok?"✔":"✖"} {importStatus.msg}
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={S.sTitle}>Collector Usage Guide</div>
              <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.9}}>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#00d4ff",fontWeight:700,marginBottom:6}}>PREREQUISITES</div>
                  <pre style={{fontSize:10,color:"#22c55e",background:"#020c1b",borderRadius:6,padding:10,fontFamily:"monospace"}}>
{`# Run as Domain Admin on a DC or member server with RSAT
Import-Module ActiveDirectory
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`}
                  </pre>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#00d4ff",fontWeight:700,marginBottom:6}}>BASIC RUN</div>
                  <pre style={{fontSize:10,color:"#22c55e",background:"#020c1b",borderRadius:6,padding:10,fontFamily:"monospace"}}>
{`.\\Invoke-ADSecureScoreCollector.ps1 \`
  -OutputPath "C:\\ADSecureScore" \`
  -GenerateHTML`}
                  </pre>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"#00d4ff",fontWeight:700,marginBottom:6}}>FULL OPTIONS</div>
                  <pre style={{fontSize:10,color:"#22c55e",background:"#020c1b",borderRadius:6,padding:10,fontFamily:"monospace"}}>
{`.\\Invoke-ADSecureScoreCollector.ps1 \`
  -OutputPath "C:\\ADSecureScore\\Data" \`
  -DomainController "dc01.domain.com" \`
  -IncludeRemediation \`
  -GenerateHTML \`
  -HistoryRetentionMonths 12`}
                  </pre>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#00d4ff",fontWeight:700,marginBottom:6}}>SCHEDULED TASK (monthly)</div>
                  <pre style={{fontSize:10,color:"#22c55e",background:"#020c1b",borderRadius:6,padding:10,fontFamily:"monospace"}}>
{`$action = New-ScheduledTaskAction \`
  -Execute "PowerShell.exe" \`
  -Argument "-File C:\\Scripts\\Invoke-ADSecureScoreCollector.ps1 -GenerateHTML"
$trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At "02:00AM"
Register-ScheduledTask -TaskName "AD-SecureScore-Monthly" \`
  -Action $action -Trigger $trigger -RunLevel Highest`}
                  </pre>
                </div>
              </div>
            </div>

            <div style={{...S.card,gridColumn:"1/-1"}}>
              <div style={S.sTitle}>Output Files Generated by Collector</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {[
                  {icon:"📄",name:"ad_secure_score_YYYY-MM-DD.json",desc:"Full assessment data — import into this dashboard",color:"#00d4ff"},
                  {icon:"📊",name:"ad_secure_score_history.json",desc:"Rolling 12-month trend history — persists across runs",color:"#22c55e"},
                  {icon:"📋",name:"ad_secure_score_report_YYYY-MM-DD.html",desc:"Standalone executive HTML report for CEO distribution",color:"#f59e0b"},
                ].map((f,i)=>(
                  <div key={i} style={{padding:16,background:"#020c1b",borderRadius:8,border:`1px solid ${f.color}30`}}>
                    <div style={{fontSize:24,marginBottom:8}}>{f.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:f.color,fontFamily:"monospace",marginBottom:6}}>{f.name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
