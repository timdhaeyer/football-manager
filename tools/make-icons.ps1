# Generates the app icons from the club logo (dev-time, Windows: uses System.Drawing).
# Source: icons/club-logo-source.png (from the club website). Outputs are committed.
#   pwsh tools/make-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root 'icons'
$src = [System.Drawing.Bitmap]::new((Join-Path $icons 'club-logo-source.png'))

# Bounding box of the crest: opaque, non-white pixels (skips the white rounded tile and margins).
$minX = $src.Width; $minY = $src.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $c = $src.GetPixel($x, $y)
    if ($c.A -gt 200 -and -not ($c.R -gt 230 -and $c.G -gt 230 -and $c.B -gt 230)) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$crop = [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
Write-Host "Crest bounds: $crop"

function New-Canvas([int]$w, [int]$h) {
  $bmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White) # opaque: iOS fills transparency with black
  return @($bmp, $g)
}

# Square icon: crest scaled so its height is $fill of the canvas, centred.
function Save-Icon([int]$size, [double]$fill, [string]$name) {
  $bmp, $g = New-Canvas $size $size
  $scale = ($size * $fill) / [Math]::Max($crop.Width, $crop.Height)
  $w = $crop.Width * $scale; $h = $crop.Height * $scale
  $dest = [System.Drawing.RectangleF]::new(($size - $w) / 2, ($size - $h) / 2, $w, $h)
  $g.DrawImage($src, $dest, [System.Drawing.RectangleF]$crop, [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $icons $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "Wrote icons/$name"
}

Save-Icon 180 0.84 'apple-touch-icon-180.png'
Save-Icon 192 0.84 'icon-192.png'
Save-Icon 512 0.84 'icon-512.png'
Save-Icon 512 0.62 'icon-512-maskable.png' # stays inside the 80% maskable safe zone
Save-Icon 64 0.92 'favicon-64.png'

# Header logo: crest with a small white margin, 2x for retina.
$pad = 6
$hh = 112
$scale = ($hh - 2 * $pad) / $crop.Height
$ww = [int][Math]::Ceiling($crop.Width * $scale + 2 * $pad)
$bmp, $g = New-Canvas $ww $hh
$g.DrawImage($src, [System.Drawing.RectangleF]::new($pad, $pad, $crop.Width * $scale, $crop.Height * $scale), [System.Drawing.RectangleF]$crop, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save((Join-Path $icons 'club-logo.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "Wrote icons/club-logo.png (${ww}x$hh)"

$src.Dispose()
