# Ensure STA Mode for WPF
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    # Re-launch in STA mode
    Start-Process powershell -ArgumentList "-Sta", "-ExecutionPolicy", "Bypass", "-File", $MyInvocation.MyCommand.Path -Verb RunAs
    exit
}

# Debug Logging
$logFile = "$env:TEMP\PhantomSetup_Debug.log"
function Log($msg) {
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File $logFile -Append
}
Log "Starting Setup Script..."

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
    # --- Configuration ---
    $appName = "Phantom Launcher"
    $installDir = "$env:LOCALAPPDATA\PhantomLauncher"
    $shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PhantomLauncher.lnk"
    
    # Capture script path EARLY for use in functions (avoids null in event handlers)
    $script:SetupPath = $MyInvocation.MyCommand.Path
    $currentDir = Split-Path -Parent $script:SetupPath

    # Check Status
    # We check if the server exe exists to confirm installation
    $isInstalled = Test-Path "$installDir\system\PhantomServer.exe"
    # We check if we are RUNNING from the installed location (comparing standardized paths)
    $isRunningFromInstall = ($currentDir.TrimEnd('\') -eq $installDir.TrimEnd('\'))
    
    # --- XAML UI Definition (Cyberpunk Style) ---
    [xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Phantom Setup" Height="500" Width="750"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize" WindowStyle="None"
        AllowsTransparency="True" Background="Transparent">
    
    <Window.Resources>
        <!-- CYBERPUNK BUTTON STYLE -->
        <Style x:Key="CyberButton" TargetType="Button">
            <Setter Property="Background" Value="#111111"/>
            <Setter Property="Foreground" Value="#00FFFF"/>
            <Setter Property="FontFamily" Value="Consolas"/>
            <Setter Property="FontWeight" Value="Bold"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Grid>
                            <!-- Cut Corner Shape - Uses Stretch=Fill to adapt to any size -->
                            <Path Name="BtnBorder" Stroke="#00FFFF" StrokeThickness="1" Fill="{TemplateBinding Background}" Stretch="Fill">
                                <Path.Data>
                                    <PathGeometry Figures="M 10,0 L 190,0 L 200,10 L 200,45 L 10,45 L 0,35 L 0,0 Z"/>
                                </Path.Data>
                                <Path.Effect>
                                    <DropShadowEffect Color="#00FFFF" BlurRadius="5" ShadowDepth="0" Opacity="0.4"/>
                                </Path.Effect>
                            </Path>
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="BtnBorder" Property="Fill" Value="#002222"/>
                                <Setter TargetName="BtnBorder" Property="Effect">
                                    <Setter.Value>
                                        <DropShadowEffect Color="#00FFFF" BlurRadius="10" ShadowDepth="0" Opacity="0.8"/>
                                    </Setter.Value>
                                </Setter>
                                <Setter Property="Cursor" Value="Hand"/>
                            </Trigger>
                            <Trigger Property="IsPressed" Value="True">
                                <Setter TargetName="BtnBorder" Property="Fill" Value="#00FFFF"/>
                                <Setter Property="Foreground" Value="Black"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

         <Style x:Key="CyberDanger" TargetType="Button" BasedOn="{StaticResource CyberButton}">
             <Setter Property="Foreground" Value="#FF3333"/>
             <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Grid>
                           <Path Name="BtnBorder" Stroke="#FF3333" StrokeThickness="1" Fill="#110000" Stretch="Fill">
                                <Path.Data>
                                    <PathGeometry Figures="M 0,0 L 140,0 L 150,10 L 150,40 L 0,40 Z"/>
                                </Path.Data>
                            </Path>
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="BtnBorder" Property="Fill" Value="#330000"/>
                                <Setter TargetName="BtnBorder" Property="Effect">
                                    <Setter.Value>
                                         <DropShadowEffect Color="#FF3333" BlurRadius="8" ShadowDepth="0" Opacity="0.8"/>
                                    </Setter.Value>
                                </Setter>
                                <Setter Property="Cursor" Value="Hand"/>
                            </Trigger>
                         </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
             </Setter>
        </Style>

        <Style x:Key="CloseButton" TargetType="Button">
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <TextBlock Text="[X]" Foreground="#666666" FontSize="16" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter Property="Cursor" Value="Hand"/>
                                <Setter Property="Foreground" Value="White"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>

    <!-- Main Window Shape -->
     <Grid>
         <Path Stroke="#00FFFF" StrokeThickness="1" Fill="#050505" Stretch="Fill">
            <Path.Effect>
                <DropShadowEffect Color="#00FFFF" BlurRadius="15" ShadowDepth="0" Opacity="0.3"/>
            </Path.Effect>
            <Path.Data>
                <PathGeometry Figures="M 30,0 L 720,0 L 750,30 L 750,500 L 30,500 L 0,470 L 0,0 Z"/>
            </Path.Data>
        </Path>

        <Grid Margin="15">
            <Grid.RowDefinitions>
                <RowDefinition Height="50"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="40"/>
            </Grid.RowDefinitions>

            <!-- Header / Drag Bar -->
            <Grid Grid.Row="0" Background="Transparent" Name="DragArea">
                 <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="50"/>
                </Grid.ColumnDefinitions>
                <TextBlock Text=">> SYSTEM_SETUP_V2.0" Foreground="#00FFFF" VerticalAlignment="Center" HorizontalAlignment="Left" Margin="25,0,0,0" FontFamily="Consolas" FontSize="16" IsHitTestVisible="False">
                    <TextBlock.Effect>
                        <DropShadowEffect Color="#00FFFF" BlurRadius="5" ShadowDepth="0" Opacity="0.6"/>
                    </TextBlock.Effect>
                </TextBlock>
                <Button Grid.Column="1" Name="BtnClose" Width="40" Height="40" HorizontalAlignment="Right" Margin="0,0,15,0" Style="{StaticResource CloseButton}"/>
            </Grid>

            <!-- Main Content -->
            <StackPanel Grid.Row="1" VerticalAlignment="Center" HorizontalAlignment="Center">
                <TextBlock Text="PHANTOM" FontSize="60" FontWeight="Bold" Foreground="White" HorizontalAlignment="Center" FontFamily="Segoe UI Black"/>
                <TextBlock Text="LAUNCHER // OS" FontSize="20" FontWeight="Normal" Foreground="#00FFFF" HorizontalAlignment="Right" Margin="0,-10,10,30" FontFamily="Consolas"/>
                
                <TextBlock Name="TxtStatus" Text="WAITING FOR COMMAND..." Foreground="#888888" HorizontalAlignment="Center" Margin="0,0,0,30" TextWrapping="Wrap" TextAlignment="Center" MaxWidth="500" FontFamily="Consolas"/>

                <!-- Action Buttons Container -->
                <StackPanel Name="PanelActions" Orientation="Vertical" HorizontalAlignment="Center" Width="200">
                    <Button Name="BtnInstall" Content="INITIALIZE SYSTEM" Height="45" Style="{StaticResource CyberButton}" Visibility="Collapsed" Margin="0,5"/>
                    <Button Name="BtnUpdate" Content="UPDATE SYSTEM" Height="45" Style="{StaticResource CyberButton}" Visibility="Collapsed" Margin="0,5"/>
                    <Button Name="BtnLaunch" Content="EXECUTE ENTRY" Height="45" Style="{StaticResource CyberButton}" Visibility="Collapsed" Margin="0,5"/>
                    
                    <Button Name="BtnUninstall" Content="PURGE SYSTEM" Height="40" Style="{StaticResource CyberDanger}" Visibility="Visible" Margin="0,20,0,0"/>
                </StackPanel>

                <!-- Success/Feedback Panel (Initially Collapsed) -->
                <StackPanel Name="PanelSuccess" Orientation="Vertical" HorizontalAlignment="Center" Width="400" Visibility="Collapsed">
                    <TextBlock Text="OPERATION COMPLETE" FontSize="20" FontWeight="Bold" Foreground="#00FF00" HorizontalAlignment="Center" Margin="0,0,0,10" FontFamily="Consolas"/>
                    <TextBlock Name="TxtSuccessMsg" Text="System installed successfully." FontSize="14" Foreground="#CCCCCC" HorizontalAlignment="Center" TextAlignment="Center" TextWrapping="Wrap" Margin="0,0,0,20" FontFamily="Consolas"/>
                    <TextBlock Text=">> The system tray icon is now active." FontSize="12" Foreground="#00FFFF" HorizontalAlignment="Center" Margin="0,0,0,30" FontFamily="Consolas"/>
                    
                    <Button Name="BtnFinish" Content="ACKNOWLEDGE" Height="45" Style="{StaticResource CyberButton}"/>
                </StackPanel>

                <!-- Confirmation Panel (Initially Collapsed) -->
                <StackPanel Name="PanelConfirm" Orientation="Vertical" HorizontalAlignment="Center" Width="400" Visibility="Collapsed">
                    <TextBlock Text="WARNING: PERMANENT ACTION" FontSize="18" FontWeight="Bold" Foreground="#FF3333" HorizontalAlignment="Center" Margin="0,0,0,10" FontFamily="Consolas"/>
                    <TextBlock Name="TxtConfirmMsg" Text="Are you sure you want to proceed?" FontSize="14" Foreground="#CCCCCC" HorizontalAlignment="Center" TextAlignment="Center" TextWrapping="Wrap" Margin="0,0,0,20" FontFamily="Consolas"/>
                    
                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                        <Button Name="BtnConfirmYes" Content="CONFIRM" Width="120" Height="40" Style="{StaticResource CyberDanger}" Margin="0,0,10,0"/>
                        <Button Name="BtnConfirmNo" Content="CANCEL" Width="120" Height="40" Style="{StaticResource CyberButton}" Margin="10,0,0,0"/>
                    </StackPanel>
                </StackPanel>


            </StackPanel>

            <!-- Footer -->
            <TextBlock Grid.Row="2" Text="SECURE CONNECTION ESTABLISHED" Foreground="#222222" VerticalAlignment="Center" HorizontalAlignment="Center" FontSize="10" FontFamily="Consolas"/>
        </Grid>
    </Grid>
</Window>
"@

    # --- WPF Helper ---
    $reader = (New-Object System.Xml.XmlNodeReader $xaml)
    $window = [Windows.Markup.XamlReader]::Load($reader)

    # Connect Controls
    $dragArea = $window.FindName("DragArea")
    $btnClose = $window.FindName("BtnClose")
    $txtStatus = $window.FindName("TxtStatus")
    $btnInstall = $window.FindName("BtnInstall")
    $btnUpdate = $window.FindName("BtnUpdate")
    $btnLaunch = $window.FindName("BtnLaunch")
    $btnUninstall = $window.FindName("BtnUninstall")
    
    $panelActions = $window.FindName("PanelActions")
    $panelSuccess = $window.FindName("PanelSuccess")
    $txtSuccessMsg = $window.FindName("TxtSuccessMsg")
    $btnFinish = $window.FindName("BtnFinish")

    $panelConfirm = $window.FindName("PanelConfirm")
    $txtConfirmMsg = $window.FindName("TxtConfirmMsg")
    $btnConfirmYes = $window.FindName("BtnConfirmYes")
    $btnConfirmNo = $window.FindName("BtnConfirmNo")
    
    $script:isUninstalling = $false

    # --- Logic Functions ---

    # --- Async Logic (DispatcherTimer) ---
    # True non-blocking approach. No Wait loops.
    $asyncTimer = New-Object System.Windows.Threading.DispatcherTimer
    $asyncTimer.Interval = [TimeSpan]::FromMilliseconds(100)
    $script:currentTask = $null
    $script:onSuccess = $null

    $asyncTimer.Add_Tick({
            if ($script:currentTask -and $script:currentTask.Handle.IsCompleted) {
                $asyncTimer.Stop()
                $ps = $script:currentTask.Power
                $handle = $script:currentTask.Handle
            
                try {
                    $ps.EndInvoke($handle) # Check for exceptions
                
                    # Check stream errors
                    if ($ps.Streams.Error.Count -gt 0) {
                        throw $ps.Streams.Error[0].ToString()
                    }
                
                    # Run Success Callback
                    if ($script:onSuccess) { & $script:onSuccess }
                }
                catch {
                    Set-Status "ERROR: $_" "#FF0000"
                }
                finally {
                    $ps.Dispose()
                    $script:currentTask = $null
                }
            }
        })

    function Start-Worker($scriptBlock, $argsList, $successAction) {
        $ps = [PowerShell]::Create()
        $ps.AddScript($scriptBlock) | Out-Null
        
        # CORRECT ARGUMENT PASSING (Fixes path concatenation bug)
        if ($argsList) {
            foreach ($arg in $argsList) {
                $ps.AddArgument($arg) | Out-Null
            }
        }
        
        $handle = $ps.BeginInvoke()
        
        $script:currentTask = @{ Power = $ps; Handle = $handle }
        $script:onSuccess = $successAction
        $asyncTimer.Start()
    }

    function Set-Status($msg, $color = "#CCCCCC") {
        $txtStatus.Text = $msg
        $txtStatus.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString($color)
        $window.UpdateLayout() # Force refresh
    }
    
    function Show-Success($details) {
        $panelActions.Visibility = "Collapsed"
        $panelConfirm.Visibility = "Collapsed"
        $panelSuccess.Visibility = "Visible"
        $txtStatus.Visibility = "Collapsed" 
        $txtSuccessMsg.Text = $details
    }

    function Show-Confirm($msg) {
        $panelActions.Visibility = "Collapsed"
        $panelSuccess.Visibility = "Collapsed"
        $panelConfirm.Visibility = "Visible"
        $txtConfirmMsg.Text = $msg
    }

    function Show-Main {
        $panelActions.Visibility = "Visible"
        $panelSuccess.Visibility = "Collapsed"
        $panelConfirm.Visibility = "Collapsed"
        $txtStatus.Visibility = "Visible"
        Set-Status "READY."
    }

    function Force-Kill-Process($name) {
        # WMI to find process and children, works better than Stop-Process for stubborn tasks
        $procs = Get-CimInstance Win32_Process -Filter "Name = '$name'"
        foreach ($p in $procs) {
            try { 
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue 
            }
            catch {}
        }
    }

    function Kill-Processes {
        Set-Status "TERMINATING ACTIVE PROCESSES..." "#FFFF00"
        Start-Sleep -Milliseconds 200
    
        # 1. Standard Kill
        Force-Kill-Process "PhantomServer.exe"
        Force-Kill-Process "node.exe"
    
        # 2. Kill PowerShell Tray Script (Regex match on command line)
        $psProcs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'"
        foreach ($p in $psProcs) {
            if ($p.CommandLine -match "PhantomTray") {
                try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    
        Start-Sleep -Seconds 1
    }

    function Create-Shortcut {
        $WshShell = New-Object -ComObject WScript.Shell
        if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force }
    
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        # Target Run.vbs for silent startup
        if (Test-Path "$installDir\system\Run.vbs") {
            $Shortcut.TargetPath = "$installDir\system\Run.vbs"
        }
        else {
            $Shortcut.TargetPath = "powershell.exe"
            $Shortcut.Arguments = "-WindowStyle Hidden -Sta -ExecutionPolicy Bypass -File `"$installDir\system\PhantomTray.ps1`""
        }
    
        $Shortcut.WorkingDirectory = "$installDir\system"
        $Shortcut.IconLocation = "$installDir\system\PhantomServer.exe,0"
        $Shortcut.Save()
    }

    function Do-Events {
        [System.Windows.Forms.Application]::DoEvents()
    }

    function Start-Install {
        if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
    
        $sourceSystem = Join-Path $currentDir "system"
        if (-not (Test-Path $sourceSystem)) { $sourceSystem = Join-Path $currentDir "phantom_app\system" }

        if (Test-Path $sourceSystem) {
            Set-Status "INSTALLING CORE SYSTEM..." "#00FFFF"
            
            $destSystem = Join-Path $installDir "system"
            if (-not (Test-Path $destSystem)) { New-Item -ItemType Directory -Path $destSystem -Force | Out-Null }
            
            # WORKER SCRIPT
            $sb = {
                param($src, $dst)
                Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force | Out-Null
            }
            
            # START ASYNC
            Start-Worker $sb @($sourceSystem, $destSystem) {
                # ON SUCCESS
                Set-Status "REGISTERING STARTUP..." "#00FFFF"
                Create-Shortcut
                
                # Copy Self (Fast enough to do sync)
                if ($script:SetupPath -and (Test-Path $script:SetupPath)) {
                    Copy-Item -Path $script:SetupPath -Destination "$installDir\PhantomSetup.ps1" -Force
                }
                
                Set-Status "SYSTEM READY." "#00FF00"
                Show-Success "System installed successfully.`n`nThe 'Phantom Launcher' service is now running in your system tray (bottom right icon)."
            }
        }
        else {
            Set-Status "ERROR: Source system files missing." "#FF0000"
        }
    }

    # --- Event Handlers ---

    $dragArea.Add_MouseLeftButtonDown({
            $window.DragMove()
        })

    $btnClose.Add_Click({
            $window.Close()
        })
        
    $btnFinish.Add_Click({
            $window.Close()
        
            if ($script:isUninstalling) {
                # Final Self-Destruct
                Start-Process cmd.exe -ArgumentList "/c timeout 2 & rmdir /s /q `"$installDir`"" -WindowStyle Hidden
            }
            else {
                # Launch only if we are in install/update mode (standard flow)
                if ($btnInstall.Visibility -eq "Visible" -or $btnUpdate.Visibility -eq "Visible") {
                    if (Test-Path "$installDir\system\Run.vbs") {
                        Start-Process "$installDir\system\Run.vbs"
                    }
                }
            }
        })

    # --- Confirm Dialog Actions ---
    $btnConfirmNo.Add_Click({ Show-Main })
    
    $btnConfirmYes.Add_Click({
            # UNINSTALL LOGIC
            try {
                Kill-Processes
                Set-Status "REMOVING REGISTRY..." "#FF3333"
             
                # WORKER SCRIPT
                $sb = {
                    param($path, $scPath)
                    
                    # 1. Registry
                    try { Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "PhantomLauncher" -ErrorAction SilentlyContinue } catch {}
                    Start-Sleep -Milliseconds 500
                
                    # 2. Shortcut
                    if (Test-Path $scPath) { Remove-Item $scPath -Force -ErrorAction SilentlyContinue }
                    Start-Sleep -Milliseconds 500
                
                    # 3. Files
                    if (Test-Path "$path\system") { Remove-Item "$path\system" -Recurse -Force -ErrorAction SilentlyContinue }
                }
             
                # START ASYNC
                Start-Worker $sb @($installDir, $shortcutPath) {
                    Set-Status "CLEANING UP..." "#FF3333"
                    $script:isUninstalling = $true
                    Show-Success "System has been uninstalled.`n`nStartup entries and services have been removed.`nClick ACKNOWLEDGE to finish."
                }
            }
            catch {
                Set-Status "ERROR: $_" "#FF0000"
            }
        })

    $btnInstall.Add_Click({
            try {
                Kill-Processes
                Set-Status "INITIALIZING INSTALLATION..." "#00FFFF"
                Start-Install
            }
            catch {
                Set-Status "ERROR: $_" "#FF0000"
            }
        })
        
    $btnUpdate.Add_Click({
            Kill-Processes
            Set-Status "UPDATING CORE FILES..." "#00FFFF"
            Start-Install
        })

    $btnLaunch.Add_Click({
            Start-Process "$installDir\system\Run.vbs"
            $window.Close()
        })

    $btnUninstall.Add_Click({
            Show-Confirm "This will completely remove Phantom Launcher from your system.`n`nFiles and settings will be deleted."
        })

    # --- State Logic ---
    # Logic: "Purge" button should ALWAYS be visible if installed.

    if ($isRunningFromInstall) {
        # Management Mode
        $txtStatus.Text = "SYSTEM ONLINE :: READY"
        $btnInstall.Visibility = "Collapsed"
        $btnUpdate.Visibility = "Collapsed"
        $btnLaunch.Visibility = "Visible"
        # Uninstall is already Visible by default in XAML, but let's confirm
        $btnUninstall.Visibility = "Visible"
    }
    elseif ($isInstalled) {
        # Update Mode
        $txtStatus.Text = "UPDATE AVAILABLE"
        $btnInstall.Visibility = "Collapsed"
        $btnUpdate.Visibility = "Visible"
        $btnLaunch.Visibility = "Collapsed"
        $btnUninstall.Visibility = "Visible"
    }
    else {
        # Install Mode
        $txtStatus.Text = "READY TO INITIALIZE"
        $btnInstall.Visibility = "Visible"
        $btnUpdate.Visibility = "Collapsed"
        $btnLaunch.Visibility = "Collapsed"
        $btnUninstall.Visibility = "Collapsed"
    }

    # --- Block Console ---
    $window.ShowDialog() | Out-Null
}
catch {
    Log "FATAL ERROR: $_"
    try { [System.Windows.MessageBox]::Show("Setup Error: $_", "Phantom Setup", "OK", "Error") } catch {}
}
