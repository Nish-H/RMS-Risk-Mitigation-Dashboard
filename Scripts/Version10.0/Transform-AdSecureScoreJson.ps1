<#
.SYNOPSIS
    Normalize AD Secure Score JSON to dashboard schema.

.DESCRIPTION
    This transformer reads the Secure Score JSON produced by the AD Secure Score Collector and:
      - Optionally normalizes the details objects within each finding (Name/SamAccountName -> name/samAccountName).
      - Ensures each finding has a collectedAt timestamp (defaulting to the meta collectedAt value).
      - Ensures findings have a details array (even if empty).
      - Writes out a normalized JSON to the requested output path.

.PARAMETERS
    InputJsonPath   - Path to the input JSON file.
    OutputJsonPath  - Path where to write the normalized JSON.
    NormalizeDetails - If specified, pivots detail object keys to lower camelCase (name, samAccountName).

.EXAMPLE
    PowerShell -NoProfile -ExecutionPolicy Bypass -File Transform-AdSecureScoreJson.ps1 \
      -InputJsonPath "C:\path\ad_secure_score.json" \
      -OutputJsonPath "C:\path\ad_secure_score.normalized.json" \
      -NormalizeDetails
#>

param(
    [Parameter(Mandatory=$true)][string]$InputJsonPath,
    [Parameter(Mandatory=$true)][string]$OutputJsonPath,
    [switch]$NormalizeDetails
)

function Normalize-Details {
    param([array]$details)
    $out = @()
    foreach ($d in @($details)) {
        $new = @{}
        foreach ($p in $d.PSObject.Properties) {
            switch ($p.Name) {
                'Name'          { $new['name'] = $p.Value; break }
                'SamAccountName'{ $new['samAccountName'] = $p.Value; break }
                default         { $new[$p.Name] = $p.Value; break }
            }
        }
        $out += [PSCustomObject]$new
    }
    return $out
}

try {
    $raw = Get-Content -Path $InputJsonPath -Raw -ErrorAction Stop
    $json = $raw | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-Error "Failed to read/parse JSON: $_"
    exit 1
}

if (-not $json) { Write-Error "Empty JSON"; exit 1 }

if ($NormalizeDetails) {
    if ($json.findings -is [System.Collections.IEnumerable]) {
        for ($i = 0; $i -lt $json.findings.Count; $i++) {
            $f = $json.findings[$i]
            if ($f -and $f.PSObject.Properties.Name -contains 'details' -and $f.details) {
                $json.findings[$i].details = Normalize-Details $f.details
            } elseif (-not $f.details) {
                $json.findings[$i].details = @()
            }
            if (-not $f.collectedAt -and $json.meta -and $json.meta.collectedAt) {
                $json.findings[$i].collectedAt = $json.meta.collectedAt
            }
        }
    }
}

# Ensure every finding has a collectedAt timestamp and a details array
foreach ($f in $json.findings) {
    if (-not $f.collectedAt -and $json.meta -and $json.meta.collectedAt) {
        $f.collectedAt = $json.meta.collectedAt
    }
    if (-not $f.details) { $f.details = @() }
}

try {
    $out = $json | ConvertTo-Json -Depth 8 -Compress
    Set-Content -Path $OutputJsonPath -Encoding UTF8 -Value $out
    Write-Host "Normalized JSON written to $OutputJsonPath"
}
catch {
    Write-Error "Failed to write normalized JSON: $_"
    exit 1
}
