# Create PowerShell script for automated imports
$importScript = @'
$csvPath = "E:\RMS_Dashboards\DomainAdmin_Mitigation\data"
$sqlConn = "Server=localhost\SQLEXPRESS01;Database=RiskDashboard;Trusted_Connection=True;"

Get-ChildItem $csvPath -Filter *.csv | ForEach-Object {
    $csv = Import-Csv $_.FullName
    foreach($row in $csv) {
        $query = "INSERT INTO Accounts..."
        Invoke-Sqlcmd -Query $query -ConnectionString $sqlConn
    }
}
'@

Set-Content -Path E:\RMS_Dashboards\DomainAdmin_Mitigation\scripts\import.ps1 -Value $importScript