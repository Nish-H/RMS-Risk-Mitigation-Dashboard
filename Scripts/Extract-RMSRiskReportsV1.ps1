# Script Name: Extract-RMSRiskReports.ps1
# Purpose: Extract CSV files from Outlook emails TO A FOLDER and generate processing log
# Author: Nishen Harichudner : RMS - Senior Systems Engineer
# Date: 2025-01-15

# Parameters
param(
    [string]$OutlookFolderName = "13Jan2025",
    [string]$OutputPath = "C:\RiskDashboard\data",
    [string]$LogFileName = "RMSExtraction_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
)

function Write-Log {
    param($Message)
    $LogMessage = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $Message"
    Add-Content -Path "$OutputPath\$LogFileName" -Value $LogMessage
    Write-Host $LogMessage
}

function Test-OutlookRunning {
    return Get-Process -Name "OUTLOOK" -ErrorAction SilentlyContinue
}

function Initialize-Outlook {
    try {
        # Check if Outlook is already running
        if (-not (Test-OutlookRunning)) {
            Write-Log "Outlook is not running. Please start Outlook first."
            return $null
        }

        # Try to get existing Outlook instance
        Write-Log "Attempting to connect to running Outlook instance..."
        $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
        
        if (-not $outlook) {
            Write-Log "Could not connect to running Outlook instance. Creating new instance..."
            $outlook = New-Object -ComObject Outlook.Application
        }

        return $outlook
    }
    catch {
        Write-Log "ERROR: Failed to initialize Outlook: $($_.Exception.Message)"
        Write-Log "Please ensure:"
        Write-Log "1. Outlook is running"
        Write-Log "2. Script is running with administrative privileges"
        Write-Log "3. You have proper permissions to access Outlook"
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

# Ensure running with proper privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Log "WARNING: Script is not running with administrative privileges. This may cause issues."
}

try {
    # Create output directory if it doesn't exist
    if (-not (Test-Path $OutputPath)) {
        New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        Write-Log "Created output directory: $OutputPath"
    }

    # Initialize Outlook with enhanced error handling
    $Outlook = Initialize-Outlook
    if (-not $Outlook) {
        throw "Failed to initialize Outlook. Please check the log for details."
    }

    $Namespace = $Outlook.GetNamespace("MAPI")
    
    # Access specified folder with better error handling
    $Inbox = $Namespace.GetDefaultFolder(6) # 6 represents Inbox
    $TargetFolder = $null
    
    try {
        $TargetFolder = $Inbox.Folders | Where-Object { $_.Name -eq $OutlookFolderName }
    }
    catch {
        Write-Log "ERROR: Failed to access folder: $($_.Exception.Message)"
        throw
    }
    
    if (-not $TargetFolder) {
        throw "Folder '$OutlookFolderName' not found in Outlook!"
    }

    # Initialize counters
    $ProcessedCount = 0
    $CustomerReport = @{}

    Write-Log "Processing emails in folder: $OutlookFolderName"
    
    # Process each email with error handling
    foreach ($Email in $TargetFolder.Items) {
        try {
            $CustomerName = Extract-CustomerName -Subject $Email.Subject
            
            if (-not $CustomerReport.ContainsKey($CustomerName)) {
                $CustomerReport[$CustomerName] = 0
            }

            if ($Email.Attachments.Count -gt 0) {
                foreach ($Attachment in $Email.Attachments) {
                    if ($Attachment.FileName -like "*.csv") {
                        $SavePath = Join-Path $OutputPath $Attachment.FileName
                        try {
                            $Attachment.SaveAsFile($SavePath)
                            $ProcessedCount++
                            $CustomerReport[$CustomerName]++
                            Write-Log "Extracted CSV: $($Attachment.FileName) from [$CustomerName]"
                        }
                        catch {
                            Write-Log "ERROR: Failed to save attachment $($Attachment.FileName): $($_.Exception.Message)"
                        }
                    }
                }
            }
        }
        catch {
            Write-Log "ERROR: Failed to process email: $($_.Exception.Message)"
            continue
        }
    }

    # Generate summary report
    Write-Log "`n=== Extraction Summary ==="
    Write-Log "Total CSV files extracted: $ProcessedCount"
    Write-Log "`nCustomer Report Summary:"
    
    foreach ($Customer in ($CustomerReport.Keys | Sort-Object)) {
        Write-Log "[${Customer}] - $($CustomerReport[$Customer]) files"
    }

} catch {
    Write-Log "CRITICAL ERROR: $($_.Exception.Message)"
    Write-Log "Stack Trace: $($_.Exception.StackTrace)"
} finally {
    # Cleanup with error handling
    if ($Outlook) {
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