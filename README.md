# E-Blocks 3 Companion App

A web-based companion application for E-Blocks 3 devices (PIC, ESP32, Arduino Mega) that enables:
- Device connection via USB Serial (Web Serial API)
- Code upload to connected boards
- Real-time serial monitor

## Features

- 🔌 **USB Serial Connection** - Connect to E-Blocks 3 devices without additional drivers
- 📤 **Code Upload** - Upload Arduino-compatible code to ESP32 and Arduino Mega boards
- 📊 **Serial Monitor** - Real-time monitoring of serial output from connected devices
- 🎯 **Multi-Board Support** - Supports PIC, ESP32, and Arduino Mega

## Requirements

- Node.js 18+ and npm
- Chrome or Edge browser (for Web Serial API support)
- Arduino CLI (for code compilation and upload)

## Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Install Arduino CLI:
   - **Windows**: Download from https://arduino.github.io/arduino-cli/ or use `choco install arduino-cli`
   - **macOS**: `brew install arduino-cli`
   - **Linux**: See https://arduino.github.io/arduino-cli/installation/

3. Configure Arduino CLI:
   - **Windows**: Run `setup-arduino-cli.bat`
   - **macOS/Linux**: Run `chmod +x setup-arduino-cli.sh && ./setup-arduino-cli.sh`
   
   Or manually:
```bash
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli core install esp32:esp32
```

## Development

Run both frontend and backend:
```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Usage

1. Open the app in Chrome or Edge browser
2. Click "Connect Device" and select your E-Blocks 3 board
3. Write or paste your Arduino code
4. Select the board type (ESP32 or Arduino Mega)
5. Click "Upload" to compile and upload code
6. Use the Serial Monitor to view real-time output

## Browser Support

Web Serial API is supported in:
- Chrome 89+
- Edge 89+
- Opera 76+

Firefox and Safari do not currently support Web Serial API.

