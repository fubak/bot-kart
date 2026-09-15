$sig = @'
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
Add-Type -TypeDefinition $sig
$procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
foreach ($p in $procs) {
  [Win]::ShowWindow($p.MainWindowHandle, 9) | Out-Null  # SW_RESTORE
  [Win]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Write-Output ("restored: " + $p.Id + " - " + $p.MainWindowTitle)
}
