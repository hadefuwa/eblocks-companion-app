Summary: E-Blocks Driver Installation Implementation
1. Initial Setup & Bundling
Added drivers/ folder to extraResources in package.json
Drivers are bundled with the app installer
Drivers include:
E-blocks2_64bit_installer.exe and E-blocks2_32bit_installer.exe
dpinst.exe (fallback installer)
INF files and driver binaries for 32-bit and 64-bit Windows
2. Manual Installation API Endpoint
Created POST /api/install-drivers endpoint
Automatically detects system architecture (32-bit/64-bit)
Tries multiple installation methods:
Silent installation with /S flag
Alternative flags: /SILENT, /VERYSILENT, /S /NCRC
PowerShell elevation (RunAs)
Fallback to UI mode if silent fails
Returns detailed success/error information
3. UI Integration
Added "🔧 Install Drivers" button in Connection Setup section
Real-time status messages (info/success/error)
Auto-refreshes ports after installation
Button disabled during installation to prevent duplicates
4. Automatic Installation on First Launch
checkAndInstallDrivers() function runs on app startup
Checks for .drivers-installed flag file in user data directory
If flag doesn't exist, automatically installs drivers silently
Creates flag file after successful installation
Non-blocking — app starts even if installation fails
Comprehensive debug logging for troubleshooting
5. NSIS Installer Integration
Created build/installer.nsh custom NSIS script
Prompts user during app installation: "Would you like to install drivers now?"
Tries silent installation first, then elevated installation if needed
Shows success/failure messages
Integrated into package.json NSIS configuration
6. Error Handling & Debugging
Detailed console logging at every step
Logs paths checked, files found, methods tried
Captures error codes, stdout, stderr
User-friendly error messages with suggestions
Multiple fallback methods if one fails
Current Status
Drivers are bundled with the app
Installation methods are implemented
UI button works
Auto-installation on first launch is implemented
NSIS installer prompts during installation
Known Issue
Installation is failing — likely requires admin privileges or specific installer flags
The installer may need to be run manually as administrator
Error handling is in place to diagnose the issue
Next Steps to Debug
Check console output for detailed error messages
Verify which installer flags the E-Blocks installer supports
Test manual installation to confirm the installer works
Consider using dpinst.exe as an alternative if the main installer continues to fail
The infrastructure is in place; we need to identify why the installer is failing and adjust the approach accordingly.