# Phantom Launcher - System Tray Wrapper
# Requires .NET Framework (Standard on Windows)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $scriptPath "PhantomServer.exe"
$launcherPath = Join-Path $scriptPath "launcher.html"
$iconPath = Join-Path $scriptPath "phantom.ico" # Use standardized icon

# --- Process Management ---
$serverProcess = $null

function Start-Server {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        return
    }
    # Start server hidden
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $serverPath
    $startInfo.WorkingDirectory = $scriptPath
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.CreateNoWindow = $true
    $startInfo.UseShellExecute = $false
    $serverProcess = [System.Diagnostics.Process]::Start($startInfo)
    
    # Set High Priority for better responsiveness
    try {
        $serverProcess.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
    }
    catch {
        # Ignore if permissions deny this (though it is usually allowed for own processes)
    }
}

function Stop-Server {
    # 1. Try Graceful Kill
    try {
        if ($serverProcess -and -not $serverProcess.HasExited) {
            $serverProcess.Kill()
        }
    }
    catch {}

    # 2. Aggressive Kill (Tree) - Ensures node.exe and child processes die
    # /F = Force, /T = Tree (children), /IM = Image Name
    Start-Process taskkill -ArgumentList "/F /IM PhantomServer.exe /T" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Process taskkill -ArgumentList "/F /IM node.exe /T" -WindowStyle Hidden -ErrorAction SilentlyContinue
}

function Open-Launcher {
    Start-Process $launcherPath
}

# --- System Tray UI ---
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "Phantom Launcher (Background)"

# Try to load icon, font fallback if failed
if (Test-Path $iconPath) {
    try {
        $notifyIcon.Icon = [System.Drawing.Icon]::new($iconPath)
    }
    catch {
        # Fallback if invalid ICO
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application 
    }
}
else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Visible = $true

# Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenu
$menuItemLaunch = $contextMenu.MenuItems.Add("Open Launcher")
$menuItemLaunch.add_Click({ Open-Launcher })

$contextMenu.MenuItems.Add("-")

$menuItemRestart = $contextMenu.MenuItems.Add("Restart Server")
$menuItemRestart.add_Click({ 
        Stop-Server
        Start-Server 
    })

$contextMenu.MenuItems.Add("-")

$menuItemExit = $contextMenu.MenuItems.Add("Exit")
$menuItemExit.add_Click({
        Stop-Server
        $notifyIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    })

$notifyIcon.ContextMenu = $contextMenu

# Double click opens launcher
$notifyIcon.add_DoubleClick({ Open-Launcher })

# --- Main Execution ---
Start-Server
[System.Windows.Forms.Application]::Run()
