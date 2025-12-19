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
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const execAsync = promisify(exec)
let mainWindow = null

// Store active serial port connections
const serialConnections = new Map()
// Store serial data buffers for polling
const serialDataBuffers = new Map()

// Ensure temp directories exist
const tempDir = app.isPackaged
  ? join(app.getPath('userData'), 'temp')
  : join(__dirname, '../temp')
const uploadsDir = app.isPackaged
  ? join(app.getPath('userData'), 'uploads')
  : join(__dirname, '../uploads')

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

// Initialize temp directories
async function initializeDirectories() {
  await mkdir(tempDir, { recursive: true })
  await mkdir(uploadsDir, { recursive: true })
}

// IPC Handlers - Convert HTTP endpoints to IPC

// Get available ports
ipcMain.handle('get-ports', async () => {
  try {
    const arduinoCLI = await findArduinoCLI()
    const { stdout } = await execAsync(`"${arduinoCLI}" board list`)
    
    const ports = []
    const lines = stdout.split('\n').slice(1)
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
          ports.push({
            port: parts[0],
            board: parts.slice(1).join(' ') || 'Unknown',
            fqbn: parts.find(p => p.includes(':')) || null
          })
        }
      }
    }
    
    return { success: true, ports }
  } catch (error) {
    console.error('Error getting ports:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to get serial ports' 
    }
  }
})

// Upload code
ipcMain.handle('upload-code', async (event, { code, board, port: portName }) => {
  if (!code) {
    return { success: false, error: 'No code provided' }
  }

  if (!board) {
    return { success: false, error: 'No board specified' }
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
      return { 
        success: false, 
        error: 'No serial port found. Please connect your device.' 
      }
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

    return { 
      success: true, 
      message: 'Code uploaded successfully',
      port: finalUploadPort,
      output: uploadResult.stdout
    }

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

    return { 
      success: false, 
      error: errorMessage 
    }
  }
})

// Check Arduino CLI
ipcMain.handle('check-cli', async () => {
  try {
    const arduinoCLI = await findArduinoCLI()
    const { stdout } = await execAsync(`"${arduinoCLI}" version`)
    return { 
      success: true, 
      installed: true, 
      version: stdout.trim(),
      path: arduinoCLI
    }
  } catch (error) {
    return { 
      success: false, 
      installed: false, 
      error: error.message 
    }
  }
})

// Connect to serial port
ipcMain.handle('serial-connect', async (event, { port, baudRate = 115200 }) => {
  if (!port) {
    return { success: false, error: 'Port not specified' }
  }

  try {
    // Check if already connected
    if (serialConnections.has(port)) {
      return { 
        success: true, 
        connectionId: port,
        message: 'Already connected'
      }
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

    return { 
      success: true, 
      connectionId: port,
      message: `Connected to ${port}`
    }
  } catch (error) {
    console.error('Connection error:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to connect to port'
    }
  }
})

// Disconnect from serial port
ipcMain.handle('serial-disconnect', async (event, { connectionId }) => {
  if (!connectionId) {
    return { success: false, error: 'Connection ID not specified' }
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
      
      return { success: true, message: 'Disconnected' }
    } else {
      return { success: true, message: 'Already disconnected' }
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Failed to disconnect' 
    }
  }
})

// Get serial data
ipcMain.handle('serial-get-data', async (event, { connectionId }) => {
  const buffer = serialDataBuffers.get(connectionId) || []
  
  // Return all data and clear buffer
  const data = [...buffer]
  serialDataBuffers.set(connectionId, [])
  
  return { success: true, data }
})

// Send data to serial port
ipcMain.handle('serial-send', async (event, { connectionId, data: dataToSend }) => {
  if (!connectionId || !dataToSend) {
    return { success: false, error: 'Connection ID and data required' }
  }

  try {
    const connection = serialConnections.get(connectionId)
    if (!connection) {
      return { success: false, error: 'Connection not found' }
    }

    return new Promise((resolve) => {
      connection.serialPort.write(dataToSend, (error) => {
        if (error) {
          resolve({ success: false, error: error.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Failed to send data' 
    }
  }
})

async function createWindow() {
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
      preload: join(__dirname, 'preload.js'),
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

  // Load the HTML app
  if (app.isPackaged) {
    // In production, load from resources
    const htmlPath = join(process.resourcesPath, 'renderer/index.html')
    mainWindow.loadFile(htmlPath)
  } else {
    // In development, load from renderer folder
    const htmlPath = join(__dirname, '../renderer/index.html')
    mainWindow.loadFile(htmlPath)
  }

  // Disable application menu (no menu bar)
  Menu.setApplicationMenu(null)

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Center the window on screen
    mainWindow.center()
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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    // Initialize directories
    await initializeDirectories()
    
    // Create the window
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error('Failed to initialize app:', error.message)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Close all serial connections
  for (const [port, connection] of serialConnections.entries()) {
    if (connection.serialPort.isOpen) {
      connection.serialPort.close()
    }
  }
  serialConnections.clear()
  serialDataBuffers.clear()
})
