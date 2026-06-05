function Invoke-AVEDRCoverageAudit {
<#
.SYNOPSIS
    Audits AV/EDR coverage across all Windows servers discovered in Active Directory.
    Integrates with the FTech KZN AD Secure Score platform via HTTP POST JSON payload.

.DESCRIPTION
    - Enumerates all enabled Windows Server computer objects from AD
    - Tests reachability via ICMP + WinRM/RPC
    - Queries installed AV/EDR products via WMI (SecurityCenter2 + Win32_Product fallback)
    - Detects Windows Defender, CrowdStrike, Sentinel One, Sophos, ESET, Bitdefender,
      Trend Micro, Carbon Black, Cylance, Malwarebytes, Webroot, Kaspersky, Symantec,
      McAfee/Trellix, Microsoft Defender for Endpoint (MDE) sensor
    - Checks AV definition age (flags if > 3 days stale)
    - Checks real-time protection state
    - Emits structured JSON for HTTP POST to Express.js API endpoint
    - Exports HTML + CSV reports
    - PS 5.1 compatible, no external module dependencies beyond ActiveDirectory + RSAT

.PARAMETER TargetOU
    Limit scan to a specific OU distinguished name. Default: entire domain.

.PARAMETER MaxConcurrentJobs
    Parallel runspace throttle. Default: 20.

.PARAMETER PostToAPI
    POST results to the ADSecureScore API endpoint.

.PARAMETER APIEndpoint
    URL of the Express.js collector API. Default: http://172.16.0.16:3000/api/scores

.PARAMETER ExportPath
    Folder for HTML and CSV exports. Default: C:\FTechReports\AVAudit

.PARAMETER DefinitionStaleDays
    Days before AV definitions are considered stale. Default: 3

.EXAMPLE
    Invoke-AVEDRCoverageAudit
    Invoke-AVEDRCoverageAudit -TargetOU "OU=Servers,DC=contoso,DC=com"
    Invoke-AVEDRCoverageAudit -PostToAPI -ExportPath "C:\Reports\AV"
#>

    [CmdletBinding()]
    param(
        [string]$TargetOU          = "",
        [int]$MaxConcurrentJobs    = 20,
        [switch]$PostToAPI,
        [string]$APIEndpoint       = "http://172.16.0.16:3000/api/scores",
        [string]$ExportPath        = "C:\FTechReports\AVAudit",
        [int]$DefinitionStaleDays  = 3,
        [int]$PingTimeoutMs        = 1000,
        [int]$WmiTimeoutSec        = 30
    )

    #region ── Helpers ──────────────────────────────────────────────────────────

    function Write-SectionHeader {
        param([string]$Title)
        $line = "=" * 76
        Write-Host "" 
        Write-Host $line                -ForegroundColor DarkCyan
        Write-Host ("  {0}" -f $Title) -ForegroundColor Cyan
        Write-Host $line                -ForegroundColor DarkCyan
    }

    function Write-StatusLine {
        param([string]$Label, [string]$Value, [string]$Status)
        $colour = switch ($Status) {
            "PASS"  { "Green"  }
            "FAIL"  { "Red"    }
            "WARN"  { "Yellow" }
            "INFO"  { "Cyan"   }
            "SKIP"  { "DarkGray" }
            default { "White"  }
        }
        Write-Host ("  {0,-48} [{1,-4}] {2}" -f $Label, $Status, $Value) -ForegroundColor $colour
    }

    # Known AV/EDR product signatures (display name fragments, case-insensitive)
    $KnownAVSignatures = @(
        # Microsoft
        @{ Name = "Windows Defender";                  Vendor = "Microsoft";     Tier = "AV"  }
        @{ Name = "Microsoft Defender";                Vendor = "Microsoft";     Tier = "EDR" }
        @{ Name = "Microsoft Endpoint Protection";     Vendor = "Microsoft";     Tier = "EDR" }
        @{ Name = "Microsoft Security Essentials";     Vendor = "Microsoft";     Tier = "AV"  }
        @{ Name = "SENSE";                             Vendor = "Microsoft MDE"; Tier = "EDR" }  # MDE sensor service
        # CrowdStrike
        @{ Name = "CrowdStrike";                       Vendor = "CrowdStrike";   Tier = "EDR" }
        @{ Name = "Falcon";                            Vendor = "CrowdStrike";   Tier = "EDR" }
        # SentinelOne
        @{ Name = "SentinelOne";                       Vendor = "SentinelOne";   Tier = "EDR" }
        @{ Name = "Sentinel Agent";                    Vendor = "SentinelOne";   Tier = "EDR" }
        # Sophos
        @{ Name = "Sophos";                            Vendor = "Sophos";        Tier = "EDR" }
        # ESET
        @{ Name = "ESET";                              Vendor = "ESET";          Tier = "AV"  }
        @{ Name = "NOD32";                             Vendor = "ESET";          Tier = "AV"  }
        # Bitdefender
        @{ Name = "Bitdefender";                       Vendor = "Bitdefender";   Tier = "EDR" }
        @{ Name = "GravityZone";                       Vendor = "Bitdefender";   Tier = "EDR" }
        # Trend Micro
        @{ Name = "Trend Micro";                       Vendor = "Trend Micro";   Tier = "EDR" }
        @{ Name = "OfficeScan";                        Vendor = "Trend Micro";   Tier = "AV"  }
        @{ Name = "Apex One";                          Vendor = "Trend Micro";   Tier = "EDR" }
        # VMware Carbon Black
        @{ Name = "Carbon Black";                      Vendor = "VMware";        Tier = "EDR" }
        @{ Name = "CbDefense";                         Vendor = "VMware";        Tier = "EDR" }
        # Cylance / BlackBerry
        @{ Name = "Cylance";                           Vendor = "BlackBerry";    Tier = "EDR" }
        # Malwarebytes
        @{ Name = "Malwarebytes";                      Vendor = "Malwarebytes";  Tier = "AV"  }
        # Webroot
        @{ Name = "Webroot";                           Vendor = "Webroot";       Tier = "AV"  }
        # Kaspersky
        @{ Name = "Kaspersky";                         Vendor = "Kaspersky";     Tier = "AV"  }
        # Symantec / Broadcom
        @{ Name = "Symantec";                          Vendor = "Broadcom";      Tier = "EDR" }
        @{ Name = "Norton";                            Vendor = "Broadcom";      Tier = "AV"  }
        @{ Name = "Endpoint Protection";               Vendor = "Broadcom";      Tier = "EDR" }
        # McAfee / Trellix
        @{ Name = "McAfee";                            Vendor = "Trellix";       Tier = "AV"  }
        @{ Name = "Trellix";                           Vendor = "Trellix";       Tier = "EDR" }
        @{ Name = "ENS";                               Vendor = "Trellix";       Tier = "AV"  }
        # Palo Alto Cortex
        @{ Name = "Cortex XDR";                        Vendor = "Palo Alto";     Tier = "EDR" }
        @{ Name = "Traps";                             Vendor = "Palo Alto";     Tier = "EDR" }
        # Cybereason
        @{ Name = "Cybereason";                        Vendor = "Cybereason";    Tier = "EDR" }
        # Deep Instinct
        @{ Name = "Deep Instinct";                     Vendor = "Deep Instinct"; Tier = "EDR" }
        # Huntress
        @{ Name = "Huntress";                          Vendor = "Huntress";      Tier = "EDR" }
    )

    function Resolve-AVProduct {
        param([string]$ProductName)
        foreach ($sig in $KnownAVSignatures) {
            if ($ProductName -match [regex]::Escape($sig.Name)) {
                return $sig
            }
        }
        return $null
    }

    function Get-AVDefinitionAge {
        param([string]$ComputerName)
        try {
            $mpStatus = Invoke-Command -ComputerName $ComputerName -ScriptBlock {
                if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) {
                    $s = Get-MpComputerStatus -ErrorAction Stop
                    [pscustomobject]@{
                        AntivirusEnabled         = $s.AntivirusEnabled
                        RealTimeProtectionEnabled = $s.RealTimeProtectionEnabled
                        AntivirusSignatureAge    = $s.AntivirusSignatureAge
                        AntivirusSignatureLastUpdated = $s.AntivirusSignatureLastUpdated
                        AMServiceEnabled         = $s.AMServiceEnabled
                        AMRunningMode            = $s.AMRunningMode
                    }
                }
            } -ErrorAction Stop -WarningAction SilentlyContinue
            return $mpStatus
        }
        catch { return $null }
    }

    #endregion

    #region ── Initialise ───────────────────────────────────────────────────────

    Write-SectionHeader "AV/EDR Coverage Audit  |  FTech KZN AD Secure Score"
    Write-Host ("  Timestamp    : {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor Gray
    Write-Host ("  Operator     : {0}" -f $env:USERNAME)                            -ForegroundColor Gray
    Write-Host ("  Domain       : {0}" -f $env:USERDNSDOMAIN)                       -ForegroundColor Gray
    Write-Host ("  Export Path  : {0}" -f $ExportPath)                              -ForegroundColor Gray
    Write-Host ("  Stale Def.   : >{0} days" -f $DefinitionStaleDays)               -ForegroundColor Gray

    if (-not (Test-Path $ExportPath)) {
        New-Item -ItemType Directory -Path $ExportPath -Force | Out-Null
    }

    $results    = [System.Collections.Generic.List[object]]::new()
    $startTime  = Get-Date

    #endregion

    #region ── Enumerate Servers from AD ────────────────────────────────────────

    Write-SectionHeader "1  |  Active Directory Server Enumeration"

    $adParams = @{
        Filter     = { OperatingSystem -like "*Windows Server*" -and Enabled -eq $true }
        Properties = "Name","OperatingSystem","OperatingSystemVersion","IPv4Address",
                     "DistinguishedName","LastLogonDate","Description"
    }
    if ($TargetOU -ne "") { $adParams["SearchBase"] = $TargetOU }

    $servers = @()
    try {
        $servers = Get-ADComputer @adParams | Sort-Object Name
        Write-Host ("  Windows Servers found in AD : {0}" -f $servers.Count) -ForegroundColor White
    }
    catch {
        Write-Warning "AD enumeration failed: $_"
        return
    }

    #endregion

    #region ── Runspace Pool for Parallel Scanning ──────────────────────────────

    Write-SectionHeader "2  |  Parallel Reachability + AV/EDR Probe"
    Write-Host ("  Throttle : {0} concurrent jobs" -f $MaxConcurrentJobs) -ForegroundColor Gray
    Write-Host ""

    $scriptBlock = {
        param($Server, $KnownAVSignatures, $DefinitionStaleDays, $WmiTimeoutSec, $PingTimeoutMs)

        $result = [pscustomobject]@{
            ComputerName          = $Server.Name
            FQDN                  = ("{0}.{1}" -f $Server.Name, $env:USERDNSDOMAIN)
            IPAddress             = $Server.IPv4Address
            OperatingSystem       = $Server.OperatingSystem
            OSVersion             = $Server.OperatingSystemVersion
            LastLogonDate         = $Server.LastLogonDate
            Reachable             = $false
            WMIAccessible         = $false
            AVDetected            = $false
            AVProducts            = @()
            AVProductNames        = ""
            AVVendors             = ""
            AVTier                = ""           # AV or EDR or Both
            RealTimeProtection    = $null
            DefinitionAge         = $null
            DefinitionStale       = $false
            DefenderEnabled       = $false
            DefenderMode          = ""
            MDE_SensorRunning     = $false
            Coverage              = "None"       # None | AV | EDR | AV+EDR
            Status                = "FAIL"
            FailReason            = ""
            ScanMethod            = ""
        }

        # ── Ping ──────────────────────────────────────────────────────────────
        try {
            $ping = New-Object System.Net.NetworkInformation.Ping
            $reply = $ping.Send($Server.Name, $PingTimeoutMs)
            $result.Reachable = ($reply.Status -eq "Success")
        }
        catch { $result.Reachable = $false }

        if (-not $result.Reachable) {
            $result.FailReason = "Unreachable (ICMP)"
            $result.Coverage   = "Unreachable"
            $result.Status     = "FAIL"
            return $result
        }

        # ── Method 1: WMI SecurityCenter2 (works on some Server OSes) ─────────
        $avFound = [System.Collections.Generic.List[object]]::new()

        try {
            $sc2 = Get-WmiObject -Namespace "root\SecurityCenter2" `
                                 -Class AntiVirusProduct            `
                                 -ComputerName $Server.Name         `
                                 -ErrorAction Stop
            if ($sc2) {
                $result.WMIAccessible = $true
                $result.ScanMethod    = "SecurityCenter2"
                foreach ($av in $sc2) {
                    $match = $null
                    foreach ($sig in $KnownAVSignatures) {
                        if ($av.displayName -match [regex]::Escape($sig.Name)) {
                            $match = $sig
                            break
                        }
                    }
                    $avFound.Add([pscustomobject]@{
                        DisplayName = $av.displayName
                        Vendor      = if ($match) { $match.Vendor } else { "Unknown" }
                        Tier        = if ($match) { $match.Tier   } else { "AV"      }
                        ProductState = $av.productState
                    })
                }
            }
        }
        catch {}

        # ── Method 2: WMI Win32_Service - detect known AV/EDR services ────────
        if ($avFound.Count -eq 0) {
            try {
                $services = Get-WmiObject -Class Win32_Service    `
                                          -ComputerName $Server.Name `
                                          -ErrorAction Stop        |
                            Where-Object { $_.State -eq "Running" }
                $result.WMIAccessible = $true
                $result.ScanMethod    = "Win32_Service"

                $serviceAVMap = @{
                    "CSFalconService"     = @{ Name = "CrowdStrike Falcon";       Vendor = "CrowdStrike";   Tier = "EDR" }
                    "SentinelAgent"       = @{ Name = "SentinelOne Agent";        Vendor = "SentinelOne";   Tier = "EDR" }
                    "SentinelHelperService" = @{ Name = "SentinelOne Helper";     Vendor = "SentinelOne";   Tier = "EDR" }
                    "Sophos Anti-Virus"   = @{ Name = "Sophos Anti-Virus";        Vendor = "Sophos";        Tier = "AV"  }
                    "SAVService"          = @{ Name = "Sophos Anti-Virus";        Vendor = "Sophos";        Tier = "AV"  }
                    "SophosMCS"           = @{ Name = "Sophos MCS";               Vendor = "Sophos";        Tier = "EDR" }
                    "ekrn"                = @{ Name = "ESET Service";             Vendor = "ESET";          Tier = "AV"  }
                    "EHttpSrv"            = @{ Name = "ESET HTTP Server";         Vendor = "ESET";          Tier = "AV"  }
                    "BDAuxSrv"            = @{ Name = "Bitdefender Auxiliary";    Vendor = "Bitdefender";   Tier = "EDR" }
                    "VSSERV"              = @{ Name = "Bitdefender";              Vendor = "Bitdefender";   Tier = "EDR" }
                    "TmListen"            = @{ Name = "Trend Micro OfficeScan";   Vendor = "Trend Micro";   Tier = "AV"  }
                    "ntrtscan"            = @{ Name = "Trend Micro Real-Time";    Vendor = "Trend Micro";   Tier = "AV"  }
                    "CbDefense"           = @{ Name = "Carbon Black Cloud";       Vendor = "VMware";        Tier = "EDR" }
                    "CbDefenseDriver"     = @{ Name = "Carbon Black Driver";      Vendor = "VMware";        Tier = "EDR" }
                    "CylanceSvc"          = @{ Name = "Cylance Service";          Vendor = "BlackBerry";    Tier = "EDR" }
                    "MBAMService"         = @{ Name = "Malwarebytes Service";     Vendor = "Malwarebytes";  Tier = "AV"  }
                    "WRSkyClient"         = @{ Name = "Webroot SecureAnywhere";   Vendor = "Webroot";       Tier = "AV"  }
                    "AVP"                 = @{ Name = "Kaspersky";                Vendor = "Kaspersky";     Tier = "AV"  }
                    "klnagent"            = @{ Name = "Kaspersky Network Agent";  Vendor = "Kaspersky";     Tier = "AV"  }
                    "SepMasterService"    = @{ Name = "Symantec Endpoint";        Vendor = "Broadcom";      Tier = "EDR" }
                    "mfefire"             = @{ Name = "McAfee Firewall";          Vendor = "Trellix";       Tier = "AV"  }
                    "mcshield"            = @{ Name = "McAfee Shield";            Vendor = "Trellix";       Tier = "AV"  }
                    "masvc"               = @{ Name = "McAfee Agent";             Vendor = "Trellix";       Tier = "AV"  }
                    "TrellixAgent"        = @{ Name = "Trellix Agent";            Vendor = "Trellix";       Tier = "EDR" }
                    "cyserver"            = @{ Name = "Cybereason";               Vendor = "Cybereason";    Tier = "EDR" }
                    "cortex_xdr"          = @{ Name = "Cortex XDR";              Vendor = "Palo Alto";     Tier = "EDR" }
                    "HuntressAgent"       = @{ Name = "Huntress Agent";           Vendor = "Huntress";      Tier = "EDR" }
                    "WinDefend"           = @{ Name = "Windows Defender";         Vendor = "Microsoft";     Tier = "AV"  }
                    "Sense"               = @{ Name = "Microsoft Defender MDE";   Vendor = "Microsoft";     Tier = "EDR" }
                    "MdCoreSvc"           = @{ Name = "Microsoft Defender Core";  Vendor = "Microsoft";     Tier = "EDR" }
                }

                foreach ($svc in $services) {
                    if ($serviceAVMap.ContainsKey($svc.Name)) {
                        $entry = $serviceAVMap[$svc.Name]
                        $avFound.Add([pscustomobject]@{
                            DisplayName  = $entry.Name
                            Vendor       = $entry.Vendor
                            Tier         = $entry.Tier
                            ProductState = "Running"
                        })
                    }
                }
            }
            catch {
                if ($result.ScanMethod -eq "") {
                    $result.FailReason = "WMI access denied or RPC unavailable"
                }
            }
        }

        # ── Method 3: Win32_Product fallback (expensive but thorough) ─────────
        if ($avFound.Count -eq 0 -and $result.WMIAccessible) {
            try {
                $result.ScanMethod = "Win32_Product"
                $products = Get-WmiObject -Class Win32_Product     `
                                          -ComputerName $Server.Name `
                                          -ErrorAction Stop        |
                            Select-Object -ExpandProperty Name

                foreach ($productName in $products) {
                    foreach ($sig in $KnownAVSignatures) {
                        if ($productName -match [regex]::Escape($sig.Name)) {
                            $avFound.Add([pscustomobject]@{
                                DisplayName  = $productName
                                Vendor       = $sig.Vendor
                                Tier         = $sig.Tier
                                ProductState = "Installed"
                            })
                            break
                        }
                    }
                }
            }
            catch {}
        }

        # ── MDE Sensor check (Sense service) ──────────────────────────────────
        try {
            $senseCheck = Get-WmiObject -Class Win32_Service  `
                                        -ComputerName $Server.Name `
                                        -Filter "Name='Sense'"     `
                                        -ErrorAction Stop
            if ($senseCheck -and $senseCheck.State -eq "Running") {
                $result.MDE_SensorRunning = $true
                $alreadyMDE = $avFound | Where-Object { $_.DisplayName -match "MDE" }
                if (-not $alreadyMDE) {
                    $avFound.Add([pscustomobject]@{
                        DisplayName  = "Microsoft Defender for Endpoint (MDE)"
                        Vendor       = "Microsoft"
                        Tier         = "EDR"
                        ProductState = "Running"
                    })
                }
            }
        }
        catch {}

        # ── Collate AV results ─────────────────────────────────────────────────
        if ($avFound.Count -gt 0) {
            $result.AVDetected    = $true
            $result.AVProducts    = $avFound | Sort-Object DisplayName -Unique
            $result.AVProductNames = ($avFound.DisplayName | Sort-Object -Unique) -join " | "
            $result.AVVendors     = ($avFound.Vendor | Sort-Object -Unique) -join ", "

            $tiers = $avFound.Tier | Sort-Object -Unique
            $result.AVTier = $tiers -join "+"
            if ($tiers -contains "EDR" -and $tiers -contains "AV") { $result.Coverage = "AV+EDR" }
            elseif ($tiers -contains "EDR")                          { $result.Coverage = "EDR"    }
            elseif ($tiers -contains "AV")                           { $result.Coverage = "AV"     }

            $result.Status = "PASS"
        }
        else {
            $result.Coverage   = "None"
            $result.Status     = "FAIL"
            if ($result.FailReason -eq "") {
                $result.FailReason = "No AV/EDR product detected"
            }
        }

        # ── Windows Defender / MpComputerStatus ───────────────────────────────
        try {
            $mpStatus = Invoke-Command -ComputerName $Server.Name -ScriptBlock {
                if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) {
                    $s = Get-MpComputerStatus -ErrorAction Stop
                    [pscustomobject]@{
                        AntivirusEnabled          = $s.AntivirusEnabled
                        RealTimeProtectionEnabled = $s.RealTimeProtectionEnabled
                        AntivirusSignatureAge     = $s.AntivirusSignatureAge
                        AntivirusSignatureLastUpdated = $s.AntivirusSignatureLastUpdated
                        AMServiceEnabled          = $s.AMServiceEnabled
                        AMRunningMode             = $s.AMRunningMode
                    }
                }
            } -ErrorAction Stop -WarningAction SilentlyContinue

            if ($mpStatus) {
                $result.DefenderEnabled   = $mpStatus.AntivirusEnabled
                $result.DefenderMode      = $mpStatus.AMRunningMode
                $result.RealTimeProtection = $mpStatus.RealTimeProtectionEnabled
                $result.DefinitionAge     = $mpStatus.AntivirusSignatureAge
                $result.DefinitionStale   = ($mpStatus.AntivirusSignatureAge -gt $DefinitionStaleDays)
            }
        }
        catch {}

        return $result
    }

    # ── Execute via Runspace Pool ────────────────────────────────────────────
    $pool = [RunspaceFactory]::CreateRunspacePool(1, $MaxConcurrentJobs)
    $pool.ApartmentState = "MTA"
    $pool.Open()

    $jobs = [System.Collections.Generic.List[object]]::new()

    foreach ($server in $servers) {
        $ps = [PowerShell]::Create()
        $ps.RunspacePool = $pool
        [void]$ps.AddScript($scriptBlock)
        [void]$ps.AddParameter("Server",            $server)
        [void]$ps.AddParameter("KnownAVSignatures", $KnownAVSignatures)
        [void]$ps.AddParameter("DefinitionStaleDays", $DefinitionStaleDays)
        [void]$ps.AddParameter("WmiTimeoutSec",     $WmiTimeoutSec)
        [void]$ps.AddParameter("PingTimeoutMs",     $PingTimeoutMs)
        $jobs.Add([pscustomobject]@{ PS = $ps; Handle = $ps.BeginInvoke() })
    }

    # Progress tracking
    $total     = $jobs.Count
    $completed = 0
    while ($jobs | Where-Object { -not $_.Handle.IsCompleted }) {
        $completed = ($jobs | Where-Object { $_.Handle.IsCompleted }).Count
        $pct = if ($total -gt 0) { [int](($completed / $total) * 100) } else { 0 }
        Write-Progress -Activity "Scanning Servers" `
                       -Status ("Completed {0}/{1}" -f $completed, $total) `
                       -PercentComplete $pct
        Start-Sleep -Milliseconds 500
    }
    Write-Progress -Activity "Scanning Servers" -Completed

    foreach ($job in $jobs) {
        $result = $job.PS.EndInvoke($job.Handle)
        if ($result) { $results.Add($result) }
        $job.PS.Dispose()
    }
    $pool.Close()
    $pool.Dispose()

    #endregion

    #region ── Score Calculation ────────────────────────────────────────────────

    Write-SectionHeader "3  |  Results Summary"

    $totalServers    = $results.Count
    $reachable       = ($results | Where-Object { $_.Reachable }).Count
    $unreachable     = ($results | Where-Object { -not $_.Reachable }).Count
    $avCovered       = ($results | Where-Object { $_.AVDetected }).Count
    $noAV            = ($results | Where-Object { $_.Reachable -and -not $_.AVDetected }).Count
    $edrCovered      = ($results | Where-Object { $_.Coverage -match "EDR" }).Count
    $staleDefsCount  = ($results | Where-Object { $_.DefinitionStale }).Count
    $rtpDisabled     = ($results | Where-Object { $_.RealTimeProtection -eq $false -and $_.Reachable }).Count
    $passPct         = if ($reachable -gt 0) { [math]::Round(($avCovered / $reachable) * 100, 1) } else { 0 }
    $rawScore        = [math]::Round($passPct * 0.30, 1)   # weight = 30

    $severity = switch ($passPct) {
        { $_ -eq 100 }  { "None"   }
        { $_ -ge 85  }  { "Low"    }
        { $_ -ge 60  }  { "Medium" }
        { $_ -ge 30  }  { "High"   }
        default          { "Critical" }
    }

    Write-StatusLine "Total Servers (AD)"           $totalServers                            "INFO"
    Write-StatusLine "Reachable"                    $reachable                               "INFO"
    Write-StatusLine "Unreachable"                  $unreachable                             (if ($unreachable -eq 0) {"PASS"} else {"WARN"})
    Write-StatusLine "AV/EDR Covered"               ("{0} / {1} ({2}%)" -f $avCovered, $reachable, $passPct)  (if ($passPct -eq 100) {"PASS"} else {"FAIL"})
    Write-StatusLine "EDR-Grade Coverage"           ("{0} / {1}" -f $edrCovered, $reachable)                   (if ($edrCovered -eq $reachable) {"PASS"} else {"WARN"})
    Write-StatusLine "No AV Detected (Reachable)"   $noAV                                   (if ($noAV -eq 0) {"PASS"} else {"FAIL"})
    Write-StatusLine "Stale Definitions (>{0}d)" $staleDefsCount                            (if ($staleDefsCount -eq 0) {"PASS"} else {"WARN"})
    Write-StatusLine "Real-Time Protection Disabled" $rtpDisabled                            (if ($rtpDisabled -eq 0) {"PASS"} else {"FAIL"})
    Write-StatusLine "Severity"                     $severity                                (if ($severity -eq "None") {"PASS"} elseif ($severity -in "Low","Medium") {"WARN"} else {"FAIL"})
    Write-StatusLine "Weighted Score (of 30)"       ("{0} / 30" -f $rawScore)               "INFO"

    #endregion

    #region ── Per-Server Detail Table ──────────────────────────────────────────

    Write-SectionHeader "4  |  Per-Server Detail"

    $results | Sort-Object Status, ComputerName | ForEach-Object {
        $lineColour = switch ($_.Status) {
            "PASS"  { "Green"    }
            "FAIL"  { "Red"      }
            default { "DarkGray" }
        }
        $defInfo = if ($_.DefinitionAge -ne $null) { "DefAge:{0}d" -f $_.DefinitionAge } else { "DefAge:N/A" }
        $rtpInfo = if ($_.RealTimeProtection -ne $null) { "RTP:{0}" -f $_.RealTimeProtection } else { "RTP:N/A" }
        $line = "  [{0,-4}] {1,-25} | {2,-12} | {3,-40} | {4} | {5}" -f `
                $_.Status, $_.ComputerName, $_.Coverage, $_.AVProductNames, $defInfo, $rtpInfo
        Write-Host $line -ForegroundColor $lineColour
    }

    #endregion

    #region ── CSV Export ───────────────────────────────────────────────────────

    $csvPath = Join-Path $ExportPath ("AVAudit_{0}.csv" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $results | Select-Object ComputerName, FQDN, IPAddress, OperatingSystem, Reachable,
                             AVDetected, Coverage, AVProductNames, AVVendors, AVTier,
                             RealTimeProtection, DefinitionAge, DefinitionStale,
                             DefenderEnabled, DefenderMode, MDE_SensorRunning,
                             Status, FailReason, ScanMethod, LastLogonDate |
              Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host ("`n  CSV exported : {0}" -f $csvPath) -ForegroundColor Cyan

    #endregion

    #region ── HTML Report ──────────────────────────────────────────────────────

    Write-SectionHeader "5  |  HTML Report Generation"

    $htmlPath = Join-Path $ExportPath ("AVAudit_{0}.html" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $scanDuration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

    $rowsHtml = ""
    foreach ($r in ($results | Sort-Object Status, ComputerName)) {
        $rowClass = if ($r.Status -eq "PASS") { "pass" } elseif ($r.Reachable -eq $false) { "warn" } else { "fail" }
        $defAgeDisplay = if ($r.DefinitionAge -ne $null) {
            $col = if ($r.DefinitionStale) { "color:#e74c3c;font-weight:bold" } else { "color:#27ae60" }
            "<span style='$col'>{0}d</span>" -f $r.DefinitionAge
        } else { "<span style='color:#888'>N/A</span>" }
        $rtpDisplay = if ($r.RealTimeProtection -ne $null) {
            if ($r.RealTimeProtection) { "<span style='color:#27ae60'>Enabled</span>" } else { "<span style='color:#e74c3c;font-weight:bold'>DISABLED</span>" }
        } else { "<span style='color:#888'>N/A</span>" }
        $mdeDisplay = if ($r.MDE_SensorRunning) { "<span style='color:#3498db'>MDE</span>" } else { "" }

        $rowsHtml += @"
        <tr class='$rowClass'>
            <td>$($r.ComputerName)</td>
            <td>$($r.IPAddress)</td>
            <td>$($r.OperatingSystem -replace 'Windows Server ','WS ')</td>
            <td>$(if($r.Reachable){"<span class='badge-pass'>Online</span>"}else{"<span class='badge-fail'>Offline</span>"})</td>
            <td>$($r.Coverage)</td>
            <td>$(if($r.AVProductNames){"$($r.AVProductNames)"}else{"<em style='color:#e74c3c'>None Detected</em>"}) $mdeDisplay</td>
            <td>$defAgeDisplay</td>
            <td>$rtpDisplay</td>
            <td>$(if($r.Status -eq 'PASS'){"<span class='badge-pass'>PASS</span>"}else{"<span class='badge-fail'>FAIL</span>"})</td>
            <td><small style='color:#888'>$($r.FailReason)</small></td>
        </tr>
"@
    }

    $vendorBreakdown = $results | Where-Object { $_.AVVendors } |
                       ForEach-Object { $_.AVVendors -split ", " } |
                       Group-Object | Sort-Object Count -Descending |
                       ForEach-Object { "<tr><td>$($_.Name)</td><td>$($_.Count)</td></tr>" }

    $htmlReport = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AV/EDR Coverage Audit - FTech KZN</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0d1117; color: #c9d1d9; font-size: 13px; }
  .header { background: linear-gradient(135deg, #161b22 0%, #1f2937 100%); border-bottom: 2px solid #e74c3c; padding: 28px 36px; }
  .header h1 { font-size: 22px; color: #fff; letter-spacing: 1px; }
  .header .sub { color: #8b949e; font-size: 12px; margin-top: 6px; }
  .header .badge-severity { display: inline-block; padding: 3px 12px; border-radius: 3px; font-size: 11px; font-weight: bold; margin-left: 12px; vertical-align: middle; }
  .sev-critical { background: #7f0000; color: #fff; }
  .sev-high     { background: #c0392b; color: #fff; }
  .sev-medium   { background: #e67e22; color: #fff; }
  .sev-low      { background: #f39c12; color: #000; }
  .sev-none     { background: #27ae60; color: #fff; }
  .scorecard { display: flex; gap: 16px; padding: 20px 36px; flex-wrap: wrap; border-bottom: 1px solid #21262d; }
  .score-tile { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 16px 24px; min-width: 150px; text-align: center; }
  .score-tile .val { font-size: 28px; font-weight: bold; }
  .score-tile .lbl { font-size: 11px; color: #8b949e; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .val-pass { color: #3fb950; }
  .val-fail { color: #f85149; }
  .val-warn { color: #d29922; }
  .val-info { color: #58a6ff; }
  .section { padding: 20px 36px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; border-bottom: 1px solid #21262d; padding-bottom: 8px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #161b22; color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #21262d; }
  td { padding: 7px 10px; border-bottom: 1px solid #161b22; vertical-align: middle; }
  tr.pass td { background: rgba(63,185,80,0.04); }
  tr.fail td { background: rgba(248,81,73,0.06); }
  tr.warn td { background: rgba(210,153,34,0.06); }
  tr:hover td { background: rgba(88,166,255,0.06); }
  .badge-pass { background: #1a4731; color: #3fb950; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
  .badge-fail { background: #3d1a1a; color: #f85149; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
  .rec-box { background: #1c2128; border-left: 4px solid #e74c3c; padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 10px; font-size: 12px; line-height: 1.7; }
  .rec-box h3 { color: #f85149; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
  .footer { padding: 16px 36px; color: #484f58; font-size: 11px; border-top: 1px solid #21262d; }
</style>
</head>
<body>
<div class='header'>
  <h1>AV / EDR Coverage Audit
    <span class='badge-severity sev-$($severity.ToLower())'>$severity</span>
  </h1>
  <div class='sub'>FTech KZN AD Secure Score &nbsp;|&nbsp; Domain: $($env:USERDNSDOMAIN) &nbsp;|&nbsp; $(Get-Date -Format 'yyyy-MM-dd HH:mm') &nbsp;|&nbsp; Operator: $($env:USERNAME) &nbsp;|&nbsp; Duration: ${scanDuration}s</div>
</div>

<div class='scorecard'>
  <div class='score-tile'><div class='val $(if($avCovered -eq $reachable){"val-pass"}else{"val-fail"})'>$avCovered / $reachable</div><div class='lbl'>Servers Protected</div></div>
  <div class='score-tile'><div class='val $(if($passPct -eq 100){"val-pass"}elseif($passPct -ge 60){"val-warn"}else{"val-fail"})'>$passPct%</div><div class='lbl'>Coverage %</div></div>
  <div class='score-tile'><div class='val $(if($edrCovered -eq $reachable){"val-pass"}else{"val-warn"})'>$edrCovered</div><div class='lbl'>EDR-Grade</div></div>
  <div class='score-tile'><div class='val $(if($noAV -eq 0){"val-pass"}else{"val-fail"})'>$noAV</div><div class='lbl'>No AV Detected</div></div>
  <div class='score-tile'><div class='val $(if($unreachable -eq 0){"val-pass"}else{"val-warn"})'>$unreachable</div><div class='lbl'>Unreachable</div></div>
  <div class='score-tile'><div class='val $(if($staleDefsCount -eq 0){"val-pass"}else{"val-warn"})'>$staleDefsCount</div><div class='lbl'>Stale Definitions</div></div>
  <div class='score-tile'><div class='val $(if($rtpDisabled -eq 0){"val-pass"}else{"val-fail"})'>$rtpDisabled</div><div class='lbl'>RTP Disabled</div></div>
  <div class='score-tile'><div class='val val-info'>$rawScore / 30</div><div class='lbl'>Weighted Score</div></div>
</div>

<div class='section'>
  <h2>Recommendations</h2>
  <div class='rec-box'>
    <h3>Critical Action Items</h3>
    1. Deploy AV/EDR immediately to all $noAV unprotected reachable server(s) — prioritise by OS criticality (DC, Exchange, SQL).<br>
    2. Upgrade any AV-only coverage to EDR-grade solution (CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint MDE).<br>
    3. Remediate $staleDefsCount server(s) with stale definitions (>$DefinitionStaleDays days) — validate WSUS/SCCM update paths.<br>
    4. Investigate $rtpDisabled server(s) with Real-Time Protection disabled — re-enable or document exclusion justification.<br>
    5. For unreachable servers ($unreachable), verify power state, firewall rules (WMI: TCP 135, 445, 49152-65535), and AD stale object cleanup.
  </div>
</div>

<div class='section'>
  <h2>Vendor Distribution</h2>
  <table style='max-width:400px'>
    <thead><tr><th>Vendor / Product</th><th>Server Count</th></tr></thead>
    <tbody>$($vendorBreakdown -join "")</tbody>
  </table>
</div>

<div class='section'>
  <h2>Server Detail ($totalServers Servers)</h2>
  <table>
    <thead>
      <tr>
        <th>Server</th><th>IP</th><th>OS</th><th>Reachable</th>
        <th>Coverage</th><th>AV / EDR Product</th>
        <th>Def Age</th><th>RTP</th><th>Status</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>$rowsHtml</tbody>
  </table>
</div>

<div class='footer'>
  FTech KZN AD Secure Score Platform &nbsp;|&nbsp; Check: infrastructure_av_edr_coverage &nbsp;|&nbsp; Weight: 30 &nbsp;|&nbsp; Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
</div>
</body>
</html>
"@

    $htmlReport | Out-File -FilePath $htmlPath -Encoding UTF8
    Write-Host ("  HTML report  : {0}" -f $htmlPath) -ForegroundColor Cyan

    #endregion

    #region ── Build JSON Payload ───────────────────────────────────────────────

    $payload = [pscustomobject]@{
        CheckId          = "infrastructure_av_edr_coverage"
        Category         = "infrastructure"
        CheckName        = "Server AV/EDR Coverage"
        Severity         = $severity
        Weight           = 30
        Score            = $rawScore
        Status           = if ($passPct -eq 100) { "Pass" } else { "Fail" }
        Timestamp        = (Get-Date -Format "o")
        Domain           = $env:USERDNSDOMAIN
        Operator         = $env:USERNAME
        ScanDurationSec  = $scanDuration
        Summary          = ("AV Coverage: {0}/{1} servers ({2}%) [Reachable: {3}, Unreachable: {4}, EDR-Grade: {5}]" `
                            -f $avCovered, $reachable, $passPct, $reachable, $unreachable, $edrCovered)
        Recommendation   = "Deploy AV/EDR to all $noAV unprotected servers. Upgrade AV-only to EDR-grade. Remediate stale definitions ($staleDefsCount servers). Fix disabled RTP ($rtpDisabled servers)."
        Statistics       = [pscustomobject]@{
            TotalServers   = $totalServers
            Reachable      = $reachable
            Unreachable    = $unreachable
            AVCovered      = $avCovered
            EDRCovered     = $edrCovered
            NoAV           = $noAV
            StaleDefs      = $staleDefsCount
            RTPDisabled    = $rtpDisabled
            PassPercent    = $passPct
        }
        ServerResults    = $results
        ExportCSV        = $csvPath
        ExportHTML       = $htmlPath
    }

    #endregion

    #region ── Optional API POST ────────────────────────────────────────────────

    if ($PostToAPI) {
        Write-SectionHeader "6  |  API Submission"
        try {
            $jsonBody = $payload | ConvertTo-Json -Depth 8 -Compress
            $response = Invoke-RestMethod -Uri $APIEndpoint `
                                          -Method Post      `
                                          -ContentType "application/json" `
                                          -Body $jsonBody   `
                                          -ErrorAction Stop
            Write-Host ("  POST to {0} : OK" -f $APIEndpoint) -ForegroundColor Green
        }
        catch {
            Write-Warning ("API POST failed: {0}" -f $_.Exception.Message)
        }
    }

    #endregion

    Write-SectionHeader "Audit Complete"
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Write-Host ("  Total scan time : {0} seconds" -f $elapsed) -ForegroundColor Gray
    Write-Host ""

    return $payload
}

<#powershell# Full audit — all servers in domain
$avResult = Invoke-AVEDRCoverageAudit

# Scope to specific OU
Invoke-AVEDRCoverageAudit -TargetOU "OU=Servers,DC=ashtons,DC=local"

# Dry audit + API submission to AD Secure Score
Invoke-AVEDRCoverageAudit -PostToAPI

# High-speed scan (increase concurrency for large environments)
Invoke-AVEDRCoverageAudit -MaxConcurrentJobs 40 -PostToAPI

# Custom export path + tighter stale definition threshold
Invoke-AVEDRCoverageAudit -ExportPath "C:\Reports\AV" -DefinitionStaleDays 1 -PostToAPI

#>