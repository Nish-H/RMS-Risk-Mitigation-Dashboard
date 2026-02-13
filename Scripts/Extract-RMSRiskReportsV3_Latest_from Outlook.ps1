# Script Name: Extract-RMSRiskReports.ps1
# Purpose: Extract CSV files from Outlook emails TO A FOLDER and generate processing log
# Author: Nishen Harichudner : RMS - Senior Systems Engineer
# Date: 2025-01-15

#Make sure OUTLOOK is closed before running, the folder should be created in the root of inbox, not a subfolder.
# set this 1st on your Pc in Powershell : "Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process"
#
#check if outlook running: "Get-Process outlook | Stop-Process -Force"

param(
    [string]$OutlookFolderName = "RMSRiskMitigation",
    [string]$OutputPath = "\\10.1.55.10\RiskDashBoard Data",
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
            Write-Log "ERROR processing email for customer ${customerName}: $($_.Exception.Message)"
        }
    }

    # Generate detailed summary report
    Write-Log "`n=== Extraction Summary ==="
    Write-Log "Total CSV files extracted: $ProcessedCount"
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