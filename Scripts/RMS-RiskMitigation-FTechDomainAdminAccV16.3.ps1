## Updated Script V16.3 - FT Engineer AD Accs -Autodisable if lastlogon 60days + ALL USERS option
#***Nishen RMS 18/02/26****AdRisk -Preventative measures-  Solution - make contact with Nishen for a full description behind this scripts logic.
#Produces 1 Html & 1 .csv Report emailed to rmsreports@ftechkzn.co.za
#Updated with Office 365 SMTP relay settings
#V16.3: Improved Privileged User detection (removed adminCount), better Server detection in computer script

# Import Active Directory module
Import-Module ActiveDirectory

# Configuration - Set to $true to include ALL users, $false for only privileged users
$IncludeAllUsers = $false  # Change to $true to include ALL AD users in the report

# Add Write-Log function
function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('Information','Warning','Error')]
        [string]$Level = 'Information'
    )
    
    $logPath = "C:\Temp\EnhancedDomainAdminReport.txt"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Create log directory if it doesn't exist
    $logDir = Split-Path $logPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }
    
    # Write to log file
    Add-Content -Path $logPath -Value $logMessage
    
    # Also write to console with appropriate color
    switch ($Level) {
        'Error' { Write-Host $logMessage -ForegroundColor Red }
        'Warning' { Write-Host $logMessage -ForegroundColor Yellow }
        'Information' { Write-Host $logMessage -ForegroundColor Green }
    }
}

# Function to get domain password policy
function Get-DomainPasswordPolicy {
    try {
        $policy = Get-ADDefaultDomainPasswordPolicy
        Write-Log -Message "Retrieved domain password policy: Max Age = $($policy.MaxPasswordAge.Days) days" -Level Information
        
        # If MaxPasswordAge is 0, use default 90 days (domain may have fine-grained policy)
        if ($null -eq $policy.MaxPasswordAge -or $policy.MaxPasswordAge.TotalDays -eq 0) {
            Write-Log -Message "Domain has no password expiration policy (MaxAge=0), using default 90 days" -Level Warning
            $policy = [PSCustomObject]@{
                MaxPasswordAge = [TimeSpan]::FromDays(90)
                MinPasswordAge = [TimeSpan]::FromDays(1)
                MinPasswordLength = 8
                PasswordHistoryCount = 24
                LockoutThreshold = 0
                LockoutDuration = [TimeSpan]::FromMinutes(30)
                ComplexityEnabled = $true
                ReversibleEncryptionEnabled = $false
            }
        }
        
        return $policy
    }
    catch {
        Write-Log -Message "Error retrieving domain password policy: $_" -Level Error
        # Return default policy as fallback (90 days)
        return [PSCustomObject]@{
            MaxPasswordAge = [TimeSpan]::FromDays(90)
            MinPasswordAge = [TimeSpan]::FromDays(1)
            MinPasswordLength = 8
            PasswordHistoryCount = 24
            LockoutThreshold = 0
            LockoutDuration = [TimeSpan]::FromMinutes(30)
            ComplexityEnabled = $true
            ReversibleEncryptionEnabled = $false
        }
    }
}

# Function to export password policy to JSON for dashboard
function Export-PasswordPolicy {
    param (
        [string]$domainName,
        [object]$policy,
        [string]$filePath
    )
    
    $policyData = @{
        DomainName = $domainName
        TimeStamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        MaxPasswordAgeDays = if ($policy.MaxPasswordAge) { $policy.MaxPasswordAge.Days } else { 90 }
        MinPasswordAgeDays = if ($policy.MinPasswordAge) { $policy.MinPasswordAge.Days } else { 1 }
        MinPasswordLength = if ($policy.MinPasswordLength) { $policy.MinPasswordLength } else { 8 }
        PasswordHistoryCount = if ($policy.PasswordHistoryCount) { $policy.PasswordHistoryCount } else { 24 }
        LockoutThreshold = if ($policy.LockoutThreshold) { $policy.LockoutThreshold } else { 0 }
        LockoutDurationMinutes = if ($policy.LockoutDuration) { $policy.LockoutDuration.TotalMinutes } else { 30 }
        ComplexityEnabled = if ($null -ne $policy.ComplexityEnabled) { $policy.ComplexityEnabled } else { $true }
        ReversibleEncryptionEnabled = if ($null -ne $policy.ReversibleEncryptionEnabled) { $policy.ReversibleEncryptionEnabled } else { $false }
    }
    
    $jsonPath = Join-Path $filePath "${domainName}_PasswordPolicy.json"
    $policyData | ConvertTo-Json | Out-File -FilePath $jsonPath -Encoding UTF8
    
    Write-Log -Message "Password policy exported to: $jsonPath" -Level Information
    return $jsonPath
}

# Function to calculate password age and status with null handling
function Get-PasswordAgeStatus {
    param (
        [Parameter(Mandatory=$false)]
        [AllowNull()]
        [Nullable[DateTime]]$passwordLastSet,
        
        [Parameter(Mandatory=$true)]
        [TimeSpan]$maxPasswordAge,
        
        [Parameter(Mandatory=$false)]
        [bool]$passwordNeverExpires = $false
    )
    
    # If password was never set or is null
    if ($null -eq $passwordLastSet) {
        return @{
            AgeInDays = 0
            Status = "Never Set"
            RiskLevel = "High"
            IsStale = $true
        }
    }
    
    # If password never expires (or domain has no max age policy)
    if ($passwordNeverExpires -or $maxPasswordAge.TotalDays -le 0) {
        return @{
            AgeInDays = [math]::Round(((Get-Date) - $passwordLastSet).TotalDays, 0)
            Status = "Never Expires"
            RiskLevel = "High"
            IsStale = $true
        }
    }
    
    try {
        $ageInDays = (Get-Date) - $passwordLastSet
        $percentageOfMax = ($ageInDays.TotalDays / $maxPasswordAge.TotalDays) * 100
        
        $status = switch ($percentageOfMax) {
            {$_ -ge 100} { "Expired" }
            {$_ -ge 75} { "Warning" }
            {$_ -ge 50} { "Aging" }
            default { "Good" }
        }
        
        $riskLevel = switch ($percentageOfMax) {
            {$_ -ge 100} { "High" }
            {$_ -ge 75} { "Medium" }
            {$_ -ge 50} { "Low" }
            default { "None" }
        }
        
        $isStale = $ageInDays.TotalDays -ge 90
        
        return @{
            AgeInDays = [math]::Round($ageInDays.TotalDays, 0)
            Status = $status
            RiskLevel = $riskLevel
            IsStale = $isStale
        }
    }
    catch {
        Write-Log -Message "Error calculating password age status: $_" -Level Error
        return @{
            AgeInDays = 0
            Status = "Error"
            RiskLevel = "High"
            IsStale = $false
        }
    }
}

# Function to determine account type based on description and group membership
function Get-AccountTypeClassification {
    param(
        [string]$Description,
        [array]$MemberOf,
        [bool]$IsDomainAdmin,
        [bool]$IsEnterpriseAdmin,
        [bool]$IsSchemaAdmin,
        [bool]$IsAccountOperator,
        [bool]$IsBackupOperator
    )
    
    $accountTypes = @()
    
    # Check group memberships first (most privileged)
    if ($IsSchemaAdmin) { $accountTypes += "Schema Admin" }
    if ($IsEnterpriseAdmin) { $accountTypes += "Enterprise Admin" }
    if ($IsAccountOperator) { $accountTypes += "Account Operator" }
    if ($IsBackupOperator) { $accountTypes += "Backup Operator" }
    if ($IsDomainAdmin) { $accountTypes += "Domain Admin" }
    
    # Check description patterns
    if ($Description -match "(?i)(FTech|FT |FirstTechnology|First Technology|First Tech|Ftech Engineer|RMS Server Engineer|RMS Engineer)") {
        if ($accountTypes -notcontains "FTech Engineer") {
            $accountTypes += "FTech Engineer"
        }
    }
    
    # Service Account patterns - includes svc, wssuser, app, etc.
    if ($Description -match "(?i)(Svc|service|ServiceAcc|SvcAcc|Break.?Glass|AdminAcc|Privileged|wssuser|app_|application_|sql_|db_|web_|http_|apppool|mssql|mysql|oracle|exchange|sharepoint|lync|teams)") {
        if ($accountTypes -notcontains "Service Account") {
            $accountTypes += "Service Account"
        }
    }
    
    # Shared Account patterns - includes portal, shared generic accounts, department, team
    if ($Description -match "(?i)(Shared|Generic|team|department|pool|portal|market|wssuser|ITTraining|FMConway| reception|admin|helpdesk|support|info|webmaster|postmaster)") {
        if ($accountTypes -notcontains "Shared Account") {
            $accountTypes += "Shared Account"
        }
    }
    
    if ($Description -match "(?i)(Test|Demo|Dev)") {
        if ($accountTypes -notcontains "Test Account") {
            $accountTypes += "Test Account"
        }
    }
    
    if ($Description -match "(?i)(Backup|Recovery|DR|Emergency)") {
        if ($accountTypes -notcontains "Emergency Account") {
            $accountTypes += "Emergency Account"
        }
    }
    
    # If user is in Domain Admins but not classified otherwise
    if ($accountTypes.Count -eq 0) {
        if ($IsDomainAdmin) {
            $accountTypes += "Privileged User"
        } else {
            $accountTypes += "Standard User"
        }
    }
    
    return ($accountTypes -join ", ")
}

# Function to detect privileged group membership
function Get-PrivilegedGroupMembership {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Username
    )
    
    try {
        $memberOf = Get-ADUser -Identity $Username -Properties memberof | Select-Object -ExpandProperty memberof
        
        $privilegedGroups = @{
            IsDomainAdmin = $false
            IsEnterpriseAdmin = $false
            IsSchemaAdmin = $false
            IsAccountOperator = $false
            IsBackupOperator = $false
            IsServerOperator = $false
            IsPrintOperator = $false
            IsGroupPolicyCreator = $false
            IsDnsAdmin = $false
            IsDHCPAdmin = $false
            PrivilegedGroups = @()
        }
        
        foreach ($group in $memberOf) {
            $groupName = ($group -split ',')[0] -replace '^CN=',''
            
            switch -Regex ($groupName) {
                "Domain Admins" { 
                    $privilegedGroups.IsDomainAdmin = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Enterprise Admins" { 
                    $privilegedGroups.IsEnterpriseAdmin = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Schema Admins" { 
                    $privilegedGroups.IsSchemaAdmin = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Account Operators" { 
                    $privilegedGroups.IsAccountOperator = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Backup Operators" { 
                    $privilegedGroups.IsBackupOperator = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Server Operators" { 
                    $privilegedGroups.IsServerOperator = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Print Operators" { 
                    $privilegedGroups.IsPrintOperator = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Group Policy Creator" { 
                    $privilegedGroups.IsGroupPolicyCreator = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "DnsAdmins" { 
                    $privilegedGroups.IsDnsAdmin = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
                "Dhcp" { 
                    $privilegedGroups.IsDHCPAdmin = $true
                    $privilegedGroups.PrivilegedGroups += $groupName
                }
            }
        }
        
        return $privilegedGroups
    }
    catch {
        return @{
            IsDomainAdmin = $false
            IsEnterpriseAdmin = $false
            IsSchemaAdmin = $false
            IsAccountOperator = $false
            IsBackupOperator = $false
            IsServerOperator = $false
            IsPrintOperator = $false
            IsGroupPolicyCreator = $false
            IsDnsAdmin = $false
            IsDHCPAdmin = $false
            PrivilegedGroups = @()
        }
    }
}

# Function to disable inactive FTech accounts (including Domain Admins)
function Disable-InactiveFTechAccounts {
    param (
        [string]$domainName,
        [array]$accountDetails,
        [int]$daysInactive = 60
    )

    try {
        $currentDate = (Get-Date).AddDays(-$daysInactive)
        $inactiveAccounts = $accountDetails | Where-Object {
            $_.Enabled -and
            $_.LastLogon -lt $currentDate -and
            ($_.Description -like "*FTech*" -or 
             $_.Description -like "*FT*" -or 
             $_.Description -like "*FirstTechnology*" -or 
             $_.Description -like "*First Technology*" -or
             $_.Description -like "*First Tech*" -or
             $_.Description -like "*Ftech Engineer*" -or 
             $_.Description -like "*RMS Server Engineer*" -or
             $_.Description -like "*RMS Engineer*") -and
                       (-not ($_.Description -like "*Svc*" -or 
                   $_.Description -like "*service*" -or 
                   $_.Description -like "*ServiceAcc*" -or
                   $_.Description -like "*Account created by Microsoft*" -or
                   $_.Description -like "*Serv*" -or 
                   $_.Description -like "*SvcAcc*"))
        }

        foreach ($account in $inactiveAccounts) {
            Disable-ADAccount -Identity $account.Username
            Write-Log -Message "Disabled FTech account: $($account.Username) (Domain Admin: $($account.IsDomainAdmin))" -Level Information
        }

        return $inactiveAccounts
    }
    catch {
        Write-Log -Message "Error disabling inactive FTech accounts: $_" -Level Error
        throw
    }
}

# Function to get enhanced account details with password age
function Get-EnhancedAccountDetails {
    param (
        [string]$domainName,
        [bool]$includeAllUsers = $false
    )

    try {
        # Get domain password policy
        $passwordPolicy = Get-DomainPasswordPolicy
        
        # Get privileged groups
        $privilegedGroupSIDs = @()
        try {
            $domainAdmins = Get-ADGroupMember -Identity "Domain Admins" -Recursive | Where-Object { $_.objectClass -eq "user" } | Select-Object -ExpandProperty SamAccountName
            $enterpriseAdmins = Get-ADGroupMember -Identity "Enterprise Admins" -Recursive | Where-Object { $_.objectClass -eq "user" } | Select-Object -ExpandProperty SamAccountName
            $schemaAdmins = Get-ADGroupMember -Identity "Schema Admins" -Recursive | Where-Object { $_.objectClass -eq "user" } | Select-Object -ExpandProperty SamAccountName
        }
        catch {
            Write-Log -Message "Could not retrieve some privileged groups: $_" -Level Warning
            $domainAdmins = @()
            $enterpriseAdmins = @()
            $schemaAdmins = @()
        }
        
        # Get all FTech Engineers (based on description)
        $ftechEngineers = Get-ADUser -Filter '(Description -like "*Ftech*" -or 
            Description -like "*FT*" -or 
            Description -like "*FirstTechnology*" -or 
            Description -like "*First Technology*" -or
            Description -like "*Ftech Engineer*" -or
            Description -like "*First Tech*" -or
            Description -like "*RMS Server Engineer*" -or 
            Description -like "*RMS Engineer*") -and 
            -not(Description -like "*Svc*" -or 
            Description -like "*service*" -or 
            Description -like "*Account created by Microsoft*" -or
            Description -like "*ServiceAcc*" -or 
            Description -like "*SvcAcc*")' -Properties *

        # If includeAllUsers is false, only get privileged users
        if ($includeAllUsers) {
            Write-Log -Message "Including ALL users in report (filtering out system accounts)" -Level Information
            $allAccounts = Get-ADUser -Filter '(Enabled -eq $true -or Enabled -eq $false)' -Properties GivenName, Surname, Description, 
                Enabled, LastLogonDate, PasswordLastSet, whenCreated, memberof, UserPrincipalName, 
                PasswordNeverExpires, PasswordNotRequired, SmartcardLogonRequired, 
                AccountExpirationDate, TrustedForDelegation, SIDHistory, adminCount
        } else {
            # Combine and deduplicate accounts (only privileged)
            $allAccounts = @($domainAdmins) + @($enterpriseAdmins) + @($ftechEngineers.SamAccountName) | Select-Object -Unique
            
            $results = foreach ($account in $allAccounts) {
                $user = Get-ADUser -Identity $account -Properties GivenName, Surname, Description, 
                    Enabled, LastLogonDate, PasswordLastSet, whenCreated, memberof, UserPrincipalName, 
                    PasswordNeverExpires, PasswordNotRequired, SmartcardLogonRequired, 
                    AccountExpirationDate, TrustedForDelegation, SIDHistory, adminCount
                
                # Get privileged group membership
                $privilegedMembership = Get-PrivilegedGroupMembership -Username $account
                
                # Check if account is a Domain Admin
                $isDomainAdmin = $privilegedMembership.IsDomainAdmin
                
                # Calculate password age and status (handle null/empty PasswordNeverExpires)
                $pwdNeverExpires = if ($null -eq $user.PasswordNeverExpires -or $user.PasswordNeverExpires -eq "") { $false } else { [bool]$user.PasswordNeverExpires }
                $passwordStatus = Get-PasswordAgeStatus -passwordLastSet $user.PasswordLastSet -maxPasswordAge $passwordPolicy.MaxPasswordAge -passwordNeverExpires $pwdNeverExpires
                
                # Determine account type
                $accountType = Get-AccountTypeClassification -Description $user.Description -MemberOf $user.memberof `
                    -IsDomainAdmin $isDomainAdmin -IsEnterpriseAdmin $privilegedMembership.IsEnterpriseAdmin `
                    -IsSchemaAdmin $privilegedMembership.IsSchemaAdmin -IsAccountOperator $privilegedMembership.IsAccountOperator `
                    -IsBackupOperator $privilegedMembership.IsBackupOperator
                
                [PSCustomObject]@{
                    DomainName = $domainName
                    TimeStamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                    ActionThisRun = "None"
                    FirstName = $user.GivenName
                    LastName = $user.Surname
                    Username = $user.SamAccountName
                    UserPrincipalName = $user.UserPrincipalName
                    Enabled = $user.Enabled
                    LastLogon = $user.LastLogonDate
                    PasswordLastSet = $user.PasswordLastSet
                    PasswordAgeInDays = $passwordStatus.AgeInDays
                    PasswordStatus = $passwordStatus.Status
                    PasswordRiskLevel = $passwordStatus.RiskLevel
                    PasswordNeverExpires = if ($null -eq $user.PasswordNeverExpires) { $false } else { $user.PasswordNeverExpires }
                    PasswordNotRequired = if ($null -eq $user.PasswordNotRequired) { $false } else { $user.PasswordNotRequired }
                    SmartcardLogonRequired = if ($null -eq $user.SmartcardLogonRequired) { $false } else { $user.SmartcardLogonRequired }
                    AccountExpirationDate = $user.AccountExpirationDate
                    TrustedForDelegation = if ($null -eq $user.TrustedForDelegation) { $false } else { $user.TrustedForDelegation }
                    SIDHistory = if ($user.SIDHistory) { "Present" } else { "None" }
                    WhenCreated = $user.whenCreated.ToString("yyyy-MM-dd HH:mm:ss")
                    Description = $user.Description
                    IsDomainAdmin = $isDomainAdmin
                    IsEnterpriseAdmin = $privilegedMembership.IsEnterpriseAdmin
                    IsSchemaAdmin = $privilegedMembership.IsSchemaAdmin
                    IsPrivileged = ($isDomainAdmin -or $privilegedMembership.IsEnterpriseAdmin -or $privilegedMembership.IsSchemaAdmin -or $privilegedMembership.IsAccountOperator -or $privilegedMembership.IsBackupOperator)
                    PrivilegedGroups = ($privilegedMembership.PrivilegedGroups -join "; ")
                    AccountType = $accountType
                    DomainPasswordMaxAge = $passwordPolicy.MaxPasswordAge.Days
                    ReportDate = (Get-Date).ToString("yyyy-MM-dd")
                }
            }
            return $results
        }
        
        # Process all users
        $results = foreach ($user in $allAccounts) {
            # Skip system accounts
            if ($user.SamAccountName -match '^(\$|S-1-5-21|MSOL_|Sync_)' -or 
                $user.Description -match "Account created by Microsoft" -or
                $user.Description -match "CN=Microsoft") {
                continue
            }
            
            # Get privileged group membership
            $privilegedMembership = Get-PrivilegedGroupMembership -Username $user.SamAccountName
            
            # Check if account is a Domain Admin
            $isDomainAdmin = $privilegedMembership.IsDomainAdmin
            
            # Calculate password age and status (handle null/empty PasswordNeverExpires)
            $pwdNeverExpires = if ($null -eq $user.PasswordNeverExpires -or $user.PasswordNeverExpires -eq "") { $false } else { [bool]$user.PasswordNeverExpires }
            $passwordStatus = Get-PasswordAgeStatus -passwordLastSet $user.PasswordLastSet -maxPasswordAge $passwordPolicy.MaxPasswordAge -passwordNeverExpires $pwdNeverExpires
            
            # Determine account type
            $accountType = Get-AccountTypeClassification -Description $user.Description -MemberOf $user.memberof `
                -IsDomainAdmin $isDomainAdmin -IsEnterpriseAdmin $privilegedMembership.IsEnterpriseAdmin `
                -IsSchemaAdmin $privilegedMembership.IsSchemaAdmin -IsAccountOperator $privilegedMembership.IsAccountOperator `
                -IsBackupOperator $privilegedMembership.IsBackupOperator
            
            # Check if privileged (Strict check - ignore adminCount as it can be sticky)
            $isPrivileged = ($isDomainAdmin -or $privilegedMembership.IsEnterpriseAdmin -or $privilegedMembership.IsSchemaAdmin -or 
                           $privilegedMembership.IsAccountOperator -or $privilegedMembership.IsBackupOperator -or $privilegedMembership.IsServerOperator -or
                           $privilegedMembership.IsPrintOperator -or $accountType -match "FTech Engineer")
            
            [PSCustomObject]@{
                DomainName = $domainName
                TimeStamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                ActionThisRun = "None"
                FirstName = $user.GivenName
                LastName = $user.Surname
                Username = $user.SamAccountName
                UserPrincipalName = $user.UserPrincipalName
                Enabled = $user.Enabled
                LastLogon = $user.LastLogonDate
                PasswordLastSet = $user.PasswordLastSet
                PasswordAgeInDays = $passwordStatus.AgeInDays
                PasswordStatus = $passwordStatus.Status
                PasswordRiskLevel = $passwordStatus.RiskLevel
                PasswordNeverExpires = if ($null -eq $user.PasswordNeverExpires) { $false } else { $user.PasswordNeverExpires }
                PasswordNotRequired = if ($null -eq $user.PasswordNotRequired) { $false } else { $user.PasswordNotRequired }
                SmartcardLogonRequired = if ($null -eq $user.SmartcardLogonRequired) { $false } else { $user.SmartcardLogonRequired }
                AccountExpirationDate = $user.AccountExpirationDate
                TrustedForDelegation = if ($null -eq $user.TrustedForDelegation) { $false } else { $user.TrustedForDelegation }
                SIDHistory = if ($user.SIDHistory) { "Present" } else { "None" }
                WhenCreated = $user.whenCreated.ToString("yyyy-MM-dd HH:mm:ss")
                Description = $user.Description
                IsDomainAdmin = $isDomainAdmin
                IsEnterpriseAdmin = $privilegedMembership.IsEnterpriseAdmin
                IsSchemaAdmin = $privilegedMembership.IsSchemaAdmin
                IsPrivileged = $isPrivileged
                PrivilegedGroups = ($privilegedMembership.PrivilegedGroups -join "; ")
                AccountType = $accountType
                DomainPasswordMaxAge = $passwordPolicy.MaxPasswordAge.Days
                ReportDate = (Get-Date).ToString("yyyy-MM-dd")
            }
        }
        return $results
    }
    catch {
        Write-Log -Message "Error retrieving account details: $_" -Level Error
        throw
    }
}

# Function to create enhanced HTML report
function New-EnhancedReport {
    param (
        [string]$domainName,
        [array]$beforeDisable,
        [array]$afterDisable,
        [array]$disabledAccounts,
        [bool]$includeAllUsers = $false
    )
    
    $htmlHeader = @"
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #333;
        }
        h1 { 
            color: #2c3e50; 
            border-bottom: 2px solid #2c3e50; 
            padding-bottom: 10px; 
        }
        h2 { 
            color: #34495e; 
            margin-top: 20px; 
        }
        table { 
            border-collapse: collapse; 
            width: 100%;
            margin-top: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        th { 
            background-color: #2c3e50; 
            color: white; 
            padding: 12px 8px; 
            text-align: left; 
            font-weight: bold;
        }
        td { 
            padding: 10px 8px; 
            text-align: left; 
            border-bottom: 1px solid #ddd;
        }
        td:nth-child(9), th:nth-child(9) { text-align: center; width: 80px; }
        td:nth-child(8), th:nth-child(8), td:nth-child(10), th:nth-child(10) { text-align: center; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        tr:hover { background-color: #f2f2f2; }
        .disabled { color: #4c3ce7; background-color: #ffeded; }
        .privileged { background-color: #fff3cd; }
        .risk-high { background-color: #ffeded; color: #e74c3c; }
        .risk-medium { background-color: #fff5e6; color: #7E22E6; }
        .risk-low { background-color: #f9fde6; color: #27ae60; }
        .risk-none { background-color: #e6ffe6; color: #2ecc71; }
        .summary-box { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 20px 0; }
        .summary-box p { margin: 5px 0; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 10px; }
        .badge { padding: 3px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold; }
        .badge-privileged { background-color: #dc3545; color: white; }
        .badge-standard { background-color: #28a745; color: white; }
        .badge-service { background-color: #6c757d; color: white; }
    </style>
"@

    $reportType = if ($includeAllUsers) { "ALL USERS" } else { "PRIVILEGED USERS" }

    $html = @"
    <html>
    <head>
        <title>Domain Admin and FTech Engineer Account Report - $domainName</title>
        $htmlHeader
    </head>
    <body>
        <h1>$reportType Account Report - $domainName</h1>
        <div class="timestamp">Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</div>
        <div class="timestamp">Domain: $domainName</div>
        <div class="timestamp">Report Type: $(if ($includeAllUsers) { 'ALL ACCOUNTS (with privileged highlighted)' } else { 'PRIVILEGED ACCOUNTS ONLY' })</div>
        
        <div class="summary-box">
            <h2>Summary</h2>
            <p><strong>Total Accounts:</strong> $($afterDisable.Count)</p>
            <p><strong>Privileged Accounts:</strong> $($afterDisable | Where-Object {$_.IsPrivileged -eq $true} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Enabled Accounts:</strong> $($afterDisable | Where-Object {$_.Enabled -eq $true} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Disabled Accounts:</strong> $($afterDisable | Where-Object {$_.Enabled -eq $false} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Accounts Disabled on this run:</strong> $($disabledAccounts.Count)</p>
            <p><strong>High Risk Passwords:</strong> $($afterDisable | Where-Object {$_.PasswordRiskLevel -eq 'High'} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Password Never Expires:</strong> $($afterDisable | Where-Object {$_.PasswordNeverExpires -eq $true} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Never Logged In:</strong> $($afterDisable | Where-Object {$_.LastLogon -eq $null} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Domain Password Max Age:</strong> $($afterDisable[0].DomainPasswordMaxAge) days</p>
        </div>
        
        <h2>Account Details</h2>
        <table>
            <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Type</th>
                <th>Privileged</th>
                <th>Status</th>
                <th>Last Logon</th>
                <th>Password Last Set</th>
                <th>Pwd Age</th>
                <th>Pwd Status</th>
                <th>Pwd Never Expires</th>
                <th>Description</th>
            </tr>
"@

    foreach ($account in $afterDisable | Sort-Object Username) {
        $riskClass = "risk-$($account.PasswordRiskLevel.ToLower())"
        $status = if ($account.Enabled) { "Enabled" } else { "Disabled" }
        $lastLogon = if ($account.LastLogon) { $account.LastLogon.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        $passwordLastSet = if ($account.PasswordLastSet) { $account.PasswordLastSet.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        $privilegedBadge = if ($account.IsPrivileged) { '<span class="badge badge-privileged">PRIVILEGED</span>' } else { '<span class="badge badge-standard">Standard</span>' }
        $pwdNeverExpires = if ($account.PasswordNeverExpires) { "YES" } else { "No" }
        
        $html += @"
            <tr class="$riskClass">
                <td>$($account.Username)</td>
                <td>$($account.FirstName) $($account.LastName)</td>
                <td>$($account.AccountType)</td>
                <td>$privilegedBadge</td>
                <td>$status</td>
                <td>$lastLogon</td>
                <td>$passwordLastSet</td>
                <td>$($account.PasswordAgeInDays)</td>
                <td>$($account.PasswordStatus)</td>
                <td>$pwdNeverExpires</td>
                <td>$($account.Description)</td>
            </tr>
"@
    }

    $html += @"
        </table>
        
        <h2>Ftech Accounts Disabled in this Run</h2>
        <table>
            <tr>
                <th>Username</th>
                <th>Type</th>
                <th>Created Date</th>
                <th>Last Logon</th>
                <th>Description</th>
            </tr>
"@

    foreach ($account in $disabledAccounts | Sort-Object Username) {
        $lastLogon = if ($account.LastLogon) { $account.LastLogon.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        
        $html += @"
            <tr class="disabled">
                <td>$($account.Username)</td>
                <td>$($account.AccountType)</td>
                <td>$($account.WhenCreated)</td>
                <td>$lastLogon</td>
                <td>$($account.Description)</td>
            </tr>
"@
    }

    $html += @"
        </table>
    </body>
    </html>
"@

    return $html
}

# Function to export CSV report
function Export-PowerBIReport {
    param (
        [array]$accountData,
        [string]$filePath,
        [array]$disabledAccounts,
        [bool]$includeAllUsers = $false
    )
    
    $date = Get-Date -Format 'yyyyMMdd'
    $domainName = $accountData[0].DomainName
    
    # Different filename based on report type
    if ($includeAllUsers) {
        $csvFileName = "${domainName}_RMSRiskMitigation_ALLUsers_Report_$date.csv"
    } else {
        $csvFileName = "${domainName}_RMSRiskMitigation_PrivilegedUsers_Report_$date.csv"
    }
    
    $csvPath = Join-Path $filePath $csvFileName
    $historicalPath = Join-Path $filePath "HistoricalAccountReport.csv"
    
    # Update ActionThisRun for disabled accounts
    $accountData | ForEach-Object {
        if ($disabledAccounts.Username -contains $_.Username) {
            $_.ActionThisRun = "Disabled"
        }
    }

    # Format data for export - EXPANDED COLUMNS FOR V16.0
    $exportData = $accountData | Select-Object @(
        'DomainName',
        'TimeStamp',
        'ActionThisRun',
        'Username',
        'UserPrincipalName',
        'FirstName',
        'LastName',
        'WhenCreated',
        'AccountType',
        @{Name='Status';Expression={if ($_.Enabled) {'Enabled'} else {'Disabled'}}},
        @{Name='LastLogon';Expression={if ($_.LastLogon) { $_.LastLogon.ToString("yyyy-MM-dd HH:mm:ss") } else { 'Never' }}},
        @{Name='PasswordLastSet';Expression={if ($_.PasswordLastSet) { $_.PasswordLastSet.ToString("yyyy-MM-dd HH:mm:ss") } else { 'Never' }}},
        'PasswordAgeInDays',
        'PasswordStatus',
        'PasswordRiskLevel',
        'PasswordNeverExpires',
        'PasswordNotRequired',
        'SmartcardLogonRequired',
        'AccountExpirationDate',
        'TrustedForDelegation',
        'SIDHistory',
        'Description',
        'IsDomainAdmin',
        'IsEnterpriseAdmin',
        'IsSchemaAdmin',
        'IsPrivileged',
        'PrivilegedGroups',
        'DomainPasswordMaxAge',
        'ReportDate'
    )

    # Export current snapshot
    $exportData | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    
    # Append to historical data
    if (Test-Path $historicalPath) {
        $exportData | Export-Csv -Path $historicalPath -NoTypeInformation -Encoding UTF8 -Append
    } else {
        $exportData | Export-Csv -Path $historicalPath -NoTypeInformation -Encoding UTF8
    }
    
    return @{
        CurrentReport = $csvPath
        HistoricalReport = $historicalPath
    }
}

# Updated function to send email report using Office 365 SMTP settings
function Send-DomainAdminReport {
    param (
        [Parameter(Mandatory=$true)]
        [string]$emailTo,
        
        [Parameter(Mandatory=$true)]
        [string]$emailFrom,
        
        [Parameter(Mandatory=$true)]
        [string]$emailSubject,
        
        [Parameter(Mandatory=$true)]
        [string]$emailBody,
        
        [Parameter(Mandatory=$true)]
        [string]$htmlReport,
        
        [Parameter(Mandatory=$true)]
        [string]$csvPath
    )
    
    try {
        # Create temporary file for HTML report with explicit encoding
        $tempHtmlPath = Join-Path $env:TEMP "DomainAdminReport_$(Get-Date -Format 'yyyyMMddHHmmss').html"
        $htmlReport | Out-File -FilePath $tempHtmlPath -Encoding UTF8 -Force

        # Create mail message
        $mailMessage = New-Object System.Net.Mail.MailMessage
        $mailMessage.From = New-Object System.Net.Mail.MailAddress($emailFrom)
        $mailMessage.To.Add($emailTo)
        $mailMessage.Subject = $emailSubject
        $mailMessage.Body = $emailBody
        $mailMessage.IsBodyHtml = $true
        
        # Add HTML report as attachment with proper encoding
        $attachment = New-Object System.Net.Mail.Attachment($tempHtmlPath, 'text/html')
        $mailMessage.Attachments.Add($attachment)

        # Add CSV report as attachment
        if (Test-Path $csvPath) {
            $csvAttachment = New-Object System.Net.Mail.Attachment($csvPath, 'text/csv')
            $mailMessage.Attachments.Add($csvAttachment)
        }
        else {
            Write-Log -Message "CSV file not found at path: $csvPath" -Level Warning
        }
        
        # Create SMTP client with Office 365 configuration
        $smtpClient = New-Object System.Net.Mail.SmtpClient("smtp.office365.com", 587)
        $smtpClient.DeliveryMethod = [System.Net.Mail.SmtpDeliveryMethod]::Network
        $smtpClient.EnableSsl = $true
        
        # Set credentials for Office 365
        $password = ConvertTo-SecureString "RM`$N0t1f!c@tion`$" -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential("RMSNotifications@ftechkzn.co.za", $password)
        $smtpClient.Credentials = New-Object System.Net.NetworkCredential($credential.UserName, $credential.Password)
        
        # Set timeout to 5 minutes
        $smtpClient.Timeout = 300000

        # Send email
        $smtpClient.Send($mailMessage)
        
        Write-Log -Message "Email report sent successfully to $emailTo" -Level Information
    }
    catch {
        Write-Log -Message "Error sending email report: $($_.Exception.Message)" -Level Error
        Write-Log -Message "Stack Trace: $($_.Exception.StackTrace)" -Level Error
        throw
    }
    finally {
        # Proper cleanup
        if ($attachment) { $attachment.Dispose() }
        if ($csvAttachment) { $csvAttachment.Dispose() }
        if ($mailMessage) { $mailMessage.Dispose() }
        if ($smtpClient) { $smtpClient.Dispose() }
        if (Test-Path $tempHtmlPath) { Remove-Item $tempHtmlPath -Force }
    }
}

# Main script execution
try {
    # Initial logging with system information
    Write-Log -Message "Script V16.0 started - RMS Risk Mitigation Dashboard Data Collector"
    Write-Log -Message "Running as: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
    Write-Log -Message "Computer Name: $env:COMPUTERNAME"
    Write-Log -Message "Include All Users: $IncludeAllUsers"
    
    # Get computer system information
    $computerSystem = Get-WmiObject Win32_ComputerSystem
    Write-Log -Message "Domain: $($computerSystem.Domain)"
    Write-Log -Message "Part of Domain: $($computerSystem.PartOfDomain)"
    
    $domainName = $computerSystem.Domain
    $tempPath = "C:\Windows\Temp"
    $logFile = Join-Path $tempPath "EnhancedDomainAdminReport.txt"
    
    # Updated email settings for Office 365
    $emailTo = "rmsreports@ftechkzn.co.za"
    $emailFrom = "RMSNotifications@ftechkzn.co.za"

    # Get domain password policy and export to JSON for dashboard
    $passwordPolicy = Get-DomainPasswordPolicy
    $policyJsonPath = Export-PasswordPolicy -domainName $domainName -policy $passwordPolicy -filePath $tempPath

    # Get account details before disabling
    $beforeDisable = Get-EnhancedAccountDetails -domainName $domainName -includeAllUsers $IncludeAllUsers
    
    # Disable inactive FTech accounts (only for privileged users mode)
    if (-not $IncludeAllUsers) {
        $disabledAccounts = Disable-InactiveFTechAccounts -domainName $domainName -accountDetails $beforeDisable
        
        # Get account details after disabling
        $afterDisable = Get-EnhancedAccountDetails -domainName $domainName -includeAllUsers $IncludeAllUsers
    } else {
        # In "all users" mode, don't auto-disable
        $disabledAccounts = @()
        $afterDisable = $beforeDisable
    }

    # Generate reports
    $htmlReport = New-EnhancedReport -domainName $domainName -beforeDisable $beforeDisable -afterDisable $afterDisable -disabledAccounts $disabledAccounts -includeAllUsers $IncludeAllUsers
    $reportPaths = Export-PowerBIReport -accountData $afterDisable -filePath $tempPath -disabledAccounts $disabledAccounts -includeAllUsers $IncludeAllUsers

    # Update email subject to match new format
    $reportType = if ($IncludeAllUsers) { "ALL USERS" } else { "PRIVILEGED" }
    $emailSubject = "$domainName RMSRiskMitigation $reportType Report - $(Get-Date -Format 'yyyy-MM-dd')"

    # Enhanced email body for V16.0
    $privilegedCount = ($afterDisable | Where-Object {$_.IsPrivileged -eq $true}).Count
    $highRiskCount = ($afterDisable | Where-Object {$_.PasswordRiskLevel -eq 'High'}).Count
    $neverExpiresCount = ($afterDisable | Where-Object {$_.PasswordNeverExpires -eq $true}).Count
    
    $emailBody = @"
<html>
<body>
<h2>RMS Risk Mitigation Report - $reportType</h2>
<p>Please find attached the Domain Admin and FTech Engineer Account Report for $domainName.</p>
<p>Report generated on: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>

<h3>Quick Summary:</h3>
<ul>
    <li><strong>Total Accounts:</strong> $($afterDisable.Count)</li>
    <li><strong>Privileged Accounts:</strong> $privilegedCount</li>
    <li><strong>High Risk Passwords:</strong> $highRiskCount</li>
    <li><strong>Password Never Expires:</strong> $neverExpiresCount</li>
    <li><strong>Disabled This Run:</strong> $($disabledAccounts.Count)</li>
</ul>

<h3>Report Type:</h3>
<p>$(if ($IncludeAllUsers) { 'This report includes ALL user accounts with privileged users highlighted.' } else { 'This report includes only PRIVILEGED accounts (Domain Admins, Enterprise Admins, FTech Engineers, etc.)' })</p>

<p>Files included:</p>
<ul>
    <li>HTML Report - Detailed account status and information</li>
    <li>CSV Report - For Power BI / Dashboard integration</li>
</ul>
</body>
</html>
"@

    # Send email report with both HTML and CSV attachments
    Send-DomainAdminReport `
        -emailTo $emailTo `
        -emailFrom $emailFrom `
        -emailSubject $emailSubject `
        -emailBody $emailBody `
        -htmlReport $htmlReport `
        -csvPath $reportPaths.CurrentReport

    Write-Log -Message "Script V16.0 completed successfully" -Level Information
    Write-Log -Message "Report file: $($reportPaths.CurrentReport)" -Level Information
}
catch {
    Write-Log -Message "An error occurred during script execution: $_" -Level Error
    Write-Log -Message "Stack Trace: $($_.ScriptStackTrace)" -Level Error
    throw
}
