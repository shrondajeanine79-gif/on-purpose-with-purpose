$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$version = & $node -p 'process.versions.node'
if ([version]$version -lt [version]'22.13.0') { throw 'PURPOSE dashboard needs Node.js 22.13 or newer.' }
$localData = Join-Path $projectRoot '.data'
New-Item -ItemType Directory -Force -Path $localData | Out-Null

# Render the existing personal sigil only as the private Windows shortcut icon.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 128,128
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#311042'))
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$font = New-Object System.Drawing.Font 'Georgia',45,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F5F0E1'))
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$sigil = "$([char]0x03BC)$([char]0x00B9)$([char]0x2070)"
$graphics.DrawString($sigil,$font,$brush,(New-Object System.Drawing.RectangleF 0,0,128,128),$format)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $localData 'purpose.ico'
$stream = [System.IO.File]::Create($iconPath)
try { $icon.Save($stream) } finally { $stream.Close(); $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $brush.Dispose(); $format.Dispose() }

$entry = Join-Path $projectRoot 'src\local\dashboard.js'
$launcher = Join-Path $localData 'Start-PURPOSE.vbs'
$command = '"' + $node + '" "' + $entry + '" --open'
$vbs = 'Set shell = CreateObject("WScript.Shell")' + "`r`n" + 'shell.Run "' + $command.Replace('"','""') + '", 0, False'
[System.IO.File]::WriteAllText($launcher, $vbs, [System.Text.Encoding]::Unicode)
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'PURPOSE.lnk'))
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + $launcher + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = $iconPath + ',0'
$shortcut.Description = 'PURPOSE - private workspace for Shronda'
$shortcut.Save()
Write-Host 'PURPOSE shortcut created. Opening your private workspace...'
Start-Process -FilePath $shortcut.TargetPath -ArgumentList $shortcut.Arguments
