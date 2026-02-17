## Updated Script FT Engineer AD Accs -Autodisable if lastlogon 60days inclu Ftech Domain Admin Acc
#***Nishen RMS 17/11/24****AdRisk -Preventative measures-  Solution - make contact with Nishen for a full description behind this scripts logic.
#Produces 1 Html & 1 .csv Report emailed to rmsreports@ftechkzn.co.za
#Updated with Office 365 SMTP relay settings

# Import Active Directory module
Import-Module ActiveDirectory

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
        return $policy
    }
    catch {
        Write-Log -Message "Error retrieving domain password policy: $_" -Level Error
        # Return default policy as fallback (90 days)
        return [PSCustomObject]@{
            MaxPasswordAge = [TimeSpan]::FromDays(90)
        }
    }
}

# Function to calculate password age and status with null handling
function Get-PasswordAgeStatus {
    param (
        [Parameter(Mandatory=$false)]
        [AllowNull()]
        [Nullable[DateTime]]$passwordLastSet,
        
        [Parameter(Mandatory=$true)]
        [TimeSpan]$maxPasswordAge
    )
    
    # If password was never set or is null
    if ($null -eq $passwordLastSet) {
        return @{
            AgeInDays = 0
            Status = "Never Set"
            RiskLevel = "High"
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
        
        return @{
            AgeInDays = [math]::Round($ageInDays.TotalDays, 0)
            Status = $status
            RiskLevel = $riskLevel
        }
    }
    catch {
        Write-Log -Message "Error calculating password age status: $_" -Level Error
        return @{
            AgeInDays = 0
            Status = "Error"
            RiskLevel = "High"
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
        [string]$domainName
    )

    try {
        # Get domain password policy
        $passwordPolicy = Get-DomainPasswordPolicy
        
        # Get all Domain Admins
        $domainAdmins = Get-ADGroupMember -Identity "Domain Admins" -Recursive | 
            Where-Object { $_.objectClass -eq "user" }
        
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
            Description -like "*SvcAcc*")'

        # Combine and deduplicate accounts
        $allAccounts = @($domainAdmins.SamAccountName) + @($ftechEngineers.SamAccountName) | Select-Object -Unique

        $results = foreach ($account in $allAccounts) {
            $user = Get-ADUser -Identity $account -Properties GivenName, Surname, Description, 
                Enabled, LastLogonDate, PasswordLastSet, whenCreated, memberof

            # Check if account is a Domain Admin
            $isDomainAdmin = $user.memberof -match "Domain Admins"
            
            # Calculate password age and status
            $passwordStatus = Get-PasswordAgeStatus -passwordLastSet $user.PasswordLastSet -maxPasswordAge $passwordPolicy.MaxPasswordAge

            [PSCustomObject]@{
                DomainName = $domainName
                TimeStamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                ActionThisRun = "None" # Default value, will be updated later
                FirstName = $user.GivenName
                LastName = $user.Surname
                Username = $user.SamAccountName
                Enabled = $user.Enabled
                LastLogon = $user.LastLogonDate
                PasswordLastSet = $user.PasswordLastSet
                PasswordAgeInDays = $passwordStatus.AgeInDays
                PasswordStatus = $passwordStatus.Status
                PasswordRiskLevel = $passwordStatus.RiskLevel
                WhenCreated = $user.whenCreated.ToString("yyyy-MM-dd HH:mm:ss")
                Description = $user.Description
                IsDomainAdmin = $isDomainAdmin
                AccountType = if ($isDomainAdmin) { "Domain Admin" } else { "FTech Engineer" }
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
        [array]$disabledAccounts
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
        /* Center align specific columns */
        td:nth-child(9), 
        th:nth-child(9) { 
            text-align: center;
            width: 80px;  /* Fixed width for Password Age column */
        }
        td:nth-child(8),
        th:nth-child(8),
        td:nth-child(10),
        th:nth-child(10) {
            text-align: center;
        }
        tr:nth-child(even) { 
            background-color: #f8f9fa;
        }
        tr:hover {
            background-color: #f2f2f2;
        }
        .disabled { 
            color: #4c3ce7;
            background-color: #ffeded;
        }
        .risk-high { 
            background-color: #ffeded; 
            color: #e74c3c; 
        }
        .risk-medium { 
            background-color: #fff5e6; 
            color: #7E22E6; 
        }
        .risk-low { 
            background-color: #f9fde6; 
            color: #27ae60; 
        }
        .risk-none { 
            background-color: #e6ffe6; 
            color: #2ecc71; 
        }
        /* Center align numbers in risk cells */
        .risk-high td:nth-child(9),
        .risk-medium td:nth-child(9),
        .risk-low td:nth-child(9),
        .risk-none td:nth-child(9) {
            text-align: center;
            font-weight: bold;
        }
        .summary-box {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .summary-box p {
            margin: 5px 0;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }
    </style>
"@

    $html = @"
    <html>
    <head>
        <title>Domain Admin and FTech Engineer Account Report - $domainName</title>
        $htmlHeader
    </head>
    <body>
        <h1>Domain Admin and FTech Engineer Account Report</h1>
        <div class="timestamp">Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</div>
        <div class="timestamp">Domain: $domainName</div>
        
        <div class="summary-box">
            <h2>Summary</h2>
            <p><strong>Total Accounts:</strong> $($beforeDisable.Count)</p>
            <p><strong>Accounts Disabled on this run:</strong> $($disabledAccounts.Count)</p>
            <p><strong>High Risk Passwords:</strong> $($afterDisable | Where-Object {$_.PasswordRiskLevel -eq 'High'} | Measure-Object | Select-Object -ExpandProperty Count)</p>
            <p><strong>Domain Password Max Age:</strong> $($afterDisable[0].DomainPasswordMaxAge) days</p>
        </div>
        
        <h2>Account Details</h2>
        <table>
            <tr>
                <th>Username</th>
                <th>Firstname</th>
                <th>Lastname</th>
                <th>Created Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Logon</th>
                <th>Password Last Set</th>
                <th>Password Age (Days)</th>
                <th>Password Status</th>
                <th>Description</th>
            </tr>
"@

    foreach ($account in $afterDisable | Sort-Object Username) {
        $riskClass = "risk-$($account.PasswordRiskLevel.ToLower())"
        $status = if ($account.Enabled) { "Enabled" } else { "Disabled" }
        $lastLogon = if ($account.LastLogon) { $account.LastLogon.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        $passwordLastSet = if ($account.PasswordLastSet) { $account.PasswordLastSet.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        
        $html += @"
            <tr class="$riskClass">
                <td>$($account.Username)</td>
                <td>$($account.FirstName)</td>
                <td>$($account.LastName)</td>
                <td>$($account.WhenCreated)</td>
                <td>$($account.AccountType)</td>
                <td>$status</td>
                <td>$lastLogon</td>
                <td>$passwordLastSet</td>
                <td>$($account.PasswordAgeInDays)</td>
                <td>$($account.PasswordStatus)</td>
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
        [array]$disabledAccounts
    )
    
    $date = Get-Date -Format 'yyyyMMdd'
    $domainName = $accountData[0].DomainName
    $csvFileName = "${domainName}_RMSRiskMitigation_FtechEng_Report_$date.csv"
    $csvPath = Join-Path $filePath $csvFileName
    $historicalPath = Join-Path $filePath "HistoricalAccountReport.csv"
    
    # Update ActionThisRun for disabled accounts
    $accountData | ForEach-Object {
        if ($disabledAccounts.Username -contains $_.Username) {
            $_.ActionThisRun = "Disabled"
        }
    }

    # Format data for export
    $exportData = $accountData | Select-Object @(
        'DomainName',
        'TimeStamp',
        'ActionThisRun'
        'Username',
        'FirstName',
        'LastName',
        'WhenCreated',
        'AccountType',
        @{Name='Status';Expression={if ($_.Enabled) {'Enabled'} else {'Disabled'}}},
        @{Name='LastLogon';Expression={$_.LastLogon.ToString("yyyy-MM-dd HH:mm:ss")}},
        @{Name='PasswordLastSet';Expression={$_.PasswordLastSet.ToString("yyyy-MM-dd HH:mm:ss")}},
        'PasswordAgeInDays',
        'PasswordStatus',
        'PasswordRiskLevel',
        'Description',
        'IsDomainAdmin',
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
        if ($attachment) {
            $attachment.Dispose()
        }
        if ($csvAttachment) {
            $csvAttachment.Dispose()
        }
        if ($mailMessage) {
            $mailMessage.Dispose()
        }
        if ($smtpClient) {
            $smtpClient.Dispose()
        }
        # Remove temporary HTML file
        if (Test-Path $tempHtmlPath) {
            Remove-Item $tempHtmlPath -Force
        }
    }
}

# Main script execution
try {
    # Initial logging with system information
    Write-Log -Message "Script started - Initializing with system details"
    Write-Log -Message "Running as: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
    Write-Log -Message "Computer Name: $env:COMPUTERNAME"
    
    # Get computer system information
    $computerSystem = Get-WmiObject Win32_ComputerSystem
    Write-Log -Message "Domain: $($computerSystem.Domain)"
    Write-Log -Message "Part of Domain: $($computerSystem.PartOfDomain)"
    
    # Update domain name variable to use computer system information
    $domainName = $computerSystem.Domain
    $tempPath = "C:\Windows\Temp"  # Changed to ensure Local System access
    $logFile = Join-Path $tempPath "EnhancedDomainAdminReport.txt"
    
    # Updated email settings for Office 365
    $emailTo = "rmsreports@ftechkzn.co.za"
    $emailFrom = "RMSNotifications@ftechkzn.co.za"

    # Get account details before disabling
    $beforeDisable = Get-EnhancedAccountDetails -domainName $domainName
    
    # Disable inactive FTech accounts
    $disabledAccounts = Disable-InactiveFTechAccounts -domainName $domainName -accountDetails $beforeDisable
    
    # Get account details after disabling
    $afterDisable = Get-EnhancedAccountDetails -domainName $domainName

    # Generate reports
    $htmlReport = New-EnhancedReport -domainName $domainName -beforeDisable $beforeDisable -afterDisable $afterDisable -disabledAccounts $disabledAccounts
    $reportPaths = Export-PowerBIReport -accountData $afterDisable -filePath $tempPath -disabledAccounts $disabledAccounts

    # Update email subject to match new format
    $emailSubject = "$domainName RMSRiskMitigation FtechEng Report - $(Get-Date -Format 'yyyy-MM-dd')"

    # Update email body to include Power BI data locations
    $emailBody = @"
<html>
<body>
<p>Please find attached the Domain Admin and FTech Engineer Account Report for $domainName.</p>
<p>Report generated on: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p>Files included:</p>
<ul>
    <li>HTML Report - Detailed account status and information</li>
    <li>CSV Report - For Power BI integration and historical tracking</li>
</ul>
</body>
</html>
"@

    # Send email report with both HTML and CSV attachments using updated Office 365 settings
    Send-DomainAdminReport `
        -emailTo $emailTo `
        -emailFrom $emailFrom `
        -emailSubject $emailSubject `
        -emailBody $emailBody `
        -htmlReport $htmlReport `
        -csvPath $reportPaths.CurrentReport

    Write-Log -Message "Script completed successfully" -Level Information
}
catch {
    Write-Log -Message "An error occurred during script execution: $_" -Level Error
    Write-Log -Message "Stack Trace: $($_.ScriptStackTrace)" -Level Error
    throw
}