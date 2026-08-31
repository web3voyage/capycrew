param(
    [string]$Source = "C:\Users\BUYPC COMPUTERS\CapyCrew\visuals\capycrew-atelier\01_signature_genesis.png",
    [string]$Output = "C:\Users\BUYPC COMPUTERS\CapyCrew\visuals\capycrew-atelier\capycrew-genesis-og.png"
)

Add-Type -AssemblyName System.Drawing

$canvas = New-Object System.Drawing.Bitmap 1200,630
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#15352C'))

$character = [System.Drawing.Image]::FromFile($Source)
$graphics.DrawImage($character, 610, -30, 660, 660)

$scrim = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 255, 255, 255))
$graphics.FillRectangle($scrim, 0, 0, 575, 630)

$cream = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F6F1E8'))
$gold = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#D8B36A'))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#B9C8BE'))
$headline = [System.Drawing.Font]::new('Arial',82,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$subhead = [System.Drawing.Font]::new('Arial',38,[System.Drawing.FontStyle]::Regular,[System.Drawing.GraphicsUnit]::Pixel)
$label = [System.Drawing.Font]::new('Consolas',22,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)

$graphics.DrawString('CAPYCREW', $headline, $cream, 72, 146)
$graphics.DrawString('MEMBERSHIP', $headline, $cream, 72, 232)
$graphics.DrawString('Mint your seat. Shape the crew.', $subhead, $gold, 76, 344)
$graphics.DrawString('10,000 GENESIS PASSES', $label, $muted, 78, 420)

$linePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D8B36A')),6
$graphics.DrawLine($linePen, 76, 112, 250, 112)

$canvas.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)

$linePen.Dispose()
$headline.Dispose()
$subhead.Dispose()
$label.Dispose()
$cream.Dispose()
$gold.Dispose()
$muted.Dispose()
$scrim.Dispose()
$character.Dispose()
$graphics.Dispose()
$canvas.Dispose()
