[CmdletBinding()]
param(
    [ValidateSet("All", "Chrome", "Firefox")]
    [string]$Target = "All"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$canonicalManifest = Get-Content -LiteralPath (Join-Path $projectRoot "manifest.json") -Raw | ConvertFrom-Json
$outputDirectory = Join-Path $projectRoot "dist"
$expectedEntries = @(
    "manifest.json"
    "api-client.js"
    "background.js"
    "content.js"
    "styles.css"
    "icons/publisher-analytics-16.png"
    "icons/publisher-analytics-32.png"
    "icons/publisher-analytics-48.png"
    "icons/publisher-analytics-128.png"
    "vendor/echarts.min.js"
    "vendor/echarts.min.js.LEGAL.txt"
    "LICENSE"
) | Sort-Object

Add-Type -AssemblyName System.IO.Compression

function Get-ArchiveDetails {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("chrome", "firefox")][string]$BrowserTarget
    )

    $archivePath = Join-Path $outputDirectory "publisher-analytics-$BrowserTarget-$($canonicalManifest.version).zip"
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw "Missing $BrowserTarget package: $archivePath"
    }

    $stream = [System.IO.File]::OpenRead($archivePath)
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Read)
    try {
        $entryNames = @($archive.Entries | ForEach-Object FullName | Sort-Object)
        if (Compare-Object -ReferenceObject $expectedEntries -DifferenceObject $entryNames) {
            throw "$BrowserTarget package contains missing or unexpected files."
        }

        $manifestEntry = $archive.GetEntry("manifest.json")
        $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
        try { $targetManifest = $reader.ReadToEnd() | ConvertFrom-Json }
        finally { $reader.Dispose() }

        if ($targetManifest.version -ne $canonicalManifest.version) {
            throw "$BrowserTarget package version does not match the canonical manifest."
        }
        if (@($targetManifest.host_permissions).Count -ne 1 -or $targetManifest.host_permissions[0] -ne "https://publisher.unity.com/*") {
            throw "$BrowserTarget package has unexpected host permissions."
        }

        if ($BrowserTarget -eq "chrome") {
            if ($targetManifest.background.service_worker -ne "background.js" -or $targetManifest.background.PSObject.Properties.Name -contains "scripts") {
                throw "Chrome package has an invalid background declaration."
            }
            if ($targetManifest.PSObject.Properties.Name -contains "browser_specific_settings") {
                throw "Chrome package contains Firefox-only metadata."
            }
        }
        else {
            if (@($targetManifest.background.scripts).Count -ne 1 -or $targetManifest.background.scripts[0] -ne "background.js" -or $targetManifest.background.PSObject.Properties.Name -contains "service_worker") {
                throw "Firefox package has an invalid background declaration."
            }
            if ($targetManifest.browser_specific_settings.gecko.strict_min_version -ne "140.0") {
                throw "Firefox package has an unexpected minimum version."
            }
            if ($targetManifest.browser_specific_settings.gecko_android.strict_min_version -ne "142.0") {
                throw "Firefox package has an unexpected Android minimum version."
            }
            if (@($targetManifest.browser_specific_settings.gecko.data_collection_permissions.required).Count -ne 1 -or $targetManifest.browser_specific_settings.gecko.data_collection_permissions.required[0] -ne "none") {
                throw "Firefox package must declare that it does not collect data."
            }
        }

        $hashes = @{}
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            foreach ($entry in $archive.Entries | Where-Object FullName -ne "manifest.json") {
                $entryStream = $entry.Open()
                try {
                    $hashBytes = $sha256.ComputeHash($entryStream)
                    $hashes[$entry.FullName] = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
                }
                finally { $entryStream.Dispose() }
            }
        }
        finally { $sha256.Dispose() }

        return @{ Path = $archivePath; Manifest = $targetManifest; Hashes = $hashes }
    }
    finally {
        $archive.Dispose()
        $stream.Dispose()
    }
}

$targets = switch ($Target) {
    "Chrome" { @("chrome") }
    "Firefox" { @("firefox") }
    default { @("chrome", "firefox") }
}

$details = @{}
foreach ($browserTarget in $targets) {
    $details[$browserTarget] = Get-ArchiveDetails -BrowserTarget $browserTarget
    Write-Output "Validated $($details[$browserTarget].Path)"
}

if ($Target -eq "All") {
    foreach ($entryName in $details.chrome.Hashes.Keys) {
        if ($details.chrome.Hashes[$entryName] -ne $details.firefox.Hashes[$entryName]) {
            throw "Runtime payload differs between packages: $entryName"
        }
    }
    Write-Output "Chrome and Firefox runtime payloads are identical."
}
