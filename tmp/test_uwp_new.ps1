$AUMID = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
$DestPath = "d:\Media\Desktop\Phantom Launcher\tmp\launch.lnk"

# Check if app exists
$shell = New-Object -ComObject Shell.Application
$appsFolder = $shell.Namespace('shell:AppsFolder')
$app = $appsFolder.ParseName($AUMID)

if ($null -eq $app) {
    Write-Host "APP_NOT_FOUND"
    exit 0
}

# The only reliable way to create a native link to a Shell Item from PowerShell 
# without PInvoke is to "Link" it via Shell Object or use explorer.exe as a shim.
# BUT, we want it to look EXACTLY like the screenshot.
# The screenshot's Properties show Target: PackageName!AppId.

# Trick: Use a temporary folder to create the shortcut and then move it.
$tempItem = $app.InvokeVerb("Link") # This creates it on the Desktop in most cases.
# No, that's not good.

# Search for what Shortcut.exe does.
# Shortcut.exe /A:AUMID creates these.

# Let's try to use the CLSID approach.
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($DestPath)
$Shortcut.TargetPath = "explorer.exe"
$Shortcut.Arguments = "shell:AppsFolder\$AUMID"
$Shortcut.IconLocation = "shell:AppsFolder\$AUMID" # Pull icon from Shell
$Shortcut.Description = "Modern App Launch Link"
$Shortcut.Save()

Write-Host "CREATED_WITH_EXPLORER_SHIM"
