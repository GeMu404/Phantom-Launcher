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
$dirs = @("phantom_app/system", "phantom_app/system/front")
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
npm run build:exe

# 5. Assemble Final Package
Write-Host "[5/5] Assembling final distribution package..." -ForegroundColor Yellow

# Copy Frontend
Copy-Item -Path "dist/*" -Destination "phantom_app/system/front/" -Recurse -Force

# Copy Core Assets
$coreFiles = @(
    "launcher.html",
    "PhantomTray.ps1",
    "Run.vbs",
    "phantom.ico"
)

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination "phantom_app/system/" -Force
        Write-Host "  Deployed: $file"
    }
}

# Move Executable to system (Retry Logic)
if (Test-Path "phantom_app/PhantomServer.exe") {
    $dest = "phantom_app/system/PhantomServer.exe"
    $maxRetries = 5
    $retryCount = 0
    $moved = $false
    
    while (-not $moved -and $retryCount -lt $maxRetries) {
        try {
            if (Test-Path $dest) {
                Remove-Item -Path $dest -Force -ErrorAction Stop
            }
            Move-Item -Path "phantom_app/PhantomServer.exe" -Destination $dest -Force -ErrorAction Stop
            $moved = $true
            Write-Host "  Deployed: PhantomServer.exe"
        }
        catch {
            Write-Warning "File locked, retrying in 2s... ($($retryCount+1)/$maxRetries)"
            Start-Sleep -Seconds 2
            $retryCount++
        }
    }
    
    if (-not $moved) {
        Write-Error "Failed to move PhantomServer.exe after multiple attempts. Please close any programs using it."
        exit 1
    }
}

# Copy Setup files to root for the installer
if (Test-Path "PhantomSetup.ps1") {
    Copy-Item -Path "PhantomSetup.ps1" -Destination "phantom_app/PhantomSetup.ps1" -Force
    Write-Host "  Deployed: PhantomSetup.ps1"
}

# Compile Setup Wrapper
if (Test-Path "Build-Wrapper.ps1") {
    powershell -ExecutionPolicy Bypass -File "./Build-Wrapper.ps1"
}

# Final Cleanup of temp build files
if (Test-Path "phantom_app/server.js") { Remove-Item "phantom_app/server.js" -Force }

Write-Host "--- Build Complete: phantom_app/ is now organized ---" -ForegroundColor Green
