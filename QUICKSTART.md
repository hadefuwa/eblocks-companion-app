# Quick Start Guide

## Prerequisites

1. **Node.js 18+** - Download from https://nodejs.org/
2. **Chrome or Edge browser** - Required for Web Serial API support
3. **Arduino CLI** - See installation steps below

## Installation Steps

### 1. Install Dependencies

```bash
npm run install:all
```

This installs dependencies for both the frontend (React) and backend (Express) servers.

### 2. Install and Configure Arduino CLI

**Windows:**
```bash
setup-arduino-cli.bat
```

**macOS/Linux:**
```bash
chmod +x setup-arduino-cli.sh
./setup-arduino-cli.sh
```

**Manual Installation:**
- Download from: https://arduino.github.io/arduino-cli/
- Or use package manager:
  - Windows: `choco install arduino-cli`
  - macOS: `brew install arduino-cli`
  - Linux: See https://arduino.github.io/arduino-cli/installation/

Then configure:
```bash
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli core install esp32:esp32
```

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:3000) servers.

### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

The app will be available at http://localhost:3000

## Usage

1. **Open the app** in Chrome or Edge browser
2. **Connect your E-Blocks 3 device:**
   - Click "Connect Device"
   - Select your device from the browser's device picker
   - The app will auto-detect the board type (Arduino Mega, ESP32, or PIC)
3. **Write or paste your Arduino code** in the code editor
4. **Select the board type** if auto-detection didn't work
5. **Click "Upload Code"** to compile and upload
6. **Use the Serial Monitor** to view real-time output from your device

## Troubleshooting

### "Arduino CLI not found"
- Make sure Arduino CLI is installed and in your PATH
- Restart the terminal/command prompt after installation
- On Windows, you may need to add Arduino CLI to your system PATH

### "No serial port found"
- Make sure your device is connected via USB
- Try disconnecting and reconnecting the device
- Check Device Manager (Windows) to see if the device is recognized
- Some devices may require drivers (though E-Blocks 3 should work without)

### "Upload failed" or port locked
- Try disconnecting the Serial Monitor before uploading
- Disconnect and reconnect the device
- Close other applications that might be using the serial port (Arduino IDE, etc.)

### Web Serial API not working
- Make sure you're using Chrome or Edge browser (version 89+)
- Firefox and Safari do not support Web Serial API
- Make sure you're accessing the app via http://localhost (not file://)

## Features

- ✅ USB Serial connection via Web Serial API (no drivers needed)
- ✅ Real-time serial monitor
- ✅ Code editor with syntax highlighting
- ✅ Automatic board detection
- ✅ Support for Arduino Mega and ESP32
- ✅ Code compilation and upload via Arduino CLI

## Browser Support

- ✅ Chrome 89+
- ✅ Edge 89+
- ✅ Opera 76+
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

