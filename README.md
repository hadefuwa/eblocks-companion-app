# E-Blocks 3 Companion App

A desktop application for connecting, programming, and monitoring E-Blocks 3 devices. Built with Electron, this companion app provides a complete development environment for E-Blocks boards including Arduino Mega, ESP32, and PIC microcontrollers.

![Version](https://img.shields.io/badge/version-2.7.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### 🎯 Code Editor
- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting
- **Multi-Board Support**: Arduino Mega, ESP32, and PIC (coming soon)
- **Code Upload**: Direct upload to connected E-Blocks boards
- **Save/Load**: Save your code locally and load it back

### 📡 Serial Communication
- **Real-time Serial Monitor**: View serial output from your E-Blocks board
- **Bidirectional Communication**: Send and receive data
- **Auto-scroll**: Automatically scroll to latest output
- **Configurable Baud Rates**: 9600, 19200, 38400, 57600, 115200, 230400

### 🔌 Connection Management
- **Auto Port Detection**: Automatically detects available COM ports
- **Connection Status**: Visual indicator for connection state
- **Smart Driver Installation**: 
  - Automatic driver detection on startup
  - Prominent banner notification if drivers not installed
  - Multiple installation methods (silent, elevated, UI)
  - Automatic banner hiding after successful installation
- **Port Refresh**: Manual refresh for COM port list
- **Board Auto-Detection**: Automatically detects E-Blocks boards via USB VID/PID

### 📚 Curriculum Integration
- **E-Blocks Curriculum**: Access to educational curriculum content
- **Worksheet Viewer**: View detailed worksheets and lessons
- **Level-based Learning**: Bronze, Silver, and Gold levels

### 🛒 Shop
- **Product Catalog**: Browse E-Blocks boards and accessories
- **Product Widgets**: Beautiful product cards with images and pricing
- **Direct Links**: Quick access to Matrix TSL product pages

### 🎨 User Interface
- **Modern Dark Theme**: VS Code-inspired dark theme
- **Resizable Sidebars**: Customizable workspace layout
- **Responsive Design**: Adapts to different window sizes
- **Intuitive Navigation**: Easy-to-use menu system

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- Windows 10/11 (for Windows builds)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eblocks-companion-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```
   or
   ```bash
   npm run dev
   ```

### Building for Production

**Windows:**
```bash
npm run build:win
```

The installer will be created in `dist-electron/` directory.

## Usage

### Getting Started

1. **Launch the Application**
   - Run `npm start` or launch the installed application
   - The app will start on `http://localhost:3000`

2. **Install Drivers (if needed)**
   - If you see an orange banner at the top saying drivers are not installed, click "Install Drivers"
   - Follow the installation prompts (may require administrator privileges)
   - The banner will automatically hide once drivers are installed
   - Reconnect your E-Blocks board after driver installation

3. **Connect Your E-Blocks Board**
   - Connect your E-Blocks board via USB
   - Select the COM port from the dropdown
   - Click refresh (↻) if your port doesn't appear
   - The connection status will update automatically
   - Board type may be auto-detected from USB information

4. **Write and Upload Code**
   - Write your Arduino code in the Monaco editor
   - Select your board type (Arduino Mega or ESP32) - may be auto-detected
   - Click "Upload Code" to compile and upload
   - Monitor upload progress in the status area

5. **Monitor Serial Output**
   - View real-time serial output in the Serial Monitor
   - Send data to the board using the input field
   - Toggle auto-scroll as needed

### Menu Navigation

- **Code Editor**: Main development interface (home page)
- **Graphical**: Coming soon - graphical programming interface
- **Shop**: Browse and purchase E-Blocks products

## Project Structure

```
eblocks-companion-app/
├── src/                      # Source code
│   ├── main.mjs             # Main Electron process
│   ├── preload.js           # Preload script for IPC
│   ├── wrapper.cjs          # Entry point wrapper
│   └── renderer/            # Frontend (renderer process)
│       ├── index.html       # Main HTML file
│       ├── shop.html        # Shop page
│       ├── app.js           # Frontend JavaScript
│       └── styles.css       # CSS styles
│
├── assets/                   # Static assets
│   ├── combo.jpg            # Product images
│   ├── prototype.jpg
│   ├── motors.jpg
│   ├── eblocks_Ard.png      # Board images
│   ├── eblocks_esp32.png
│   ├── eblocks_pic.png
│   ├── matrix.png           # Logo
│   └── *.txt                # Curriculum files
│
├── resources/                # External binaries (bundled with app)
│   └── arduino-cli/         # Arduino CLI executable (bundled)
│       └── win32/x64/arduino-cli.exe
│
├── drivers/                  # E-Blocks USB driver installers (bundled)
│   ├── E-blocks2_64bit_installer.exe
│   ├── E-blocks2_32bit_installer.exe
│   ├── dpinst.exe          # Driver Package Installer
│   └── inf/                # Driver INF files
│
├── build/                    # Build configuration
│
├── dist-electron/           # Build output (gitignored)
│
├── package.json             # Project configuration
└── README.md               # This file
```

## Technologies Used

- **Electron** (^39.2.7) - Desktop application framework
- **Express** (^4.18.2) - Web server for serving frontend and API
- **Monaco Editor** (^0.55.1) - Code editor component (VS Code editor)
- **SerialPort** (^12.0.0) - Serial communication library
- **Arduino CLI** - Bundled for code compilation and upload (v0.35.0)
- **Node.js** - Runtime environment
- **NSIS** - Windows installer creation

## API Endpoints

The app uses a local Express server on port 3000 with the following endpoints:

### Serial Port Management
- `GET /api/ports` - List available serial ports with board detection
- `POST /api/connect` - Connect to serial port
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

## Supported Boards

- ✅ **Arduino Mega** - Full support
- ✅ **ESP32** - Full support
- 🚧 **PIC** - Coming soon

## Driver Installation

The app includes a comprehensive driver installation system for E-Blocks USB drivers:

### Automatic Detection
- **Startup Check**: Automatically checks for installed drivers when the app launches
- **Banner Notification**: Shows a prominent banner at the top of the app if drivers are not installed
- **Periodic Checking**: Rechecks driver status every 30 seconds
- **Auto-Hide**: Banner automatically hides after successful installation

### Installation Methods
The app tries multiple installation methods in order:
1. **Silent Installation**: Attempts silent installation with various flags (`/S`, `/SILENT`, `/VERYSILENT`)
2. **PowerShell Elevation**: If silent methods fail, attempts elevated installation via PowerShell
3. **UI Mode**: Falls back to showing the installer UI if all silent methods fail

### Features
- **Bundled Drivers**: 32-bit and 64-bit driver installers are bundled with the app
- **Flag File**: Creates a `.drivers-installed` flag file after successful installation
- **Board Detection**: Also checks for connected E-Blocks boards as an indirect indicator
- **User-Friendly**: Clear instructions and status messages throughout the process

### Manual Installation
If automatic installation fails, you can:
- Click the "Install Drivers" button in the banner or sidebar
- Manually run the installer from `resources/drivers/` in the app installation directory

## Building

### Development
```bash
npm start
```

### Production Build
```bash
npm run build:win
```

The build process creates:
- Windows installer (NSIS) in `dist-electron/`
- Unpacked application files
- All required resources and dependencies

## Troubleshooting

### COM Port Not Appearing
- **Check Driver Banner**: Look for the orange banner at the top of the app - if visible, drivers need to be installed
- **Install Drivers**: Click the "Install Drivers" button in the banner or sidebar
- **Refresh Ports**: Click the refresh button (↻) after installing drivers
- **Reconnect Board**: Unplug and reconnect your E-Blocks board after driver installation
- **Device Manager**: Check Windows Device Manager to see if the board appears (may show as "Unknown Device" if drivers not installed)

### Upload Fails
- **Board Selection**: Verify the correct board type is selected (Arduino Mega or ESP32)
- **Connection**: Check that the board is connected and the connection status shows "Connected"
- **Arduino CLI**: Ensure Arduino CLI is working (the app bundles it automatically)
- **Code Syntax**: Check for syntax errors in your code
- **Port Access**: Ensure no other application is using the COM port

### Serial Monitor Not Working
- Verify connection status is "Connected"
- Check baud rate matches your code
- Try disconnecting and reconnecting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- **Matrix TSL** - For E-Blocks hardware and curriculum
- **Monaco Editor** - For the excellent code editing experience
- **Electron** - For the desktop application framework

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for the E-Blocks community**

