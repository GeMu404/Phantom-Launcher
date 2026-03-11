$AUMID = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
$DestDir = "d:\Media\Desktop\Phantom Launcher\tmp"
$WantedName = "launch.lnk"

# Clean up previous tests
if (Test-Path "$DestDir\$WantedName") { Remove-Item "$DestDir\$WantedName" -Force }

$shell = New-Object -ComObject Shell.Application
$appsFolder = $shell.Namespace('shell:AppsFolder')
$app = $appsFolder.ParseName($AUMID)

if ($null -eq $app) { 
    Write-Error "App not found: $AUMID"
    exit 1
}

$destFolder = $shell.Namespace($DestDir)
# CopyHere (4 = no progress dialog, 16 = respond "Yes to All" for overwrite, 1024 = quiet)
$destFolder.CopyHere($app)

# The file will be created with the App's Display Name (e.g. "Calculadora.lnk")
# We need to find it and rename it.
Start-Sleep -Milliseconds 500 # Wait for async disk write
$createdFile = Get-ChildItem "$DestDir\*.lnk" | Where-Object { $_.Name -ne $WantedName } | Select-Object -First 1

if ($createdFile) {
    Rename-Item $createdFile.FullName $WantedName -Force
    Write-Host "Success: Created $WantedName for $AUMID"
}
else {
    Write-Error "Failed to create shortcut"
}
