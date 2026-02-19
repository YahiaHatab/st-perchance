
Set WshShell = CreateObject("WScript.Shell")

' Run SillyTavern Start.bat (Visible, because you usually want to see ST output/know it's running)
' Assuming Start.bat is in the SillyTavern-release folder (3 levels up from this extensions folder)
WshShell.Run "..\..\..\..\Start.bat", 0, False

' Run the Bridge Server (Hidden)
WshShell.Run "node server/index.js", 0, False
