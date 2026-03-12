# build.ps1
# Clean and organized build for Phantom Launcher

$ErrorActionPreference = "Stop"

Write-Host "--- Starting Clean Build ---" -ForegroundColor Cyan

# 1. Cleanup
Write-Host "[1/5] Cleaning old artifacts..." -ForegroundColor Yellow
if (Test-Path "phantom_app") {
    # Delete everything except .env to not lose credentials, but clean "the caga"
    Get-ChildItem -Path "phantom_app" -Exclude ".env" | Remove-Item -Recurse -Force
    Write-Host "  Cleared: phantom_app/ (except .env)"
}
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "  Removed: dist/"
}

# 2. Recreate structure
Write-Host "[2/5] Initializing directory structure..." -ForegroundColor Yellow
$dirs = @("phantom_app", "phantom_app/front")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir"
    }
}

# 3. Build Frontend
Write-Host "[3/5] Compiling Frontend..." -ForegroundColor Yellow
npm run build:front
if (-not (Test-Path "dist")) { throw "Frontend build failed: 'dist' folder not found." }

# 4. Build Server & Executable
Write-Host "[4/5] Compiling Server & Packaging EXE..." -ForegroundColor Yellow
npm run build:server
if ($LASTEXITCODE -ne 0) { throw "npm run build:server failed with exit code $LASTEXITCODE." }

npm run build:exe
if ($LASTEXITCODE -ne 0) { throw "npm run build:exe failed with exit code $LASTEXITCODE." }

if (-not (Test-Path "phantom_app/PhantomServer.exe")) {
    Write-Host "Contents of phantom_app:" -ForegroundColor Yellow
    ls phantom_app | Out-String | Write-Host
    throw "Fatal: PhantomServer.exe was not generated."
}

# 5. Assemble Final Package
Write-Host "[5/5] Assembling final distribution package..." -ForegroundColor Yellow

# Copy Frontend
Copy-Item -Path "dist/*" -Destination "phantom_app/front/" -Recurse -Force

# Set up Production Modules for Node SEA Runtime
Write-Host "  -> Installing Production Dependencies..." -ForegroundColor Cyan
Copy-Item package.json, package-lock.json "phantom_app\"
$sysPath = Join-Path $PWD.Path "phantom_app"
$npmArgs = @("ci", "--omit=dev", "--prefix", "`"$sysPath`"")
Start-Process "npm.cmd" -ArgumentList $npmArgs -Wait -NoNewWindow
Remove-Item "phantom_app\package.json", "phantom_app\package-lock.json" -Force

# Compile Native Launcher (Replaces VBS/PowerShell)
powershell -ExecutionPolicy Bypass -File "./scripts/compile_launcher.ps1"

# Copy Core Assets
$coreFiles = @(
    "launcher.html",
    "phantom.ico"
)

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination "phantom_app/" -Force
        Write-Host "  Deployed: $file"
    }
}

# PhantomServer.exe is already generated in phantom_app by npm run build:exe, so we just verify it exists.
if (Test-Path "phantom_app/PhantomServer.exe") {
    Write-Host "  Deployed: PhantomServer.exe"
} else {
    Write-Error "Failed to find PhantomServer.exe in phantom_app. Build likely failed."
    exit 1
}

# 5.5 Create Payload Zip
Write-Host "  -> Compacting Payload into a single archive..." -ForegroundColor Cyan
if (Test-Path "phantom_app/server.js") { Remove-Item "phantom_app/server.js" -Force }
if (Test-Path "phantom_app/server.cjs") { Remove-Item "phantom_app/server.cjs" -Force }
if (Test-Path "phantom_app/sea-prep.blob") { Remove-Item "phantom_app/sea-prep.blob" -Force }

node -e "const AdmZip = require('adm-zip'); const zip = new AdmZip(); zip.addLocalFolder('phantom_app'); zip.writeZip('payload.zip');"
Write-Host "  -> Payload generated." -ForegroundColor Green

# Clean phantom_app so ONLY Setup.exe will remain
Get-ChildItem -Path "phantom_app" -Exclude ".env" | Remove-Item -Recurse -Force

# Compile Setup Wrapper (This embeds payload.zip)
if (Test-Path "Build-Wrapper.ps1") {
    powershell -ExecutionPolicy Bypass -File "./Build-Wrapper.ps1"
}

# Cleanup payload.zip
if (Test-Path "payload.zip") { Remove-Item "payload.zip" -Force }

Write-Host "--- Build Complete: phantom_app/Setup.exe is your SINGLE FILE INSTALLER ---" -ForegroundColor Green
