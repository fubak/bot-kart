param([int]$X = 60, [int]$Y = 60, [int]$W = 1100, [int]$H = 620, [string]$Match = 'remote-debugging-port=9333')
$sig = @'
using System;
using System.Runtime.InteropServices;
public class WinM {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
Add-Type -TypeDefinition $sig
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$Match*" }
foreach ($p in $procs) {
  $np = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
  if ($np -and $np.MainWindowHandle -ne 0) {
    [WinM]::ShowWindow($np.MainWindowHandle, 9) | Out-Null
    [WinM]::SetWindowPos($np.MainWindowHandle, 0, $X, $Y, $W, $H, 0x0040) | Out-Null  # SWP_SHOWWINDOW
    [WinM]::SetForegroundWindow($np.MainWindowHandle) | Out-Null
    Write-Output ("moved pid " + $p.ProcessId + " -> " + $X + "," + $Y + " " + $W + "x" + $H)
  }
}
