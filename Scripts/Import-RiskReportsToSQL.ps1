# Import-RiskReportsToSQL.ps1
# Script to import client risk mitigation CSV reports to SQL Express database
# Current Working script Version *Nishenh RMS 2025*

param(
    [string]$ImportFolder = "P:\PRODUCTION\DomainAdminRiskDashBoard\Historical Reports",
    [string]$ProcessedFolder = "P:\PRODUCTION\DomainAdminRiskDashBoard\Processed",
    [string]$SQLInstance = "localhost\SQLEXPRESS",
    [string]$Database = "FTecEngAccRiskManagement",
    [string]$LogFile = "P:\PRODUCTION\DomainAdminRiskDashBoard\Logs\import_log.txt"
)

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$timestamp - $Message"
}

function Create-Database {
    try {
        Write-Log "Checking if database exists..."
        $query = "IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = N'$Database')
                CREATE DATABASE [$Database]"
        Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $query
        Write-Log "Database check/creation complete."
    }
    catch {
        Write-Log "Error creating database: $_"
        exit
    }
}

function Create-Tables {
    try {
        Write-Log "Creating tables if they don't exist..."
        
        # Use the SQL script content to create the tables
        $scriptPath = Join-Path $PSScriptRoot "CreateTables.sql"
        if (Test-Path $scriptPath) {
            $query = Get-Content -Path $scriptPath -Raw
            Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $query
            Write-Log "Tables created successfully using script file."
        }
        else {
            # Inline table creation if script doesn't exist
            $query = @"
USE [$Database]

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientDomains]') AND type in (N'U'))
CREATE TABLE [dbo].[ClientDomains](
    [DomainID] [int] IDENTITY(1,1) PRIMARY KEY,
    [DomainName] [nvarchar](255) NOT NULL,
    [CreatedDate] [datetime] DEFAULT GETDATE(),
    [LastUpdated] [datetime] DEFAULT GETDATE(),
    CONSTRAINT [UQ_DomainName] UNIQUE ([DomainName])
)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAccounts]') AND type in (N'U'))
CREATE TABLE [dbo].[UserAccounts](
    [UserID] [int] IDENTITY(1,1) PRIMARY KEY,
    [DomainID] [int] NOT NULL,
    [Username] [nvarchar](255) NOT NULL,
    [FirstName] [nvarchar](255) NULL,
    [LastName] [nvarchar](255) NULL,
    [WhenCreated] [datetime] NULL,
    [AccountType] [nvarchar](50) NULL,
    [CreatedDate] [datetime] DEFAULT GETDATE(),
    [LastUpdated] [datetime] DEFAULT GETDATE(),
    CONSTRAINT [FK_UserAccounts_ClientDomains] FOREIGN KEY([DomainID]) REFERENCES [dbo].[ClientDomains] ([DomainID]),
    CONSTRAINT [UQ_Domain_Username] UNIQUE ([DomainID], [Username])
)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserAccountSnapshots]') AND type in (N'U'))
CREATE TABLE [dbo].[UserAccountSnapshots](
    [SnapshotID] [int] IDENTITY(1,1) PRIMARY KEY,
    [UserID] [int] NOT NULL,
    [TimeStamp] [datetime] NULL,
    [ActionThisRun] [nvarchar](50) NULL,
    [Status] [nvarchar](50) NULL,
    [LastLogon] [datetime] NULL,
    [PasswordLastSet] [datetime] NULL,
    [PasswordAgeInDays] [int] NULL,
    [Description] [nvarchar](500) NULL,
    [DomainPasswordMaxAge] [int] NULL,
    [ReportDate] [datetime] NULL,
    [ImportDate] [datetime] DEFAULT GETDATE(),
    CONSTRAINT [FK_UserAccountSnapshots_UserAccounts] FOREIGN KEY([UserID]) REFERENCES [dbo].[UserAccounts] ([UserID])
)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ImportHistory]') AND type in (N'U'))
CREATE TABLE [dbo].[ImportHistory](
    [ImportID] [int] IDENTITY(1,1) PRIMARY KEY,
    [FileName] [nvarchar](255) NOT NULL,
    [DomainName] [nvarchar](255) NOT NULL,
    [RecordsImported] [int] NOT NULL,
    [ImportDate] [datetime] DEFAULT GETDATE()
)
"@
            Invoke-Sqlcmd -ServerInstance $SQLInstance -Database $Database -Query $query
            Write-Log "Table creation/verification complete."
        }
    }
    catch {
        Write-Log "Error creating tables: $_"
        exit
    }
}

function Import-CSVtoSQL {
    # Ensure required folders exist
    if (-not (Test-Path -Path $ProcessedFolder)) {
        New-Item -ItemType Directory -Path $ProcessedFolder -Force
    }
    
    if (-not (Test-Path -Path (Split-Path $LogFile -Parent))) {
        New-Item -ItemType Directory -Path (Split-Path $LogFile -Parent) -Force
    }
    
    # Get all date folders in the import directory
    $dateFolders = Get-ChildItem -Path $ImportFolder -Directory
    
    # Collection for all CSV files
    $csvFiles = @()
    
    # Iterate through each date folder to find CSV files
    foreach ($folder in $dateFolders) {
        $folderCsvFiles = Get-ChildItem -Path $folder.FullName -Filter "*_RMSRiskMitigation_*.csv" -File
        $csvFiles += $folderCsvFiles
    }
    
    Write-Log "Found $($dateFolders.Count) date folders to process"
    
    if ($csvFiles.Count -eq 0) {
        Write-Log "No CSV files found in date folders"
        return
    }
    
    Write-Log "Found $($csvFiles.Count) CSV files to process"
    
    foreach ($file in $csvFiles) {
        try {
            Write-Log "Processing file: $($file.Name)"
            
            # Import CSV data
            $csvData = Import-Csv -Path $file.FullName
            
            if ($csvData.Count -eq 0) {
                Write-Log "No data found in $($file.Name), skipping"
                continue
            }
            
            # Extract domain name from first row
            $domainName = $csvData[0].DomainName
            
            # Get or insert domain
            $domainQuery = @"
USE [$Database]
IF NOT EXISTS (SELECT * FROM ClientDomains WHERE DomainName = '$domainName')
    INSERT INTO ClientDomains (DomainName) VALUES ('$domainName');
SELECT DomainID FROM ClientDomains WHERE DomainName = '$domainName'
"@
            $domainID = (Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $domainQuery).DomainID
            
            $recordsImported = 0
            
            foreach ($row in $csvData) {
                # Clean up values and handle nulls
                $username = $row.Username -replace "'", "''"
                $firstName = if ([string]::IsNullOrEmpty($row.FirstName)) { "NULL" } else { "'" + ($row.FirstName -replace "'", "''") + "'" }
                $lastName = if ([string]::IsNullOrEmpty($row.LastName)) { "NULL" } else { "'" + ($row.LastName -replace "'", "''") + "'" }
                $accountType = if ([string]::IsNullOrEmpty($row.AccountType)) { "NULL" } else { "'" + ($row.AccountType -replace "'", "''") + "'" }
                $whenCreated = if ([string]::IsNullOrEmpty($row.WhenCreated)) { "NULL" } else { "'" + (Get-Date $row.WhenCreated -Format "yyyy-MM-dd HH:mm:ss") + "'" }
                
                # Insert or update user
                $userQuery = @"
USE [$Database]
DECLARE @UserID int

IF NOT EXISTS (SELECT * FROM UserAccounts WHERE DomainID = $domainID AND Username = '$username')
    INSERT INTO UserAccounts (DomainID, Username, FirstName, LastName, AccountType, WhenCreated)
    VALUES ($domainID, '$username', $firstName, $lastName, $accountType, $whenCreated)
ELSE
    UPDATE UserAccounts 
    SET FirstName = $firstName, 
        LastName = $lastName, 
        AccountType = $accountType, 
        WhenCreated = $whenCreated,
        LastUpdated = GETDATE()
    WHERE DomainID = $domainID AND Username = '$username'

SELECT @UserID = UserID FROM UserAccounts WHERE DomainID = $domainID AND Username = '$username'

SELECT @UserID as UserID
"@
                $userID = (Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $userQuery).UserID
                
                # Handle snapshot data
                $timeStamp = if ([string]::IsNullOrEmpty($row.TimeStamp)) { "NULL" } else { "'" + (Get-Date $row.TimeStamp -Format "yyyy-MM-dd HH:mm:ss") + "'" }
                $actionThisRun = if ([string]::IsNullOrEmpty($row.ActionThisRun)) { "NULL" } else { "'" + ($row.ActionThisRun -replace "'", "''") + "'" }
                $status = if ([string]::IsNullOrEmpty($row.Status)) { "NULL" } else { "'" + ($row.Status -replace "'", "''") + "'" }
                $lastLogon = if ([string]::IsNullOrEmpty($row.LastLogon)) { "NULL" } else { "'" + (Get-Date $row.LastLogon -Format "yyyy-MM-dd HH:mm:ss") + "'" }
                $passwordLastSet = if ([string]::IsNullOrEmpty($row.PasswordLastSet)) { "NULL" } else { "'" + (Get-Date $row.PasswordLastSet -Format "yyyy-MM-dd HH:mm:ss") + "'" }
                $passwordAgeInDays = if ([string]::IsNullOrEmpty($row.PasswordAgeInDays)) { "NULL" } else { $row.PasswordAgeInDays }
                $description = if ([string]::IsNullOrEmpty($row.Description)) { "NULL" } else { "'" + ($row.Description -replace "'", "''") + "'" }
                $domainPasswordMaxAge = if ([string]::IsNullOrEmpty($row.DomainPasswordMaxAge)) { "NULL" } else { $row.DomainPasswordMaxAge }
                $reportDate = if ([string]::IsNullOrEmpty($row.ReportDate)) { "NULL" } else { "'" + (Get-Date $row.ReportDate -Format "yyyy-MM-dd HH:mm:ss") + "'" }
                
                # Insert snapshot
                $snapshotQuery = @"
USE [$Database]
INSERT INTO UserAccountSnapshots (
    UserID, 
    TimeStamp, 
    ActionThisRun, 
    Status, 
    LastLogon, 
    PasswordLastSet, 
    PasswordAgeInDays, 
    Description, 
    DomainPasswordMaxAge, 
    ReportDate
)
VALUES (
    $userID, 
    $timeStamp, 
    $actionThisRun, 
    $status, 
    $lastLogon, 
    $passwordLastSet, 
    $passwordAgeInDays, 
    $description, 
    $domainPasswordMaxAge, 
    $reportDate
)
"@
                Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $snapshotQuery
                $recordsImported++
            }
            
            # Record import in history
            $historyQuery = @"
USE [$Database]
INSERT INTO ImportHistory (FileName, DomainName, RecordsImported)
VALUES ('$($file.Name)', '$domainName', $recordsImported)
"@
            Invoke-Sqlcmd -ServerInstance $SQLInstance -Query $historyQuery
            
            # Move file to processed folder with subfolder structure
            $processedSubFolder = Join-Path $ProcessedFolder (Split-Path $file.DirectoryName -Leaf)
            if (-not (Test-Path -Path $processedSubFolder)) {
                New-Item -ItemType Directory -Path $processedSubFolder -Force | Out-Null
            }
            
            $destinationPath = Join-Path $processedSubFolder $file.Name
            Move-Item -Path $file.FullName -Destination $destinationPath -Force
            
            Write-Log "Successfully imported $recordsImported records from $($file.Name)"
        }
        catch {
            Write-Log "Error processing file $($file.Name): $_"
        }
    }
}

# Main execution flow
try {
    Write-Log "Starting import process"
    
    # Load SQL Server module
    if (-not (Get-Module -Name SQLPS -ListAvailable) -and -not (Get-Module -Name SqlServer -ListAvailable)) {
        Write-Log "SqlServer module not found. Attempting to install..."
        Install-Module -Name SqlServer -Force -AllowClobber
    }
    
    if (Get-Module -Name SQLPS -ListAvailable) {
        Import-Module SQLPS -DisableNameChecking
    }
    else {
        Import-Module SqlServer
    }
    
    # Create database and tables if they don't exist
    Create-Database
    Create-Tables
    
    # Import CSV data
    Import-CSVtoSQL
    
    Write-Log "Import process completed successfully"
}
catch {
    Write-Log "Critical error in import process: $_"
}