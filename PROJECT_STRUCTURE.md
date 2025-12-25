# E-Blocks 3 Companion App - Project Structure

## Overview
This is an Electron application (v2.7.0) that uses Express.js to serve the frontend and handle API requests. The app provides a complete development environment for E-Blocks 3 boards, including code editing, uploading, serial monitoring, and curriculum access.

## Directory Structure

```
eblocks-companion-app/
├── src/                   # Source code
│   ├── main.mjs          # Main Electron process - Express server, serial port, Arduino CLI
│   ├── wrapper.cjs       # Entry point wrapper (required by package.json "main")
│   ├── preload.js        # Preload script for secure context bridge
│   └── renderer/         # Frontend (renderer process)
│       ├── index.html    # Main HTML file
│       ├── shop.html     # Shop page HTML
│       ├── app.js        # Frontend JavaScript - UI logic, API calls, Monaco Editor
│       └── styles.css    # CSS styles
│
├── assets/                # Static assets
│   ├── curriculum1.txt   # Curriculum content
│   ├── CP0507 - Motors and microconrtollers.txt
│   ├── CP1972 - Sensors and microcontrollers.txt
│   ├── CP4436 - PC and web interfacing.txt
│   ├── eblocks_Ard.png   # Arduino board image
│   ├── eblocks_esp32.png # ESP32 board image
│   ├── eblocks_pic.png   # PIC board image
│   ├── matrix.png        # Matrix logo
│   ├── combo.jpg         # Product images
│   ├── motors.jpg
│   └── prototype.jpg
│
├── resources/             # External binaries/resources (bundled with app)
│   └── arduino-cli/      # Arduino CLI executable
│       └── win32/
│           └── x64/
│               └── arduino-cli.exe
│
├── drivers/               # E-Blocks USB driver installers (bundled with app)
│   ├── E-blocks2_64bit_installer.exe
│   ├── E-blocks2_32bit_installer.exe
│   ├── dpinst.exe        # Driver Package Installer
│   ├── dpinst.xml
│   ├── inf/              # Driver INF files
│   │   ├── amd64/        # 64-bit driver files
│   │   ├── i386/         # 32-bit driver files
│   │   └── Static/       # Static library files
│   └── MTX_EB3.ico       # Icon files
│
├── build/                 # Build configuration (currently empty)
│
├── dist-electron/         # Build output (gitignored)
│   └── ...               # Compiled app and installers
│
├── docs/                  # Documentation
├── node_modules/          # npm dependencies
├── package.json           # Project config and dependencies
├── package-lock.json      # Locked dependency versions
├── .gitignore            # Git ignore rules
└── README.md             # Project readme
```

## How It Works

### Architecture
1. **Electron Main Process** (`src/main.mjs`):
   - Starts Express.js server on port 3000
   - Handles serial port communication
   - Manages Arduino CLI operations
   - Serves static files from `src/renderer/` folder
   - Manages driver installation and checking
   - Handles file uploads and temporary file management

2. **Frontend** (`src/renderer/`):
   - Served by Express as static files
   - Makes API calls to `/api/*` endpoints
   - Uses Monaco Editor for code editing
   - Communicates via HTTP (not IPC)
   - Features driver installation banner
   - Curriculum viewer and worksheet system

3. **File Paths**:
   - **Development**: Uses system temp directory (`app.getPath('temp')`)
   - **Packaged**: Uses `app.getPath('userData')/temp` and `app.getPath('userData')/uploads`
   - **Drivers**: Bundled in `resources/drivers/` when packaged
   - **Arduino CLI**: Bundled in `resources/arduino-cli/` when packaged

## API Endpoints

All endpoints are served at `http://localhost:3000/api/*`:

### Serial Port Management
- `GET /api/ports` - List available serial ports with board detection
- `POST /api/connect` - Connect to a serial port
- `POST /api/disconnect` - Disconnect from serial port
- `GET /api/serial/data/:connectionId` - Get serial data (polling)
- `POST /api/serial/send` - Send data to serial port

### Code Upload & Compilation
- `POST /api/upload` - Upload and compile Arduino code, then upload to board

### System Checks
- `GET /api/check-cli` - Check if Arduino CLI is installed and accessible
- `GET /api/check-drivers` - Check if E-Blocks USB drivers are installed
- `GET /api/health` - Health check endpoint

### Driver Installation
- `POST /api/install-drivers` - Install E-Blocks USB drivers (tries multiple methods)

## Key Features

### Driver Installation
- **Automatic Detection**: Checks for installed drivers on app startup
- **Banner Notification**: Shows prominent banner at top of app if drivers not installed
- **Multiple Installation Methods**: 
  - Silent installation (`/S`, `/SILENT`, `/VERYSILENT`)
  - PowerShell elevation (if silent fails)
  - UI mode (fallback)
- **Flag File**: Creates `.drivers-installed` flag in user data directory after successful installation
- **Periodic Checking**: Rechecks driver status every 30 seconds

### Arduino CLI Integration
- **Bundled CLI**: Arduino CLI is bundled with the app in `resources/arduino-cli/`
- **Path Resolution**: Automatically finds CLI in both development and packaged modes
- **Board Detection**: Uses CLI to detect board types from connected ports
- **Version Checking**: Verifies CLI is working on startup

### Serial Communication
- **Connection Management**: Maintains active serial port connections
- **Data Buffering**: Stores serial data for polling-based retrieval
- **Board Detection**: Automatically detects E-Blocks boards via USB VID/PID

### Curriculum System
- **Worksheet Viewer**: Displays curriculum worksheets with code examples
- **Multiple Curricula**: Supports multiple curriculum files
- **Code Integration**: Can load worksheet code into editor

## Build Process

### Development
- `npm start` or `npm run dev` - Start Electron app in development mode

### Production Build
- `npm run build` or `npm run build:win` - Creates Windows installer in `dist-electron/`
- Uses `electron-builder` with NSIS installer
- Bundles Arduino CLI, drivers, and all assets
- Creates unpacked files for `preload.js` and renderer assets

### Build Configuration
- **Target**: Windows x64 NSIS installer
- **Extra Resources**: 
  - Arduino CLI (`resources/arduino-cli/` → `arduino-cli/`)
  - Drivers (`drivers/` → `drivers/`)
- **ASAR Unpack**: 
  - `src/renderer/**/*` (for serving via Express)
  - `src/preload.js` (for secure context)
  - `assets/**/*` (static assets)
  - `node_modules/monaco-editor/**/*` (Monaco Editor)
  - `resources/arduino-cli/**/*` (CLI executable)

## Notes

- The app uses Express to serve the frontend (not direct Electron file:// protocol)
- Serial communication uses polling (not WebSockets or IPC)
- Arduino CLI is bundled with the app in `resources/arduino-cli/`
- E-Blocks drivers are bundled in `drivers/` folder
- Temporary files are stored in system temp directory during development, user data folder when packaged
- Driver installation banner automatically shows/hides based on installation status
- NSIS installer no longer prompts for driver installation (handled by app banner instead)
- Preload script provides secure context bridge for Electron APIs
