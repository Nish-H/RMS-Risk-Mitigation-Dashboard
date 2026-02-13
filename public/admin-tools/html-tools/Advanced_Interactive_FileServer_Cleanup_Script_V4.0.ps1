# PowerShell Storage Audit & Cleanup Script
# Run as Administrator for full access to user shares
# Created by: Nishen Harichunder | L4 Senior Engineering 2026
# Improved version: Added progress indicator, empty folder cleanup, and refined log aging.
# Organized junk extensions into categories, added more extensions, 
# included *.crdownload, and prompt per category for delete/retain after scan.
# Further improvement: For logs, exclude event logs (.evtx), show accumulated size of logs over 2 weeks old,
# and note they are safe to delete after verifying with Lead engineer.
# Version 4.0: Added Pre-scan filtering, Progress tracking, and Post-Cleanup Reclaimed Space Summary.


$ErrorActionPreference = "SilentlyContinue"

# 1. Define Junk File Categories
$Categories = [ordered]@{
    "Broken Downloads"           = @("*.crdownload")
    "Media"                      = @("*.mp3", "*.mp4", "*.mov", "*.wav", "*.avi", "*.mkv")
    "Archives and Downloads"     = @("*.torrent", "*.iso", "*.zip", "*.rar", "*.7z")
    "Temporary Files"            = @("*.tmp", "*.temp", "*.~", "*.~*", "*.^*", "*.??$", "*.db$", "thumbs.db")
    "Backup and Redundant Files" = @("*.bak", "*.old", "*.prv", "*.syd", "*.wbk", "*.sik", "*.nu3", "*.cpy")
    "Log and Error Files"        = @("*.log", "*.err", "*.dmp", "*.chk")
    "Index and Help Files"       = @("*.gid", "*.fts", "*.ftg", "*.fnd", "*__ofidx*.*", "*ffastun*")
    "Development Temp Files"     = @("*.ilc", "*.ild", "*.ilf", "*.ils", "*.tds", "*.bsc", "*.ilk", "*.res", "*.pch", "ws_ftp.log", "*.spc")
    "Other Junk Files"           = @("*license.txt", "*install*.txt", "*order*.txt", "*readme*.txt", "*.fic", "*.sdi", "*.nav", "mscreate.dir")
}

# 2. Drive Selection & Initial State
Write-Host "--- FILE SERVER STORAGE AUDIT ---" -ForegroundColor Cyan
$Drives = Get-PSDrive -PSProvider FileSystem
$Drives | Select-Object Name, @{n="Free(GB)";e={"{0:N2}" -f ($_.Free/1GB)}}, @{n="Used(GB)";e={"{0:N2}" -f ($_.Used/1GB)}} | Out-String
$SelectedDrive = Read-Host "Enter the Drive Letter to scan (e.g., D)"
$ScanPath = "$($SelectedDrive):\"

if (-not (Test-Path $ScanPath)) { 
    Write-Host "Invalid Drive. Exiting." -ForegroundColor Red; exit 
}

# Capture Baseline for Summary
$StartFreeSpace = (Get-PSDrive $SelectedDrive).Free / 1GB

# 3. Category Selection Menu
Write-Host "`n--- SELECT CATEGORIES TO SCAN ---" -ForegroundColor Yellow
$keyList = $Categories.Keys | ForEach-Object { $_ }
for ($i = 0; $i -lt $keyList.Count; $i++) {
    Write-Host ("[{0}] {1} ({2})" -f ($i + 1), $keyList[$i], ($Categories[$keyList[$i]] -join ", "))
}
Write-Host "[A] All Categories"

$Selection = Read-Host "`nEnter selection (e.g., 1,5,6 or A for all)"
$SelectedPatterns = @()
$ActiveCategories = @()

if ($Selection -match "A") {
    foreach ($cat in $Categories.Keys) { 
        $SelectedPatterns += $Categories[$cat] 
        $ActiveCategories += $cat
    }
} else {
    $Indices = $Selection.Split(',')
    foreach ($idx in $Indices) {
        $realIdx = [int]$idx - 1
        if ($realIdx -ge 0 -and $realIdx -lt $keyList.Count) {
            $catName = $keyList[$realIdx]
            $SelectedPatterns += $Categories[$catName]
            $ActiveCategories += $catName
        }
    }
}

if ($SelectedPatterns.Count -eq 0) {
    Write-Host "No valid categories selected. Exiting." -ForegroundColor Red; exit
}

# 4. Scanning phase with Progress Indicator
Write-Host "`nInitializing Targeted Scan..." -ForegroundColor Yellow

# Step 1: Indexing
Write-Progress -Activity "Auditing Storage" -Status "Indexing files on $ScanPath..." -PercentComplete 10
$AllFiles = Get-ChildItem -Path $ScanPath -Recurse -File -Force -ErrorAction SilentlyContinue

# Step 2: Categorizing Junk
Write-Progress -Activity "Auditing Storage" -Status "Filtering chosen extensions..." -PercentComplete 50
$TotalSize = ($AllFiles | Measure-Object -Property Length -Sum).Sum / 1GB

$JunkFiles = $AllFiles | Where-Object { 
    $fileName = $_.Name
    $isMatch = $false
    foreach ($p in $SelectedPatterns) { if ($fileName -like $p) { $isMatch = $true; break } }
    $isMatch
}

$TotalJunkSize = ($JunkFiles | Measure-Object -Property Length -Sum).Sum / 1GB

# Grouping logic for the report
$JunkGroups = @{}
$JunkSizes = @{}
$OldLogSize = 0
$OldLogs = @()

foreach ($cat in $ActiveCategories) {
    $catPatterns = $Categories[$cat]
    $catFiles = $JunkFiles | Where-Object {
        $fName = $_.Name
        $match = $false
        foreach ($p in $catPatterns) { if ($fName -like $p) { $match = $true; break } }
        $match
    }

    if ($cat -eq "Log and Error Files") {
        $catFiles = $catFiles | Where-Object { $_.Extension -ne '.evtx' -and $_.FullName -notlike '*winevt\Logs*' }
        $OldLogs = $catFiles | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) }
        $OldLogSize = ($OldLogs | Measure-Object -Property Length -Sum).Sum / 1GB
    }
    $JunkGroups[$cat] = $catFiles
    $JunkSizes[$cat] = ($catFiles | Measure-Object -Property Length -Sum).Sum / 1GB
}
Write-Progress -Activity "Auditing Storage" -Status "Complete" -Completed

# 5. Reporting
Write-Host "`n--- SCAN REPORT ---" -ForegroundColor Cyan
Write-Host "Total Data on Drive: " -NoNewline; Write-Host ("{0:N2} GB" -f $TotalSize) -ForegroundColor White
Write-Host "Potential Junk (Selected): " -NoNewline; Write-Host ("{0:N2} GB" -f $TotalJunkSize) -ForegroundColor Red

Write-Host "`n--- JUNK BREAKDOWN BY CATEGORY ---" -ForegroundColor Yellow
foreach ($cat in $ActiveCategories) {
    $color = if ($cat -eq "Broken Downloads") { "Red" } else { "Magenta" }
    Write-Host "$cat`: " -NoNewline; Write-Host ("{0:N2} GB ({1} files)" -f $JunkSizes[$cat], $JunkGroups[$cat].Count) -ForegroundColor $color
    if ($cat -eq "Log and Error Files" -and $OldLogSize -gt 0) {
        Write-Host "  - Aged Logs (>2 weeks): " -NoNewline; Write-Host ("{0:N2} GB - Safe to delete (Verify with Lead)" -f $OldLogSize) -ForegroundColor Yellow
    }
}

Write-Host "`n--- TOP 10 LARGEST FILES OVERALL ---" -ForegroundColor Yellow
$AllFiles | Sort-Object Length -Descending | Select-Object -First 10 | 
    Select-Object Name, @{n="Size(MB)";e={"{0:N2}" -f ($_.Length/1MB)}}, FullName | Format-Table -AutoSize

# 6. Deletion & Cleanup
if ($JunkFiles.Count -gt 0) {
    Write-Host "`n--- CLEANUP PHASE ---" -ForegroundColor Cyan
    foreach ($cat in $ActiveCategories) {
        if ($JunkGroups[$cat].Count -gt 0) {
            Write-Host "`n[CATEGORY: $cat]" -ForegroundColor Cyan
            $ConfirmDelete = Read-Host "Do you want to DELETE these files? (y/n)"
            if ($ConfirmDelete -eq 'y') {
                Write-Host "Purging $cat files..." -ForegroundColor Magenta
                $JunkGroups[$cat] | Remove-Item -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    $cleanFolders = Read-Host "`nWould you like to remove empty directories? (y/n)"
    if ($cleanFolders -eq 'y') {
        Write-Host "Cleaning empty folders..." -ForegroundColor Gray
        $dirs = Get-ChildItem -Path $ScanPath -Recurse -Directory
        $dirs | Sort-Object FullName -Descending | ForEach-Object {
            if ((Get-ChildItem -Path $_.FullName -Force).Count -eq 0) {
                Remove-Item -Path $_.FullName -Force
            }
        }
    }

    # 7. Final Summary Calculation
    $EndFreeSpace = (Get-PSDrive $SelectedDrive).Free / 1GB
    $SpaceReclaimed = $EndFreeSpace - $StartFreeSpace

    Write-Host "`n--- REMEDIATION SUMMARY ---" -ForegroundColor Green
    Write-Host "Baseline Free Space: " -NoNewline; Write-Host ("{0:N2} GB" -f $StartFreeSpace)
    Write-Host "Current Free Space:  " -NoNewline; Write-Host ("{0:N2} GB" -f $EndFreeSpace)
    Write-Host "Total Space Reclaimed: " -NoNewline; Write-Host ("{0:N2} GB" -f $SpaceReclaimed) -ForegroundColor White -BackgroundColor Green
} else {
    Write-Host "No junk files found for selected categories." -ForegroundColor Green
}

# Export Remaining to CSV
$RemainingJunk = Get-ChildItem -Path $ScanPath -Recurse -File -Force -Include $SelectedPatterns -ErrorAction SilentlyContinue
if ($RemainingJunk.Count -gt 0) {
    Write-Host "`nExporting remaining junk list to scan_results.csv" -ForegroundColor Gray
    $RemainingJunk | Select-Object Name, FullName, @{n="Size(GB)";e={$_.Length/1GB}}, LastWriteTime | Export-Csv -Path ".\scan_results.csv" -NoTypeInformation
}