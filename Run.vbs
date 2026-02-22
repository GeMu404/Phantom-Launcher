Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell") 
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "powershell -Sta -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strPath & "\PhantomTray.ps1""", 0, False
