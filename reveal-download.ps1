[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$Uri
)

$ErrorActionPreference = 'Stop'

try {
  $link = [Uri]$Uri
  if ($link.Scheme -ne 'youtube-downloader' -or $link.Host -ne 'reveal') { exit 1 }

  $targetPath = [Uri]::UnescapeDataString($link.AbsolutePath.TrimStart('/')).Replace('/', '\\')
  $videosPath = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE 'Videos')).TrimEnd('\\')
  $fullPath = [IO.Path]::GetFullPath($targetPath)

  if (-not $fullPath.StartsWith("$videosPath\\", [StringComparison]::OrdinalIgnoreCase)) { exit 1 }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { exit 1 }

  Start-Process -FilePath 'explorer.exe' -ArgumentList "/select,`"$fullPath`""
} catch {
  exit 1
}
