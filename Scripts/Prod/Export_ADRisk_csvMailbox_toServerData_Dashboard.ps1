# Script Name: Extract-RMSRiskReportsV4.1.ps1
# Purpose: Extract latest CSV files from Outlook emails and move older reports to historical folder
# Author: Modified by [Your Name] from original by Nishen Harichudner
# Date: 2025-03-03  This script exports the latest email reports from my mailbox into the Data folder,
# and will export the older .csv reports into the historical folder.

param(
    [string]$OutlookFolderName = "RMSRiskMitigation",
    [string]$OutputPath = "\\rms-web01.rmslab.local\RiskDashBoard Data",
    [string]$HistoricalPath = "\\rms-web01.rmslab.local\Historical AD Reports",
    [string]$LogFileName = "RMSExtraction_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
)

function Write-Log {
    param($Message)
    $LogMessage = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $Message"
    Add-Content -Path "$OutputPath\$LogFileName" -Value $LogMessage
    Write-Host $LogMessage
}

function Initialize-Outlook {
    try {
        Write-Log "Initializing new Outlook instance..."
        $outlook = New-Object -ComObject Outlook.Application
        return $outlook
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Log "ERROR: Failed to initialize Outlook: $errorMsg"
        if ($errorMsg -like "*80080005*") {
            Write-Log "DCOM permission issue detected. Please check administrative privileges and DCOM permissions."
        }
        elseif ($errorMsg -like "*800401E3*") {
            Write-Log "COM activation issue detected. Please verify Outlook installation and try restarting."
        }
        return $null
    }
}

function Extract-CustomerName {
    param($Subject)
    if ($Subject -match '^(.*?)\s*RMSRiskMitigation') {
        return $Matches[1].Trim()
    }
    return "Unknown"
}

function Get-LatestEmailsPerCustomer {
    param($FolderItems)
    
    $customerEmails = @{}
    
    $FolderItems | ForEach-Object {
        $email = $_
        $customerName = Extract-CustomerName -Subject $email.Subject
        $receivedTime = $email.ReceivedTime
        
        if (-not $customerEmails.ContainsKey($customerName) -or 
            $receivedTime -gt $customerEmails[$customerName].ReceivedTime) {
            $customerEmails[$customerName] = @{
                Email = $email
                ReceivedTime = $receivedTime
            }
        }
    }
    
    return $customerEmails
}

function Move-OlderReportsToHistorical {
    param(
        [Parameter(Mandatory=$true)]
        [string]$DataFolderPath,
        
        [Parameter(Mandatory=$true)]
        [string]$HistoricalFolderPath,
        
        [Parameter(Mandatory=$true)]
        [string[]]$NewFileNames
    )
    
    # Get current date for historical folder structure
    $currentDate = Get-Date
    $year = $currentDate.ToString("yyyy")
    $month = $currentDate.ToString("MM")
    $day = $currentDate.ToString("dd")
    
    # Create historical folder path for today if it doesn't exist
    $historicalDailyPath = Join-Path -Path $HistoricalFolderPath -ChildPath $year
    $historicalDailyPath = Join-Path -Path $historicalDailyPath -ChildPath $month
    $historicalDailyPath = Join-Path -Path $historicalDailyPath -ChildPath $day
    
    if (-not (Test-Path -Path $historicalDailyPath)) {
        try {
            New-Item -Path $historicalDailyPath -ItemType Directory -Force | Out-Null
            Write-Log "Created historical folder: $historicalDailyPath"
        }
        catch {
            Write-Log "ERROR: Failed to create historical folder: $($_.Exception.Message)"
            return
        }
    }
    
    # Get all CSV files in the data folder
    $allCsvFiles = Get-ChildItem -Path $DataFolderPath -Filter "*.csv"
    
    # Identify files that are not in the new files list
    $oldFiles = $allCsvFiles | Where-Object { $NewFileNames -notcontains $_.Name }
    
    # Move older files to historical folder
    $movedCount = 0
    foreach ($file in $oldFiles) {
        try {
            $destinationPath = Join-Path -Path $historicalDailyPath -ChildPath $file.Name
            Move-Item -Path $file.FullName -Destination $destinationPath -Force
            $movedCount++
            Write-Log "Moved older report to historical folder: $($file.Name)"
        }
        catch {
            Write-Log "ERROR: Failed to move file $($file.Name): $($_.Exception.Message)"
        }
    }
    
    return $movedCount
}

# Verify Outlook Process
$outlookProcess = Get-Process -Name "OUTLOOK" -ErrorAction SilentlyContinue
if (-not $outlookProcess) {
    Write-Log "WARNING: Outlook is not running. Starting Outlook..."
    Start-Process "outlook.exe"
    Start-Sleep -Seconds 10
}

try {
    # Create output directory if it doesn't exist
    if (-not (Test-Path $OutputPath)) {
        New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        Write-Log "Created output directory: $OutputPath"
    }

    # Initialize Outlook with retry logic
    $Outlook = $null
    $retryCount = 0
    $maxRetries = 3

    while ($null -eq $Outlook -and $retryCount -lt $maxRetries) {
        $Outlook = Initialize-Outlook
        if ($null -eq $Outlook) {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Log "Retry attempt $retryCount of $maxRetries..."
                Start-Sleep -Seconds 5
            }
        }
    }

    if ($null -eq $Outlook) {
        throw "Failed to initialize Outlook after $maxRetries attempts."
    }

    Write-Log "Successfully connected to Outlook"
    $Namespace = $Outlook.GetNamespace("MAPI")
    $Inbox = $Namespace.GetDefaultFolder(6)
    Write-Log "Successfully accessed Inbox"
    
    # Find target folder
    $TargetFolder = $Inbox.Folders | Where-Object { $_.Name -eq $OutlookFolderName }
    if ($null -eq $TargetFolder) {
        Write-Log "Available folders:"
        $Inbox.Folders | ForEach-Object { Write-Log "- $($_.Name)" }
        throw "Target folder '$OutlookFolderName' not found"
    }

    # Get latest emails per customer
    Write-Log "Finding latest emails per customer..."
    $latestCustomerEmails = Get-LatestEmailsPerCustomer -FolderItems $TargetFolder.Items
    
    # Initialize counters
    $ProcessedCount = 0
    $CustomerReport = @{}
    $NewFileList = @()

    Write-Log "Processing latest emails from folder: $OutlookFolderName"
    
    # Process each latest email per customer
    foreach ($customerName in $latestCustomerEmails.Keys) {
        $emailData = $latestCustomerEmails[$customerName]
        $email = $emailData.Email
        
        try {
            if (-not $CustomerReport.ContainsKey($customerName)) {
                $CustomerReport[$customerName] = @{
                    FilesExtracted = 0
                    ReceivedDate = $emailData.ReceivedTime
                }
            }

            if ($email.Attachments.Count -gt 0) {
                $email.Attachments | ForEach-Object {
                    $attachment = $_
                    if ($attachment.FileName -like "*.csv") {
                        $savePath = Join-Path $OutputPath $attachment.FileName
                        try {
                            $attachment.SaveAsFile($savePath)
                            $ProcessedCount++
                            $CustomerReport[$customerName].FilesExtracted++
                            $NewFileList += $attachment.FileName
                            Write-Log "Extracted CSV: $($attachment.FileName) from [$customerName] (Received: $($emailData.ReceivedTime))"
                        }
                        catch {
                            Write-Log "ERROR: Failed to save attachment $($attachment.FileName): $($_.Exception.Message)"
                        }
                    }
                }
            }
        }
        catch {
            Write-Log "ERROR processing email for customer [$customerName] $($_.Exception.Message)"
        }
    }

    # Move older reports to historical folder
    Write-Log "`n=== Moving Older Reports to Historical Folder ==="
    $movedCount = Move-OlderReportsToHistorical -DataFolderPath $OutputPath -HistoricalFolderPath $HistoricalPath -NewFileNames $NewFileList
    Write-Log "Total older CSV files moved to historical folder: $movedCount"

    # Generate detailed summary report
    Write-Log "`n=== Extraction Summary ==="
    Write-Log "Total CSV files extracted: $ProcessedCount"
    Write-Log "Total older CSV files archived: $movedCount"
    Write-Log "`nCustomer Report Summary:"
    
    foreach ($Customer in ($CustomerReport.Keys | Sort-Object)) {
        Write-Log "[${Customer}]"
        Write-Log "  - Files Extracted: $($CustomerReport[$Customer].FilesExtracted)"
        Write-Log "  - Report Date: $($CustomerReport[$Customer].ReceivedDate)"
    }

} catch {
    Write-Log "CRITICAL ERROR: $($_.Exception.Message)"
    Write-Log "Stack Trace: $($_.Exception.StackTrace)"
} finally {
    if ($null -ne $Outlook) {
        try {
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Outlook) | Out-Null
            [System.GC]::Collect()
            [System.GC]::WaitForPendingFinalizers()
        }
        catch {
            Write-Log "WARNING: Failed to properly release Outlook COM object: $($_.Exception.Message)"
        }
    }
    Write-Log "`nScript execution completed"
}