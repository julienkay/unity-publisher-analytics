[CmdletBinding()]
param(
    [ValidateSet("All", "Chrome", "Firefox")]
    [string]$Target = "All"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifestGeneratorPath = Join-Path $PSScriptRoot "generate-manifest.mjs"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$packageFiles = @(
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
)

$requiredFiles = @("manifest.json", "scripts/generate-manifest.mjs") + $packageFiles
$missingFiles = $requiredFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $projectRoot $_) -PathType Leaf)
}

if ($missingFiles) {
    throw "Cannot package the extension. Missing: $($missingFiles -join ', ')"
}

$outputDirectory = Join-Path $projectRoot "dist"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression

function Add-ArchiveFile {
    param(
        [Parameter(Mandatory = $true)]$Archive,
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$EntryName
    )

    $entry = $Archive.CreateEntry($EntryName.Replace("\", "/"), [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $sourceStream = [System.IO.File]::OpenRead($SourcePath)
    try {
        $sourceStream.CopyTo($entryStream)
    }
    finally {
        $sourceStream.Dispose()
        $entryStream.Dispose()
    }
}

function New-ExtensionArchive {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("chrome", "firefox")][string]$BrowserTarget
    )

    $outputPath = Join-Path $outputDirectory "publisher-analytics-$BrowserTarget-$($manifest.version).zip"
    $temporaryOutputPath = Join-Path $outputDirectory ".$BrowserTarget-$([guid]::NewGuid()).tmp"
    $temporaryManifestPath = Join-Path $outputDirectory ".$BrowserTarget-manifest-$([guid]::NewGuid()).json"
    $outputStream = $null
    $archive = $null

    try {
        & node $manifestGeneratorPath $BrowserTarget $temporaryManifestPath
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate the $BrowserTarget manifest."
        }

        $outputStream = [System.IO.File]::Open(
            $temporaryOutputPath,
            [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::Write
        )
        $archive = [System.IO.Compression.ZipArchive]::new(
            $outputStream,
            [System.IO.Compression.ZipArchiveMode]::Create
        )

        Add-ArchiveFile -Archive $archive -SourcePath $temporaryManifestPath -EntryName "manifest.json"
        foreach ($relativePath in $packageFiles) {
            Add-ArchiveFile -Archive $archive -SourcePath (Join-Path $projectRoot $relativePath) -EntryName $relativePath
        }

        $archive.Dispose()
        $archive = $null
        $outputStream.Dispose()
        $outputStream = $null

        if (Test-Path -LiteralPath $outputPath) {
            Remove-Item -LiteralPath $outputPath -Force
        }
        Move-Item -LiteralPath $temporaryOutputPath -Destination $outputPath

        $createdArchive = Get-Item -LiteralPath $outputPath
        Write-Output "Created $($createdArchive.FullName) ($($createdArchive.Length) bytes)"
    }
    finally {
        if ($archive) { $archive.Dispose() }
        if ($outputStream) { $outputStream.Dispose() }
        if (Test-Path -LiteralPath $temporaryOutputPath) {
            Remove-Item -LiteralPath $temporaryOutputPath -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $temporaryManifestPath) {
            Remove-Item -LiteralPath $temporaryManifestPath -Force -ErrorAction SilentlyContinue
        }
    }
}

$targets = switch ($Target) {
    "Chrome" { @("chrome") }
    "Firefox" { @("firefox") }
    default { @("chrome", "firefox") }
}

foreach ($browserTarget in $targets) {
    New-ExtensionArchive -BrowserTarget $browserTarget
}
