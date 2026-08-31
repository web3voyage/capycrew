param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$CopyFiles
)

$ErrorActionPreference = 'Stop'
$assetRoot = Join-Path $ProjectRoot 'assets'
$outputRoot = Join-Path $ProjectRoot 'nft-assets'
$sourceRoot = Join-Path $outputRoot 'source'
$artworkRoot = Join-Path $sourceRoot 'complete-artworks'
$siteRoot = Join-Path $sourceRoot 'site-assets'
$preparedRoot = Join-Path $outputRoot 'prepared'
$imageRoot = Join-Path $preparedRoot 'images'
$metadataRoot = Join-Path $preparedRoot 'metadata'
$manifestRoot = Join-Path $outputRoot 'manifests'

foreach ($path in @($artworkRoot, $siteRoot, $imageRoot, $metadataRoot, $manifestRoot)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

if ($CopyFiles) {
    $collectionFolders = @('Common', 'Epic', 'Helmets', 'Legendary', 'Rare-Graffiti', 'Skate', 'Ski-Mask', 'Sport-Outfit')
    foreach ($folder in $collectionFolders) {
        $source = Join-Path $assetRoot $folder
        if (Test-Path -LiteralPath $source) {
            $destination = Join-Path $artworkRoot $folder
            New-Item -ItemType Directory -Force -Path $destination | Out-Null
            Get-ChildItem -LiteralPath $source -File | Copy-Item -Destination $destination -Force
        }
    }

    Get-ChildItem -LiteralPath $assetRoot -File | Copy-Item -Destination $siteRoot -Force
}

function Get-Classification([string]$folder, [string]$name) {
    switch ($folder) {
        'Common' { return @{ Rarity = 'Common'; TraitType = 'Rarity'; TraitValue = 'Common' } }
        'Epic' { return @{ Rarity = 'Epic'; TraitType = 'Rarity'; TraitValue = 'Epic' } }
        'Legendary' { return @{ Rarity = 'Legendary'; TraitType = 'Rarity'; TraitValue = 'Legendary' } }
        'Rare-Graffiti' { return @{ Rarity = 'Rare'; TraitType = 'Style'; TraitValue = 'Graffiti' } }
        'Helmets' { return @{ Rarity = 'Unassigned'; TraitType = 'Headwear'; TraitValue = 'Helmet' } }
        'Skate' { return @{ Rarity = 'Unassigned'; TraitType = 'Lifestyle'; TraitValue = 'Skate' } }
        'Ski-Mask' { return @{ Rarity = 'Unassigned'; TraitType = 'Facewear'; TraitValue = 'Ski Mask' } }
        'Sport-Outfit' { return @{ Rarity = 'Unassigned'; TraitType = 'Outfit'; TraitValue = 'Sport' } }
        default { return @{ Rarity = 'Unassigned'; TraitType = 'Review'; TraitValue = 'Unclassified' } }
    }
}

Add-Type -AssemblyName System.Drawing
$rows = New-Object System.Collections.Generic.List[object]
$files = Get-ChildItem -LiteralPath $artworkRoot -Recurse -File | Where-Object { $_.Extension.ToLowerInvariant() -in @('.jpg', '.jpeg', '.png', '.webp') }
$assetId = 0
foreach ($file in $files) {
    $assetId++
    $folder = Split-Path -Leaf (Split-Path -Parent $file.FullName)
    $classification = Get-Classification $folder $file.Name
    $width = $null
    $height = $null
    try {
        $image = [System.Drawing.Image]::FromFile($file.FullName)
        $width = $image.Width
        $height = $image.Height
        $image.Dispose()
    } catch {
        $width = 'unreadable'
        $height = 'unreadable'
    }
    $rows.Add([pscustomobject]@{
        AssetId = ('source-{0:D3}' -f $assetId)
        SourceFolder = $folder
        SourceFile = $file.Name
        RelativePath = (Resolve-Path -LiteralPath $file.FullName -Relative).Replace('.\', '')
        Format = $file.Extension.TrimStart('.').ToLowerInvariant()
        Width = $width
        Height = $height
        CanvasStatus = if ($width -eq 1024 -and $height -eq 1024) { 'square-1024-ready-for-review' } else { 'needs-canvas-normalization' }
        Rarity = $classification.Rarity
        TraitType = $classification.TraitType
        TraitValue = $classification.TraitValue
        TokenId = ''
        ReviewStatus = 'unassigned'
    })
}

$inventoryPath = Join-Path $manifestRoot 'asset-inventory.csv'
$rows | Export-Csv -LiteralPath $inventoryPath -NoTypeInformation -Encoding UTF8

$plan = [ordered]@{
    collection = 'CapyCrew Genesis'
    maxSupply = 10000
    candidateArtworkCount = $rows.Count
    generatedArtworkCount = 0
    generatedMetadataCount = 0
    sourceArtworkRoot = 'source/complete-artworks'
    preparedImageRoot = 'prepared/images'
    preparedMetadataRoot = 'prepared/metadata'
    metadataNaming = '{tokenId}.json, token IDs 1 through 10000'
    tokenIdPolicy = 'Assign IDs only after final artwork selection and review.'
    unresolvedWork = @(
        'Normalize all candidate art to one deployment canvas, preferably 1024x1024.',
        'Decide whether portrait candidates should be cropped or padded; do not silently crop character artwork.',
        'Assign every final artwork a unique token ID.',
        'Generate one image and one metadata JSON file for every token ID 1-10000.',
        'Review unassigned rarity values for Helmets, Skate, Ski-Mask, and Sport-Outfit.',
        'Upload prepared/images and prepared/metadata to durable IPFS pinning before freezing metadata.'
    )
}
$plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $manifestRoot 'collection-plan.json') -Encoding UTF8

Write-Output ("Candidate artworks indexed: {0}" -f $rows.Count)
Write-Output ("Inventory: {0}" -f $inventoryPath)
Write-Output 'No originals were deleted or modified.'
