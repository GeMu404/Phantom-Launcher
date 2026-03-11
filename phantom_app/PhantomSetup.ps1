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
    $installDir = "$env:LOCALAPPDATA\PhantomLauncher"
    $shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PhantomLauncher.lnk"
    
    # Capture script path EARLY for use in functions (avoids null in event handlers)
    $script:SetupPath = $MyInvocation.MyCommand.Path
    $currentDir = Split-Path -Parent $script:SetupPath

    # Check Status
    $isInstalled = Test-Path "$installDir\system\PhantomServer.exe"
    $isRunningFromInstall = ($currentDir.TrimEnd('\') -eq $installDir.TrimEnd('\'))
    
    # --- XAML UI Definition (Sketch-Based Architecture) ---
    [xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Phantom Setup" Height="500" Width="750"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize" WindowStyle="None"
        AllowsTransparency="True" Background="Transparent">
    
    <Window.Resources>
        <Style x:Key="AccentText" TargetType="TextBlock">
            <Setter Property="Foreground" Value="#D4FF58"/>
            <Setter Property="FontFamily" Value="Consolas"/>
            <Setter Property="FontWeight" Value="Bold"/>
        </Style>

        <!-- Octagonal Button Style (All Corners Notched) -->
        <Style x:Key="ModularButton" TargetType="Button">
            <Setter Property="Background" Value="#101010"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="FontFamily" Value="Consolas"/>
            <Setter Property="FontWeight" Value="Bold"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Grid>
                            <Path Name="BtnBorder" Stroke="#D4FF58" StrokeThickness="1.5" Fill="{TemplateBinding Background}" Stretch="Fill">
                                <Path.Data>
                                    <PathGeometry Figures="M 10,0 L 190,0 L 200,10 L 200,35 L 190,45 L 10,45 L 0,35 L 0,10 Z"/>
                                </Path.Data>
                            </Path>
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center">
                                <ContentPresenter.ContentTemplate>
                                    <DataTemplate>
                                        <TextBlock Text="{Binding}" Margin="20,0"/>
                                    </DataTemplate>
                                </ContentPresenter.ContentTemplate>
                            </ContentPresenter>
                        </Grid>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="BtnBorder" Property="Fill" Value="#D4FF58"/>
                                <Setter Property="Foreground" Value="Black"/>
                                <Setter Property="Cursor" Value="Hand"/>
                            </Trigger>
                            <Trigger Property="IsPressed" Value="True">
                                <Setter TargetName="BtnBorder" Property="Fill" Value="White"/>
                                <Setter Property="Foreground" Value="Black"/>
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
                        <Border BorderBrush="#D4FF58" BorderThickness="1" Background="Transparent" Padding="8,4">
                            <TextBlock Text="[X]" Foreground="#D4FF58" FontSize="11" FontFamily="Consolas" FontWeight="Bold"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter Property="Cursor" Value="Hand"/>
                                <Setter Property="Background" Value="#FF4444"/>
                                <Setter Property="BorderBrush" Value="White"/>
                                <Setter Property="Foreground" Value="White"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>

    <Grid>
        <!-- Window Frame (Top-Left & Bottom-Right Notches only) -->
         <Path Stroke="#D4FF58" StrokeThickness="2" Fill="#0A0A0A" Stretch="Fill">
            <Path.Effect>
                <DropShadowEffect Color="#D4FF58" BlurRadius="15" ShadowDepth="0" Opacity="0.15"/>
            </Path.Effect>
            <Path.Data>
                <PathGeometry Figures="M 40,0 L 750,0 L 750,460 L 710,500 L 0,500 L 0,40 Z"/>
            </Path.Data>
        </Path>

        <Grid Margin="20">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <!-- Header -->
            <Grid Grid.Row="0" Name="DragArea" Background="Transparent" Margin="20,10,10,0">
                <TextBlock Text="[ MODULAR_SETUP_V0.9 ]" Style="{StaticResource AccentText}" FontSize="12" HorizontalAlignment="Left" VerticalAlignment="Center"/>
                <Button Name="BtnClose" HorizontalAlignment="Right" VerticalAlignment="Top" Style="{StaticResource CloseButton}"/>
            </Grid>

            <!-- Main Content (Centered) -->
            <Grid Grid.Row="1">
                <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">
                    <TextBlock Text="Phantom Launcher V 0.9" FontSize="32" FontWeight="Bold" Foreground="White" HorizontalAlignment="Center" FontFamily="Segoe UI" Margin="0,0,0,40"/>
                    
                    <TextBlock Name="TxtStatus" Text="READY_TO_INITIALIZE" Foreground="#666666" FontSize="11" FontFamily="Consolas" HorizontalAlignment="Center" Margin="0,0,0,30"/>

                    <Grid Name="PanelActions">
                        <StackPanel Opacity="0.9">
                            <Button Name="BtnInstall" Content="install" Width="300" Height="50" Style="{StaticResource ModularButton}" Visibility="Collapsed" Margin="0,10"/>
                            <Button Name="BtnUpdate" Content="update" Width="300" Height="50" Style="{StaticResource ModularButton}" Visibility="Collapsed" Margin="0,10"/>
                            <Button Name="BtnLaunch" Content="execute" Width="300" Height="50" Style="{StaticResource ModularButton}" Visibility="Collapsed" Margin="0,10"/>
                            <Button Name="BtnUninstall" Content="uninstall" Width="300" Height="50" Style="{StaticResource ModularButton}" Foreground="#FF6666" Margin="0,10"/>
                        </StackPanel>
                    </Grid>

                    <StackPanel Name="PanelSuccess" Visibility="Collapsed">
                        <TextBlock Text="SUCCESS" Style="{StaticResource AccentText}" FontSize="24" HorizontalAlignment="Center" Margin="0,0,0,10"/>
                        <TextBlock Name="TxtSuccessMsg" Text="Protocol Complete." Foreground="#888888" FontFamily="Consolas" HorizontalAlignment="Center" TextAlignment="Center" Margin="0,0,0,30"/>
                        <Button Name="BtnFinish" Content="acknowledge" Width="200" Height="45" Style="{StaticResource ModularButton}"/>
                    </StackPanel>

                    <StackPanel Name="PanelConfirm" Visibility="Collapsed">
                        <TextBlock Text="CONFIRM_ACTION" FontSize="20" Foreground="#FF4444" FontFamily="Consolas" FontWeight="Bold" HorizontalAlignment="Center" Margin="0,0,0,10"/>
                        <TextBlock Name="TxtConfirmMsg" Text="Proceed with destructive operation?" Foreground="#888888" FontFamily="Consolas" HorizontalAlignment="Center" Margin="0,0,0,30"/>
                        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                            <Button Name="BtnConfirmYes" Content="confirm" Width="140" Height="45" Style="{StaticResource ModularButton}" Foreground="#FF4444" Margin="0,0,10,0"/>
                            <Button Name="BtnConfirmNo" Content="cancel" Width="140" Height="45" Style="{StaticResource ModularButton}"/>
                        </StackPanel>
                    </StackPanel>
                </StackPanel>
            </Grid>

            <!-- Footer -->
            <Grid Grid.Row="2" Margin="20,0,20,10">
                <TextBlock Text="made by GeMu404" Foreground="#333333" FontSize="10" FontFamily="Consolas" HorizontalAlignment="Left" VerticalAlignment="Bottom"/>
                <TextBlock Text="PHANTOM_SHELL_INITIALIZER" Foreground="#222222" FontSize="9" FontFamily="Consolas" HorizontalAlignment="Right" VerticalAlignment="Bottom"/>
            </Grid>
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

    # --- Logic ---
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
                    $ps.EndInvoke($handle)
                    if ($ps.Streams.Error.Count -gt 0) { throw $ps.Streams.Error[0].ToString() }
                    if ($script:onSuccess) { & $script:onSuccess }
                }
                catch { Set-Status "ERROR: $_" "#FF0000" }
                finally { $ps.Dispose(); $script:currentTask = $null }
            }
        })

    function Start-Worker($scriptBlock, $argsList, $successAction) {
        $ps = [PowerShell]::Create(); $ps.AddScript($scriptBlock) | Out-Null
        if ($argsList) { foreach ($arg in $argsList) { $ps.AddArgument($arg) | Out-Null } }
        $handle = $ps.BeginInvoke()
        $script:currentTask = @{ Power = $ps; Handle = $handle }; $script:onSuccess = $successAction
        $asyncTimer.Start()
    }

    function Set-Status($msg, $color = "#666666") {
        $txtStatus.Text = $msg
        $txtStatus.Foreground = [System.Windows.Media.BrushConverter]::new().ConvertFromString($color)
        $window.UpdateLayout()
    }
    
    function Show-Success($details) {
        $panelActions.Visibility = "Collapsed"; $panelConfirm.Visibility = "Collapsed"; $panelSuccess.Visibility = "Visible"
        $txtSuccessMsg.Text = $details
    }

    function Show-Confirm($msg) {
        $panelActions.Visibility = "Collapsed"; $panelSuccess.Visibility = "Collapsed"; $panelConfirm.Visibility = "Visible"
        $txtConfirmMsg.Text = $msg
    }

    function Show-Main {
        $panelActions.Visibility = "Visible"; $panelSuccess.Visibility = "Collapsed"; $panelConfirm.Visibility = "Collapsed"
        Set-Status "READY."
    }

    function Force-Kill-Process($name) {
        $procs = Get-CimInstance Win32_Process -Filter "Name = '$name'"
        foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
    }

    function Kill-Processes {
        Set-Status "TERMINATING PROCESSES..." "#D4FF58"
        Force-Kill-Process "PhantomServer.exe"
        Force-Kill-Process "node.exe"
        $psProcs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'"
        foreach ($p in $psProcs) { if ($p.CommandLine -match "PhantomTray") { try { Stop-Process -Id $p.ProcessId -Force } catch {} } }
        Start-Sleep -Seconds 1
    }

    function Create-Shortcut {
        $WshShell = New-Object -ComObject WScript.Shell
        if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force }
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        if (Test-Path "$installDir\system\Run.vbs") { $Shortcut.TargetPath = "$installDir\system\Run.vbs" }
        else { $Shortcut.TargetPath = "powershell.exe"; $Shortcut.Arguments = "-WindowStyle Hidden -Sta -Bypass -File `"$installDir\system\PhantomTray.ps1`"" }
        $Shortcut.WorkingDirectory = "$installDir\system"; $Shortcut.IconLocation = "$installDir\system\PhantomServer.exe,0"; $Shortcut.Save()
    }

    function Start-Install {
        if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
        $sourceSystem = Join-Path $currentDir "system"
        if (-not (Test-Path $sourceSystem)) { $sourceSystem = Join-Path $currentDir "phantom_app\system" }
        if (Test-Path $sourceSystem) {
            Set-Status "DEPLOYING SYSTEM CORE..." "#D4FF58"
            $destSystem = Join-Path $installDir "system"
            if (-not (Test-Path $destSystem)) { New-Item -ItemType Directory -Path $destSystem -Force | Out-Null }
            $sb = { param($src, $dst); Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force | Out-Null }
            Start-Worker $sb @($sourceSystem, $destSystem) {
                Create-Shortcut
                if ($script:SetupPath -and (Test-Path $script:SetupPath)) { Copy-Item -Path $script:SetupPath -Destination "$installDir\PhantomSetup.ps1" -Force }
                Set-Status "SUCCESS." "#00FF00"
                Show-Success "System installed successfully.`nThe launcher is active in your system tray."
            }
        }
    }

    # Event Handlers
    $dragArea.Add_MouseLeftButtonDown({ $window.DragMove() })
    $btnClose.Add_Click({ $window.Close() })
    $btnFinish.Add_Click({
            $window.Close()
            if ($script:isUninstalling) { Start-Process cmd.exe -ArgumentList "/c timeout 2 & rmdir /s /q `"$installDir`"" -WindowStyle Hidden }
            else { if (Test-Path "$installDir\system\Run.vbs") { Start-Process "$installDir\system\Run.vbs" } }
        })
    $btnConfirmNo.Add_Click({ Show-Main })
    $btnConfirmYes.Add_Click({
            Kill-Processes
            Set-Status "PURGING SYSTEM..." "#FF4444"
            $sb = { param($path, $scPath); try { Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "PhantomLauncher" -ErrorAction SilentlyContinue } catch {}
                if (Test-Path $scPath) { Remove-Item $scPath -Force }; if (Test-Path "$path\system") { Remove-Item "$path\system" -Recurse -Force } }
            Start-Worker $sb @($installDir, $shortcutPath) { $script:isUninstalling = $true; Show-Success "System successfully purged.`nClick ACKNOWLEDGE to finish." }
        })
    $btnInstall.Add_Click({ Kill-Processes; Start-Install })
    $btnUpdate.Add_Click({ Kill-Processes; Start-Install })
    $btnLaunch.Add_Click({ if (Test-Path "$installDir\system\Run.vbs") { Start-Process "$installDir\system\Run.vbs" }; $window.Close() })
    $btnUninstall.Add_Click({ Show-Confirm "Completely remove Phantom Launcher?`nSettings and records will be deleted." })

    # State
    if ($isRunningFromInstall) { $txtStatus.Text = "SYSTEM ONLINE"; $btnInstall.Visibility = "Collapsed"; $btnUpdate.Visibility = "Collapsed"; $btnLaunch.Visibility = "Visible" }
    elseif ($isInstalled) { $txtStatus.Text = "UPDATE AVAILABLE"; $btnInstall.Visibility = "Collapsed"; $btnUpdate.Visibility = "Visible"; $btnLaunch.Visibility = "Collapsed" }
    else { $txtStatus.Text = "READY TO INITIALIZE"; $btnInstall.Visibility = "Visible"; $btnUpdate.Visibility = "Collapsed"; $btnLaunch.Visibility = "Collapsed"; $btnUninstall.Visibility = "Collapsed" }

    $window.ShowDialog() | Out-Null
}
catch { Log "FATAL: $_"; try { [System.Windows.MessageBox]::Show("Setup Error: $_", "Phantom Setup", "OK", "Error") } catch {} }
