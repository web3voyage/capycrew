param(
    [string]$AssetsDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'),
    [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'output\capycrew-numbered'),
    [int]$CanvasSize = 1200,
    [int]$JpegQuality = 94
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundedPath {
    param([System.Drawing.RectangleF]$Rectangle, [float]$Radius)
    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($Rectangle.Left, $Rectangle.Top, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Top, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.Left, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Save-Jpeg {
    param([System.Drawing.Image]$Image, [string]$Path, [long]$Quality)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid } |
        Select-Object -First 1
    $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
    $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
        [System.Drawing.Imaging.Encoder]::Quality,
        $Quality
    )
    try {
        $Image.Save($Path, $codec, $parameters)
    }
    finally {
        $parameters.Dispose()
    }
}

function Get-ConceptInfo {
    param([string]$Name)
    switch -Regex ($Name) {
        'desert_nomad'       { return @{ Title = 'Desert Nomad'; Outfit = 'Tactical Nomad'; Category = 'Adventure' } }
        'dressed_as_skater'  { return @{ Title = 'Deck District'; Outfit = 'Skater'; Category = 'Street' } }
        'graffiti_artist'    { return @{ Title = 'Graffiti Courier'; Outfit = 'Graffiti Artist'; Category = 'Creative' } }
        'captain_hat'        { return @{ Title = 'Captain Capy'; Outfit = 'Captain'; Category = 'Nautical' } }
        'gorpcore'           { return @{ Title = 'Alpine Gorpcore'; Outfit = 'Gorpcore'; Category = 'Outdoor' } }
        'maritime_uniform'   { return @{ Title = 'Harbor Authority'; Outfit = 'Maritime Uniform'; Category = 'Nautical' } }
        'nautical_outfit'    { return @{ Title = 'Coastal Crew'; Outfit = 'Nautical'; Category = 'Nautical' } }
        'puffer_jacket'      { return @{ Title = 'Cloud Puffer'; Outfit = 'Puffer Jacket'; Category = 'Winter' } }
        'skater_outfit'      { return @{ Title = 'Street Session'; Outfit = 'Skater Outfit'; Category = 'Street' } }
        'wearing_streetwear' { return @{ Title = 'Block Party'; Outfit = 'Streetwear'; Category = 'Street' } }
        'tactical_outfit'    { return @{ Title = 'Utility Marshal'; Outfit = 'Tactical'; Category = 'Utility' } }
        'techwear_attire'    { return @{ Title = 'Noir Circuit'; Outfit = 'Techwear'; Category = 'Utility' } }
        'trendy_streetwear_2K' { return @{ Title = 'Signature Street'; Outfit = 'Trendy Streetwear'; Category = 'Signature' } }
        'urban_streetwear'   { return @{ Title = 'City Signal'; Outfit = 'Urban Streetwear'; Category = 'Street' } }
        'varsity_jacket'     { return @{ Title = 'Varsity Captain'; Outfit = 'Varsity Jacket'; Category = 'Collegiate' } }
        'winter_outfit'      { return @{ Title = 'Winter Crew'; Outfit = 'Winter Outfit'; Category = 'Winter' } }
        default              { return @{ Title = 'CapyCrew Member'; Outfit = 'Unknown'; Category = 'Unclassified' } }
    }
}

$imageDirectory = Join-Path $OutputDirectory 'images'
$metadataDirectory = Join-Path $OutputDirectory 'metadata'
New-Item -ItemType Directory -Force -Path $imageDirectory, $metadataDirectory | Out-Null

$assets = Get-ChildItem -LiteralPath $AssetsDirectory -File -Filter '*.jpeg' |
    Where-Object { $_.Name -notmatch 'trendy_streetwear_202608191116\.jpeg$' } |
    Sort-Object Name

if ($assets.Count -eq 0) {
    throw 'No JPEG assets found.'
}

$manifest = [System.Collections.Generic.List[object]]::new()
$metadataObjects = [System.Collections.Generic.List[object]]::new()

$brandFont = [System.Drawing.Font]::new('Arial', 43, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$serialFont = [System.Drawing.Font]::new('Consolas', 39, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brandBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F8F4EA'))
$serialBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#121417'))
$plateBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(232, 18, 20, 23))
$serialPlateBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F4C84A'))
$plateBorder = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#F8F4EA'), 3)

try {
    for ($index = 0; $index -lt $assets.Count; $index++) {
        $asset = $assets[$index]
        $tokenId = $index + 1
        $serial = '#{0:D4}' -f $tokenId
        $tokenName = 'CapyCrew {0}' -f $serial
        $outputName = '{0:D4}.jpg' -f $tokenId
        $outputPath = Join-Path $imageDirectory $outputName
        $info = Get-ConceptInfo -Name $asset.Name

        $source = [System.Drawing.Image]::FromFile($asset.FullName)
        $canvas = [System.Drawing.Bitmap]::new($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
            $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#15181D'))

            $available = $CanvasSize - 72
            $scale = [Math]::Min($available / $source.Width, $available / $source.Height)
            $drawWidth = [int][Math]::Round($source.Width * $scale)
            $drawHeight = [int][Math]::Round($source.Height * $scale)
            $drawX = [int](($CanvasSize - $drawWidth) / 2)
            $drawY = [int](($CanvasSize - $drawHeight) / 2)
            $graphics.DrawImage($source, $drawX, $drawY, $drawWidth, $drawHeight)

            $brandRect = [System.Drawing.RectangleF]::new(42, 42, 330, 76)
            $serialRect = [System.Drawing.RectangleF]::new($CanvasSize - 238, 42, 196, 76)
            $brandPath = New-RoundedPath -Rectangle $brandRect -Radius 14
            $serialPath = New-RoundedPath -Rectangle $serialRect -Radius 14
            try {
                $graphics.FillPath($plateBrush, $brandPath)
                $graphics.DrawPath($plateBorder, $brandPath)
                $graphics.FillPath($serialPlateBrush, $serialPath)
                $graphics.DrawPath($plateBorder, $serialPath)

                $center = [System.Drawing.StringFormat]::new()
                try {
                    $center.Alignment = [System.Drawing.StringAlignment]::Center
                    $center.LineAlignment = [System.Drawing.StringAlignment]::Center
                    $graphics.DrawString('CAPYCREW', $brandFont, $brandBrush, $brandRect, $center)
                    $graphics.DrawString($serial, $serialFont, $serialBrush, $serialRect, $center)
                }
                finally {
                    $center.Dispose()
                }
            }
            finally {
                $brandPath.Dispose()
                $serialPath.Dispose()
            }

            Save-Jpeg -Image $canvas -Path $outputPath -Quality $JpegQuality
        }
        finally {
            $graphics.Dispose()
            $canvas.Dispose()
            $source.Dispose()
        }

        $metadata = [ordered]@{
            name = $tokenName
            description = 'A numbered CapyCrew collectible featuring the {0} design.' -f $info.Title
            image = 'ipfs://REPLACE_WITH_IMAGE_CID/{0}' -f $outputName
            external_url = 'https://capycrew.example/token/{0}' -f $tokenId
            attributes = @(
                [ordered]@{ trait_type = 'Design'; value = $info.Title }
                [ordered]@{ trait_type = 'Outfit'; value = $info.Outfit }
                [ordered]@{ trait_type = 'Category'; value = $info.Category }
                [ordered]@{ trait_type = 'Brand'; value = 'CAPYCREW' }
                [ordered]@{ trait_type = 'Token Number'; value = $tokenId; display_type = 'number' }
            )
            source_asset = $asset.Name
        }
        $metadataPath = Join-Path $metadataDirectory ('{0:D4}.json' -f $tokenId)
        $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding utf8
        $metadataObjects.Add($metadata)

        $manifest.Add([pscustomobject]@{
            token_id = $tokenId
            token_number = $serial
            name = $tokenName
            design = $info.Title
            outfit = $info.Outfit
            category = $info.Category
            source_asset = $asset.Name
            image_file = "images/$outputName"
            metadata_file = ('metadata/{0:D4}.json' -f $tokenId)
        })
    }

    $manifest | Export-Csv -LiteralPath (Join-Path $OutputDirectory 'manifest.csv') -NoTypeInformation -Encoding utf8
    $collection = [ordered]@{
        name = 'CapyCrew Numbered Collection'
        symbol = 'CAPY'
        description = 'A curated numbered collection created from the unique CapyCrew artwork assets.'
        total_supply = $assets.Count
        token_range = '#0001-#{0:D4}' -f $assets.Count
        image_format = 'JPEG'
        image_size = "${CanvasSize}x${CanvasSize}"
        metadata_standard = 'OpenSea-compatible attributes'
        ipfs_note = 'Replace REPLACE_WITH_IMAGE_CID after uploading the images directory to IPFS.'
    }
    $collection | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'collection.json') -Encoding utf8

    $cellSize = 300
    $columns = 4
    $rows = [int][Math]::Ceiling($assets.Count / $columns)
    $sheet = [System.Drawing.Bitmap]::new($columns * $cellSize, $rows * $cellSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $sheetGraphics = [System.Drawing.Graphics]::FromImage($sheet)
    try {
        $sheetGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#101216'))
        $sheetGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        for ($index = 0; $index -lt $assets.Count; $index++) {
            $imagePath = Join-Path $imageDirectory ('{0:D4}.jpg' -f ($index + 1))
            $image = [System.Drawing.Image]::FromFile($imagePath)
            try {
                $x = ($index % $columns) * $cellSize
                $y = [int]($index / $columns) * $cellSize
                $sheetGraphics.DrawImage($image, $x, $y, $cellSize, $cellSize)
            }
            finally {
                $image.Dispose()
            }
        }
        Save-Jpeg -Image $sheet -Path (Join-Path $OutputDirectory 'contact-sheet.jpg') -Quality 91
    }
    finally {
        $sheetGraphics.Dispose()
        $sheet.Dispose()
    }
}
finally {
    $plateBorder.Dispose()
    $plateBrush.Dispose()
    $serialPlateBrush.Dispose()
    $brandBrush.Dispose()
    $serialBrush.Dispose()
    $brandFont.Dispose()
    $serialFont.Dispose()
}

Write-Output ('Processed {0} unique CapyCrew assets.' -f $assets.Count)
Write-Output ('Output: {0}' -f $OutputDirectory)
