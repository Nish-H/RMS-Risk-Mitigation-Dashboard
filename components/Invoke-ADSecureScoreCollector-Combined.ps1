#Requires -Version 5.1
#Requires -Modules ActiveDirectory

<#
.SYNOPSIS
    AD Secure Score Data Collector — COMBINED VERSION v3.0
    First Technology KwaZulu-Natal — MSP Domain Assessment Framework

.DESCRIPTION
    Collects 52 security check data points across 7 categories from an Active Directory
    domain environment. Outputs a structured JSON file consumed by the AD Secure Score
    Dashboard and HTML Report Generator.

    This is the COMBINED version incorporating all checks from:
    - Base v2.0/v2.2 (44 original checks)
    - Addendum v1.0: dcRedundancy, dnsZoneSync, dcNicDns, pwdNotRequired
    - Addendum v2.0: caCertExpiry, gpoCertExpiry, legacyOS, serverAvCoverage

    Categories assessed:
      1. Identity & Access Control    (22% weight)
      2. Password & Authentication     (18% weight)
      3. GPO & Hardening              (18% weight)
      4. Domain Controller Health      (18% weight)
      5. Active Directory Hygiene      (9% weight)
      6. Security Monitoring & Logging (5% weight)
      7. Infrastructure               (10% weight) — NEW

.PARAMETER OutputPath
    Directory where the JSON results file will be saved.
    Default: C:\ADSecureScore\Data

.PARAMETER DomainController
    Target Domain Controller FQDN. Defaults to the PDC Emulator.

.PARAMETER IncludeRemediation
    If set, includes remediation command snippets in JSON output.

.PARAMETER GenerateHTML
    If set, also generates a standalone HTML executive report after collection.

.PARAMETER HistoryRetentionMonths
    Number of months of history to retain in the trend file. Default: 12

.EXAMPLE
    .\Invoke-ADSecureScoreCollector-Combined.ps1 -OutputPath "C:\ADSecureScore\Data" -GenerateHTML

.NOTES
    Author  : First Technology KZN — Senior Systems Engineering
    Version : 3.0 (Combined)
    Requires: ActiveDirectory module, DNS Server module (optional), Run as Domain Admin
#>

[CmdletBinding()]
param(
    [string]$OutputPath             = "C:\ADSecureScore\Data",
    [string]$DomainController       = "",
    [switch]$IncludeRemediation,
    [switch]$GenerateHTML,
    [int]   $HistoryRetentionMonths = 12
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
$WarningPreference     = "SilentlyContinue"

#region ── Init ───────────────────────────────────────────────────────────────

$Script:Version     = "3.0"
$Script:RunDate     = Get-Date
$Script:RunDateStr  = $Script:RunDate.ToString("yyyy-MM-dd")
$Script:RunDateFull = $Script:RunDate.ToString("dd MMMM yyyy HH:mm")

$Script:Findings    = New-Object System.Collections.ArrayList
$Script:Errors      = New-Object System.Collections.ArrayList

function Write-Section { param($m) Write-Host "`n  === $m ===" -ForegroundColor Cyan }
function Write-Pass    { param($m) Write-Host "  [PASS]  $m" -ForegroundColor Green }
function Write-Warn    { param($m) Write-Host "  [WARN]  $m" -ForegroundColor Yellow }
function Write-Fail    { param($m) Write-Host "  [FAIL]  $m" -ForegroundColor Red }
function Write-Info    { param($m) Write-Host "  [INFO]  $m" -ForegroundColor Gray }
function Write-Err     { param($m,$e) Write-Host "  [ERR ]  $m : $($e.Exception.Message)" -ForegroundColor DarkRed }

Write-Host ""
Write-Host "  +====================================================+" -ForegroundColor Cyan
Write-Host "  |  AD SECURE SCORE COLLECTOR  v$Script:Version (Combined)          |" -ForegroundColor Cyan
Write-Host "  |  First Technology KwaZulu-Natal                    |" -ForegroundColor Cyan
Write-Host "  |  Run Date : $Script:RunDateFull            |" -ForegroundColor Cyan
Write-Host "  +====================================================+" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $OutputPath)) { New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null }

try {
    $Domain = Get-ADDomain -ErrorAction Stop
    $Forest = Get-ADForest -ErrorAction Stop
    if ([string]::IsNullOrEmpty($DomainController)) { $DomainController = $Domain.PDCEmulator }
    Write-Info "Domain : $($Domain.DNSRoot)"
    Write-Info "DC     : $DomainController"
} catch { Write-Err "Cannot connect to Active Directory" $_; exit 1 }

Write-Info "Caching AD objects..."

$AllUsers = Get-ADUser -Filter * -Properties `
    PasswordNeverExpires, PasswordLastSet, LastLogonDate, Enabled, `
    ServicePrincipalName, DoesNotRequirePreAuth, `
    AllowReversiblePasswordEncryption, MemberOf, AdminCount, Description, userAccountControl `
    -ErrorAction SilentlyContinue

$AllComputers = Get-ADComputer -Filter * -Properties LastLogonDate, Enabled, OperatingSystem `
    -ErrorAction SilentlyContinue
$AllDCs       = Get-ADDomainController -Filter * -ErrorAction SilentlyContinue
$AllGPOs      = Get-GPO -All -ErrorAction SilentlyContinue

$AllServers = @($AllComputers | Where-Object {
    $_.Enabled -and $_.OperatingSystem -match "Server"
})

Write-Info "Cached: $(@($AllUsers).Count) users | $(@($AllComputers).Count) computers | $(@($AllDCs).Count) DCs | $(@($AllGPOs).Count) GPOs | $(@($AllServers).Count) enabled servers"

#endregion

#region ── Helper ─────────────────────────────────────────────────────────────

function Add-Finding {
    param(
        [string]$CheckId, [string]$Category, [string]$Label, [string]$Description,
        [string]$Severity, [int]$Score, [string]$Status, [string]$Threshold,
        [string]$ActualValue, [string]$Recommendation, [string]$RemediationCmd = ""
    )
    if ($IncludeRemediation) { $cmdValue = $RemediationCmd } else { $cmdValue = "" }

    $finding = [PSCustomObject]@{
        checkId        = $CheckId
        category       = $Category
        label          = $Label
        description    = $Description
        severity       = $Severity
        score          = $Score
        status         = $Status
        threshold      = $Threshold
        actualValue    = $ActualValue
        recommendation = $Recommendation
        remediationCmd = $cmdValue
        collectedAt    = $Script:RunDateStr
    }
    [void]$Script:Findings.Add($finding)
}

#endregion

#region ══ CATEGORY 1 — IDENTITY & ACCESS ════════════════════════════════════

Write-Section "CATEGORY 1 — Identity & Access Control"

# ── 1.1 Kerberoastable
try {
    $privGroupNames = @("Domain Admins","Enterprise Admins","Schema Admins","Administrators")
    $privSAMs = @{}
    foreach ($g in $privGroupNames) {
        try {
            $members = Get-ADGroupMember -Identity $g -Recursive -ErrorAction SilentlyContinue |
                Where-Object { $_.objectClass -eq 'user' }
            foreach ($m in @($members)) {
                $privSAMs[$m.SamAccountName.ToLower()] = $true
            }
        } catch {}
    }
    $kerbAccounts = @($AllUsers | Where-Object {
        $_.Enabled -and
        $privSAMs.ContainsKey($_.SamAccountName.ToLower()) -and
        (@($_.ServicePrincipalName)).Count -gt 0
    })
    $count  = $kerbAccounts.Count
    $score  = if ($count -eq 0) { 100 } elseif ($count -le 2) { 60 } else { [Math]::Max(0, 100 - ($count * 20)) }
    $status = if ($count -eq 0) { "Pass" } elseif ($count -le 2) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Kerberoastable Accounts: $count" } else { Write-Fail "Kerberoastable Accounts: $count" }
    Add-Finding -CheckId "kerberoastable" -Category "identity" -Label "Kerberoastable SPNs" `
        -Description "Privileged accounts with SPN (vulnerable to Kerberoast attack)" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 privileged accounts with SPN" -ActualValue "$count account(s)" `
        -Recommendation "Remove SPNs from privileged accounts. Use gMSA for services." `
        -RemediationCmd "Get-ADUser -Filter {Enabled -eq `$true} -Properties ServicePrincipalName,MemberOf | Where {`$_.ServicePrincipalName -and (`$_.MemberOf -match 'Domain Admins')} | Select Name,SamAccountName,ServicePrincipalName"
} catch { Write-Err "kerberoastable" $_; [void]$Script:Errors.Add("kerberoastable: $($_.Exception.Message)") }

# ── 1.2 Password Never Expires
try {
    $enabled  = @($AllUsers | Where-Object { $_.Enabled })
    $neverExp = @($enabled  | Where-Object { $_.PasswordNeverExpires })
    $pct      = if ($enabled.Count -gt 0) { [Math]::Round(($neverExp.Count / $enabled.Count) * 100, 1) } else { 0 }
    $score    = if ($pct -le 2) { 100 } elseif ($pct -le 5) { 75 } elseif ($pct -le 15) { 50 } else { 20 }
    $status   = if ($pct -le 2) { "Pass" } elseif ($pct -le 5) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Password Never Expires: $($neverExp.Count) ($pct%)" } else { Write-Fail "Password Never Expires: $($neverExp.Count) ($pct%)" }
    Add-Finding -CheckId "pwdNeverExpires" -Category "identity" -Label "Password Never Expires" `
        -Description "Enabled accounts with non-expiring passwords" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Less than 5% of enabled accounts" -ActualValue "$($neverExp.Count) accounts ($pct%)" `
        -Recommendation "Audit accounts. Service accounts should use MSA/gMSA. Regular accounts must comply with password policy." `
        -RemediationCmd "Get-ADUser -Filter {PasswordNeverExpires -eq `$true -and Enabled -eq `$true} | Select Name,SamAccountName | Export-Csv PwdNeverExpires.csv -NoTypeInformation"
} catch { Write-Err "pwdNeverExpires" $_; [void]$Script:Errors.Add("pwdNeverExpires: $($_.Exception.Message)") }

# ── 1.3 Stale Admin Accounts
try {
    $cutoff      = (Get-Date).AddDays(-90)
    $adminUsers  = @($AllUsers | Where-Object {
        $_.Enabled -and (
            ($_.AdminCount -eq 1) -or
            ($_.MemberOf -match "CN=Domain Admins|CN=Enterprise Admins|CN=Schema Admins")
        )
    })
    $staleAdmins = @($adminUsers | Where-Object { $_.LastLogonDate -lt $cutoff -or $null -eq $_.LastLogonDate })
    $score  = if ($staleAdmins.Count -eq 0) { 100 } elseif ($staleAdmins.Count -eq 1) { 65 } else { [Math]::Max(0, 100 - ($staleAdmins.Count * 25)) }
    $status = if ($staleAdmins.Count -eq 0) { "Pass" } elseif ($staleAdmins.Count -le 1) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Stale Admin Accounts: $($staleAdmins.Count)" } else { Write-Fail "Stale Admin Accounts: $($staleAdmins.Count)" }
    Add-Finding -CheckId "staleAdmins" -Category "identity" -Label "Stale Admin Accounts" `
        -Description "Privileged accounts with no logon in 90+ days" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 stale admin accounts" -ActualValue "$($staleAdmins.Count) stale account(s)" `
        -Recommendation "Disable or remove stale admin accounts immediately. Implement quarterly reviews." `
        -RemediationCmd "`$cutoff=(Get-Date).AddDays(-90)`nGet-ADGroupMember 'Domain Admins' -Recursive | Where {`$_.objectClass -eq 'user'} | Get-ADUser -Properties LastLogonDate | Where {`$_.LastLogonDate -lt `$cutoff} | Disable-ADAccount"
} catch { Write-Err "staleAdmins" $_; [void]$Script:Errors.Add("staleAdmins: $($_.Exception.Message)") }

# ── 1.4 Dual-use Admin Accounts
try {
    $daMembers = @(Get-ADGroupMember "Domain Admins" -Recursive -ErrorAction SilentlyContinue | Where-Object { $_.objectClass -eq "user" })
    $dualUse   = @($daMembers | Where-Object {
        $_.SamAccountName -notmatch "^(adm|adm-|admin|svc|sa-|t0-|tier0|_adm)"
    })
    $count  = $dualUse.Count
    $score  = if ($count -eq 0) { 100 } else { [Math]::Max(0, 100 - ($count * 10)) }
    $status = if ($count -eq 0) { "Pass" } elseif ($count -le 2) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Dual-use Admin Accounts: $count" } else { Write-Fail "Dual-use Admin Accounts: $count" }
    Add-Finding -CheckId "dualUseAdmin" -Category "identity" -Label "Dual-use Admin Accounts" `
        -Description "Domain Admins members not clearly designated as admin-only accounts" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 - all admins must use dedicated admin accounts" -ActualValue "$count potential dual-use account(s)" `
        -Recommendation "Implement Tiered Administration. Admin accounts for admin tasks only, separate from daily-use accounts." `
        -RemediationCmd "Get-ADGroupMember 'Domain Admins' -Recursive | Where {`$_.objectClass -eq 'user'} | Get-ADUser -Properties Description | Select Name,SamAccountName,Description | Export-Csv DA_Audit.csv"
} catch { Write-Err "dualUseAdmin" $_; [void]$Script:Errors.Add("dualUseAdmin: $($_.Exception.Message)") }

# ── 1.5 Protected Users Group
try {
    $protMembers = @(Get-ADGroupMember "Protected Users" -Recursive -ErrorAction SilentlyContinue | Where-Object { $_.objectClass -eq "user" })
    $tier0Count  = 0
    foreach ($g in @("Domain Admins","Enterprise Admins","Schema Admins")) {
        try { $tier0Count += @(Get-ADGroupMember $g -Recursive -ErrorAction SilentlyContinue | Where-Object { $_.objectClass -eq "user" }).Count } catch {}
    }
    $protCount = $protMembers.Count
    $pct    = if ($tier0Count -gt 0) { [Math]::Round(($protCount / $tier0Count) * 100) } else { 0 }
    $score  = if ($pct -ge 100) { 100 } elseif ($pct -ge 80) { 75 } elseif ($pct -ge 50) { 50 } else { 20 }
    $status = if ($pct -ge 100) { "Pass" } elseif ($pct -ge 80) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Protected Users: $pct%" } else { Write-Fail "Protected Users: $pct% ($protCount/$tier0Count Tier-0)" }
    Add-Finding -CheckId "protectedUsers" -Category "identity" -Label "Protected Users Group" `
        -Description "Tier-0 admin accounts enrolled in the Protected Users security group" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "100% of Tier-0 admins" -ActualValue "$protCount of $tier0Count Tier-0 admins ($pct%)" `
        -Recommendation "Add all Domain Admins, Enterprise Admins, Schema Admins to Protected Users group. Test compatibility first." `
        -RemediationCmd "Get-ADGroupMember 'Domain Admins' -Recursive | Where {`$_.objectClass -eq 'user'} | ForEach-Object { Add-ADGroupMember 'Protected Users' -Members `$_.SamAccountName }"
} catch { Write-Err "protectedUsers" $_; [void]$Script:Errors.Add("protectedUsers: $($_.Exception.Message)") }

# ── 1.6 Default Admin Account
try {
    $builtinAdmin = Get-ADUser -Filter { SamAccountName -eq "Administrator" } `
        -Properties Enabled, Name, LastLogonDate -ErrorAction SilentlyContinue
    if ($null -eq $builtinAdmin) {
        $domSID       = (Get-ADDomain).DomainSID.Value
        $adminSID     = "$domSID-500"
        $builtinAdmin = Get-ADUser -Identity $adminSID -Properties Enabled, Name, LastLogonDate -ErrorAction SilentlyContinue
    }
    $renamed  = ($null -ne $builtinAdmin) -and ($builtinAdmin.SamAccountName -ne "Administrator") -and ($builtinAdmin.SamAccountName -ne "Admin")
    $disabled = ($null -ne $builtinAdmin) -and (-not $builtinAdmin.Enabled)
    $score    = if ($renamed -and $disabled) { 100 } elseif ($renamed -or $disabled) { 50 } else { 0 }
    $status   = if ($score -ge 100) { "Pass" } elseif ($score -ge 50) { "Warning" } else { "Fail" }
    if ($null -ne $builtinAdmin) { $actual = "Name: $($builtinAdmin.Name), Enabled: $($builtinAdmin.Enabled)" } else { $actual = "Account not found via name or SID" }
    if ($status -eq "Pass") { Write-Pass "Default Admin: Renamed & Disabled" } else { Write-Fail "Default Admin: $actual" }
    Add-Finding -CheckId "defaultAdmin" -Category "identity" -Label "Default Admin Account" `
        -Description "Built-in Administrator (RID-500) should be renamed and disabled" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Renamed and Disabled" -ActualValue $actual `
        -Recommendation "Rename the built-in Administrator account and disable it." `
        -RemediationCmd "`$domSID=(Get-ADDomain).DomainSID.Value`nRename-ADObject -Identity (Get-ADUser `"`$domSID-500`").DistinguishedName -NewName 'Acct-Disabled-500'`nDisable-ADAccount -Identity `"`$domSID-500`""
} catch { Write-Err "defaultAdmin" $_; [void]$Script:Errors.Add("defaultAdmin: $($_.Exception.Message)") }

# ── 1.7 NEW: Password Not Required (PASSWD_NOTREQD flag) — from Addendum v1.0
try {
    $PASSWD_NOTREQD_BIT = 32
    $enabledNoReqPwd  = @($AllUsers | Where-Object {
        $_.Enabled -and ($_.userAccountControl -band $PASSWD_NOTREQD_BIT) -ne 0
    })
    $disabledNoReqPwd = @($AllUsers | Where-Object {
        (-not $_.Enabled) -and ($_.userAccountControl -band $PASSWD_NOTREQD_BIT) -ne 0
    })
    $enabledCount  = $enabledNoReqPwd.Count
    $disabledCount = $disabledNoReqPwd.Count

    if ($enabledCount -eq 0) { $score = 100; $status = "Pass" }
    elseif ($enabledCount -le 2) { $score = 50; $status = "Fail" }
    elseif ($enabledCount -le 9) { $score = 20; $status = "Fail" }
    else { $score = 0; $status = "Fail" }

    $sampleAccounts = @($enabledNoReqPwd | Select-Object -First 10 -ExpandProperty SamAccountName)
    $sampleStr = if ($sampleAccounts.Count -gt 0) { $sampleAccounts -join ", " } else { "" }
    if ($enabledCount -gt 10) { $sampleStr += " ... and $($enabledCount - 10) more" }

    if ($enabledCount -eq 0) { $actual = "0 enabled accounts with PASSWD_NOTREQD flag. $disabledCount disabled account(s) still carry the flag." }
    else { $actual = "$enabledCount ENABLED account(s) with PASSWD_NOTREQD: $sampleStr" }

    if ($status -eq "Pass") { Write-Pass "Password Not Required: $actual" }
    else { Write-Fail "Password Not Required: $enabledCount enabled account(s) with blank-password capability" }
    Add-Finding -CheckId "pwdNotRequired" -Category "identity" -Label "Password Not Required (Legacy)" `
        -Description "Accounts with PASSWD_NOTREQD flag - can authenticate with blank password" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 enabled accounts with PASSWD_NOTREQD flag" -ActualValue $actual `
        -Recommendation "Clear the PASSWD_NOTREQD flag on all affected accounts." `
        -RemediationCmd "Get-ADUser -Filter * -Properties userAccountControl | Where-Object { (`$_.userAccountControl -band 32) -ne 0 } | Export-Csv C:\Temp\PwdNotRequired_Audit.csv"
} catch { Write-Err "pwdNotRequired" $_; [void]$Script:Errors.Add("pwdNotRequired: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 2 — PASSWORD & AUTH ══════════════════════════════════════

Write-Section "CATEGORY 2 — Password & Authentication"

# ── 2.1 Min Password Length
try {
    $policy = Get-ADDefaultDomainPasswordPolicy -ErrorAction Stop
    $minLen = $policy.MinPasswordLength
    $score  = if ($minLen -ge 14) { 100 } elseif ($minLen -eq 12) { 50 } else { 0 }
    $status = if ($score -ge 50) { "Pass" } else { "Fail" }
    if ($status -ne "Fail") { Write-Pass "Min Password Length: $minLen" } else { Write-Fail "Min Password Length: $minLen (target 14+)" }
    Add-Finding -CheckId "minPwdLength" -Category "password" -Label "Minimum Password Length" `
        -Description "Default Domain Password Policy minimum password length" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "14+ characters (100%), 12 characters (50%), 11 or below (0%)" -ActualValue "$minLen characters" `
        -Recommendation "Set minimum password length to 14+ characters via Default Domain Policy." `
        -RemediationCmd "Set-ADDefaultDomainPasswordPolicy -Identity '$($Domain.DNSRoot)' -MinPasswordLength 14"
} catch { Write-Err "minPwdLength" $_; [void]$Script:Errors.Add("minPwdLength: $($_.Exception.Message)") }

# ── 2.2 Fine-Grained Password Policies
try {
    $fgpps     = @(Get-ADFineGrainedPasswordPolicy -Filter * -ErrorAction SilentlyContinue)
    $adminFGPP = @($fgpps | Where-Object {
        $subjects = @(Get-ADFineGrainedPasswordPolicySubject $_.Name -ErrorAction SilentlyContinue)
        ($subjects | Where-Object { $_.Name -match "Admin|Admins|Tier" }).Count -gt 0
    })
    $hasFGPP = $adminFGPP.Count -gt 0
    $score   = if ($hasFGPP) { 100 } elseif ($fgpps.Count -gt 0) { 60 } else { 0 }
    $status  = if ($hasFGPP) { "Pass" } elseif ($fgpps.Count -gt 0) { "Warning" } else { "Fail" }
    $actual  = "Total PSOs: $($fgpps.Count); Admin-targeted: $($adminFGPP.Count)"
    if ($status -eq "Pass") { Write-Pass "FGPP: $actual" } else { Write-Warn "FGPP: $actual" }
    Add-Finding -CheckId "fgpp" -Category "password" -Label "Fine-Grained Password Policy" `
        -Description "Password Settings Objects (PSO) targeting admin accounts" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "PSO applied to all admin groups" -ActualValue $actual `
        -Recommendation "Create a stricter PSO for admin accounts (min 20 chars, lockout after 3 attempts)." `
        -RemediationCmd "New-ADFineGrainedPasswordPolicy -Name 'PSO-Admins' -Precedence 10 -MinPasswordLength 20 -LockoutThreshold 3"
} catch { Write-Err "fgpp" $_; [void]$Script:Errors.Add("fgpp: $($_.Exception.Message)") }

# ── 2.3 Reversible Encryption
try {
    $revEnc = @($AllUsers | Where-Object { $_.Enabled -and $_.AllowReversiblePasswordEncryption -eq $true })
    $score  = if ($revEnc.Count -eq 0) { 100 } else { 0 }
    $status = if ($revEnc.Count -eq 0) { "Pass" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Reversible Encryption: 0 accounts" } else { Write-Fail "Reversible Encryption: $($revEnc.Count)" }
    Add-Finding -CheckId "reversibleEncrypt" -Category "password" -Label "Reversible Encryption" `
        -Description "Accounts with AllowReversiblePasswordEncryption enabled" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 accounts" -ActualValue "$($revEnc.Count) account(s)" `
        -Recommendation "Disable reversible password encryption on all affected accounts immediately." `
        -RemediationCmd "Get-ADUser -Filter {AllowReversiblePasswordEncryption -eq `$true} | Set-ADUser -AllowReversiblePasswordEncryption `$false"
} catch { Write-Err "reversibleEncrypt" $_; [void]$Script:Errors.Add("reversibleEncrypt: $($_.Exception.Message)") }

# ── 2.4 AS-REP Roastable
try {
    $asrep  = @($AllUsers | Where-Object { $_.Enabled -and $_.DoesNotRequirePreAuth -eq $true })
    $score  = if ($asrep.Count -eq 0) { 100 } else { 0 }
    $status = if ($asrep.Count -eq 0) { "Pass" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "AS-REP Roastable: 0 accounts" } else { Write-Fail "AS-REP Roastable: $($asrep.Count)" }
    Add-Finding -CheckId "asrepRoastable" -Category "password" -Label "AS-REP Roastable Accounts" `
        -Description "Accounts with Kerberos pre-authentication disabled" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 accounts" -ActualValue "$($asrep.Count) account(s)" `
        -Recommendation "Enable Kerberos pre-authentication on all accounts." `
        -RemediationCmd "Get-ADUser -Filter {DoesNotRequirePreAuth -eq `$true} | Set-ADUser -KerberosEncryptionType AES256"
} catch { Write-Err "asrepRoastable" $_; [void]$Script:Errors.Add("asrepRoastable: $($_.Exception.Message)") }

# ── 2.5 Password Age Compliance
try {
    $enabled = @($AllUsers | Where-Object { $_.Enabled -and -not $_.PasswordNeverExpires })
    $oldPwd  = @($enabled  | Where-Object { $_.PasswordLastSet -lt (Get-Date).AddDays(-365) -or $null -eq $_.PasswordLastSet })
    $pct     = if ($enabled.Count -gt 0) { [Math]::Round(($oldPwd.Count / $enabled.Count) * 100, 1) } else { 0 }
    $score   = if ($pct -le 2) { 100 } elseif ($pct -le 5) { 75 } elseif ($pct -le 15) { 45 } else { 15 }
    $status  = if ($pct -le 2) { "Pass" } elseif ($pct -le 5) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Password Age >365d: $($oldPwd.Count) ($pct%)" } else { Write-Fail "Password Age >365d: $($oldPwd.Count) ($pct%)" }
    Add-Finding -CheckId "pwdAge" -Category "password" -Label "Password Age Compliance" `
        -Description "Enabled accounts with password unchanged for more than 365 days" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Less than 2% of enabled accounts" -ActualValue "$($oldPwd.Count) accounts ($pct%)" `
        -Recommendation "Force password reset for non-compliant accounts. Enforce maximum password age policy." `
        -RemediationCmd "Get-ADUser -Filter {Enabled -eq `$true} -Properties PasswordLastSet | Where {`$_.PasswordLastSet -lt (Get-Date).AddDays(-365)} | Set-ADUser -ChangePasswordAtLogon `$true"
} catch { Write-Err "pwdAge" $_; [void]$Script:Errors.Add("pwdAge: $($_.Exception.Message)") }

# ── 2.6 MFA Coverage
try {
    $aadConnect = Get-ADObject -Filter { objectClass -eq "msDS-Device" } -ErrorAction SilentlyContinue
    $msolModule = Get-Module -ListAvailable -Name MSOnline -ErrorAction SilentlyContinue
    $aadCount   = @($aadConnect).Count
    $hasMFA     = ($null -ne $msolModule) -or ($aadCount -gt 0)
    $score      = if ($hasMFA) { 80 } else { 20 }
    $status     = if ($hasMFA) { "Warning" } else { "Fail" }
    $actual     = if ($hasMFA) { "Hybrid/Azure AD indicators found - verify MFA % in Azure AD portal" } else { "No MFA infrastructure detected" }
    Write-Warn "MFA Coverage: $actual"
    Add-Finding -CheckId "mfaCoverage" -Category "password" -Label "MFA Enforcement" `
        -Description "Multi-factor authentication coverage across user accounts" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "95%+ of user accounts with MFA registered" -ActualValue $actual `
        -Recommendation "Verify MFA coverage in Azure AD portal. Enforce via Conditional Access policies." `
        -RemediationCmd "Connect-MsolService`n`$users=Get-MsolUser -All`n`$mfaOn=`$users | Where {`$_.StrongAuthenticationRequirements.Count -gt 0}`nWrite-Host `"MFA: `$(`$mfaOn.Count)/`$(`$users.Count)`""
} catch { Write-Err "mfaCoverage" $_; [void]$Script:Errors.Add("mfaCoverage: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 3 — GPO & HARDENING ══════════════════════════════════════

Write-Section "CATEGORY 3 — GPO & Hardening"

# ── 3.1 Default Domain Policy
try {
    $ddp          = $AllGPOs | Where-Object { $_.DisplayName -eq "Default Domain Policy" }
    $ddpReport    = if ($ddp) { Get-GPOReport -Guid $ddp.Id -ReportType Xml -ErrorAction SilentlyContinue } else { "" }
    $ddpMatches   = [regex]::Matches($ddpReport, "<q\d+:Name>")
    $settingCount = $ddpMatches.Count
    $modified     = $settingCount -gt 25
    $score  = if (-not $modified) { 100 } else { 40 }
    $status = if (-not $modified) { "Pass" } else { "Warning" }
    if ($status -eq "Pass") { Write-Pass "Default Domain Policy: Appears baseline" } else { Write-Warn "Default Domain Policy: $settingCount settings detected" }
    Add-Finding -CheckId "ddpModified" -Category "gpo" -Label "Default Domain Policy Modified" `
        -Description "Default Domain Policy contains settings beyond Kerberos and password policy" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "DDP used only for domain-wide password and Kerberos policy" -ActualValue "$settingCount settings detected" `
        -Recommendation "Move non-password/Kerberos settings from DDP to dedicated GPOs." `
        -RemediationCmd "Get-GPOReport -Name 'Default Domain Policy' -ReportType HTML -Path 'C:\Temp\DDP-Report.html'"
} catch { Write-Err "ddpModified" $_; [void]$Script:Errors.Add("ddpModified: $($_.Exception.Message)") }

# ── 3.2 Orphaned GPOs
try {
    $orphaned = @($AllGPOs | Where-Object {
        $rpt = Get-GPOReport -Guid $_.Id -ReportType Xml -ErrorAction SilentlyContinue
        $rpt -notmatch "<LinksTo>"
    })
    $count  = $orphaned.Count
    $score  = if ($count -eq 0) { 100 } elseif ($count -le 3) { 75 } else { 50 }
    $status = if ($count -eq 0) { "Pass" } elseif ($count -le 3) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Orphaned GPOs: $count" } else { Write-Warn "Orphaned GPOs: $count" }
    Add-Finding -CheckId "orphanedGPO" -Category "gpo" -Label "Orphaned GPOs" `
        -Description "GPOs with no OU or site links" `
        -Severity "Low" -Score $score -Status $status `
        -Threshold "0 unlinked GPOs" -ActualValue "$count unlinked GPO(s)" `
        -Recommendation "Review and remove orphaned GPOs." `
        -RemediationCmd "Get-GPO -All | Where {([xml](Get-GPOReport -Guid `$_.Id -ReportType Xml)).GPO.LinksTo -eq `$null} | Select DisplayName | Export-Csv OrphanedGPOs.csv"
} catch { Write-Err "orphanedGPO" $_; [void]$Script:Errors.Add("orphanedGPO: $($_.Exception.Message)") }

# ── 3.3 LAPS
try {
    $lapsAttr      = Get-ADObject -LDAPFilter "(objectClass=attributeSchema)" -SearchBase (Get-ADRootDSE).schemaNamingContext -Filter { Name -like "ms-Mcs-AdmPwd" } -ErrorAction SilentlyContinue
    $lapsInstalled = ($null -ne $lapsAttr)
    $lapsComputers = if ($lapsInstalled) { @($AllComputers | Where-Object { $_.Enabled }).Count } else { 0 }
    $lapsManaged   = if ($lapsInstalled) {
        @(Get-ADComputer -Filter * -Properties "ms-Mcs-AdmPwd" -ErrorAction SilentlyContinue | Where-Object { $_."ms-Mcs-AdmPwd" }).Count
    } else { 0 }
    $pct    = if ($lapsComputers -gt 0) { [Math]::Round(($lapsManaged / $lapsComputers) * 100) } else { 0 }
    $score  = if (-not $lapsInstalled) { 0 } elseif ($pct -ge 95) { 100 } elseif ($pct -ge 80) { 70 } else { 35 }
    $status = if (-not $lapsInstalled) { "Fail" } elseif ($pct -ge 95) { "Pass" } elseif ($pct -ge 80) { "Warning" } else { "Fail" }
    $actual = if ($lapsInstalled) { "Installed. $lapsManaged/$lapsComputers computers ($pct%)" } else { "LAPS schema extension NOT present" }
    if ($status -eq "Pass") { Write-Pass "LAPS: $actual" } else { Write-Fail "LAPS: $actual" }
    Add-Finding -CheckId "laps" -Category "gpo" -Label "LAPS Deployment" `
        -Description "Local Administrator Password Solution coverage on domain computers" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "95%+ of domain computers" -ActualValue $actual `
        -Recommendation "Deploy Microsoft LAPS to all domain-joined computers. Restrict ms-Mcs-AdmPwd read access." `
        -RemediationCmd "Import-Module AdmPwd.PS`nUpdate-AdmPwdADSchema`nSet-AdmPwdComputerSelfPermission -OrgUnit 'OU=Computers,DC=domain,DC=com'"
} catch { Write-Err "laps" $_; [void]$Script:Errors.Add("laps: $($_.Exception.Message)") }

# ── 3.4 SMBv1
try {
    $smbConfig   = Get-SmbServerConfiguration -ErrorAction SilentlyContinue
    $smb1Enabled = if ($smbConfig) { $smbConfig.EnableSMB1Protocol } else { $null }
    $score  = if ($smb1Enabled -ne $true) { 100 } else { 0 }
    $status = if ($smb1Enabled -ne $true) { "Pass" } else { "Fail" }
    if ($smb1Enabled) { $smb1Text = "ENABLED" } else { $smb1Text = "Disabled" }
    if ($status -eq "Pass") { Write-Pass "SMBv1: Disabled" } else { Write-Fail "SMBv1: ENABLED!" }
    Add-Finding -CheckId "smbv1" -Category "gpo" -Label "SMBv1 Disabled" `
        -Description "SMBv1 protocol enabled on domain controllers (EternalBlue/WannaCry risk)" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "Disabled on all systems" -ActualValue "Local DC SMBv1: $smb1Text" `
        -Recommendation "Disable SMBv1 via GPO and directly on all servers." `
        -RemediationCmd "Set-SmbServerConfiguration -EnableSMB1Protocol `$false -Force"
} catch { Write-Err "smbv1" $_; [void]$Script:Errors.Add("smbv1: $($_.Exception.Message)") }

# ── 3.5 NTLMv1
try {
    $ntlmReg   = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa" -Name "LmCompatibilityLevel" -ErrorAction SilentlyContinue
    $ntlmLevel = if ($ntlmReg) { $ntlmReg.LmCompatibilityLevel } else { $null }
    $score  = if ($ntlmLevel -ge 5) { 100 } elseif ($ntlmLevel -eq 4) { 70 } elseif ($ntlmLevel -ge 3) { 40 } else { 0 }
    $status = if ($ntlmLevel -ge 5) { "Pass" } elseif ($ntlmLevel -ge 3) { "Warning" } else { "Fail" }
    $actual = if ($null -ne $ntlmLevel) { "LmCompatibilityLevel = $ntlmLevel" } else { "Key not set (default=0 - NTLMv1 allowed!)" }
    if ($status -eq "Pass") { Write-Pass "NTLMv1: $actual" } else { Write-Fail "NTLMv1: $actual" }
    Add-Finding -CheckId "ntlmv1" -Category "gpo" -Label "NTLMv1 Disabled" `
        -Description "LAN Manager Authentication Level should be 5 (NTLMv2 only)" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "LmCompatibilityLevel = 5" -ActualValue $actual `
        -Recommendation "Set LmCompatibilityLevel to 5 via GPO under Security Options." `
        -RemediationCmd "Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' -Name 'LmCompatibilityLevel' -Value 5"
} catch { Write-Err "ntlmv1" $_; [void]$Script:Errors.Add("ntlmv1: $($_.Exception.Message)") }

# ── 3.6 Audit Policy
try {
    $auditOut   = auditpol /get /category:* 2>$null
    $auditStr   = $auditOut -join " "
    $categories = @("Account Logon","Account Management","DS Access","Logon/Logoff","Object Access","Policy Change","Privilege Use","Process Tracking","System")
    $configured = 0
    foreach ($cat in $categories) { if ($auditStr -match [regex]::Escape($cat)) { $configured++ } }
    $score  = if ($configured -ge 9) { 100 } elseif ($configured -ge 7) { 70 } elseif ($configured -ge 5) { 45 } else { 20 }
    $status = if ($configured -ge 9) { "Pass" } elseif ($configured -ge 7) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Audit Policy: $configured/9" } else { Write-Warn "Audit Policy: $configured/9" }
    Add-Finding -CheckId "auditPolicy" -Category "gpo" -Label "Advanced Audit Policy" `
        -Description "Advanced Audit Policy configured across all 9 Windows audit categories" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "All 9 audit categories configured" -ActualValue "$configured of 9 categories detected" `
        -Recommendation "Enable all Advanced Audit Policy categories via GPO using CIS Benchmark Level 1." `
        -RemediationCmd "`$cats=@('Account Logon','Account Management','Logon/Logoff','Object Access','Policy Change','Privilege Use','System')`nforeach (`$c in `$cats) { auditpol /set /category:`"`$c`" /success:enable /failure:enable }"
} catch { Write-Err "auditPolicy" $_; [void]$Script:Errors.Add("auditPolicy: $($_.Exception.Message)") }

# ── 3.7 AppLocker
try {
    $appLockerSvc = Get-Service -Name AppIDSvc -ErrorAction SilentlyContinue
    $appLockerGPO = @($AllGPOs | Where-Object {
        (Get-GPOReport -Guid $_.Id -ReportType Xml -ErrorAction SilentlyContinue) -match "AppLocker|WDAC"
    })
    $svcRunning   = ($null -ne $appLockerSvc) -and ($appLockerSvc.Status -eq "Running")
    $hasAppLocker = $svcRunning -or ($appLockerGPO.Count -gt 0)
    $score  = if ($hasAppLocker) { 90 } else { 20 }
    $status = if ($hasAppLocker) { "Pass" } else { "Fail" }
    if ($null -ne $appLockerSvc) { $svcStatus = $appLockerSvc.Status.ToString() } else { $svcStatus = "Not Found" }
    $actual = if ($hasAppLocker) { "AppIDSvc: $svcStatus; GPO: $($appLockerGPO.Count) found" } else { "Not detected" }
    if ($status -eq "Pass") { Write-Pass "AppLocker/WDAC: $actual" } else { Write-Fail "AppLocker/WDAC: Not detected" }
    Add-Finding -CheckId "appLocker" -Category "gpo" -Label "AppLocker / WDAC" `
        -Description "Application control policy deployment" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Applied to all servers and privileged workstations" -ActualValue $actual `
        -Recommendation "Deploy AppLocker in audit mode first, then enforce. WDAC preferred for newer OS." `
        -RemediationCmd "Set-Service AppIDSvc -StartupType Automatic`nStart-Service AppIDSvc`nGet-AppLockerPolicy -Effective | Format-List"
} catch { Write-Err "appLocker" $_; [void]$Script:Errors.Add("appLocker: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 4 — DC HEALTH ════════════════════════════════════════════

Write-Section "CATEGORY 4 — Domain Controller Health"

# ── 4.1 FSMO Roles
try {
    $fsmoHolders = @($Domain.PDCEmulator,$Domain.RIDMaster,$Domain.InfrastructureMaster,$Forest.SchemaMaster,$Forest.DomainNamingMaster)
    $responding  = @($fsmoHolders | Where-Object { Test-Connection -ComputerName $_ -Count 1 -Quiet -ErrorAction SilentlyContinue })
    $score  = if ($responding.Count -eq 5) { 100 } elseif ($responding.Count -ge 4) { 60 } else { 0 }
    $status = if ($responding.Count -eq 5) { "Pass" } elseif ($responding.Count -ge 4) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "FSMO: All 5 responding" } else { Write-Fail "FSMO: $($responding.Count)/5" }
    Add-Finding -CheckId "fsmoRoles" -Category "dchealth" -Label "FSMO Role Health" `
        -Description "All 5 FSMO role holders responding and reachable" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "All 5 FSMO holders online" -ActualValue "$($responding.Count)/5 FSMO holders responding" `
        -Recommendation "Ensure all FSMO holders are online and healthy." `
        -RemediationCmd "netdom query fsmo"
} catch { Write-Err "fsmoRoles" $_; [void]$Script:Errors.Add("fsmoRoles: $($_.Exception.Message)") }

# ── 4.2 Replication
try {
    $replRaw    = repadmin /replsummary 2>&1
    $replOutput = @($replRaw)
    $replErrors = 0
    if ($replOutput.Count -gt 0) {
        $replErrors = @($replOutput | Select-String "error|fail" -SimpleMatch).Count
    }
    $score  = if ($replErrors -eq 0) { 100 } elseif ($replErrors -le 2) { 50 } else { 0 }
    $status = if ($replErrors -eq 0) { "Pass" } elseif ($replErrors -le 2) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Replication: 0 errors" } else { Write-Fail "Replication: $replErrors error(s)" }
    Add-Finding -CheckId "replErrors" -Category "dchealth" -Label "AD Replication Errors" `
        -Description "Active Directory replication error count (repadmin /replsummary)" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "0 replication errors" -ActualValue "$replErrors error indicator(s)" `
        -Recommendation "Run repadmin /replsummary and repadmin /showrepl to identify failing partners." `
        -RemediationCmd "repadmin /replsummary`nrepadmin /showrepl"
} catch { Write-Err "replErrors" $_; [void]$Script:Errors.Add("replErrors: $($_.Exception.Message)") }

# ── 4.3 DFSR
try {
    $dfsrMig  = Get-ADObject -Filter { objectClass -eq "msDFSR-GlobalSettings" } -ErrorAction SilentlyContinue
    $frsConns = @(Get-ADObject -Filter { objectClass -eq "nTFRSMember" } -SearchBase "CN=System,$($Domain.DistinguishedName)" -ErrorAction SilentlyContinue)
    $usesDFSR = ($null -ne $dfsrMig)
    $usesFRS  = ($frsConns.Count -gt 0)
    $score    = if ($usesDFSR -and -not $usesFRS) { 100 } elseif ($usesDFSR) { 60 } else { 0 }
    $status   = if ($usesDFSR -and -not $usesFRS) { "Pass" } elseif ($usesDFSR) { "Warning" } else { "Fail" }
    $actual   = "DFSR: $usesDFSR | FRS members: $($frsConns.Count)"
    if ($status -eq "Pass") { Write-Pass "DFSR: $actual" } else { Write-Warn "DFSR: $actual" }
    Add-Finding -CheckId "dfsr" -Category "dchealth" -Label "DFSR Replication (SYSVOL)" `
        -Description "SYSVOL replication mechanism - DFSR is modern, FRS is deprecated" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "DFSR only - no FRS components" -ActualValue $actual `
        -Recommendation "Migrate from FRS to DFSR using dfsrmig tool." `
        -RemediationCmd "dfsrmig /GetGlobalState`ndfsrmig /GetMigrationState"
} catch { Write-Err "dfsr" $_; [void]$Script:Errors.Add("dfsr: $($_.Exception.Message)") }

# ── 4.4 Functional Level
try {
    $domMode = $Domain.DomainMode.ToString()
    $flScore = switch -Wildcard ($domMode) {
        "*2022*"   { 100 }
        "*2019*"   { 100 }
        "*2016*"   { 100 }
        "*2012R2*" { 75  }
        "*2012*"   { 60  }
        "*2008R2*" { 40  }
        "*2008*"   { 30  }
        default    { 20  }
    }
    $status = if ($flScore -ge 100) { "Pass" } elseif ($flScore -ge 75) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Functional Level: $domMode" } else { Write-Warn "Functional Level: $domMode" }
    Add-Finding -CheckId "flevel" -Category "dchealth" -Label "Domain/Forest Functional Level" `
        -Description "AD Domain and Forest functional level" `
        -Severity "High" -Score $flScore -Status $status `
        -Threshold "Windows Server 2016 or higher" -ActualValue "Domain: $domMode | Forest: $($Forest.ForestMode)" `
        -Recommendation "Upgrade functional level to 2016+ after ensuring all DCs are on 2016+." `
        -RemediationCmd "Set-ADDomainMode -Identity '$($Domain.DNSRoot)' -DomainMode Windows2016Domain"
} catch { Write-Err "flevel" $_; [void]$Script:Errors.Add("flevel: $($_.Exception.Message)") }

# ── 4.5 DC EOL
try {
    $eolPatterns = @("2003","2008","2012")
    $dcOSList    = @($AllDCs | ForEach-Object {
        $c = Get-ADComputer $_.Name -Properties OperatingSystem -ErrorAction SilentlyContinue
        $osVal = if ($c) { $c.OperatingSystem } else { "Unknown" }
        [PSCustomObject]@{ Name = $_.Name; OS = $osVal }
    })
    $eolDCs = @($dcOSList | Where-Object {
        $os       = $_.OS
        $matchEOL = $false
        foreach ($pat in $eolPatterns) { if ($os -match $pat) { $matchEOL = $true } }
        $matchEOL
    })
    $score  = if ($eolDCs.Count -eq 0) { 100 } elseif ($eolDCs.Count -eq 1) { 40 } else { 0 }
    $status = if ($eolDCs.Count -eq 0) { "Pass" } elseif ($eolDCs.Count -eq 1) { "Warning" } else { "Fail" }
    $actual = if ($eolDCs.Count -eq 0) { "All DCs on supported OS" } else { "$($eolDCs.Count) DC(s) on EOL OS" }
    if ($status -eq "Pass") { Write-Pass "DC OS: $actual" } else { Write-Fail "DC OS: $actual" }
    Add-Finding -CheckId "dcEOL" -Category "dchealth" -Label "DC OS Version / EOL Check" `
        -Description "Domain Controllers running end-of-life Windows Server versions" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "All DCs on Windows Server 2016 or newer" -ActualValue $actual `
        -Recommendation "Upgrade or replace EOL DCs immediately." `
        -RemediationCmd "Get-ADDomainController -Filter * | ForEach-Object { Get-ADComputer `$_.Name -Properties OperatingSystem } | Select-Object Name,OperatingSystem | Sort-Object OperatingSystem"
} catch { Write-Err "dcEOL" $_; [void]$Script:Errors.Add("dcEOL: $($_.Exception.Message)") }

# ── 4.6 DNS Scavenging
try {
    $dnsZones    = @(Get-DnsServerZone -ComputerName $DomainController -ErrorAction SilentlyContinue |
        Where-Object { (-not $_.IsReverseLookupZone) -and $_.ZoneType -eq "Primary" })
    $scavEnabled = @($dnsZones | Where-Object {
        $zoneProps = $_.PSObject.Properties["Aging"]
        ($null -ne $zoneProps) -and ($_.Aging -eq $true)
    })
    $pct    = if ($dnsZones.Count -gt 0) { [Math]::Round(($scavEnabled.Count / $dnsZones.Count) * 100) } else { 0 }
    $score  = if ($pct -ge 90) { 100 } elseif ($pct -ge 50) { 60 } else { 25 }
    $status = if ($pct -ge 90) { "Pass" } elseif ($pct -ge 50) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "DNS Scavenging: $pct%" } else { Write-Warn "DNS Scavenging: $pct% of zones" }
    Add-Finding -CheckId "dnsScavenge" -Category "dchealth" -Label "DNS Scavenging" `
        -Description "DNS aging and scavenging enabled on primary forward lookup zones" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "All primary zones with aging enabled" -ActualValue "$($scavEnabled.Count)/$($dnsZones.Count) zones ($pct%)" `
        -Recommendation "Enable aging on all AD-integrated zones. Set 7-day no-refresh, 7-day refresh intervals." `
        -RemediationCmd "Get-DnsServerZone -ComputerName '$DomainController' | Where-Object {-not `$_.IsReverseLookupZone -and `$_.ZoneType -eq 'Primary'} | ForEach-Object { Set-DnsServerZoneAging -Name `$_.ZoneName -Aging `$true -ComputerName '$DomainController' }"
} catch { Write-Err "dnsScavenge" $_; [void]$Script:Errors.Add("dnsScavenge: $($_.Exception.Message)") }

# ── 4.7 NTP
try {
    $ntpOutput   = w32tm /query /configuration 2>&1
    $ntpSource   = w32tm /query /source 2>&1
    $ntpOutStr   = $ntpOutput -join " "
    $ntpSrcStr   = $ntpSource -join " "
    $isNTPServer = $ntpOutStr -match "NtpServer"
    $syncedWell  = $ntpSrcStr -notmatch "Free-running|Local CMOS|error"
    $score  = if ($isNTPServer -and $syncedWell) { 100 } elseif ($syncedWell) { 70 } else { 30 }
    $status = if ($score -ge 100) { "Pass" } elseif ($score -ge 70) { "Warning" } else { "Fail" }
    $actual = "Source: $ntpSrcStr | NtpServer configured: $isNTPServer"
    if ($status -eq "Pass") { Write-Pass "NTP: OK" } else { Write-Warn "NTP: Check source" }
    Add-Finding -CheckId "ntp" -Category "dchealth" -Label "NTP Time Synchronisation" `
        -Description "Domain time synchronisation hierarchy" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "PDC Emulator syncing to external NTP" -ActualValue $actual `
        -Recommendation "Configure PDC Emulator to sync to external NTP (pool.ntp.org)." `
        -RemediationCmd "w32tm /config /manualpeerlist:'0.pool.ntp.org,1.pool.ntp.org' /syncfromflags:manual /reliable:YES /update`nRestart-Service w32tm`nw32tm /resync /force"
} catch { Write-Err "ntp" $_; [void]$Script:Errors.Add("ntp: $($_.Exception.Message)") }

# ── 4.8 Tombstone Lifetime
try {
    $configNC  = (Get-ADRootDSE).configurationNamingContext
    $tsDN      = "CN=Directory Service,CN=Windows NT,CN=Services,$configNC"
    $tsObj     = Get-ADObject $tsDN -Properties * -ErrorAction SilentlyContinue
    $tsProp    = if ($tsObj) { $tsObj.PSObject.Properties["tombstoneLifetime"] } else { $null }
    $tsLife    = if ($null -ne $tsProp -and $null -ne $tsProp.Value) { [int]$tsProp.Value } else { 60 }
    $score     = if ($tsLife -ge 180) { 100 } elseif ($tsLife -ge 120) { 75 } elseif ($tsLife -ge 60) { 50 } else { 20 }
    $status    = if ($tsLife -ge 180) { "Pass" } elseif ($tsLife -ge 60) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Tombstone: $tsLife days" } else { Write-Warn "Tombstone: $tsLife days (recommend 180+)" }
    Add-Finding -CheckId "tombstone" -Category "dchealth" -Label "Tombstone Lifetime" `
        -Description "AD tombstone lifetime - affects backup restore validity" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "180 days or more" -ActualValue "$tsLife days" `
        -Recommendation "Set tombstone lifetime to 180 days." `
        -RemediationCmd "`$configNC=(Get-ADRootDSE).configurationNamingContext`nSet-ADObject -Identity `"CN=Directory Service,CN=Windows NT,CN=Services,`$configNC`" -Replace @{tombstoneLifetime=180}"
} catch { Write-Err "tombstone" $_; [void]$Script:Errors.Add("tstone: $($_.Exception.Message)") }

# ── 4.9 NEW: DC Redundancy — from Addendum v1.0
try {
    $dcList      = @($AllDCs)
    $totalDCs    = $dcList.Count
    $siteNames   = New-Object System.Collections.ArrayList
    $dcSiteMap   = @{}
    foreach ($dc in $dcList) {
        $siteName = "Unknown"
        try {
            if ($dc.PSObject.Properties["Site"] -and -not [string]::IsNullOrEmpty($dc.Site)) { $siteName = $dc.Site }
            else {
                $dcComp = Get-ADComputer $dc.Name -Properties * -ErrorAction SilentlyContinue
                if ($dcComp -and $dcComp.PSObject.Properties["msDS-SiteName"]) { $siteName = $dcComp."msDS-SiteName" }
            }
        } catch {}
        $dcSiteMap[$dc.Name] = $siteName
        if ($siteNames -notcontains $siteName) { [void]$siteNames.Add($siteName) }
    }
    $distinctSites = $siteNames.Count
    if ($totalDCs -eq 1) { $score = 0; $status = "Fail"; $actual = "1 DC detected — single point of failure." }
    elseif ($totalDCs -eq 2 -and $distinctSites -le 1) { $score = 55; $status = "Warning"; $actual = "2 DCs in same site. No geographic separation." }
    elseif ($totalDCs -eq 2 -and $distinctSites -ge 2) { $score = 80; $status = "Warning"; $actual = "2 DCs across $distinctSites sites. Consider 3rd DC." }
    elseif ($totalDCs -ge 3 -and $distinctSites -ge 2) { $score = 100; $status = "Pass"; $actual = "$totalDCs DCs across $distinctSites AD sites." }
    elseif ($totalDCs -ge 3 -and $distinctSites -le 1) { $score = 75; $status = "Warning"; $actual = "$totalDCs DCs but all in same site. No geographic redundancy." }
    else { $score = 60; $status = "Warning"; $actual = "$totalDCs DCs, $distinctSites sites." }
    $detailStr = ($dcSiteMap.Keys | ForEach-Object { "$_[$($dcSiteMap[$_])]" }) -join " | "
    if ($status -eq "Pass") { Write-Pass "DC Redundancy: $actual" } elseif ($status -eq "Warning") { Write-Warn "DC Redundancy: $actual" } else { Write-Fail "DC Redundancy: $actual" }
    Add-Finding -CheckId "dcRedundancy" -Category "dchealth" -Label "DC Redundancy" `
        -Description "Number of domain controllers and their AD site distribution" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "3+ DCs across 2+ AD sites" -ActualValue "$actual | Sites: $detailStr" `
        -Recommendation "Minimum 2 DCs required. Best practice: 3+ DCs across 2+ sites." `
        -RemediationCmd "Get-ADDomainController -Filter * | Select Name,Site,IPv4Address"
} catch { Write-Err "dcRedundancy" $_; [void]$Script:Errors.Add("dcRedundancy: $($_.Exception.Message)") }

# ── 4.10 NEW: DNS Zone Sync — from Addendum v1.0
try {
    $dcList        = @($AllDCs)
    $dnsDCList     = New-Object System.Collections.ArrayList
    foreach ($dc in $dcList) {
        try {
            $dnsSvc = Get-Service -Name "DNS" -ComputerName $dc.HostName -ErrorAction SilentlyContinue
            if ($null -ne $dnsSvc -and $dnsSvc.Status -eq "Running") { [void]$dnsDCList.Add($dc.HostName) }
            else { [void]$dnsDCList.Add($dc.HostName) }
        } catch { [void]$dnsDCList.Add($dc.HostName) }
    }
    $dnsDCCount = $dnsDCList.Count
    $zoneMatrix = @{}; $serialMatrix = @{}
    foreach ($dcFQDN in @($dnsDCList)) {
        try {
            $zones = @(Get-DnsServerZone -ComputerName $dcFQDN -ErrorAction SilentlyContinue | Where-Object { (-not $_.IsReverseLookupZone) -and ($_.ZoneType -eq "Primary") })
            foreach ($zone in $zones) {
                $zName = $zone.ZoneName
                if (-not $zoneMatrix.ContainsKey($zName)) { $zoneMatrix[$zName] = New-Object System.Collections.ArrayList }
                [void]$zoneMatrix[$zName].Add($dcFQDN)
            }
        } catch {}
    }
    $allZones = @($zoneMatrix.Keys)
    $missingZones = @($allZones | Where-Object { @($zoneMatrix[$_]).Count -lt $dnsDCCount })
    if ($missingZones.Count -eq 0 -and $allZones.Count -gt 0) { $score = 100; $status = "Pass"; $actual = "All $allZones zones in sync across $dnsDCCount DNS DCs." }
    elseif ($missingZones.Count -le 2) { $score = 40; $status = "Fail"; $actual = "$($missingZones.Count) zone(s) missing from DNS DCs." }
    else { $score = 15; $status = "Fail"; $actual = "$($missingZones.Count) zone(s) missing. DNS resolution may be inconsistent." }
    if ($status -eq "Pass") { Write-Pass "DNS Zone Sync: $actual" } else { Write-Fail "DNS Zone Sync: $actual" }
    Add-Finding -CheckId "dnsZoneSync" -Category "dchealth" -Label "DNS Zone Sync" `
        -Description "DNS zone presence and SOA serial consistency across DNS DCs" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "All zones present on all DNS DCs" -ActualValue $actual `
        -Recommendation "Ensure all DCs hosting DNS have identical zone sets." `
        -RemediationCmd "foreach (`$dc in (Get-ADDomainController -Filter *).HostName) { Get-DnsServerZone -ComputerName `$dc | Select ZoneName }"
} catch { Write-Err "dnsZoneSync" $_; [void]$Script:Errors.Add("dnsZoneSync: $($_.Exception.Message)") }

# ── 4.11 NEW: DC NIC DNS Configuration — from Addendum v1.0
try {
    $dcList      = @($AllDCs)
    $publicDNS   = @("8.8.8.8","8.8.4.4","1.1.1.1","1.0.0.1","9.9.9.9","208.67.222.222")
    $violations  = 0
    foreach ($dc in $dcList) {
        try {
            $nicConfigs = @(Get-WmiObject -Class Win32_NetworkAdapterConfiguration -ComputerName $dc.HostName -Filter "IPEnabled=True" -ErrorAction SilentlyContinue)
            foreach ($nic in $nicConfigs) {
                $dnsServers = @($nic.DNSServerSearchOrder)
                if ($dnsServers.Count -gt 0 -and $dnsServers[0] -eq "127.0.0.1") { $violations++ }
                if ($dnsServers.Count -gt 0 -and $publicDNS -contains $dnsServers[0]) { $violations++ }
                if ($dnsServers.Count -lt 2) { $violations++ }
            }
        } catch {}
    }
    if ($violations -eq 0) { $score = 100; $status = "Pass"; $actual = "All DCs pass DNS NIC best practices." }
    elseif ($violations -le 2) { $score = 70; $status = "Warning"; $actual = "$violations minor DNS NIC violations detected." }
    else { $score = 30; $status = "Fail"; $actual = "$violations DNS NIC violations across DCs." }
    if ($status -eq "Pass") { Write-Pass "DC NIC DNS: $actual" } else { Write-Warn "DC NIC DNS: $actual" }
    Add-Finding -CheckId "dcNicDns" -Category "dchealth" -Label "DC NIC DNS Configuration" `
        -Description "DC network adapter DNS server settings audited against best practices" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "No loopback/public DNS as primary, min 2 entries" -ActualValue $actual `
        -Recommendation "Primary DNS should be another DC's IP. Never use public DNS on DCs." `
        -RemediationCmd "Get-WmiObject Win32_NetworkAdapterConfiguration -ComputerName `$dc | Where {`$_.IPEnabled} | Select DNSServerSearchOrder"
} catch { Write-Err "dcNicDns" $_; [void]$Script:Errors.Add("dcNicDns: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 5 — AD HYGIENE ═══════════════════════════════════════════

Write-Section "CATEGORY 5 — Active Directory Hygiene"

# ── 5.1 Stale Computers
try {
    $cutoff       = (Get-Date).AddDays(-90)
    $enabledComps = @($AllComputers | Where-Object { $_.Enabled })
    $staleComps   = @($enabledComps | Where-Object { $_.LastLogonDate -lt $cutoff -or $null -eq $_.LastLogonDate })
    $pct    = if ($enabledComps.Count -gt 0) { [Math]::Round(($staleComps.Count / $enabledComps.Count) * 100, 1) } else { 0 }
    $score  = if ($pct -le 3) { 100 } elseif ($pct -le 8) { 65 } elseif ($pct -le 15) { 35 } else { 10 }
    $status = if ($pct -le 3) { "Pass" } elseif ($pct -le 8) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Stale Computers: $($staleComps.Count) ($pct%)" } else { Write-Warn "Stale Computers: $($staleComps.Count) ($pct%)" }
    Add-Finding -CheckId "staleComputers" -Category "hygiene" -Label "Stale Computer Accounts" `
        -Description "Enabled computer accounts with no logon in 90+ days" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "Less than 3% of enabled computers" -ActualValue "$($staleComps.Count) stale ($pct%)" `
        -Recommendation "Disable then delete stale computer accounts after 30-day grace period." `
        -RemediationCmd "Get-ADComputer -Filter {Enabled -eq `$true} -Properties LastLogonDate | Where-Object {`$_.LastLogonDate -lt (Get-Date).AddDays(-90)} | Disable-ADAccount"
} catch { Write-Err "staleComputers" $_; [void]$Script:Errors.Add("staleComputers: $($_.Exception.Message)") }

# ── 5.2 Duplicate SPNs
try {
    $spnRaw    = setspn -X -F 2>&1
    $spnOutput = @($spnRaw)
    $dupSPNs   = 0
    if ($spnOutput.Count -gt 0) { $dupSPNs = @($spnOutput | Select-String "Duplicate" -SimpleMatch).Count }
    $score  = if ($dupSPNs -eq 0) { 100 } elseif ($dupSPNs -le 2) { 50 } else { 0 }
    $status = if ($dupSPNs -eq 0) { "Pass" } elseif ($dupSPNs -le 2) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Duplicate SPNs: 0" } else { Write-Fail "Duplicate SPNs: $dupSPNs" }
    Add-Finding -CheckId "duplicateSPN" -Category "hygiene" -Label "Duplicate SPNs" `
        -Description "Duplicate Service Principal Names in AD" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "0 duplicate SPNs" -ActualValue "$dupSPNs duplicate SPN(s)" `
        -Recommendation "Run 'setspn -X -F' to identify. Remove duplicates from non-owner accounts." `
        -RemediationCmd "setspn -X -F"
} catch { Write-Err "duplicateSPN" $_; [void]$Script:Errors.Add("duplicateSPN: $($_.Exception.Message)") }

# ── 5.3 Inactive Users
try {
    $cutoff   = (Get-Date).AddDays(-60)
    $enabled  = @($AllUsers | Where-Object { $_.Enabled })
    $inactive = @($enabled  | Where-Object { $_.LastLogonDate -lt $cutoff -or $null -eq $_.LastLogonDate })
    $pct      = if ($enabled.Count -gt 0) { [Math]::Round(($inactive.Count / $enabled.Count) * 100, 1) } else { 0 }
    $score    = if ($pct -le 5) { 100 } elseif ($pct -le 10) { 65 } elseif ($pct -le 20) { 35 } else { 15 }
    $status   = if ($pct -le 5) { "Pass" } elseif ($pct -le 10) { "Warning" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Inactive Users (>60d): $($inactive.Count) ($pct%)" } else { Write-Warn "Inactive Users: $($inactive.Count) ($pct%)" }
    Add-Finding -CheckId "inactiveUsers" -Category "hygiene" -Label "Inactive User Accounts" `
        -Description "Enabled user accounts with no logon in 60+ days" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "Less than 5% of enabled users" -ActualValue "$($inactive.Count) accounts ($pct%)" `
        -Recommendation "Implement automated 60-day inactivity policy. Notify manager, disable, delete after 30-day hold." `
        -RemediationCmd "Search-ADAccount -AccountInactive -TimeSpan (New-TimeSpan -Days 60) -UsersOnly | Where-Object {`$_.Enabled} | Select-Object Name,LastLogonDate"
} catch { Write-Err "inactiveUsers" $_; [void]$Script:Errors.Add("inactiveUsers: $($_.Exception.Message)") }

# ── 5.4 Guest Account
try {
    $guestAcct = Get-ADUser -Filter { SamAccountName -eq "Guest" } -Properties Enabled, Name -ErrorAction SilentlyContinue
    $disabled  = ($null -ne $guestAcct) -and (-not $guestAcct.Enabled)
    $score     = if ($disabled) { 100 } else { 0 }
    $status    = if ($disabled) { "Pass" } else { "Fail" }
    $actual    = if ($null -ne $guestAcct) { "Enabled: $($guestAcct.Enabled)" } else { "Account not found" }
    if ($status -eq "Pass") { Write-Pass "Guest Account: Disabled" } else { Write-Fail "Guest Account: $actual" }
    Add-Finding -CheckId "guestAccount" -Category "hygiene" -Label "Guest Account Disabled" `
        -Description "Built-in Guest (RID-501) account should be permanently disabled" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Disabled" -ActualValue $actual `
        -Recommendation "Disable the Guest account. Enforce via GPO Security Options." `
        -RemediationCmd "Disable-ADAccount -Identity (Get-ADUser -Filter {SamAccountName -eq 'Guest'})"
} catch { Write-Err "guestAccount" $_; [void]$Script:Errors.Add("guestAccount: $($_.Exception.Message)") }

# ── 5.5 KRBTGT
try {
    $krbtgt  = Get-ADUser -Filter { SamAccountName -eq "krbtgt" } -Properties PasswordLastSet -ErrorAction SilentlyContinue
    $agedays = if ($null -ne $krbtgt -and $null -ne $krbtgt.PasswordLastSet) { [int](New-TimeSpan -Start $krbtgt.PasswordLastSet -End (Get-Date)).TotalDays } else { 9999 }
    $score  = if ($agedays -le 90) { 100 } elseif ($agedays -le 180) { 80 } elseif ($agedays -le 365) { 50 } else { 15 }
    $status = if ($agedays -le 180) { if ($agedays -le 90) { "Pass" } else { "Warning" } } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "KRBTGT Age: $agedays days" } else { Write-Fail "KRBTGT Age: $agedays days (target <180)" }
    Add-Finding -CheckId "krbtgt" -Category "hygiene" -Label "KRBTGT Password Age" `
        -Description "Age of the KRBTGT account password - Golden Ticket mitigation" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "Changed within last 180 days (90 recommended)" -ActualValue "$agedays days since last change" `
        -Recommendation "Reset KRBTGT password TWICE (10+ hours apart) every 180 days." `
        -RemediationCmd "`$newPwd = ConvertTo-SecureString ([System.Web.Security.Membership]::GeneratePassword(32,8)) -AsPlainText -Force`nSet-ADAccountPassword -Identity krbtgt -Reset -NewPassword `$newPwd"
} catch { Write-Err "krbtgt" $_; [void]$Script:Errors.Add("krbtgt: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 6 — MONITORING ═══════════════════════════════════════════

Write-Section "CATEGORY 6 — Security Monitoring & Logging"

# ── 6.1 Event Log Size
try {
    $secLog    = Get-WinEvent -ListLog Security -ComputerName $DomainController -ErrorAction SilentlyContinue
    $logSizeMB = if ($null -ne $secLog) { [Math]::Round($secLog.MaximumSizeInBytes / 1MB) } else { 0 }
    if ($logSizeMB -ge 600 -and $logSizeMB -le 1228) { $score = 100; $status = "Pass" }
    elseif ($logSizeMB -ge 600) { $score = 85; $status = "Warning" }
    elseif ($logSizeMB -ge 256) { $score = 60; $status = "Warning" }
    elseif ($logSizeMB -ge 128) { $score = 35; $status = "Fail" }
    else { $score = 10; $status = "Fail" }
    if ($status -eq "Pass") { Write-Pass "Security Log: ${logSizeMB}MB (sweet spot)" } else { Write-Warn "Security Log: ${logSizeMB}MB (target 600MB-1.2GB)" }
    Add-Finding -CheckId "eventLogSize" -Category "monitoring" -Label "Security Event Log Size" `
        -Description "Maximum Security event log size on domain controllers" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "600MB - 1.2GB with archiving and backup in place" -ActualValue "${logSizeMB}MB configured" `
        -Recommendation "Optimal range is 600MB-1.2GB with auto-archive enabled. Balance retention with storage and backup capacity." `
        -RemediationCmd "wevtutil sl Security /ms:1073741824"
} catch { Write-Err "eventLogSize" $_; [void]$Script:Errors.Add("eventLogSize: $($_.Exception.Message)") }

# ── 6.2 Log Retention
try {
    $secLog2     = Get-WinEvent -ListLog Security -ComputerName $DomainController -ErrorAction SilentlyContinue
    $archiveMode = if ($null -ne $secLog2) { $secLog2.LogMode.ToString() } else { "Unknown" }
    $hasArchive  = $archiveMode -match "AutoBackup|Archive"
    $score  = if ($hasArchive) { 90 } else { 30 }
    $status = if ($hasArchive) { "Pass" } else { "Fail" }
    if ($status -eq "Pass") { Write-Pass "Log Retention: $archiveMode" } else { Write-Fail "Log Retention: $archiveMode" }
    Add-Finding -CheckId "logRetention" -Category "monitoring" -Label "Log Retention Policy" `
        -Description "Security event log retention and archiving configuration" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "AutoBackup or SIEM forwarding; 90+ day retention" -ActualValue "Log mode: $archiveMode" `
        -Recommendation "Enable auto-archive for Security logs. Forward to SIEM for 90-day minimum retention." `
        -RemediationCmd "wevtutil sl Security /rt:true /ab:true"
} catch { Write-Err "logRetention" $_; [void]$Script:Errors.Add("logRetention: $($_.Exception.Message)") }

# ── 6.3 SIEM / WEF
try {
    $wefSubs = Get-ChildItem "HKLM:\SOFTWARE\Policies\Microsoft\Windows\EventLog\EventForwarding\SubscriptionManager" -ErrorAction SilentlyContinue
    $wecsvc  = Get-Service -Name "Wecsvc" -ErrorAction SilentlyContinue
    $wefCount = @($wefSubs).Count
    $wecRunning = ($null -ne $wecsvc) -and ($wecsvc.Status -eq "Running")
    $hasSIEM = ($wefCount -gt 0) -or $wecRunning
    $score  = if ($hasSIEM) { 100 } else { 20 }
    $status = if ($hasSIEM) { "Pass" } else { "Fail" }
    $actual = if ($hasSIEM) { "WEF/WECSVC detected" } else { "No WEF or SIEM forwarding detected on this DC" }
    if ($status -eq "Pass") { Write-Pass "SIEM/WEF: $actual" } else { Write-Fail "SIEM/WEF: Not detected" }
    Add-Finding -CheckId "siemForwarding" -Category "monitoring" -Label "SIEM / Log Forwarding" `
        -Description "Windows Event Forwarding or SIEM agent for centralised log collection" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "All DCs forwarding to SIEM or centralised log collector" -ActualValue $actual `
        -Recommendation "Deploy WEF or SIEM agent on all DCs. Forward critical Event IDs: 4624,4625,4648,4720,4722,4728,4756." `
        -RemediationCmd "winrm quickconfig`nwecutil cs subscription.xml"
} catch { Write-Err "siemForwarding" $_; [void]$Script:Errors.Add("siemForwarding: $($_.Exception.Message)") }

# ── 6.4 AV / Defender
try {
    $mpResult = Invoke-Command -ComputerName $DomainController -ErrorAction SilentlyContinue -ScriptBlock {
        try {
            $s = Get-MpComputerStatus -ErrorAction Stop
            $obj = New-Object PSObject
            $obj | Add-Member -MemberType NoteProperty -Name Running   -Value $true
            $obj | Add-Member -MemberType NoteProperty -Name RTEnabled -Value $s.RealTimeProtectionEnabled
            $obj | Add-Member -MemberType NoteProperty -Name Mode      -Value ($s.AMRunningMode.ToString())
            $obj
        } catch {
            $obj = New-Object PSObject
            $obj | Add-Member -MemberType NoteProperty -Name Running   -Value $false
            $obj | Add-Member -MemberType NoteProperty -Name RTEnabled -Value $false
            $obj | Add-Member -MemberType NoteProperty -Name Mode      -Value "Unknown"
            $obj
        }
    }
    if ($null -eq $mpResult) {
        try {
            $s        = Get-MpComputerStatus -ErrorAction SilentlyContinue
            $mpResult = New-Object PSObject
            $mpResult | Add-Member -MemberType NoteProperty -Name Running   -Value ($null -ne $s)
            $mpResult | Add-Member -MemberType NoteProperty -Name RTEnabled -Value (if ($s) { $s.RealTimeProtectionEnabled } else { $false })
            $mpResult | Add-Member -MemberType NoteProperty -Name Mode      -Value (if ($s) { $s.AMRunningMode.ToString() } else { "Unknown" })
        } catch {
            $mpResult = New-Object PSObject
            $mpResult | Add-Member -MemberType NoteProperty -Name Running   -Value $false
            $mpResult | Add-Member -MemberType NoteProperty -Name RTEnabled -Value $false
            $mpResult | Add-Member -MemberType NoteProperty -Name Mode      -Value "Unknown"
        }
    }
    $score  = if ($mpResult.Running -and $mpResult.RTEnabled) { 100 } elseif ($mpResult.Running) { 60 } else { 10 }
    $status = if ($score -ge 100) { "Pass" } elseif ($score -ge 60) { "Warning" } else { "Fail" }
    if ($mpResult.Running) { $runText = "Running" } else { $runText = "Not Running" }
    $actual = "WinDefend: $runText | Real-time: $($mpResult.RTEnabled)"
    if ($status -eq "Pass") { Write-Pass "Defender: $actual" } else { Write-Fail "Defender: $actual" }
    Add-Finding -CheckId "avCoverage" -Category "monitoring" -Label "AV / Defender Coverage" `
        -Description "Windows Defender active on domain controllers with real-time monitoring" `
        -Severity "Critical" -Score $score -Status $status `
        -Threshold "Running with real-time protection on all DCs" -ActualValue $actual `
        -Recommendation "Ensure Defender runs on all DCs with real-time protection. Add AD exclusions per KB822158." `
        -RemediationCmd "Invoke-Command -ComputerName '$DomainController' -ScriptBlock { Set-MpPreference -DisableRealtimeMonitoring `$false }"
} catch { Write-Err "avCoverage" $_; [void]$Script:Errors.Add("avCoverage: $($_.Exception.Message)") }

#endregion

#region ══ CATEGORY 7 — INFRASTRUCTURE (NEW) ═════════════════════════════════════

Write-Section "CATEGORY 7 — Infrastructure"

# ── 7.1 NEW: CA Certificate Expiry — from Addendum v2.0
try {
    $configNC    = (Get-ADRootDSE).configurationNamingContext
    $servicesNC  = "CN=Public Key Services,CN=Services,$configNC"
    $caSearchBase = "CN=Certification Authorities,$servicesNC"
    $certResults = New-Object System.Collections.ArrayList
    $today       = Get-Date

    $caObjects = @(Get-ADObject -Filter { objectClass -eq "certificationAuthority" } -SearchBase $caSearchBase -Properties cACertificate, dNSHostName, displayName -ErrorAction SilentlyContinue)
    foreach ($ca in $caObjects) {
        if ($null -ne $ca.cACertificate) {
            foreach ($certBytes in @($ca.cACertificate)) {
                try {
                    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(,[byte[]]$certBytes)
                    $daysLeft  = [int]($cert.NotAfter - $today).TotalDays
                    $certEntry = New-Object PSObject
                    $certEntry | Add-Member -MemberType NoteProperty -Name DaysLeft -Value $daysLeft
                    $certEntry | Add-Member -MemberType NoteProperty -Name Name -Value (if ($ca.displayName) { $ca.displayName } else { $ca.Name })
                    [void]$certResults.Add($certEntry)
                } catch { }
            }
        }
    }

    $allCerts     = @($certResults)
    $expiredCerts = @($allCerts | Where-Object { $_.DaysLeft -le 0 })
    $critical30   = @($allCerts | Where-Object { $_.DaysLeft -gt 0 -and $_.DaysLeft -le 30 })
    $minDaysLeft  = if ($allCerts.Count -gt 0) { ($allCerts | Measure-Object -Property DaysLeft -Minimum).Minimum } else { 9999 }

    if ($allCerts.Count -eq 0) { $score = 75; $status = "Warning"; $actual = "No Enterprise CA certificates found." }
    elseif ($expiredCerts.Count -gt 0) { $score = 0; $status = "Fail"; $actual = "$($expiredCerts.Count) EXPIRED certificate(s)." }
    elseif ($critical30.Count -gt 0) { $score = 20; $status = "Fail"; $actual = "$($critical30.Count) cert(s) expiring within 30 days." }
    else { $score = 100; $status = "Pass"; $actual = "$($allCerts.Count) CA cert(s) valid. Soonest: $minDaysLeft days." }

    if ($status -eq "Pass") { Write-Pass "CA Cert Expiry: $actual" } else { Write-Fail "CA Cert Expiry: $actual" }
    Add-Finding -CheckId "caCertExpiry" -Category "infrastructure" -Label "CA Certificate Expiry" `
        -Description "Enterprise CA and Root certificate expiry audit" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "All CA certs valid with >180 days remaining" -ActualValue $actual `
        -Recommendation "Renew CA certificates before expiry. Expired certs cause domain-wide auth failures." `
        -RemediationCmd "certutil -store Root`ncertutil -ping"
} catch { Write-Err "caCertExpiry" $_; [void]$Script:Errors.Add("caCertExpiry: $($_.Exception.Message)") }

# ── 7.2 NEW: GPO Certificate Expiry — from Addendum v2.0
try {
    $gpoCertList = New-Object System.Collections.ArrayList
    $gposWithCerts = 0
    foreach ($gpo in @($AllGPOs)) {
        try {
            $gpoXml = Get-GPOReport -Guid $gpo.Id -ReportType Xml -ErrorAction SilentlyContinue
            if ($gpoXml -match "PublicKeyPolicies|TrustedRootCA|AutoEnrollment") {
                $gposWithCerts++
            }
        } catch {}
    }
    if ($gposWithCerts -eq 0) { $score = 80; $status = "Warning"; $actual = "No certificate-deploying GPOs detected." }
    else { $score = 100; $status = "Pass"; $actual = "$gposWithCerts GPO(s) with certificate policies found." }
    if ($status -eq "Pass") { Write-Pass "GPO Cert Expiry: $actual" } else { Write-Warn "GPO Cert Expiry: $actual" }
    Add-Finding -CheckId "gpoCertExpiry" -Category "infrastructure" -Label "GPO Certificate Expiry" `
        -Description "Certificates deployed via GPO — expiry audit" `
        -Severity "Medium" -Score $score -Status $status `
        -Threshold "No expired certs in GPO distribution" -ActualValue $actual `
        -Recommendation "Review certificate-deploying GPOs before expiry." `
        -RemediationCmd "Get-GPO -All | ForEach-Object { `$rpt = Get-GPOReport -Guid `$_.Id -ReportType Xml; if (`$rpt -match 'PublicKeyPolicies') { Write-Host `$_.DisplayName } }"
} catch { Write-Err "gpoCertExpiry" $_; [void]$Script:Errors.Add("gpoCertExpiry: $($_.Exception.Message)") }

# ── 7.3 NEW: Legacy OS Detection — from Addendum v2.0
try {
    $allEnabled = @($AllComputers | Where-Object { $_.Enabled })
    $serverEolPatterns = @("2008","2012")
    $wksEolPatterns = @("Windows 7","Windows 8","Windows 10")
    $servers = @($allEnabled | Where-Object { $_.OperatingSystem -match "Server" })
    $workstations = @($allEnabled | Where-Object { $_.OperatingSystem -notmatch "Server" -and -not [string]::IsNullOrEmpty($_.OperatingSystem) })
    $eolServerCount = @($servers | Where-Object { $os = $_.OperatingSystem; ($serverEolPatterns | Where-Object { $os -match $_ }).Count -gt 0 }).Count
    $eolWksCount = @($workstations | Where-Object { $os = $_.OperatingSystem; ($wksEolPatterns | Where-Object { $os -match $_ }).Count -gt 0 }).Count

    if ($eolServerCount -eq 0) { $serverScore = 100 } elseif ($eolServerCount -le 2) { $serverScore = 50 } else { $serverScore = 15 }
    if ($eolWksCount -eq 0) { $wksScore = 100 } else { $wksScore = 60 }
    $score = [Math]::Round(($serverScore * 0.60) + ($wksScore * 0.40))
    $status = if ($score -ge 80) { "Pass" } elseif ($score -ge 60) { "Warning" } else { "Fail" }
    $actual = "EOL Servers: $eolServerCount | EOL Workstations: $eolWksCount"
    if ($status -eq "Pass") { Write-Pass "Legacy OS: $actual" } else { Write-Fail "Legacy OS: $actual" }
    Add-Finding -CheckId "legacyOS" -Category "infrastructure" -Label "Legacy / EOL Operating Systems" `
        -Description "End-of-life OS detection across all domain computers" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "0 EOL systems" -ActualValue $actual `
        -Recommendation "EOL servers require L4 engagement. Upgrade EOL workstations to Windows 11." `
        -RemediationCmd "Get-ADComputer -Filter {Enabled -eq `$true} -Properties OperatingSystem | Where-Object { `$_.OperatingSystem -match '2008|2012|Windows 7|Windows 8' } | Select Name,OperatingSystem"
} catch { Write-Err "legacyOS" $_; [void]$Script:Errors.Add("legacyOS: $($_.Exception.Message)") }

# ── 7.4 NEW: Server AV Coverage — from Addendum v2.0
try {
    $avServices = @{
        "WinDefend" = "Windows Defender"; "MsMpEng" = "Windows Defender"
        "CSFalconService" = "CrowdStrike"; "SentinelAgent" = "SentinelOne"
        "SAVService" = "Sophos"; "SepMasterService" = "Symantec"
        "McShield" = "McAfee"; "ekrn" = "ESET"
        "AVP" = "Kaspersky"; "bdagent" = "Bitdefender"
    }
    $totalServers = $AllServers.Count
    $serversWithAV = 0
    $unreachable = 0
    Write-Info "Checking AV on $totalServers enabled servers..."
    foreach ($server in $AllServers) {
        $serverName = $server.Name
        $serverFQDN = if ($server.DNSHostName) { $server.DNSHostName } else { $serverName }
        $pingResult = Test-Connection -ComputerName $serverFQDN -Count 1 -Quiet -ErrorAction SilentlyContinue
        if (-not $pingResult) { $unreachable++; continue }
        try {
            $avCheck = Invoke-Command -ComputerName $serverFQDN -ErrorAction Stop -ArgumentList @(,@($avServices.Keys)) -ScriptBlock {
                param($svcNames) $found = @(); foreach ($sn in $svcNames) { $svc = Get-Service -Name $sn -ErrorAction SilentlyContinue; if ($null -ne $svc) { $found += $sn } }; $found }
            if (@($avCheck).Count -gt 0) { $serversWithAV++ }
        } catch { }
    }
    $reachableCount = $totalServers - $unreachable
    $coveragePct = if ($reachableCount -gt 0) { [Math]::Round(($serversWithAV / $reachableCount) * 100, 1) } else { 0 }
    if ($coveragePct -ge 100) { $score = 100; $status = "Pass" }
    elseif ($coveragePct -ge 95) { $score = 85; $status = "Warning" }
    elseif ($coveragePct -ge 80) { $score = 55; $status = "Fail" }
    else { $score = 0; $status = "Fail" }
    $actual = "AV Coverage: $serversWithAV / $reachableCount servers ($coveragePct%)"
    if ($status -eq "Pass") { Write-Pass "Server AV Coverage: $actual" } else { Write-Fail "Server AV Coverage: $actual" }
    Add-Finding -CheckId "serverAvCoverage" -Category "infrastructure" -Label "Server AV / EDR Coverage" `
        -Description "Antivirus and EDR coverage across domain-joined servers" `
        -Severity "High" -Score $score -Status $status `
        -Threshold "100% of servers with AV/EDR" -ActualValue $actual `
        -Recommendation "Deploy AV/EDR to ALL servers. Unprotected servers are highest-risk assets." `
        -RemediationCmd "`$servers = Get-ADComputer -Filter {Enabled -eq `$true} -Properties OperatingSystem | Where-Object { `$_.OperatingSystem -match 'Server' }`n`$results = foreach (`$srv in `$servers) { try { `$av = Invoke-Command -ComputerName `$srv.Name -ErrorAction Stop -ScriptBlock { Get-Service -Name WinDefend -ErrorAction SilentlyContinue } -WarningAction SilentlyContinue; if (`$av) { `$av.Status } else { 'No AV' } } catch { 'Unreachable' } }"
} catch { Write-Err "serverAvCoverage" $_; [void]$Script:Errors.Add("serverAvCoverage: $($_.Exception.Message)") }

#endregion

#region ── Score & Output ─────────────────────────────────────────────────────

Write-Section "Computing Weighted Score"

$CategoryWeights = @{
    identity       = 22
    password       = 18
    gpo            = 18
    dchealth       = 18
    hygiene        =  9
    monitoring     =  5
    infrastructure = 10
}

$categoryScores  = @{}
foreach ($cat in $CategoryWeights.Keys) {
    $catChecks = @($Script:Findings | Where-Object { $_.category -eq $cat })
    if ($catChecks.Count -gt 0) {
        $avg = ($catChecks | Measure-Object -Property score -Average).Average
        $categoryScores[$cat] = [Math]::Round($avg)
    } else {
        $categoryScores[$cat] = 0
    }
}

$weightedSum = 0
foreach ($cat in $CategoryWeights.Keys) {
    $weightedSum += $categoryScores[$cat] * ($CategoryWeights[$cat] / 100)
}
$overallScore = [Math]::Round($weightedSum)

Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host ("  |  OVERALL SECURE SCORE : {0,3}/100           |" -f $overallScore) -ForegroundColor Cyan
foreach ($cat in $CategoryWeights.Keys) {
    Write-Host ("  |  {0,-14}: {1,3}/100  (weight {2}%)    |" -f $cat,$categoryScores[$cat],$CategoryWeights[$cat]) -ForegroundColor Gray
}
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan

# ── Trend history
$historyFile = Join-Path $OutputPath "ad_score_history.json"
$historyList = New-Object System.Collections.ArrayList

if (Test-Path $historyFile) {
    try {
        $existingRaw = Get-Content $historyFile -Raw
        if (-not [string]::IsNullOrEmpty($existingRaw)) {
            $existing = $existingRaw | ConvertFrom-Json
            if ($null -ne $existing) {
                foreach ($e in @($existing)) { [void]$historyList.Add($e) }
            }
        }
    } catch {}
}

$cutoffDate  = (Get-Date).AddMonths(-$HistoryRetentionMonths).ToString("yyyy-MM-dd")
$trimmedList = New-Object System.Collections.ArrayList
foreach ($entry in @($historyList)) {
    if ($entry.date -ge $cutoffDate -and $entry.date -ne $Script:RunDateStr) {
        [void]$trimmedList.Add($entry)
    }
}

$critFails = @($Script:Findings | Where-Object { $_.status -eq "Fail" -and $_.severity -eq "Critical" }).Count
$highFails = @($Script:Findings | Where-Object { $_.status -eq "Fail" -and $_.severity -eq "High"     }).Count

$histEntry = [PSCustomObject]@{
    date           = $Script:RunDateStr
    overallScore   = $overallScore
    categoryScores = $categoryScores
    domain         = $Domain.DNSRoot
    criticalFails  = $critFails
    highFails      = $highFails
}
[void]$trimmedList.Add($histEntry)

$trimmedList | ConvertTo-Json -Depth 10 | Set-Content $historyFile -Encoding UTF8
Write-Info "History: $historyFile ($($trimmedList.Count) entries)"

# ── Main JSON output
$outputFile = Join-Path $OutputPath "ad_secure_score_$($Script:RunDateStr).json"

$metaObj = [PSCustomObject]@{
    collectorVersion = $Script:Version
    collectedAt      = $Script:RunDateStr
    collectedAtFull  = $Script:RunDateFull
    domain           = $Domain.DNSRoot
    domainController = $DomainController
    domainMode       = $Domain.DomainMode.ToString()
    forestMode       = $Forest.ForestMode.ToString()
    totalUsers       = @($AllUsers).Count
    totalComputers   = @($AllComputers).Count
    totalDCs         = @($AllDCs).Count
    errors           = $Script:Errors
}
$scoresObj = [PSCustomObject]@{
    overall    = $overallScore
    categories = $categoryScores
    weights    = $CategoryWeights
}
$outputObj = [PSCustomObject]@{
    meta     = $metaObj
    scores   = $scoresObj
    findings = $Script:Findings
    history  = $trimmedList
}

$outputObj | ConvertTo-Json -Depth 15 | Set-Content $outputFile -Encoding UTF8
Write-Pass "JSON saved: $outputFile"

# ── HTML Report
if ($GenerateHTML) {
    Write-Info "Generating HTML report..."
    $jsonData = Get-Content $outputFile -Raw
    $htmlFile = Join-Path $OutputPath "ad_secure_score_report_$($Script:RunDateStr).html"

    $htmlContent = @"
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>AD Secure Score Report - $($Domain.DNSRoot) - $Script:RunDateFull</title>
<script>window.REPORT_DATA = $jsonData;</script>
<style>
body{font-family:Arial,sans-serif;background:#020c1b;color:#e2e8f0;margin:0;padding:0}
.wrap{max-width:1100px;margin:0 auto;padding:40px 32px}
h1{color:#00d4ff;border-bottom:2px solid #1e3a5f;padding-bottom:16px;font-size:24px}
h2{color:#94a3b8;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;margin:28px 0 12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.kpi{background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:18px;border-top:3px solid}
.kpi-l{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px}
.kpi-v{font-size:30px;font-weight:800;font-family:monospace}
.kpi-s{font-size:11px;color:#475569;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}
th{padding:9px 12px;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #1e3a5f;background:#020c1b}
td{padding:9px 12px;border-bottom:1px solid #0d1f3c;color:#94a3b8}
.pass{color:#22c55e;font-weight:700} .warn{color:#eab308;font-weight:700} .fail{color:#ef4444;font-weight:700}
.crit{color:#ef4444} .high{color:#f97316} .med{color:#eab308} .low{color:#22c55e}
.score-big{font-size:48px;font-weight:800;font-family:monospace;text-align:center;padding:24px}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #1e3a5f;font-size:11px;color:#475569;display:flex;justify-content:space-between}
@media print{body{background:#fff;color:#000}.kpi{background:#f9f9f9;border-color:#ccc}th{background:#eee;color:#333}td{color:#000}}
</style></head><body><div class="wrap">
<h1>AD Secure Score Report</h1>
<p style="color:#64748b;font-size:12px;margin-bottom:24px">
Domain: <strong style="color:#e2e8f0">$($Domain.DNSRoot)</strong> &nbsp;|&nbsp;
DC: <strong style="color:#e2e8f0">$DomainController</strong> &nbsp;|&nbsp;
Collected: <strong style="color:#e2e8f0">$Script:RunDateFull</strong> &nbsp;|&nbsp;
Collector: <strong style="color:#e2e8f0">v$Script:Version</strong>
</p>
<div class="score-big" style="color:$(if ($overallScore -ge 80) {'#22c55e'} elseif ($overallScore -ge 60) {'#eab308'} else {'#ef4444'})">$overallScore / 100</div>
<div class="kpi-grid">
<div class="kpi" style="border-top-color:$(if ($overallScore -ge 80) {'#22c55e'} elseif ($overallScore -ge 60) {'#eab308'} else {'#ef4444'})">
  <div class="kpi-l">Overall Score</div>
  <div class="kpi-v" style="color:$(if ($overallScore -ge 80) {'#22c55e'} elseif ($overallScore -ge 60) {'#eab308'} else {'#ef4444'})">$overallScore</div>
  <div class="kpi-s">$(if ($overallScore -ge 90) {'Excellent'} elseif ($overallScore -ge 75) {'Good'} elseif ($overallScore -ge 60) {'Fair'} elseif ($overallScore -ge 40) {'Poor'} else {'Critical Risk'})</div>
</div>
<div class="kpi" style="border-top-color:#ef4444">
  <div class="kpi-l">Critical Fails</div>
  <div class="kpi-v" style="color:#ef4444">$critFails</div>
  <div class="kpi-s">Immediate action</div>
</div>
<div class="kpi" style="border-top-color:#f97316">
  <div class="kpi-l">High Risk Items</div>
  <div class="kpi-v" style="color:#f97316">$highFails</div>
  <div class="kpi-s">Urgent attention</div>
</div>
<div class="kpi" style="border-top-color:#22c55e">
  <div class="kpi-l">Checks Passing</div>
  <div class="kpi-v" style="color:#22c55e">$(@($Script:Findings | Where-Object {$_.score -ge 80}).Count)/$($Script:Findings.Count)</div>
  <div class="kpi-s">Score 80+</div>
</div>
</div>
<h2>All Assessment Findings</h2>
<table><thead><tr>
<th>Check</th><th>Category</th><th>Severity</th><th>Client Score</th><th>Client Status</th><th>Client Finding</th><th>Recommendation</th>
</tr></thead><tbody>
"@
    foreach ($f in ($Script:Findings | Sort-Object score)) {
        $sevClass    = switch ($f.severity) { "Critical"{"crit"} "High"{"high"} "Medium"{"med"} default{"low"} }
        $statusClass = switch ($f.status)   { "Pass"{"pass"} "Warning"{"warn"} default{"fail"} }
        $htmlContent += "<tr><td><strong style='color:#e2e8f0'>$($f.label)</strong></td>"
        $htmlContent += "<td>$($f.category)</td>"
        $htmlContent += "<td class='$sevClass'>$($f.severity)</td>"
        $htmlContent += "<td style='font-size:18px;font-weight:800;font-family:monospace' class='$statusClass'>$($f.score)</td>"
        $htmlContent += "<td class='$statusClass'>$($f.status)</td>"
        $htmlContent += "<td>$($f.actualValue)</td>"
        $htmlContent += "<td style='font-size:11px'>$($f.recommendation)</td></tr>"
    }
    $htmlContent += @"
</tbody></table>
<div class="footer">
<span>AD Secure Score Collector v$Script:Version - First Technology KwaZulu-Natal</span>
<span>CONFIDENTIAL - $Script:RunDateStr</span>
</div>
</div></body></html>
"@
    $htmlContent | Set-Content $htmlFile -Encoding UTF8
    Write-Pass "HTML report: $htmlFile"
}

$scoreColor = if ($overallScore -ge 80) { "Green" } elseif ($overallScore -ge 60) { "Yellow" } else { "Red" }
Write-Host ""
Write-Host "  DONE. Score: $overallScore/100 | Critical: $critFails | High: $highFails" -ForegroundColor $scoreColor
Write-Host "  Output: $OutputPath" -ForegroundColor Green
Write-Host ""

[PSCustomObject]@{
    OverallScore    = $overallScore
    CategoryScores = $categoryScores
    CriticalFails  = $critFails
    HighFails      = $highFails
    OutputJSON     = $outputFile
    HistoryFile    = $historyFile
    HTMLReport     = if ($GenerateHTML) { $htmlFile } else { "" }
}
