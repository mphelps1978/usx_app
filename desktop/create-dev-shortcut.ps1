# Creates "USX IC Books (Dev).lnk" on the Windows desktop pointing at local Electron (development).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$electron = Join-Path $root "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electron)) {
    Write-Host "Electron not found. Run: cd usx_app/desktop && npm install"
    exit 1
}
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "USX IC Books (Dev).lnk"
$wsh = New-Object -ComObject WScript.Shell
$s = $wsh.CreateShortcut($shortcutPath)
$s.TargetPath = $electron
$s.Arguments = "`"$root`""
$s.WorkingDirectory = $root
$s.Description = "USX IC Books (run Vite on http://localhost:5173 + API on :3001)"
$s.Save()
Write-Host "Created: $shortcutPath"
