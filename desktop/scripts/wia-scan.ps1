# Uses Windows Image Acquisition (WIA) — shows the system scan UI (device + preview).
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

try {
  $commonDialog = New-Object -ComObject WIA.CommonDialog
  $item = $commonDialog.ShowAcquire()
  if ($null -eq $item) {
    exit 2
  }
  $image = $item.Transfer()
  $dir = Split-Path -Parent $OutputPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $image.SaveFile($OutputPath)
  exit 0
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
