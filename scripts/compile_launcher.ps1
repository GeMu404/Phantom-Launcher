# scripts/compile_launcher.ps1
# Compiles the C# Launcher into a professional Windows EXE

$outputFile = Join-Path $PWD.Path "phantom_app\Phantom.exe"
$sourceFile = Join-Path $PWD.Path "scripts\Launcher.cs"
$iconPath = Join-Path $PWD.Path "phantom.ico"

if (-not (Test-Path "phantom_app")) { New-Item -ItemType Directory -Path "phantom_app" -Force | Out-Null }
if (-not (Test-Path $sourceFile)) { throw "Source file not found: $sourceFile" }

# Find CSC.EXE
$csc = Get-ChildItem -Path C:\Windows\Microsoft.NET\Framework64\v4.0.30319 -Filter csc.exe | Select-Object -First 1 -ExpandProperty FullName
if (-not $csc) {
    $csc = Get-ChildItem -Path C:\Windows\Microsoft.NET\Framework\v4.0.30319 -Filter csc.exe | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $csc) { throw "CSC.EXE (C# Compiler) not found. Please install .NET Framework 4.5+." }

Write-Host "--- Compiling Native Launcher ---" -ForegroundColor Cyan

$args = @(
    "/target:winexe",
    "/optimize",
    "/out:$outputFile"
)

if (Test-Path $iconPath) {
    $args += "/win32icon:$iconPath"
}

$args += "/reference:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.Data.dll"
$args += $sourceFile

Write-Host "Executing: $csc $args" -ForegroundColor Gray
& $csc $args

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success: $outputFile created." -ForegroundColor Green
} else {
    Write-Host "Compilation failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
