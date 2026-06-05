function Invoke-DNSScavengingAudit {
<#
.SYNOPSIS
    Audits DNS Scavenging and Aging configuration across all AD-integrated zones on all DCs.
    Designed for AD Secure Score platform integration (HTTP POST JSON payload).

.DESCRIPTION
    - Discovers all AD-integrated DNS zones across all authoritative DCs
    - Checks scavenging enabled at server level and aging at zone level
    - Validates 7-day No-Refresh and 7-day Refresh intervals
    - Emits structured JSON for HTTP POST to Express.js API endpoint
    - Supports -WhatIf remediation mode
    - PS 5.1 compatible, ASCII-safe output

.PARAMETER Remediate
    Apply recommended settings (scavenging enabled, 7/7 intervals).

.PARAMETER WhatIf
    Simulate remediation without making changes.

.PARAMETER PostToAPI
    If set, POST results to the ADSecureScore API endpoint.

.PARAMETER APIEndpoint
    URL of the Express.js collector API. Default: http://172.16.0.16:3000/api/scores

.EXAMPLE
    Invoke-DNSScavengingAudit
    Invoke-DNSScavengingAudit -Remediate -WhatIf
    Invoke-DNSScavengingAudit -Remediate -PostToAPI
#>

    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [switch]$Remediate,
        [switch]$PostToAPI,
        [string]$APIEndpoint = "http://172.16.0.16:3000/api/scores",
        [int]$NoRefreshIntervalDays = 7,
        [int]$RefreshIntervalDays   = 7
    )

    #region ── Helpers ──────────────────────────────────────────────────────────

    function Write-SectionHeader {
        param([string]$Title)
        $line = "-" * 72
        Write-Host ""
        Write-Host $line -ForegroundColor DarkCyan
        Write-Host "  $Title" -ForegroundColor Cyan
        Write-Host $line -ForegroundColor DarkCyan
    }

    function Write-StatusLine {
        param([string]$Label, [string]$Value, [string]$Status)
        $colour = switch ($Status) {
            "PASS"    { "Green"  }
            "FAIL"    { "Red"    }
            "WARN"    { "Yellow" }
            "INFO"    { "Cyan"   }
            default   { "White"  }
        }
        Write-Host ("  {0,-45} [{1}] {2}" -f $Label, $Status, $Value) -ForegroundColor $colour
    }

    function ConvertTo-Hours { param([int]$Days) return $Days * 24 }

    #endregion

    #region ── Initialise ───────────────────────────────────────────────────────

    Write-SectionHeader "DNS Scavenging & Aging Audit  |  FTech KZN AD Secure Score"
    Write-Host ("  Timestamp  : {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor Gray
    Write-Host ("  Operator   : {0}" -f $env:USERNAME)                           -ForegroundColor Gray
    Write-Host ("  Domain     : {0}" -f $env:USERDNSDOMAIN)                      -ForegroundColor Gray

    $targetNoRefreshH = ConvertTo-Hours $NoRefreshIntervalDays
    $targetRefreshH   = ConvertTo-Hours $RefreshIntervalDays

    $auditResults   = [System.Collections.Generic.List[object]]::new()
    $remediationLog = [System.Collections.Generic.List[string]]::new()
    $allZoneResults = [System.Collections.Generic.List[object]]::new()

    $domainControllers = @()
    try {
        $domainControllers = (Get-ADDomainController -Filter *).HostName | Sort-Object
        Write-Host ("  DCs Found  : {0}" -f ($domainControllers -join ", ")) -ForegroundColor Gray
    }
    catch {
        Write-Warning "Failed to enumerate domain controllers: $_"
        return
    }

    if ($domainControllers.Count -eq 0) {
        Write-Warning "No domain controllers found. Aborting."
        return
    }

    #endregion

    #region ── Per-DC Server-Level Scavenging ───────────────────────────────────

    Write-SectionHeader "1  |  Server-Level Scavenging (per DC)"

    $serverResults = [System.Collections.Generic.List[object]]::new()

    foreach ($dc in $domainControllers) {

        $serverObj = [pscustomobject]@{
            DC                      = $dc
            ScavengingEnabled       = $false
            ScavengingInterval      = $null
            ServerStatus            = "FAIL"
            Error                   = $null
        }

        try {
            $dnsServer = Get-DnsServer -ComputerName $dc -ErrorAction Stop

            $scavEnabled  = $dnsServer.ServerSetting.ScavengingInterval -ne 0
            $scavInterval = $dnsServer.ServerSetting.ScavengingInterval   # TimeSpan

            $serverObj.ScavengingEnabled  = $scavEnabled
            $serverObj.ScavengingInterval = if ($scavInterval) { $scavInterval.ToString() } else { "Not Set" }
            $serverObj.ServerStatus       = if ($scavEnabled) { "PASS" } else { "FAIL" }

            Write-StatusLine ("DC: $dc  |  Scavenging Enabled") $serverObj.ScavengingEnabled $serverObj.ServerStatus

            # ── Remediate server scavenging ──────────────────────────────────
            if ($Remediate -and -not $scavEnabled) {
                $action = "Enable DNS scavenging on $dc (interval: 7 days)"
                if ($PSCmdlet.ShouldProcess($dc, $action)) {
                    Set-DnsServerScavenging -ComputerName $dc -ScavengingState $true `
                        -ScavengingInterval ([TimeSpan]::FromDays(7)) -ApplyOnAllZones $false
                    $serverObj.ScavengingEnabled = $true
                    $serverObj.ServerStatus      = "PASS"
                    $remediationLog.Add("[REMEDIATED] Server scavenging enabled on $dc")
                    Write-Host ("    >> Scavenging ENABLED on {0}" -f $dc) -ForegroundColor Green
                }
                else {
                    $remediationLog.Add("[WHATIF] Would enable server scavenging on $dc")
                }
            }
        }
        catch {
            $serverObj.Error        = $_.Exception.Message
            $serverObj.ServerStatus = "ERROR"
            Write-StatusLine ("DC: $dc") "Query failed" "WARN"
            Write-Host ("    Error: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
        }

        $serverResults.Add($serverObj)
    }

    #endregion

    #region ── Zone-Level Aging (AD-Integrated Zones) ───────────────────────────

    Write-SectionHeader "2  |  Zone-Level Aging (AD-Integrated Zones)"

    # Collect zones from the PDC emulator for a single authoritative view
    $pdcEmulator = (Get-ADDomain).PDCEmulator

    $adZones = @()
    try {
        $adZones = Get-DnsServerZone -ComputerName $pdcEmulator |
                   Where-Object { $_.IsReverseLookupZone -eq $false -and
                                  $_.ZoneType -eq "Primary"          -and
                                  $_.IsDsIntegrated -eq $true } |
                   Sort-Object ZoneName
    }
    catch {
        Write-Warning "Failed to enumerate DNS zones from PDC ($pdcEmulator): $_"
    }

    Write-Host ("  AD-Integrated Primary Zones: {0}" -f $adZones.Count) -ForegroundColor Gray
    Write-Host ""

    $zonesPass = 0
    $zonesFail = 0
    $zoneTotal = $adZones.Count

    foreach ($zone in $adZones) {

        $zoneObj = [pscustomobject]@{
            ZoneName          = $zone.ZoneName
            AgingEnabled      = $false
            NoRefreshInterval = $null
            RefreshInterval   = $null
            NoRefreshPass     = $false
            RefreshPass       = $false
            ZoneStatus        = "FAIL"
            Recommendation    = ""
            Error             = $null
        }

        try {
            $zoneAging = Get-DnsServerZoneAging -ZoneName $zone.ZoneName `
                                                -ComputerName $pdcEmulator -ErrorAction Stop

            $agingOn      = $zoneAging.AgingEnabled
            $noRefreshH   = $zoneAging.NoRefreshInterval.TotalHours
            $refreshH     = $zoneAging.RefreshInterval.TotalHours

            $noRefreshPass = ($noRefreshH -eq $targetNoRefreshH)
            $refreshPass   = ($refreshH   -eq $targetRefreshH)
            $fullyPass     = $agingOn -and $noRefreshPass -and $refreshPass

            $zoneObj.AgingEnabled      = $agingOn
            $zoneObj.NoRefreshInterval = ("{0}h ({1}d)" -f [int]$noRefreshH, [math]::Round($noRefreshH/24,1))
            $zoneObj.RefreshInterval   = ("{0}h ({1}d)" -f [int]$refreshH,   [math]::Round($refreshH/24,1))
            $zoneObj.NoRefreshPass     = $noRefreshPass
            $zoneObj.RefreshPass       = $refreshPass
            $zoneObj.ZoneStatus        = if ($fullyPass) { "PASS" } else { "FAIL" }

            if (-not $agingOn) {
                $zoneObj.Recommendation = "Enable aging on zone"
            }
            elseif (-not $noRefreshPass) {
                $zoneObj.Recommendation = ("Set No-Refresh to {0} days (currently {1}h)" -f $NoRefreshIntervalDays, [int]$noRefreshH)
            }
            elseif (-not $refreshPass) {
                $zoneObj.Recommendation = ("Set Refresh to {0} days (currently {1}h)" -f $RefreshIntervalDays, [int]$refreshH)
            }

            if ($fullyPass) { $zonesPass++ } else { $zonesFail++ }

            # Console output per zone
            $zColour = if ($fullyPass) { "Green" } else { "Red" }
            Write-Host ("  Zone : {0}" -f $zone.ZoneName) -ForegroundColor White
            Write-Host ("    Aging Enabled   : {0}" -f $agingOn)                         -ForegroundColor $zColour
            Write-Host ("    No-Refresh      : {0}  (target {1}d)" -f $zoneObj.NoRefreshInterval, $NoRefreshIntervalDays) `
                       -ForegroundColor (if ($noRefreshPass) { "Green" } else { "Red" })
            Write-Host ("    Refresh         : {0}  (target {1}d)" -f $zoneObj.RefreshInterval, $RefreshIntervalDays) `
                       -ForegroundColor (if ($refreshPass) { "Green" } else { "Red" })
            if ($zoneObj.Recommendation) {
                Write-Host ("    Recommendation  : {0}" -f $zoneObj.Recommendation) -ForegroundColor Yellow
            }
            Write-Host ""

            # ── Remediate zone aging ─────────────────────────────────────────
            if ($Remediate -and -not $fullyPass) {
                $action = ("Set aging on zone {0} (Aging=true, NoRefresh={1}d, Refresh={2}d)" `
                           -f $zone.ZoneName, $NoRefreshIntervalDays, $RefreshIntervalDays)

                if ($PSCmdlet.ShouldProcess($zone.ZoneName, $action)) {
                    foreach ($dc in $domainControllers) {
                        try {
                            Set-DnsServerZoneAging -ZoneName $zone.ZoneName         `
                                                   -ComputerName $dc                `
                                                   -Aging $true                     `
                                                   -NoRefreshInterval ([TimeSpan]::FromDays($NoRefreshIntervalDays)) `
                                                   -RefreshInterval   ([TimeSpan]::FromDays($RefreshIntervalDays))  `
                                                   -ErrorAction Stop
                            $remediationLog.Add("[REMEDIATED] Zone $($zone.ZoneName) aging configured on $dc")
                        }
                        catch {
                            $remediationLog.Add("[ERROR] Zone $($zone.ZoneName) on ${dc}: $($_.Exception.Message)")
                        }
                    }
                    $zoneObj.AgingEnabled  = $true
                    $zoneObj.ZoneStatus    = "PASS"
                    $zoneObj.Recommendation = "Remediated"
                    Write-Host ("    >> Zone {0} aging REMEDIATED" -f $zone.ZoneName) -ForegroundColor Green
                }
                else {
                    $remediationLog.Add("[WHATIF] Would configure aging on zone $($zone.ZoneName)")
                }
            }
        }
        catch {
            $zoneObj.Error      = $_.Exception.Message
            $zoneObj.ZoneStatus = "ERROR"
            $zonesFail++
            Write-Host ("  Zone : {0}  [ERROR] {1}" -f $zone.ZoneName, $_.Exception.Message) -ForegroundColor Yellow
        }

        $allZoneResults.Add($zoneObj)
    }

    #endregion

    #region ── Score Calculation ────────────────────────────────────────────────

    Write-SectionHeader "3  |  Score Summary"

    $passPct     = if ($zoneTotal -gt 0) { [math]::Round(($zonesPass / $zoneTotal) * 100, 1) } else { 0 }
    $rawScore    = [math]::Round($passPct * 0.25, 1)   # max weight 25 per check spec
    $severity    = switch ($passPct) {
        { $_ -eq 100 }          { "None"   }
        { $_ -ge 75  }          { "Low"    }
        { $_ -ge 40  }          { "Medium" }
        default                 { "High"   }
    }
    $serverScavPass = ($serverResults | Where-Object { $_.ScavengingEnabled -eq $true }).Count
    $serverScavFail = ($serverResults | Where-Object { $_.ScavengingEnabled -eq $false }).Count

    Write-StatusLine "Zones Passing Aging Config"     ("{0}/{1} ({2}%)" -f $zonesPass, $zoneTotal, $passPct)  (if ($passPct -eq 100) {"PASS"} else {"FAIL"})
    Write-StatusLine "DCs with Server Scavenging"     ("{0}/{1}" -f $serverScavPass, $domainControllers.Count) (if ($serverScavFail -eq 0) {"PASS"} else {"FAIL"})
    Write-StatusLine "Severity"                        $severity                                               (if ($severity -eq "None") {"PASS"} elseif ($severity -eq "Low") {"WARN"} else {"FAIL"})
    Write-StatusLine "Weighted Score (of 25)"          $rawScore                                               "INFO"
    Write-Host ""

    #endregion

    #region ── Remediation Log ──────────────────────────────────────────────────

    if ($remediationLog.Count -gt 0) {
        Write-SectionHeader "4  |  Remediation Log"
        foreach ($entry in $remediationLog) {
            $colour = if ($entry -match "REMEDIATED") { "Green" } elseif ($entry -match "WHATIF") { "Yellow" } else { "Red" }
            Write-Host ("  {0}" -f $entry) -ForegroundColor $colour
        }
    }

    #endregion

    #region ── Build JSON Payload ───────────────────────────────────────────────

    $payload = [pscustomobject]@{
        CheckId          = "dchealth_dns_scavenging"
        Category         = "dchealth"
        CheckName        = "DNS Scavenging & Zone Aging"
        Severity         = $severity
        Weight           = 25
        Score            = $rawScore
        Status           = if ($passPct -eq 100) { "Pass" } else { "Fail" }
        Timestamp        = (Get-Date -Format "o")
        Domain           = $env:USERDNSDOMAIN
        Operator         = $env:USERNAME
        Summary          = ("{0}/{1} zones ({2}%) pass aging config. {3}/{4} DCs have server scavenging enabled." `
                            -f $zonesPass, $zoneTotal, $passPct, $serverScavPass, $domainControllers.Count)
        Recommendation   = "Enable aging on all AD-integrated zones. Set $($NoRefreshIntervalDays)-day No-Refresh and $($RefreshIntervalDays)-day Refresh intervals. Enable scavenging on all DCs."
        ServerResults    = $serverResults
        ZoneResults      = $allZoneResults
        RemediationLog   = $remediationLog
    }

    #endregion

    #region ── Optional API POST ────────────────────────────────────────────────

    if ($PostToAPI) {
        Write-SectionHeader "5  |  API Submission"
        try {
            $jsonBody = $payload | ConvertTo-Json -Depth 6 -Compress
            $response = Invoke-RestMethod -Uri $APIEndpoint `
                                          -Method Post       `
                                          -ContentType "application/json" `
                                          -Body $jsonBody    `
                                          -ErrorAction Stop
            Write-Host ("  POST to {0} : OK" -f $APIEndpoint) -ForegroundColor Green
            Write-Host ("  API Response : {0}" -f ($response | ConvertTo-Json -Compress)) -ForegroundColor Gray
        }
        catch {
            Write-Warning ("API POST failed: {0}" -f $_.Exception.Message)
        }
    }

    #endregion

    Write-SectionHeader "Audit Complete"
    return $payload
}

<# 1. Audit only — view console output and receive structured object
$result = Invoke-DNSScavengingAudit

# 2. Audit + submit to AD Secure Score API
Invoke-DNSScavengingAudit -PostToAPI

# 3. Dry-run remediation (WhatIf — no changes applied)
Invoke-DNSScavengingAudit -Remediate -WhatIf

# 4. Live remediation + API submission
Invoke-DNSScavengingAudit -Remediate -PostToAPI

# 5. Custom intervals (e.g. 14-day no-refresh, 7-day refresh)
Invoke-DNSScavengingAudit -NoRefreshIntervalDays 14 -RefreshIntervalDays 7 -PostToAPI
#>