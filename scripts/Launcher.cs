using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("Phantom Launcher")]
[assembly: AssemblyProduct("Phantom")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace Phantom
{
    public class PhantomLauncher : Form
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private ToolStripMenuItem launchItem;
        private ToolStripMenuItem restartItem;
        private ToolStripMenuItem exitItem;
        
        private Process serverProcess;
        private string appDir;
        private string serverPath;
        private string launcherPath;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new PhantomLauncher());
        }

        public PhantomLauncher()
        {
            appDir = AppDomain.CurrentDomain.BaseDirectory;
            serverPath = Path.Combine(appDir, "PhantomServer.exe");
            launcherPath = Path.Combine(appDir, "launcher.html");

            // Setup Tray Icon
            notifyIcon = new NotifyIcon();
            notifyIcon.Text = "Phantom Launcher (Active)";
            
            string iconPath = Path.Combine(appDir, "phantom.ico");
            if (File.Exists(iconPath))
            {
                notifyIcon.Icon = new Icon(iconPath);
            }
            else
            {
                notifyIcon.Icon = SystemIcons.Application;
            }

            // Setup Menu
            contextMenu = new ContextMenuStrip();
            contextMenu.BackColor = Color.FromArgb(16, 16, 16);
            contextMenu.ForeColor = Color.White;
            contextMenu.ShowImageMargin = false;
            contextMenu.Font = new Font("Consolas", 10F, FontStyle.Bold);
            
            // Custom Renderer for Neon Pink Hover
            contextMenu.Renderer = new PhantomMenuRenderer();
            
            launchItem = new ToolStripMenuItem("[ OPEN LAUNCHER ]", null, (s, e) => OpenLauncher());
            restartItem = new ToolStripMenuItem("[ RESTART SERVER ]", null, (s, e) => RestartServer());
            exitItem = new ToolStripMenuItem("[ SYSTEM EXIT ]", null, (s, e) => {
                StopServer();
                notifyIcon.Visible = false;
                Application.Exit();
            });

            // Style
            contextMenu.Items.Add(launchItem);
            contextMenu.Items.Add(restartItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(exitItem);

            foreach (ToolStripItem item in contextMenu.Items)
            {
                item.Padding = new Padding(10, 5, 10, 5);
                ToolStripSeparator sep = item as ToolStripSeparator;
                if (sep != null) {
                    sep.ForeColor = Color.FromArgb(255, 0, 85);
                }
            }

            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = true;
            notifyIcon.DoubleClick += (s, e) => OpenLauncher();

            // Start the server
            StartServer();

            // Hide the form itself
            this.WindowState = FormWindowState.Minimized;
            this.ShowInTaskbar = false;
            this.Load += (s, e) => this.Hide();
        }

        private void StartServer()
        {
            if (serverProcess != null && !serverProcess.HasExited) return;

            if (!File.Exists(serverPath))
            {
                MessageBox.Show("Critical Error: PhantomServer.exe not found at " + serverPath, "Core Missing", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = serverPath;
            psi.WorkingDirectory = appDir;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;

            try
            {
                serverProcess = Process.Start(psi);
                serverProcess.PriorityClass = ProcessPriorityClass.High;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to start Phantom Server: " + ex.Message, "Process Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void StopServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
                
                // Nuclear option to clean up any leaked instances
                ProcessStartInfo psi = new ProcessStartInfo("taskkill", "/F /IM PhantomServer.exe /T");
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                Process.Start(psi);
            }
            catch { }
        }

        private void RestartServer()
        {
            StopServer();
            System.Threading.Thread.Sleep(500);
            StartServer();
        }

        private void OpenLauncher()
        {
            if (File.Exists(launcherPath))
            {
                Process.Start(launcherPath);
            }
            else
            {
                Process.Start("http://localhost:3001");
            }
        }
    }

    public class PhantomMenuRenderer : ToolStripProfessionalRenderer
    {
        public PhantomMenuRenderer() : base(new PhantomColorTable()) { }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (e.Item.Selected)
            {
                Rectangle rc = new Rectangle(0, 0, e.Item.Width, e.Item.Height);
                e.Graphics.FillRectangle(new SolidBrush(Color.FromArgb(255, 0, 85)), rc);
            }
            else
            {
                base.OnRenderMenuItemBackground(e);
            }
        }
        
        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            if (e.Item.Selected)
            {
                e.TextColor = Color.White;
            }
            else
            {
                e.TextColor = Color.White;
            }
            base.OnRenderItemText(e);
        }
    }

    public class PhantomColorTable : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground { get { return Color.FromArgb(16, 16, 16); } }
        public override Color ImageMarginGradientBegin { get { return Color.FromArgb(16, 16, 16); } }
        public override Color ImageMarginGradientMiddle { get { return Color.FromArgb(16, 16, 16); } }
        public override Color ImageMarginGradientEnd { get { return Color.FromArgb(16, 16, 16); } }
        public override Color MenuBorder { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemBorder { get { return Color.Transparent; } }
        public override Color MenuItemSelected { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemSelectedGradientBegin { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemSelectedGradientEnd { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemPressedGradientBegin { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemPressedGradientMiddle { get { return Color.FromArgb(255, 0, 85); } }
        public override Color MenuItemPressedGradientEnd { get { return Color.FromArgb(255, 0, 85); } }
        public override Color SeparatorDark { get { return Color.FromArgb(255, 0, 85); } }
        public override Color SeparatorLight { get { return Color.FromArgb(255, 0, 85); } }
    }
}
