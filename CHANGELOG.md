# Changelog

All notable changes to the E-Blocks 3 Companion App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2024-12-XX

### Added
- **Driver Installation Banner**: Prominent banner at the top of the app that automatically appears when E-Blocks USB drivers are not installed
- **Automatic Driver Detection**: App checks for installed drivers on startup and periodically (every 30 seconds)
- **Multiple Driver Installation Methods**: 
  - Silent installation with various flags (`/S`, `/SILENT`, `/VERYSILENT`)
  - PowerShell elevation for administrator privileges
  - UI mode fallback if silent methods fail
- **Driver Status API**: New `/api/check-drivers` endpoint to check driver installation status
- **Driver Installation API**: Enhanced `/api/install-drivers` endpoint with multiple installation strategies
- **Flag File System**: Creates `.drivers-installed` flag file after successful driver installation
- **Board Auto-Detection**: Enhanced port detection to automatically identify E-Blocks boards via USB VID/PID
- **Periodic Status Checking**: Automatic rechecking of driver status to detect external installations

### Changed
- **Arduino CLI Path Resolution**: Improved path finding for bundled Arduino CLI in both development and packaged modes
- **Driver Installation Flow**: Moved driver installation from NSIS installer to in-app banner system
- **Error Handling**: Enhanced error messages and logging for driver installation attempts
- **UI Feedback**: Better visual feedback during driver installation process

### Fixed
- **Arduino CLI Double-Quoting**: Fixed issue where CLI path was being double-quoted, causing execution failures
- **PowerShell Command Escaping**: Fixed PowerShell elevation command to properly handle paths with spaces
- **Driver Installation Success Detection**: Improved detection of successful driver installation even when installer returns non-zero exit codes
- **UI Method Handling**: Fixed issue where UI installer method was incorrectly treated as failure

### Removed
- **NSIS Driver Installation Prompt**: Removed driver installation popup from main app installer (now handled by in-app banner)
- **build/installer.nsh**: Removed NSIS custom installer script that was causing installation issues

## [2.6.0] - Previous Release

### Added
- Initial driver installation support
- Driver installer bundling in app resources

### Changed
- Improved Arduino CLI integration

## [2.5.0] - Previous Release

### Added
- Arduino CLI bundling and integration
- Enhanced port detection with board type identification

### Fixed
- Arduino CLI path resolution in packaged app

## [2.4.0] - Previous Release

### Added
- Basic serial communication
- Code editor with Monaco Editor
- Serial monitor functionality
- Curriculum integration
- Shop page

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

