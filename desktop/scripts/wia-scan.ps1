# Uses Windows Image Acquisition (WIA) — shows the system scan UI (device + preview).
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

try {
  # WIA Automation exposes ShowAcquireImage (not the older ShowAcquire name some samples use).
  # Signature: ShowAcquireImage(WiaDeviceType, WiaImageIntent, WiaImageBias, FormatID, AlwaysSelectDevice, UseCommonUI, CancelError)
  # Returns IImageFile directly (no separate Transfer()).
  $wiaFormatPNG = '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'
  $commonDialog = New-Object -ComObject WIA.CommonDialog
  # ScannerDeviceType (1): UnspecifiedDeviceType (0) can yield “No WIA device of the selected type” on some PCs.
  # AlwaysSelectDevice: lets the user pick the scanner when auto-selection finds nothing or the wrong class.
  $image = $commonDialog.ShowAcquireImage(
    1,    # ScannerDeviceType
    0,    # UnspecifiedIntent
    1,    # MaximizeQuality (WiaImageBias)
    $wiaFormatPNG,
    $true,  # AlwaysSelectDevice — show “Select Device” when needed
    $true,  # UseCommonUI — system scan / preview dialogs
    $false  # CancelError
  )
  if ($null -eq $image) {
    exit 2
  }
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
