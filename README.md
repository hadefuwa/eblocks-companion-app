# E-Blocks 3 Companion App

<div align="center">

![E-Blocks 3 Companion](https://img.shields.io/badge/E--Blocks-3-blue)
![Web Serial API](https://img.shields.io/badge/Web%20Serial%20API-Supported-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

A modern web-based companion application for **E-Blocks 3** devices that enables seamless connection, code upload, and serial monitoring without requiring additional drivers.

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Troubleshooting](#-troubleshooting)

</div>

---

## 📋 Overview

The E-Blocks 3 Companion App is a full-stack web application designed to work with Matrix TSL's E-Blocks 3 modular microcontroller system. It supports **PIC**, **ESP32**, and **Arduino Mega** boards, providing a streamlined development experience directly in your browser.

### Why This App?

- ✅ **No Driver Installation** - Uses Web Serial API, eliminating the need for Matrix drivers
- ✅ **Browser-Based** - Works directly in Chrome/Edge, no desktop app required
- ✅ **Arduino IDE Compatible** - Uses Arduino CLI for seamless code compilation and upload
- ✅ **Real-Time Monitoring** - Live serial output with filtering and auto-scroll
- ✅ **Modern UI** - Clean, responsive interface built with React

## ✨ Features

### 🔌 Device Connection
- USB Serial connection via Web Serial API
- Automatic board type detection (Arduino Mega, ESP32, PIC)
- No additional drivers required
- Visual connection status indicator

### 📝 Code Editor
- Syntax-friendly code editor
- Load and save `.ino` files
- Board type selection
- One-click code upload
- Compilation status feedback

### 📊 Serial Monitor
- Real-time serial data display
- Configurable baud rates (9600 - 921600)
- Send data to device
- Message filtering
- Auto-scroll option
- Timestamped messages

### 🛠️ Backend Services
- Express.js server with Arduino CLI integration
- Automatic port detection
- Code compilation and upload
- Health checks and status monitoring

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Chrome or Edge** browser (Web Serial API support)
- **Arduino CLI** ([Installation Guide](https://arduino.github.io/arduino-cli/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hadefuwa/eblocks-companion-app.git
   cd eblocks-companion-app
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Install and configure Arduino CLI**

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
     - Linux: See [Arduino CLI Installation](https://arduino.github.io/arduino-cli/installation/)

   Then configure:
   ```bash
   arduino-cli config init
   arduino-cli core update-index
   arduino-cli core install arduino:avr
   arduino-cli core install esp32:esp32
   ```

## 💻 Development

### Running the Application

**Development Mode** (with hot reload):
```bash
npm run dev
```

This starts both:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

**Production Mode**:
```bash
npm run build
npm start
```

### Project Structure

```
eblocks-companion-app/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── DeviceConnection.jsx
│   │   │   ├── CodeEditor.jsx
│   │   │   ├── SerialMonitor.jsx
│   │   │   └── ArduinoCLIStatus.jsx
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   └── package.json
├── server/                 # Node.js backend (Express)
│   ├── index.js           # Server with Arduino CLI integration
│   └── package.json
├── package.json           # Root package.json
├── setup-arduino-cli.bat  # Windows setup script
├── setup-arduino-cli.sh   # macOS/Linux setup script
└── README.md
```

### Available Scripts

- `npm run dev` - Start development servers (frontend + backend)
- `npm run dev:client` - Start frontend only
- `npm run dev:server` - Start backend only
- `npm run build` - Build frontend for production
- `npm start` - Start production server
- `npm run install:all` - Install all dependencies

## 📖 Usage

### 1. Connect Your Device

1. Connect your E-Blocks 3 device (PIC, ESP32, or Arduino Mega) via USB
2. Open the app in Chrome or Edge browser
3. Click **"Connect Device"**
4. Select your device from the browser's device picker
5. The app will automatically detect the board type

### 2. Write and Upload Code

1. Write or paste your Arduino code in the code editor
2. Select the board type if auto-detection didn't work
3. Click **"Upload Code"** to compile and upload
4. Monitor the upload progress in the status messages

### 3. Monitor Serial Output

1. The Serial Monitor automatically starts reading when connected
2. Configure baud rate if needed (default: 115200)
3. View real-time output from your device
4. Use the filter to search for specific messages
5. Send data to your device using the input field

### Example Code

```cpp
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("E-Blocks 3 Companion App - Ready!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
```

## 🌐 Browser Support

| Browser | Web Serial API Support | Status |
|---------|----------------------|--------|
| Chrome 89+ | ✅ Yes | Fully Supported |
| Edge 89+ | ✅ Yes | Fully Supported |
| Opera 76+ | ✅ Yes | Fully Supported |
| Firefox | ❌ No | Not Supported |
| Safari | ❌ No | Not Supported |

## 🔧 Troubleshooting

### Arduino CLI Not Found

**Problem:** App shows "Arduino CLI not found" error

**Solutions:**
- Ensure Arduino CLI is installed and in your system PATH
- Restart your terminal/command prompt after installation
- On Windows, add Arduino CLI to your system PATH manually
- Verify installation: `arduino-cli version`

### No Serial Port Found

**Problem:** "No serial port found" error during upload

**Solutions:**
- Ensure your device is connected via USB
- Try disconnecting and reconnecting the device
- Check Device Manager (Windows) to verify device recognition
- Close other applications using the serial port (Arduino IDE, etc.)
- Some devices may require drivers (though E-Blocks 3 should work without)

### Upload Failed / Port Locked

**Problem:** Upload fails with port locked error

**Solutions:**
- Disconnect the Serial Monitor before uploading
- Disconnect and reconnect the device
- Close other serial port applications
- Restart the application

### Web Serial API Not Working

**Problem:** Cannot connect to device

**Solutions:**
- Ensure you're using Chrome or Edge browser (version 89+)
- Access the app via `http://localhost` (not `file://`)
- Check browser permissions for serial port access
- Try refreshing the page

### Compilation Errors

**Problem:** Code fails to compile

**Solutions:**
- Verify Arduino CLI cores are installed: `arduino-cli core list`
- Install missing cores: `arduino-cli core install <core-name>`
- Check code syntax and board compatibility
- Review error messages in the upload status

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Web Serial API** - USB serial communication
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web server
- **Arduino CLI** - Code compilation and upload

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

For issues, questions, or contributions, please open an issue on [GitHub](https://github.com/hadefuwa/eblocks-companion-app/issues).

## 🙏 Acknowledgments

- [Matrix TSL](https://www.matrixtsl.com/) for the E-Blocks system
- [Arduino](https://www.arduino.cc/) for Arduino CLI and platform support
- Web Serial API specification and browser implementations

---

<div align="center">

Made with ❤️ for the E-Blocks 3 community

[⭐ Star this repo](https://github.com/hadefuwa/eblocks-companion-app) if you find it helpful!

</div>
