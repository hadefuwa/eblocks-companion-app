# E-Blocks 3 Companion App - Project Structure

## Overview
This is an Electron application that uses Express.js to serve the frontend and handle API requests.

## Directory Structure

```
eblocks-companion-app/
├── src/                   # Source code
│   ├── main.mjs          # Main Electron process - Express server, serial port, Arduino CLI
│   ├── wrapper.cjs       # Entry point wrapper (required by package.json "main")
│   └── renderer/         # Frontend (renderer process)
│       ├── index.html    # Main HTML file
│       ├── app.js        # Frontend JavaScript - UI logic, API calls
│       └── styles.css    # CSS styles
│
├── assets/                # Static assets
│   ├── curriculum1.txt   # Curriculum content
│   ├── eblocks_Ard.png   # Arduino board image
│   ├── eblocks_esp32.png # ESP32 board image
│   ├── eblocks_pic.png   # PIC board image
│   └── matrix.png        # Matrix logo
│
├── resources/             # External binaries/resources
│   └── arduino-cli/      # Arduino CLI executable
│       └── win32/
│           └── x64/
│               └── arduino-cli.exe
│
├── dist-electron/         # Build output (gitignored)
│   └── ...               # Compiled app and installers
│
├── node_modules/          # npm dependencies
├── package.json           # Project config and dependencies
└── .gitignore            # Git ignore rules
```

## How It Works

### Architecture
1. **Electron Main Process** (`src/main.mjs`):
   - Starts Express.js server on port 3000
   - Handles serial port communication
   - Manages Arduino CLI operations
   - Serves static files from `src/renderer/` folder

2. **Frontend** (`src/renderer/`):
   - Served by Express as static files
   - Makes API calls to `/api/*` endpoints
   - Uses Monaco Editor for code editing
   - Communicates via HTTP (not IPC)

3. **File Paths**:
   - **Development**: Uses system temp directory (`app.getPath('temp')`)
   - **Packaged**: Uses `app.getPath('userData')/temp` and `app.getPath('userData')/uploads`

## API Endpoints

All endpoints are served at `http://localhost:3000/api/*`:

- `GET /api/ports` - List available serial ports
- `POST /api/upload` - Upload and compile Arduino code
- `POST /api/connect` - Connect to serial port
- `POST /api/disconnect` - Disconnect from serial port
- `GET /api/serial/data/:connectionId` - Get serial data (polling)
- `POST /api/serial/send` - Send data to serial port
- `GET /api/check-cli` - Check if Arduino CLI is installed

## Build Process

- **Development**: `npm start` or `npm run dev`
- **Build**: `npm run build:win` (creates Windows installer in `dist-electron/`)

## Notes

- The app uses Express to serve the frontend (not direct Electron file:// protocol)
- Serial communication uses polling (not WebSockets or IPC)
- Arduino CLI is bundled with the app in `resources/arduino-cli/`
- Temporary files are stored in system temp directory during development, user data folder when packaged

