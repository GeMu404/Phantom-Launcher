# Phantom Launcher - System Tray Wrapper

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $scriptPath "PhantomServer.exe"
$launcherPath = Join-Path $scriptPath "launcher.html"
$iconPath = Join-Path $scriptPath "phantom.ico"

# --- Process Management ---
$serverProcess = $null

function Start-Server {
    if ($serverProcess -and -not $serverProcess.HasExited) { return }
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $serverPath
    $startInfo.WorkingDirectory = $scriptPath
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.CreateNoWindow = $true
    $startInfo.UseShellExecute = $false
    $serverProcess = [System.Diagnostics.Process]::Start($startInfo)
    try { $serverProcess.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High } catch {}
}

function Stop-Server {
    try { if ($serverProcess -and -not $serverProcess.HasExited) { $serverProcess.Kill() } } catch {}
    Start-Process taskkill -ArgumentList "/F /IM PhantomServer.exe /T" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Process taskkill -ArgumentList "/F /IM node.exe /T" -WindowStyle Hidden -ErrorAction SilentlyContinue
}

function Open-Launcher { Start-Process $launcherPath }

# --- System Tray UI ---
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "Phantom Launcher (Background)"

if (Test-Path $iconPath) {
    try { $notifyIcon.Icon = [System.Drawing.Icon]::new($iconPath) } catch { $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application }
}
else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Visible = $true

# --- Custom Form Menu (Tactical UI via WinForms) ---
# WPF is too unstable in background PS threads. Recreating the Tactical UI using a borderless, owner-drawn WinForms menu.

$menuForm = New-Object System.Windows.Forms.Form
$menuForm.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$menuForm.FormBorderStyle = "None"
$menuForm.ShowInTaskbar = $false
$menuForm.TopMost = $true
$menuForm.BackColor = [System.Drawing.ColorTranslator]::FromHtml("#050505")
$menuForm.Size = New-Object System.Drawing.Size(170, 130)

# Tactical Outline
$menuForm.add_Paint({
        param($evtSender, $e)
        $g = $e.Graphics
        $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#00FFFF"), 2)
    
        # Draw standard outline, we skip true transparency cuts in WinForms to keep it 100% stable, but use styling
        $rect = New-Object System.Drawing.Rectangle(1, 1, 168, 128)
        $g.DrawRectangle($pen, $rect)
    })

function Create-CyberButton($text, $yPos, $action, $isDanger = $false) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $text
    $btn.Location = New-Object System.Drawing.Point(10, $yPos)
    $btn.Size = New-Object System.Drawing.Size(150, 35)
    $btn.FlatStyle = "Flat"
    $btn.FlatAppearance.BorderSize = 0
    $btn.BackColor = [System.Drawing.ColorTranslator]::FromHtml("#050505")
    $btn.ForeColor = if ($isDanger) { [System.Drawing.ColorTranslator]::FromHtml("#FF3366") } else { [System.Drawing.ColorTranslator]::FromHtml("#00FFFF") }
    $btn.Font = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Bold)
    $btn.Cursor = [System.Windows.Forms.Cursors]::Hand

    $btn.add_MouseEnter({ 
            $btn.BackColor = [System.Drawing.ColorTranslator]::FromHtml("#111111")
            $btn.ForeColor = [System.Drawing.ColorTranslator]::FromHtml("#FFFFFF")
        })
    $btn.add_MouseLeave({ 
            $btn.BackColor = [System.Drawing.ColorTranslator]::FromHtml("#050505")
            $btn.ForeColor = if ($isDanger) { [System.Drawing.ColorTranslator]::FromHtml("#FF3366") } else { [System.Drawing.ColorTranslator]::FromHtml("#00FFFF") }
        })
    
    $btn.add_Click($action)
    return $btn
}

$btnLaunch = Create-CyberButton "[ OPEN LAUNCHER ]" 10 { Open-Launcher; $menuForm.Hide() }
$btnRestart = Create-CyberButton "[ RESTART SERVER ]" 48 { Stop-Server; Start-Server; $menuForm.Hide() }
$btnExit = Create-CyberButton "[ SYSTEM EXIT ]" 86 {
    Stop-Server
    $notifyIcon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
} $true

$menuForm.Controls.Add($btnLaunch)
$menuForm.Controls.Add($btnRestart)
$menuForm.Controls.Add($btnExit)

# Hide when clicking outside
$menuForm.add_Deactivate({ $menuForm.Hide() })

$notifyIcon.add_MouseUp({
        param($evtSender, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Right -or $e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
            if ($menuForm.Visible) {
                $menuForm.Hide()
            }
            else {
                $pos = [System.Windows.Forms.Cursor]::Position
                $x = $pos.X - 160
                $y = $pos.Y - 140
            
                # Force placement via explicit boundaries to bypass WinForms point conversion bug
                $menuForm.Left = $x
                $menuForm.Top = $y
            
                $menuForm.Show()
                $menuForm.Activate()
            }
        }
    })

$notifyIcon.add_DoubleClick({ Open-Launcher })

# --- Main Execution ---
Start-Server
[System.Windows.Forms.Application]::Run()
