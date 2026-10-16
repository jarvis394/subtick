#!/bin/sh
cd /wine/pfx/drive_c/hlae
exec wine HLAE.exe -customLoader -noGui -autoStart \
  -hookDllPath "C:\\hlae\\x64\\AfxHookSource2.dll" \
  -programPath "Z:\\cs2\\game\\bin\\win64\\cs2.exe" \
  -cmdLine "-steam -insecure +sv_lan 1 -console -sw -w 1280 -h 720 -novid -nojoy -netconport 2121 -afxDisableSteamStorage +playdemo subtick/cache"
