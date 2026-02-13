$csvPath = "E:\RMS_Dashboards\DomainAdmin_Mitigation\data"
$sqlConn = "Server=localhost\SQLEXPRESS01;Database=DomainAdminRiskDashboard;Trusted_Connection=True;"

Get-ChildItem $csvPath -Filter *.csv | ForEach-Object {
    $csv = Import-Csv $_.FullName
    foreach($row in $csv) {
        $query = "INSERT INTO Accounts..."
        Invoke-Sqlcmd -Query $query -ConnectionString $sqlConn
    }
}
