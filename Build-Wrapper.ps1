# Build-Wrapper.ps1
# Compiles a C# wrapper into a stealth EXE for the installer.

$outputFile = "phantom_app\Setup.exe"
$iconFile = "phantom_app\PhantomServer.exe" # We try to extract icon or just use standard if hard

# Ensure output directory exists (it should be created by npm run dist)
if (-not (Test-Path "phantom_app")) { New-Item -ItemType Directory -Path "phantom_app" -Force | Out-Null }

$code = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("Phantom Launcher Setup")]
[assembly: AssemblyProduct("Phantom Launcher")]
[assembly: AssemblyVersion("2.0.0.0")]
[assembly: AssemblyFileVersion("2.0.0.0")]

namespace PhantomLauncher
{
    class Wrapper
    {
        [STAThread]
        static void Main()
        {
            string tempFolder = Path.Combine(Path.GetTempPath(), "PhantomSetup_" + Guid.NewGuid().ToString().Substring(0, 8));
            Directory.CreateDirectory(tempFolder);
            
            string scriptPath = Path.Combine(tempFolder, "PhantomSetup.ps1");
            string payloadPath = Path.Combine(tempFolder, "payload.zip");

            ExtractResource("PhantomSetup.ps1", scriptPath);
            ExtractResource("payload.zip", payloadPath);

            // Double check file existence
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show("Critical Error: PhantomSetup.ps1 is missing from the installation package.", "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            // -WindowStyle Hidden is key here. -ExecutionPolicy Bypass allows the script to run.
            psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + scriptPath + "\"";
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.UseShellExecute = true; 
            psi.Verb = "runas"; // Request Administrator Privileges immediately

            try
            {
                Process p = Process.Start(psi);
                p.WaitForExit();
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // User cancelled UAC. Do nothing, just exit.
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch setup: " + ex.Message, "Fatal Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                try { Directory.Delete(tempFolder, true); } catch {}
            }
        }

        static void ExtractResource(string name, string outPath)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (s == null) return;
                using (FileStream fs = new FileStream(outPath, FileMode.Create))
                {
                    s.CopyTo(fs);
                }
            }
        }
    }
}
"@

Write-Host "Compiling Setup.exe..." -ForegroundColor Cyan

$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$params = New-Object System.CodeDom.Compiler.CompilerParameters
$params.GenerateExecutable = $true
$params.OutputAssembly = $outputFile
# Use icon if available
if (Test-Path "phantom_app\phantom.ico") {
    $params.CompilerOptions = "/target:winexe /optimize /win32icon:`"phantom_app\phantom.ico`"" 
}
else {
    $params.CompilerOptions = "/target:winexe /optimize" 
} 

# Add references
$params.ReferencedAssemblies.Add("System.dll") | Out-Null
$params.ReferencedAssemblies.Add("System.Windows.Forms.dll") | Out-Null
$params.ReferencedAssemblies.Add("System.Drawing.dll") | Out-Null

# Embed payload & script directly into C#
$params.EmbeddedResources.Add((Join-Path $PWD.Path "PhantomSetup.ps1")) | Out-Null
$params.EmbeddedResources.Add((Join-Path $PWD.Path "payload.zip")) | Out-Null

# Compile
$results = $provider.CompileAssemblyFromSource($params, $code)

if ($results.Errors.Count -gt 0) {
    Write-Host "Compilation Failed!" -ForegroundColor Red
    foreach ($err in $results.Errors) {
        Write-Host $err.ToString() -ForegroundColor Red
    }
    exit 1
}
else {
    Write-Host "Success: $outputFile created." -ForegroundColor Green
}
