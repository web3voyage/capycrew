param(
    [int]$Proof = 0,
    [int]$Start = 1,
    [int]$Count = 10000,
    [int]$Size = 640,
    [ValidateSet('jpg', 'png')][string]$Format = 'jpg',
    [switch]$ManifestOnly,
    [string]$Output = 'output/capycrew-10000'
)

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'CapyCrewGenerator/CapyCrewGenerator.csproj'
$source = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets/CapyCrew_042_cutout.png'
$outputPath = Join-Path (Split-Path $PSScriptRoot -Parent) $Output
$contactSheet = Join-Path $outputPath 'capycrew-proof-sheet.jpg'

$arguments = @(
    'run', '--project', $project, '--configuration', 'Release', '--',
    '--source', $source, '--output', $outputPath,
    '--start', $Start, '--count', $Count, '--size', $Size, '--format', $Format
)

if ($Proof -gt 0) {
    $arguments += @('--proof', $Proof, '--contact-sheet', $contactSheet)
}
if ($ManifestOnly) {
    $arguments += '--manifest-only'
}

& dotnet @arguments
exit $LASTEXITCODE
