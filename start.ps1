[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments
  exit
}

Set-Location $PSScriptRoot

$revealScript = Join-Path $PSScriptRoot 'reveal-download.ps1'
if (-not (Test-Path -LiteralPath $revealScript)) {
  throw 'O script para mostrar arquivos baixados não foi encontrado.'
}

$protocolKey = 'HKCU:\Software\Classes\youtube-downloader'
New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
Set-Item -Path $protocolKey -Value 'URL:YouTube Downloader Protocol'
New-ItemProperty -Path $protocolKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
Set-Item -Path "$protocolKey\shell\open\command" -Value ('powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" "%1"' -f $revealScript)

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$hostsLines = Get-Content -LiteralPath $hostsPath | Where-Object { $_ -notmatch '(^|\s)youtube\.download(\s|$)' }
$hostsLines += '127.0.0.1 youtube.download'
Set-Content -LiteralPath $hostsPath -Value $hostsLines -Encoding ASCII

docker compose up --build -d

$certificateDirectory = Join-Path $PSScriptRoot '.local-certs'
$rootCertificate = Join-Path $certificateDirectory 'caddy-local-root.crt'
New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

$deadline = (Get-Date).AddSeconds(60)
do {
  docker compose cp 'caddy:/data/caddy/pki/authorities/local/root.crt' $rootCertificate 2>$null
  if (Test-Path -LiteralPath $rootCertificate) { break }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

if (-not (Test-Path -LiteralPath $rootCertificate)) {
  throw 'O certificado local não foi criado pelo Caddy em até 60 segundos.'
}

$certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new($rootCertificate)
$installed = Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $certificate.Thumbprint }
if (-not $installed) {
  Import-Certificate -FilePath $rootCertificate -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
}

Start-Process 'https://youtube.download'
Write-Host 'Pronto: https://youtube.download (HTTP redireciona automaticamente para HTTPS).'
