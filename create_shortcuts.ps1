$desktopPath = [Environment]::GetFolderPath("Desktop")
$wshShell = New-Object -ComObject WScript.Shell

$botScriptPath = Join-Path (Get-Location).Path "StartDiscordBot.bat"
if (Test-Path $botScriptPath) {
    $botShortcut = $wshShell.CreateShortcut("$desktopPath\Start Antigravity Discord Bot.lnk")
    $botShortcut.TargetPath = $botScriptPath
    $botShortcut.WorkingDirectory = (Get-Location).Path
    $botShortcut.IconLocation = "cmd.exe, 0"
    $botShortcut.Save()
    Write-Host "Discord bot shortcut created."
} else {
    Write-Host "Warning: StartDiscordBot.bat not found at $botScriptPath"
}
