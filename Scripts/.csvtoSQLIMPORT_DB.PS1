# CSV-to-SQL Import Script
$csvPath = "E:\RMS_Dashboards\DomainAdminDashboard\Data"
$processedPath = "E:\RMS_Dashboards\DomainAdminDashboard\IMPORT\Processed"
$logPath = "E:\RMS_Dashboards\DomainAdminDashboard\Logs"

$sqlConnection = "Server=localhost\SQLEXPRESS;Database=DomainAdminDashboard;Trusted_Connection=True;"

# Process new CSV files
Get-ChildItem -Path $csvPath -Filter "*.csv" | ForEach-Object {
    $importDate = Get-Date
    $logFile = Join-Path $logPath "import_$($importDate.ToString('yyyyMMdd')).log"
    
    # Import CSV data
    $csvData = Import-Csv $_.FullName
    
    # Process each record
    foreach ($record in $csvData) {
        # Insert into SQL tables with proper error handling
        try {
            # SQL insertion logic here
        }
        catch {
            Add-Content $logFile "Error processing record: $($record.Username)"
        }
    }
    
    # Move processed file
    Move-Item $_.FullName -Destination $processedPath
}