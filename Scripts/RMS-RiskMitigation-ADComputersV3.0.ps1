## RMS AD Computer Objects Report Script V1.0
#***Nishen RMS 16/02/26****AdRisk -Preventative measures- Computer Endpoint Cleanup Solution
#Reports on all AD computer objects - excludes servers from auto-disable
#Produces CSV report for dashboard integration

# Import Active Directory module
Import-Module ActiveDirectory

# Configuration
$IncludeAllComputers = $true  # Set to $true to include ALL computers, $false for only endpoints
$DaysInactive = 90  # Days of inactivity before disabling endpoints (servers excluded)
$ExcludeServers = $true  # Servers will NOT be auto-disabled but will be reported

# Add Write-Log function
function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('Information','Warning','Error')]
        [string]$Level = 'Information'
    )
    
    $logPath = "C:\Temp\EnhancedComputerReport.txt"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    $logDir = Split-Path $logPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }
    
    Add-Content -Path $logPath -Value $logMessage
    
    switch ($Level) {
        'Error' { Write-Host $logMessage -ForegroundColor Red }
        'Warning' { Write-Host $logMessage -ForegroundColor Yellow }
        'Information' { Write-Host $logMessage -ForegroundColor Green }
    }
}

# Function to determine if computer is a server
function Get-ComputerType {
    param(
        [string]$Name,
        [string]$OperatingSystem,
        [string]$DistinguishedName
    )
    
    # 1. Check Operating System (Most reliable)
    if ($OperatingSystem -match "Server") {
        return 'Server'
    }
    
    # 2. Check Distinguished Name (OU)
    if ($DistinguishedName -match "OU=.*Servers.*" -or $DistinguishedName -match "OU=.*Domain Controllers.*") {
        return 'Server'
    }
    
    $nameLower = $Name.ToLower()
    
    # 3. Check Name Patterns
    # Server patterns
    $serverPatterns = @(
        'srv', 'server', 'dc', 'dc01', 'dc02', 'dc03', 
        'sql', 'sqlserver', 'sql01', 'sql02',
        'exchange', 'mail', 'mail01', 'mail02',
        'sharepoint', 'sp', 'sp01', 'sp02',
        'web', 'web01', 'web02', 'webserver',
        'app', 'app01', 'app02', 'application',
        'print', 'print01', 'printserver',
        'file', 'file01', 'fileserver',
        'backup', 'backup01', 'bacula',
        'veeam', 'vbr', 'esxi', 'hyperv',
        'vcenter', 'vcsa',
        'terminal', 'rds', 'rdwa', 'rdlic',
        'wvd', 'fslogix',
        'dns', 'dhcp', 'nis',
        'wsus', 'sccm', 'scor', 'mem',
        'azure', 'aws', 'cloud',
        'dev', 'test', 'uat',
        'domain', 'forest', 'root'
    )
    
    foreach ($pattern in $serverPatterns) {
        if ($nameLower -match $pattern) {
            return 'Server'
        }
    }
    
    # Check if it's a laptop or desktop
    $laptopPatterns = @('laptop', 'notebook', 'mobile', 'tablet')
    foreach ($pattern in $laptopPatterns) {
        if ($nameLower -match $pattern) {
            return 'Laptop'
        }
    }
    
    return 'Desktop'
}

# Function to get computer details
function Get-ComputerDetails {
    param(
        [string]$domainName,
        [bool]$includeAll = $false
    )
    
    try {
        Write-Log -Message "Retrieving AD computer objects..." -Level Information
        
        # Get all computers
        if ($includeAll) {
            $computers = Get-ADComputer -Filter * -Properties Name, DNSHostName, SamAccountName, 
                Enabled, LastLogonDate, PasswordLastSet, whenCreated, Description, 
                OperatingSystem, OperatingSystemVersion, ServicePrincipalName, 
                TrustedForDelegation,TrustedToAuthForDelegation,DistinguishedName
        } else {
            # Get only non-server computers (endpoints)
            $computers = Get-ADComputer -Filter * -Properties Name, DNSHostName, SamAccountName, 
                Enabled, LastLogonDate, PasswordLastSet, whenCreated, Description, 
                OperatingSystem, OperatingSystemVersion, ServicePrincipalName,
                TrustedForDelegation,TrustedToAuthForDelegation,DistinguishedName
        }
        
        Write-Log -Message "Found $($computers.Count) computer objects" -Level Information
        
        $results = foreach ($computer in $computers) {
            $computerType = Get-ComputerType -Name $computer.Name -OperatingSystem $computer.OperatingSystem -DistinguishedName $computer.DistinguishedName
            $isServer = ($computerType -eq 'Server')
            
            # Calculate last logon age
            $lastLogonAge = 0
            if ($computer.LastLogonDate) {
                $lastLogonAge = ((Get-Date) - $computer.LastLogonDate).Days
            }
            
            # Determine status
            $status = if ($computer.Enabled) { "Enabled" } else { "Disabled" }
            
            # Determine risk level based on last logon
            $riskLevel = switch ($true) {
                ($lastLogonAge -gt 180) { "Critical" }
                ($lastLogonAge -gt 90) { "High" }
                ($lastLogonAge -gt 60) { "Medium" }
                ($lastLogonAge -gt 30) { "Low" }
                default { "None" }
            }
            
            # Check if computer is stale (no logon in 90+ days)
            $isStale = ($lastLogonAge -ge $DaysInactive)
            
            [PSCustomObject]@{
                DomainName = $domainName
                TimeStamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                ComputerName = $computer.Name
                DNSHostName = $computer.DNSHostName
                SamAccountName = $computer.SamAccountName
                Enabled = $computer.Enabled
                Status = $status
                ComputerType = $computerType
                IsServer = $isServer
                LastLogonDate = $computer.LastLogonDate
                LastLogonAgeDays = $lastLogonAge
                PasswordLastSet = $computer.PasswordLastSet
                WhenCreated = if ($computer.whenCreated) { $computer.whenCreated.ToString("yyyy-MM-dd HH:mm:ss") } else { "N/A" }
                OperatingSystem = $computer.OperatingSystem
                OperatingSystemVersion = $computer.OperatingSystemVersion
                Description = $computer.Description
                TrustedForDelegation = $computer.TrustedForDelegation
                ServicePrincipalNameCount = if ($computer.ServicePrincipalName) { $computer.ServicePrincipalName.Count } else { 0 }
                IsStale = $isStale
                RiskLevel = $riskLevel
                ActionThisRun = "None"
                ReportDate = (Get-Date).ToString("yyyy-MM-dd")
            }
        }
        
        return $results
    }
    catch {
        Write-Log -Message "Error retrieving computer details: $_" -Level Error
        throw
    }
}

# Function to disable inactive endpoints (excluding servers)
function Disable-InactiveEndpoints {
    param(
        [string]$domainName,
        [array]$computerDetails
    )
    
    try {
        # Filter for inactive endpoints only (exclude servers)
        $inactiveEndpoints = $computerDetails | Where-Object {
            $_.Enabled -and
            $_.IsStale -and
            -not $_.IsServer  # Exclude servers
        }
        
        Write-Log -Message "Found $($inactiveEndpoints.Count) inactive endpoints to disable" -Level Information
        
        $disabledComputers = @()
        
        foreach ($computer in $inactiveEndpoints) {
            try {
                $disableDate = Get-Date -Format "yyyy-MM-dd"
                $newDescription = "$($computer.Description) - AutoDisabled on $disableDate"
                
                # Disable the computer account and update description
                Disable-ADAccount -Identity $computer.SamAccountName
                Set-ADComputer -Identity $computer.SamAccountName -Description $newDescription
                
                Write-Log -Message "Disabled endpoint: $($computer.ComputerName) (Type: $($computer.ComputerType), Last Logon: $($computer.LastLogonAgeDays) days ago) - Description updated" -Level Information
                $disabledComputers += $computer
            }
            catch {
                Write-Log -Message "Failed to disable $($computer.ComputerName): $_" -Level Warning
            }
        }
        
        return $disabledComputers
    }
    catch {
        Write-Log -Message "Error disabling inactive endpoints: $_" -Level Error
        throw
    }
}

# Function to export CSV report
function Export-ComputerReport {
    param (
        [array]$computerData,
        [string]$filePath,
        [array]$disabledComputers,
        [string]$reportType
    )
    
    $date = Get-Date -Format 'yyyyMMdd'
    $domainName = $computerData[0].DomainName
    $csvFileName = "${domainName}_RMS_ADComputers_${reportType}_Report_$date.csv"
    $csvPath = Join-Path $filePath $csvFileName
    
    # Update ActionThisRun for disabled computers
    $computerData | ForEach-Object {
        if ($disabledComputers.ComputerName -contains $_.ComputerName) {
            $_.ActionThisRun = "Disabled"
        }
    }
    
    # Export to CSV
    $computerData | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    
    Write-Log -Message "Computer report exported to: $csvPath" -Level Information
    
    return $csvPath
}

# Function to create HTML report
function New-HTMLComputerReport {
    param(
        [string]$domainName,
        [array]$computers,
        [array]$disabledComputers,
        [string]$reportType
    )
    
    $totalCount = $computers.Count
    $endpointCount = ($computers | Where-Object { $_.ComputerType -ne 'Server' }).Count
    $serverCount = ($computers | Where-Object { $_.ComputerType -eq 'Server' }).Count
    $staleCount = ($computers | Where-Object { $_.IsStale -eq $true }).Count
    $disabledCount = $disabledComputers.Count

    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>AD Computer Objects Report - $domainName</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #2c3e50; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th { background-color: #2c3e50; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f2f2f2; }
        .server { background-color: #e8f4fd; }
        .endpoint { background-color: #fff3cd; }
        .disabled { color: #666; background-color: #f0f0f0; }
        .stale { background-color: #ffeded; }
        .risk-critical { color: #dc3545; font-weight: bold; }
        .risk-high { color: #fd7e14; }
        .risk-medium { color: #ffc107; }
        .risk-low { color: #28a745; }
        .summary-box { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>AD Computer Objects Report - $reportType</h1>
    <p>Domain: $domainName | Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
    
    <div class="summary-box">
        <h2>Summary</h2>
        <p><strong>Total Computers:</strong> $totalCount</p>
        <p><strong>Endpoints (Desktops/Laptops):</strong> $endpointCount</p>
        <p><strong>Servers:</strong> $serverCount</p>
        <p><strong>Stale Computers (90+ days):</strong> $staleCount</p>
        <p><strong>Disabled This Run:</strong> $disabledCount</p>
    </div>
    
    <h2>Computer Details</h2>
    <table>
        <tr>
            <th>Computer Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>OS</th>
            <th>Last Logon</th>
            <th>Days Since Logon</th>
            <th>Risk Level</th>
            <th>Description</th>
        </tr>
"@
    
    foreach ($comp in $computers | Sort-Object ComputerName) {
        $rowClass = ""
        if ($comp.ComputerType -eq "Server") { $rowClass = "server" }
        elseif ($comp.ComputerType -eq "Laptop") { $rowClass = "endpoint" }
        if (-not $comp.Enabled) { $rowClass = "disabled" }
        if ($comp.IsStale) { $rowClass += " stale" }
        
        $riskClass = "risk-$($comp.RiskLevel.ToLower())"
        $lastLogon = if ($comp.LastLogonDate) { $comp.LastLogonDate.ToString("yyyy-MM-dd") } else { "Never" }
        $os = if ($comp.OperatingSystem) { $comp.OperatingSystem } else { "Unknown" }
        
        $html += @"
        <tr class="$rowClass">
            <td>$($comp.ComputerName)</td>
            <td>$($comp.ComputerType)</td>
            <td>$($comp.Status)</td>
            <td>$($os)</td>
            <td>$lastLogon</td>
            <td>$($comp.LastLogonAgeDays)</td>
            <td class="$riskClass">$($comp.RiskLevel)</td>
            <td>$($comp.Description)</td>
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

# Main script execution
try {
    Write-Log -Message "=== RMS AD Computer Objects Report Script V1.0 Started ===" -Level Information
    Write-Log -Message "Running as: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)" -Level Information
    
    $computerSystem = Get-WmiObject Win32_ComputerSystem
    $domainName = $computerSystem.Domain
    $tempPath = "C:\Windows\Temp"
    
    Write-Log -Message "Domain: $domainName" -Level Information
    Write-Log -Message "Include All Computers: $IncludeAllComputers" -Level Information
    Write-Log -Message "Exclude Servers from Auto-Disable: $ExcludeServers" -Level Information
    
    # Get computer details
    $computerData = Get-ComputerDetails -domainName $domainName -includeAll $IncludeAllComputers
    
    # Disable inactive endpoints (excluding servers)
    $disabledComputers = Disable-InactiveEndpoints -domainName $domainName -computerDetails $computerData
    
    # Get updated list after disabling
    $computerDataAfter = Get-ComputerDetails -domainName $domainName -includeAll $IncludeAllComputers
    
    # Generate reports
    $reportType = if ($IncludeAllComputers) { "ALL" } else { "ENDPOINTS" }
    $csvPath = Export-ComputerReport -computerData $computerDataAfter -filePath $tempPath -disabledComputers $disabledComputers -reportType $reportType
    $htmlReport = New-HTMLComputerReport -domainName $domainName -computers $computerDataAfter -disabledComputers $disabledComputers -reportType $reportType
    
    # Save HTML report
    $htmlPath = Join-Path $tempPath "${domainName}_ADComputers_Report_$(Get-Date -Format 'yyyyMMdd').html"
    $htmlReport | Out-File -FilePath $htmlPath -Encoding UTF8
    
    Write-Log -Message "Script completed successfully" -Level Information
    Write-Log -Message "CSV Report: $csvPath" -Level Information
    Write-Log -Message "HTML Report: $htmlPath" -Level Information
}
catch {
    Write-Log -Message "Error: $_" -Level Error
    Write-Log -Message "Stack Trace: $($_.ScriptStackTrace)" -Level Error
    throw
}
