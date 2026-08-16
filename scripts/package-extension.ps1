[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$packageFiles = @(
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
)

$missingFiles = $packageFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $projectRoot $_) -PathType Leaf)
}

if ($missingFiles) {
    throw "Cannot package the extension. Missing: $($missingFiles -join ', ')"
}

$outputDirectory = Join-Path $projectRoot "dist"
$outputPath = Join-Path $outputDirectory "publisher-analytics-$($manifest.version).zip"
$temporaryOutputPath = Join-Path $outputDirectory ".$([guid]::NewGuid()).tmp"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression

$outputStream = $null
$archive = $null
try {
    $outputStream = [System.IO.File]::Open(
        $temporaryOutputPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write
    )
    $archive = [System.IO.Compression.ZipArchive]::new(
        $outputStream,
        [System.IO.Compression.ZipArchiveMode]::Create
    )

    foreach ($relativePath in $packageFiles) {
        $entryName = $relativePath.Replace("\", "/")
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $sourceStream = [System.IO.File]::OpenRead((Join-Path $projectRoot $relativePath))

        try {
            $sourceStream.CopyTo($entryStream)
        }
        finally {
            $sourceStream.Dispose()
            $entryStream.Dispose()
        }
    }

    $archive.Dispose()
    $archive = $null
    $outputStream.Dispose()
    $outputStream = $null

    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    Move-Item -LiteralPath $temporaryOutputPath -Destination $outputPath
}
finally {
    if ($archive) {
        $archive.Dispose()
    }
    if ($outputStream) {
        $outputStream.Dispose()
    }

    if (Test-Path -LiteralPath $temporaryOutputPath) {
        Remove-Item -LiteralPath $temporaryOutputPath -Force -ErrorAction SilentlyContinue
    }
}

$archive = Get-Item -LiteralPath $outputPath
Write-Output "Created $($archive.FullName) ($($archive.Length) bytes)"
