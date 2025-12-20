import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const electron = require('electron')
console.log('=== Electron Module Debug ===')
console.log('Type:', typeof electron)
console.log('Has app?:', !!electron?.app)
if (!electron || !electron.app) {
  console.error('FATAL: Electron APIs not available!')
  console.error('This usually means the electron module is not properly installed')
  console.error('Try: npm install electron@latest')
  process.exit(1)
}
const { app, BrowserWindow, Menu, ipcMain } = electron
import express from 'express'
import cors from 'cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const execAsync = promisify(exec)
let mainWindow = null
let serverProcess = null
const PORT = 3000

// Store active serial port connections
const serialConnections = new Map()
// Store serial data buffers for polling
const serialDataBuffers = new Map()

// Start Express server
async function startServer() {
  const serverApp = express()
  
  // Middleware
  serverApp.use(cors())
  serverApp.use(express.json({ limit: '10mb' }))
  
  // Serve static files from renderer folder (development) or client/dist (packaged)
  const clientDistPath = app.isPackaged
    ? join(process.resourcesPath, 'client/dist')
    : join(__dirname, 'renderer')
  
  serverApp.use(express.static(clientDistPath))
  
  // Serve assets folder
  const assetsPath = app.isPackaged
    ? join(process.resourcesPath, 'assets')
    : join(__dirname, '../assets')
  
  serverApp.use('/assets', express.static(assetsPath))
  
  // Serve node_modules for Monaco Editor (development only)
  if (!app.isPackaged) {
    const nodeModulesPath = join(__dirname, '../node_modules')
    serverApp.use('/node_modules', express.static(nodeModulesPath))
  }

  // Ensure temp directories exist
  const tempDir = app.isPackaged
    ? join(app.getPath('userData'), 'temp')
    : join(app.getPath('temp'), 'eblocks-companion')
  const uploadsDir = app.isPackaged
    ? join(app.getPath('userData'), 'uploads')
    : join(app.getPath('temp'), 'eblocks-companion')

  await mkdir(tempDir, { recursive: true })
  await mkdir(uploadsDir, { recursive: true })

  // Helper function to find Arduino CLI
  async function findArduinoCLI() {
    // First, try to find bundled Arduino CLI
    if (app.isPackaged) {
      // In packaged app, look in resources folder
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const platform = process.platform
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
      const exeName = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
      const bundledPath = join(resourcesPath, 'resources', 'arduino-cli', platform, arch, exeName)
      
      try {
        // Check if bundled CLI exists and is executable
        const { access, constants } = await import('fs/promises')
        await access(bundledPath, constants.F_OK)
        // Test if it works
        await execAsync(`"${bundledPath}" version`)
        console.log(`Using bundled Arduino CLI: ${bundledPath}`)
        return `"${bundledPath}"`
      } catch (error) {
        console.log('Bundled Arduino CLI not found, trying system PATH...')
      }
    } else {
      // In development, check local resources folder
      const platform = process.platform
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
      const exeName = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
      const localPath = join(__dirname, '../resources/arduino-cli', platform, arch, exeName)
      
      try {
        const { access, constants } = await import('fs/promises')
        await access(localPath, constants.F_OK)
        await execAsync(`"${localPath}" version`)
        console.log(`Using local Arduino CLI: ${localPath}`)
        return `"${localPath}"`
      } catch (error) {
        console.log('Local Arduino CLI not found, trying system PATH...')
      }
    }

    // Fall back to system PATH
    try {
      const commands = [
        'arduino-cli',
        'arduino-cli.exe',
        process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
      ]

      for (const cmd of commands) {
        try {
          await execAsync(`"${cmd}" version`)
          console.log(`Using system Arduino CLI: ${cmd}`)
          return cmd
        } catch (error) {
          continue
        }
      }

      const whichCmd = process.platform === 'win32' ? 'where' : 'which'
      try {
        const { stdout } = await execAsync(`${whichCmd} arduino-cli`)
        const path = stdout.trim()
        console.log(`Using system Arduino CLI: ${path}`)
        return path
      } catch (error) {
        throw new Error('Arduino CLI not found. Please install it from https://arduino.github.io/arduino-cli/ or rebuild the app with bundled CLI.')
      }
    } catch (error) {
      throw new Error('Arduino CLI not found. Please install it from https://arduino.github.io/arduino-cli/ or rebuild the app with bundled CLI.')
    }
  }

  // API Routes
  serverApp.get('/api/ports', async (req, res) => {
    try {
      const arduinoCLI = await findArduinoCLI()
      const { stdout } = await execAsync(`"${arduinoCLI}" board list`)
      
      const ports = []
      const lines = stdout.split('\n').slice(1)
      
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 2) {
            const portName = parts[0]
            const boardName = parts.slice(1).join(' ') || 'Unknown'
            const fqbn = parts.find(p => p.includes(':')) || null
            
            // Try to get more details using arduino-cli board details
            let detectedFQBN = fqbn
            let usbInfo = null
            
            // Get USB VID/PID from serialport if available
            try {
              const portList = await SerialPort.list()
              const portInfo = portList.find(p => p.path === portName)
              if (portInfo) {
                usbInfo = {
                  vendorId: portInfo.vendorId,
                  productId: portInfo.productId,
                  manufacturer: portInfo.manufacturer,
                  product: portInfo.product,
                  pnpId: portInfo.pnpId,
                  serialNumber: portInfo.serialNumber,
                  friendlyName: portInfo.friendlyName
                }
                
                // Log full port info for debugging
                console.log('Full port info for', portName, ':', JSON.stringify(portInfo, null, 2))
                
                // Try to identify E-Blocks boards using multiple methods
                // Method 1: Check VID/PID - E-Blocks boards have specific vendor/product IDs
                const vendorId = (portInfo.vendorId || '').toUpperCase()
                const productId = (portInfo.productId || '').toUpperCase()
                
                // Known E-Blocks VID/PID combinations
                // VID 12BF appears to be E-Blocks specific
                const eblocksVIDs = ['12BF'] // Add more as discovered
                const eblocksArduinoMegaPIDs = ['0030'] // Add more as discovered
                const eblocksESP32PIDs = [] // Add ESP32 PIDs when discovered
                const eblocksPICPIDs = [] // Add PIC PIDs when discovered
                
                if (eblocksVIDs.includes(vendorId)) {
                  if (eblocksArduinoMegaPIDs.includes(productId)) {
                    detectedFQBN = 'arduino:avr:mega'
                    console.log('Detected E-Blocks Arduino Mega from VID/PID:', vendorId, productId)
                  } else if (eblocksESP32PIDs.includes(productId)) {
                    detectedFQBN = 'esp32:esp32:esp32'
                    console.log('Detected E-Blocks ESP32 from VID/PID:', vendorId, productId)
                  } else if (eblocksPICPIDs.includes(productId)) {
                    detectedFQBN = 'pic'
                    console.log('Detected E-Blocks PIC from VID/PID:', vendorId, productId)
                  }
                }
                
                // Method 2: Check serial number pattern - E-Blocks serials often start with "EB"
                if (!detectedFQBN && portInfo.serialNumber) {
                  const serial = portInfo.serialNumber.toUpperCase()
                  if (serial.startsWith('EB')) {
                    // E-Blocks serial number detected, try to determine type from other clues
                    // For now, default to Arduino Mega if we can't determine
                    // Could be enhanced with more specific patterns
                    console.log('Detected E-Blocks board from serial number pattern:', serial)
                    // We'll use friendlyName or other methods to determine specific type
                  }
                }
                
                // Method 3: Check friendlyName, product name, manufacturer, or pnpId for keywords
                // This works if E-Blocks driver is installed
                if (!detectedFQBN) {
                  const friendlyName = (portInfo.friendlyName || '').toLowerCase()
                  const productName = (portInfo.product || '').toLowerCase()
                  const manufacturer = (portInfo.manufacturer || '').toLowerCase()
                  const pnpId = (portInfo.pnpId || '').toLowerCase()
                  const combined = `${friendlyName} ${productName} ${manufacturer} ${pnpId}`
                  
                  if (combined.includes('eblocks') || combined.includes('eblocks3')) {
                    if (combined.includes('mega') || combined.includes('ard')) {
                      detectedFQBN = 'arduino:avr:mega'
                      console.log('Detected E-Blocks Arduino Mega from device name (friendlyName:', portInfo.friendlyName, ')')
                    } else if (combined.includes('esp32')) {
                      detectedFQBN = 'esp32:esp32:esp32'
                      console.log('Detected E-Blocks ESP32 from device name')
                    } else if (combined.includes('pic')) {
                      detectedFQBN = 'pic'
                      console.log('Detected E-Blocks PIC from device name')
                    }
                  }
                }
                
                // Method 4: If we detected it's an E-Blocks board (by VID or serial) but don't know the type,
                // and we have VID 12BF with PID 0030, it's likely Arduino Mega based on current evidence
                if (!detectedFQBN && vendorId === '12BF' && productId === '0030') {
                  detectedFQBN = 'arduino:avr:mega'
                  console.log('Detected E-Blocks Arduino Mega from known VID/PID combination (12BF:0030)')
                }
              }
            } catch (serialError) {
              console.log('Could not get USB info for', portName, ':', serialError.message)
            }
            
            // If no FQBN from Arduino CLI, try board details command
            if (!detectedFQBN && portName) {
              try {
                const { stdout: detailsStdout } = await execAsync(`"${arduinoCLI}" board details -p ${portName}`, { timeout: 5000 })
                // Parse FQBN from board details output
                const fqbnMatch = detailsStdout.match(/FQBN:\s*([^\s]+)/i)
                if (fqbnMatch) {
                  detectedFQBN = fqbnMatch[1]
                }
              } catch (detailsError) {
                // Board details might not work for all boards, that's okay
                console.log('Could not get board details for', portName)
              }
            }
            
            ports.push({
              port: portName,
              board: boardName,
              fqbn: detectedFQBN,
              usbInfo: usbInfo
            })
          }
        }
      }
      
      res.json({ success: true, ports })
    } catch (error) {
      console.error('Error getting ports:', error)
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get serial ports' 
      })
    }
  })

  serverApp.post('/api/upload', async (req, res) => {
    const { code, board, port: portName } = req.body

    if (!code) {
      return res.status(400).json({ success: false, error: 'No code provided' })
    }

    if (!board) {
      return res.status(400).json({ success: false, error: 'No board specified' })
    }

    // Ensure the port is not in use by our serial connection
    const uploadPort = portName || 'auto'
    if (uploadPort !== 'auto' && serialConnections.has(uploadPort)) {
      console.log(`Port ${uploadPort} is in use, closing connection...`)
      const connection = serialConnections.get(uploadPort)
      serialConnections.delete(uploadPort)
      serialDataBuffers.delete(uploadPort)
      
      if (connection && connection.serialPort.isOpen) {
        await new Promise((resolve) => {
          connection.serialPort.close((error) => {
            if (error) console.error('Close error:', error)
            // Wait for port to be fully released by OS
            setTimeout(resolve, 2000)
          })
        })
      }
      console.log(`Port ${uploadPort} released, proceeding with upload...`)
    }

    let arduinoCLI
    let sketchDir
    let sketchFile

    try {
      arduinoCLI = await findArduinoCLI()

      const timestamp = Date.now()
      const sketchName = `sketch_${timestamp}`
      sketchDir = join(tempDir, sketchName)
      await mkdir(sketchDir, { recursive: true })

      // Arduino CLI requires the main file to have the same name as the folder
      sketchFile = join(sketchDir, `${sketchName}.ino`)
      await writeFile(sketchFile, code, 'utf8')

      console.log('Updating core index...')
      try {
        await execAsync(`"${arduinoCLI}" core update-index`, { timeout: 60000 })
      } catch (error) {
        console.warn('Core update failed, continuing...', error.message)
      }

      const coreName = board.split(':').slice(0, 2).join(':')
      console.log(`Installing core: ${coreName}...`)
      try {
        await execAsync(`"${arduinoCLI}" core install ${coreName}`, { timeout: 120000 })
      } catch (error) {
        console.warn('Core install failed, may already be installed:', error.message)
      }

      console.log('Compiling sketch...')
      const compileCommand = `"${arduinoCLI}" compile --fqbn ${board} "${sketchDir}"`
      const compileResult = await execAsync(compileCommand, { timeout: 120000 })
      
      if (compileResult.stderr && !compileResult.stderr.includes('Sketch uses')) {
        console.warn('Compile warnings:', compileResult.stderr)
      }

      let finalUploadPort = uploadPort
      if (!finalUploadPort || finalUploadPort === 'auto') {
        console.log('Port not specified or set to auto, detecting available ports...')
        const { stdout: portList } = await execAsync(`"${arduinoCLI}" board list`)
        const lines = portList.split('\n').slice(1)
        // Filter out COM1 (usually system port) and prefer EBLOCKS devices
        const eblocksPort = lines.find(line => {
          const upper = line.toUpperCase()
          return line.trim() && !line.includes('Disconnected') && 
                 (upper.includes('EBLOCKS') || upper.includes('MEGA') || upper.includes('ARDUINO'))
        })
        const firstPort = eblocksPort || lines.find(line => line.trim() && !line.includes('Disconnected'))
        if (firstPort) {
          finalUploadPort = firstPort.trim().split(/\s+/)[0]
          console.log(`Auto-detected port: ${finalUploadPort}`)
        }
      } else {
        console.log(`Using specified port: ${finalUploadPort}`)
      }

      if (!finalUploadPort) {
        return res.status(400).json({ 
          success: false, 
          error: 'No serial port found. Please connect your device.' 
        })
      }

      // Double-check port is not in use
      if (serialConnections.has(finalUploadPort)) {
        console.warn(`Warning: Port ${finalUploadPort} still appears to be in use`)
        // Force close it
        const conn = serialConnections.get(finalUploadPort)
        serialConnections.delete(finalUploadPort)
        if (conn && conn.serialPort.isOpen) {
          conn.serialPort.close()
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      console.log(`Uploading to port: ${finalUploadPort}...`)
      const uploadCommand = `"${arduinoCLI}" upload -p ${finalUploadPort} --fqbn ${board} "${sketchDir}"`
      const uploadResult = await execAsync(uploadCommand, { timeout: 60000 })

      await rm(sketchDir, { recursive: true, force: true })

      res.json({ 
        success: true, 
        message: 'Code uploaded successfully',
        port: finalUploadPort,
        output: uploadResult.stdout
      })

    } catch (error) {
      console.error('Upload error:', error)
      
      if (sketchDir) {
        try {
          await rm(sketchDir, { recursive: true, force: true })
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
      }

      let errorMessage = error.message || 'Upload failed'
      if (error.stderr) {
        errorMessage = error.stderr
      } else if (error.stdout) {
        errorMessage = error.stdout
      }

      res.status(500).json({ 
        success: false, 
        error: errorMessage 
      })
    }
  })

  serverApp.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  serverApp.get('/api/check-cli', async (req, res) => {
    try {
      const arduinoCLI = await findArduinoCLI()
      const { stdout } = await execAsync(`"${arduinoCLI}" version`)
      res.json({ 
        success: true, 
        installed: true, 
        version: stdout.trim(),
        path: arduinoCLI
      })
    } catch (error) {
      res.json({ 
        success: false, 
        installed: false, 
        error: error.message 
      })
    }
  })

  // Connect to serial port
  serverApp.post('/api/connect', async (req, res) => {
    const { port, baudRate = 115200 } = req.body

    if (!port) {
      return res.status(400).json({ success: false, error: 'Port not specified' })
    }

    try {
      // Check if already connected
      if (serialConnections.has(port)) {
        return res.json({ 
          success: true, 
          connectionId: port,
          message: 'Already connected'
        })
      }

      // Create serial port connection
      const serialPort = new SerialPort({
        path: port,
        baudRate: parseInt(baudRate),
        autoOpen: false
      })

      const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }))

      // Handle data
      parser.on('data', (data) => {
        const dataString = data.toString()
        // Store in buffer for polling
        if (!serialDataBuffers.has(port)) {
          serialDataBuffers.set(port, [])
        }
        serialDataBuffers.get(port).push(dataString)
        // Keep only last 1000 messages
        if (serialDataBuffers.get(port).length > 1000) {
          serialDataBuffers.get(port).shift()
        }
        // Also send via IPC if window exists
        if (mainWindow) {
          mainWindow.webContents.send('serial-data', { port, data: dataString })
        }
      })

      // Handle errors
      serialPort.on('error', (error) => {
        console.error(`Serial port error on ${port}:`, error)
        serialConnections.delete(port)
      })

      // Open port
      await new Promise((resolve, reject) => {
        serialPort.open((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })

      serialConnections.set(port, { serialPort, parser })

      res.json({ 
        success: true, 
        connectionId: port,
        message: `Connected to ${port}`
      })
    } catch (error) {
      console.error('Connection error:', error)
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to connect to port'
      })
    }
  })

  // Disconnect from serial port
  serverApp.post('/api/disconnect', async (req, res) => {
    const { connectionId } = req.body

    if (!connectionId) {
      return res.status(400).json({ success: false, error: 'Connection ID not specified' })
    }

    try {
      const connection = serialConnections.get(connectionId)
      if (connection) {
        // Remove from map first to prevent new operations
        serialConnections.delete(connectionId)
        serialDataBuffers.delete(connectionId)
        
        // Close the port
        await new Promise((resolve) => {
          if (connection.serialPort.isOpen) {
            connection.serialPort.close((error) => {
              if (error) console.error('Close error:', error)
              // Wait longer for the port to be fully released by Windows
              setTimeout(resolve, 2000)
            })
          } else {
            resolve()
          }
        })
        
        res.json({ success: true, message: 'Disconnected' })
      } else {
        res.json({ success: true, message: 'Already disconnected' })
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to disconnect'
      })
    }
  })

  // Get serial data (polling endpoint)
  serverApp.get('/api/serial/data/:connectionId', (req, res) => {
    const { connectionId } = req.params
    const buffer = serialDataBuffers.get(connectionId) || []
    
    // Return all data and clear buffer
    const data = [...buffer]
    serialDataBuffers.set(connectionId, [])
    
    res.json({ success: true, data })
  })

  // Send data to serial port
  serverApp.post('/api/serial/send', async (req, res) => {
    const { connectionId, data } = req.body

    if (!connectionId || !data) {
      return res.status(400).json({ success: false, error: 'Connection ID and data required' })
    }

    try {
      const connection = serialConnections.get(connectionId)
      if (!connection) {
        return res.status(404).json({ success: false, error: 'Connection not found' })
      }

      connection.serialPort.write(data, (error) => {
        if (error) {
          res.status(500).json({ success: false, error: error.message })
        } else {
          res.json({ success: true })
        }
      })
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to send data' 
      })
    }
  })

  // Catch-all handler: send back index.html file
  // This must be last, after all API routes
  serverApp.get('*', (req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'))
  })

  // Start server
  return new Promise((resolve, reject) => {
    const server = serverApp.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      resolve()
    })
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!`)
        console.error('Please close any other instances of the app or stop other services using port 3000.\n')
        console.error('You can find what\'s using the port with:')
        console.error('  Windows: netstat -ano | findstr :3000')
        console.error('  macOS/Linux: lsof -i :3000\n')
        reject(error)
      } else {
        reject(error)
      }
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false, // Don't show until ready
    frame: true, // Keep native frame for dark mode
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1e1e1e', // VS Code dark background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow Web Serial API
      enableBlinkFeatures: 'Serial', // Enable Web Serial API
      experimentalFeatures: true,
      devTools: true // Enable DevTools (but hidden on startup)
    },
    icon: join(__dirname, '../assets/icon.png'), // Optional: add icon
    title: 'E-Blocks 3 Companion',
    // Windows dark mode title bar
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: '#252526',
        symbolColor: '#cccccc',
        height: 35
      }
    })
  })

  // Load the app - always from local server
  // The Express server serves the built React app
  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Disable application menu (no menu bar)
  Menu.setApplicationMenu(null)

  // Show window when ready (in windowed mode)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Center the window on screen
    mainWindow.center()
    // DevTools are enabled but hidden - user can toggle with F12, Ctrl+Shift+I, or View menu
  })

  // Add keyboard shortcut to toggle DevTools (F12 or Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
    }
  })

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (errorCode === -105) {
      // ERR_NAME_NOT_RESOLVED - server not ready yet
      console.log('Waiting for server to start...')
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}`)
      }, 1000)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    // Start the Express server first
    await startServer()
    
    // Then create the window
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Clean up server process if needed
  if (serverProcess) {
    serverProcess.kill()
  }
})

