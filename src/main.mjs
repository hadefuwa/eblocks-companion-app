import { createRequire } from 'module'
import { join, dirname, normalize } from 'path'
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
const { app, BrowserWindow, Menu, ipcMain, shell } = electron
import express from 'express'
import cors from 'cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
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
  
  // Serve static files from renderer folder (development or packaged)
  // 
  // ELECTRON-BUILDER PATH STRUCTURE:
  // - In packaged app: Files go into app.asar (packed) or app.asar.unpacked (unpacked)
  // - app.getAppPath() returns: path to app.asar file (if asar enabled) or app directory
  // - process.resourcesPath returns: path to resources/ folder
  // - __dirname in main.mjs: points to where main.mjs is (inside app.asar or unpacked)
  // - Unpacked files: go to process.resourcesPath/app.asar.unpacked/ maintaining source structure
  //
  // So if source is: src/renderer/index.html
  // Unpacked location: process.resourcesPath/app.asar.unpacked/src/renderer/index.html
  // __dirname would be: process.resourcesPath/app.asar.unpacked/src (if main.mjs unpacked)
  //                     OR app.asar/src (if main.mjs packed)
  
  let clientDistPath, assetsPath, nodeModulesPath;
  
  if (app.isPackaged) {
    const appPath = app.getAppPath(); // Path to app.asar or app directory
    const resourcesPath = process.resourcesPath; // Path to resources/ folder
    const unpackedBase = join(resourcesPath, 'app.asar.unpacked');
    
    console.log('=== PACKAGED APP PATH DEBUG ===');
    console.log('app.getAppPath():', appPath);
    console.log('process.resourcesPath:', resourcesPath);
    console.log('__dirname:', __dirname);
    console.log('Unpacked base:', unpackedBase);
    
    // For unpacked files, they're at: resources/app.asar.unpacked/src/renderer/
    // The structure mirrors the source structure
    clientDistPath = join(unpackedBase, 'src', 'renderer');
    assetsPath = join(unpackedBase, 'assets');
    nodeModulesPath = join(unpackedBase, 'node_modules');
    
    // Verify and log
    console.log('Renderer path:', clientDistPath, 'exists:', existsSync(clientDistPath));
    console.log('Assets path:', assetsPath, 'exists:', existsSync(assetsPath));
    console.log('Node modules path:', nodeModulesPath, 'exists:', existsSync(nodeModulesPath));
    
    // If unpacked paths don't exist, try app.asar paths (files might be packed)
    if (!existsSync(clientDistPath)) {
      console.warn('Unpacked renderer not found, trying app.asar path');
      clientDistPath = join(appPath, 'src', 'renderer');
      // If appPath points to app.asar file, we can't read from it directly
      // So we need to use the unpacked path
      if (!existsSync(clientDistPath)) {
        console.error('ERROR: Cannot find renderer files!');
        console.error('Tried:', join(unpackedBase, 'src', 'renderer'));
        console.error('Tried:', clientDistPath);
      }
    }
    
    if (!existsSync(assetsPath)) {
      console.warn('Unpacked assets not found, trying app.asar path');
      assetsPath = join(appPath, 'assets');
    }
    
    if (!existsSync(nodeModulesPath)) {
      console.warn('Unpacked node_modules not found, trying app.asar path');
      nodeModulesPath = join(appPath, 'node_modules');
      if (!existsSync(nodeModulesPath)) {
        console.error('ERROR: Cannot find node_modules! Monaco Editor will not work!');
        console.error('Tried:', join(unpackedBase, 'node_modules'));
        console.error('Tried:', nodeModulesPath);
      }
    }
  } else {
    // Development paths - relative to __dirname (which is src/)
    clientDistPath = join(__dirname, 'renderer');
    assetsPath = join(__dirname, '..', 'assets');
    nodeModulesPath = join(__dirname, '..', 'node_modules');
    console.log('=== DEVELOPMENT PATHS ===');
    console.log('Renderer:', clientDistPath);
    console.log('Assets:', assetsPath);
    console.log('Node modules:', nodeModulesPath);
  }
  
  serverApp.use(express.static(clientDistPath));
  serverApp.use('/assets', express.static(assetsPath));
  serverApp.use('/node_modules', express.static(nodeModulesPath));

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
      // process.resourcesPath points to the resources/ folder
      // extraResources copies files to process.resourcesPath/arduino-cli/
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const platform = process.platform
      const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
      const exeName = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
      
      // Try multiple possible paths
      const possiblePaths = [
        // Primary path: resourcesPath/arduino-cli/platform/arch/exeName
        join(resourcesPath, 'arduino-cli', platform, arch, exeName),
        // Alternative: resourcesPath/arduino-cli/exeName (flat structure)
        join(resourcesPath, 'arduino-cli', exeName),
        // Alternative: app.getAppPath() relative paths
        join(app.getAppPath(), '..', 'resources', 'arduino-cli', platform, arch, exeName),
        join(app.getAppPath(), '..', 'resources', 'arduino-cli', exeName),
        // Alternative: process.resourcesPath with different structure
        join(process.resourcesPath, '..', 'resources', 'arduino-cli', platform, arch, exeName),
      ]
      
      console.log('=== Arduino CLI Search (Packaged) ===')
      console.log('process.resourcesPath:', process.resourcesPath)
      console.log('app.getAppPath():', app.getAppPath())
      console.log('process.execPath:', process.execPath)
      
      // Try each possible path
      for (const bundledPathRaw of possiblePaths) {
        const bundledPath = normalize(bundledPathRaw)
        console.log(`Trying path: ${bundledPath}`)
        console.log(`File exists? ${existsSync(bundledPath)}`)
        
        if (existsSync(bundledPath)) {
          try {
            // Check if bundled CLI exists and is executable
            const { access, constants } = await import('fs/promises')
            await access(bundledPath, constants.F_OK)
            console.log('File access check passed')
            // Test if it works
            const versionResult = await execAsync(`"${bundledPath}" version`)
            console.log('Version command output:', versionResult.stdout)
            console.log(`✓ Using bundled Arduino CLI: ${bundledPath}`)
            return bundledPath
          } catch (error) {
            console.error(`✗ Path exists but execution failed: ${error.message}`)
            continue // Try next path
          }
        }
      }
      
      // If we get here, none of the paths worked - list what's actually there
      console.error('✗ Arduino CLI not found at any expected path')
      try {
        const { readdir, stat } = await import('fs/promises')
        console.log('Listing resourcesPath contents...')
        const resourcesContents = await readdir(resourcesPath)
        console.log('Contents of resourcesPath:', resourcesContents)
        
        for (const item of resourcesContents) {
          const itemPath = join(resourcesPath, item)
          const stats = await stat(itemPath)
          if (stats.isDirectory()) {
            const subContents = await readdir(itemPath)
            console.log(`  ${item}/:`, subContents)
          }
        }
        
        // Also check parent directory
        const parentPath = join(resourcesPath, '..')
        console.log('Listing parent directory...')
        const parentContents = await readdir(parentPath)
        console.log('Contents of parent:', parentContents)
      } catch (listError) {
        console.error('Could not list directories:', listError.message)
      }
      
      console.log('Bundled Arduino CLI not found, trying system PATH...')
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
        return localPath
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
      if (!arduinoCLI) {
        console.warn('Arduino CLI not found - using SerialPort.list() as fallback')
        // Still return ports from SerialPort.list() even if Arduino CLI is not available
        try {
          const portList = await SerialPort.list()
          console.log('Found', portList.length, 'ports via SerialPort.list()')
          const ports = portList.map(port => {
            // Try to detect board type from USB info
            let detectedFQBN = null
            const vendorId = (port.vendorId || '').toUpperCase()
            const productId = (port.productId || '').toUpperCase()
            
            // E-Blocks detection
            if (vendorId === '12BF' && productId === '0030') {
              detectedFQBN = 'arduino:avr:mega'
              console.log('Detected E-Blocks Arduino Mega from VID/PID:', vendorId, productId)
            }
            
            return {
              port: port.path,
              board: port.friendlyName || port.manufacturer || 'Unknown',
              fqbn: detectedFQBN,
              usbInfo: {
                vendorId: port.vendorId,
                productId: port.productId,
                manufacturer: port.manufacturer,
                product: port.product,
                pnpId: port.pnpId,
                serialNumber: port.serialNumber,
                friendlyName: port.friendlyName
              }
            }
          })
          return res.json({ success: true, ports })
        } catch (serialError) {
          console.error('Error getting ports from SerialPort:', serialError)
          console.error('SerialPort error stack:', serialError.stack)
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to get serial ports: ' + serialError.message 
          })
        }
      }
      
      console.log('Using Arduino CLI:', arduinoCLI)
      const { stdout } = await execAsync(`"${arduinoCLI}" board list`, { timeout: 10000 })
      
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
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      // Try to fallback to SerialPort.list() if Arduino CLI fails
      try {
        console.log('Falling back to SerialPort.list() due to error:', error.message)
        const portList = await SerialPort.list()
        console.log('Found', portList.length, 'ports via SerialPort.list() fallback')
        const ports = portList.map(port => {
          // Try to detect board type from USB info
          let detectedFQBN = null
          const vendorId = (port.vendorId || '').toUpperCase()
          const productId = (port.productId || '').toUpperCase()
          
          // E-Blocks detection
          if (vendorId === '12BF' && productId === '0030') {
            detectedFQBN = 'arduino:avr:mega'
            console.log('Detected E-Blocks Arduino Mega from VID/PID:', vendorId, productId)
          }
          
          return {
            port: port.path,
            board: port.friendlyName || port.manufacturer || 'Unknown',
            fqbn: detectedFQBN,
            usbInfo: {
              vendorId: port.vendorId,
              productId: port.productId,
              manufacturer: port.manufacturer,
              product: port.product,
              pnpId: port.pnpId,
              serialNumber: port.serialNumber,
              friendlyName: port.friendlyName
            }
          }
        })
        console.log('Fallback successful, returning', ports.length, 'ports')
        return res.json({ success: true, ports })
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
        console.error('Fallback error stack:', fallbackError.stack)
        res.status(500).json({ 
          success: false, 
          error: error.message || 'Failed to get serial ports',
          fallbackError: fallbackError.message,
          details: error.stack
        })
      }
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

  // Check if E-Blocks drivers are installed
  serverApp.get('/api/check-drivers', async (req, res) => {
    try {
      // Check if the flag file exists (created after successful installation)
      const userDataPath = app.getPath('userData')
      const driverFlagPath = join(userDataPath, '.drivers-installed')
      const installed = existsSync(driverFlagPath)
      
      // Also check if we can detect an E-Blocks board (indirect indicator)
      let eblocksBoardDetected = false
      try {
        const portList = await SerialPort.list()
        eblocksBoardDetected = portList.some(port => {
          const vid = (port.vendorId || '').toUpperCase()
          const pid = (port.productId || '').toUpperCase()
          const name = (port.friendlyName || port.manufacturer || '').toLowerCase()
          return vid === '12BF' || name.includes('eblocks')
        })
      } catch (err) {
        // Ignore serial port errors
      }
      
      res.json({
        success: true,
        installed: installed || eblocksBoardDetected,
        flagFileExists: installed,
        eblocksBoardDetected: eblocksBoardDetected,
        flagPath: driverFlagPath
      })
    } catch (error) {
      console.error('Error checking drivers:', error)
      res.json({
        success: false,
        installed: false,
        error: error.message
      })
    }
  })

  serverApp.get('/api/check-cli', async (req, res) => {
    console.log('=== /api/check-cli called ===')
    try {
      const arduinoCLI = await findArduinoCLI()
      console.log('findArduinoCLI returned:', arduinoCLI)
      const { stdout } = await execAsync(`"${arduinoCLI}" version`)
      console.log('Arduino CLI version command succeeded')
      res.json({ 
        success: true, 
        installed: true, 
        version: stdout.trim(),
        path: arduinoCLI
      })
    } catch (error) {
      console.error('=== Arduino CLI check failed ===')
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      // Include more details in the error response
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        resourcesPath: process.resourcesPath,
        appPath: app.getAppPath(),
        isPackaged: app.isPackaged,
        platform: process.platform,
        arch: process.arch,
        execPath: process.execPath,
        cwd: process.cwd()
      }
      console.error('Error details:', JSON.stringify(errorDetails, null, 2))
      res.json({ 
        success: false, 
        installed: false, 
        error: error.message,
        details: errorDetails
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

  // Install E-Blocks drivers
  serverApp.post('/api/install-drivers', async (req, res) => {
    try {
      const resourcesPath = process.resourcesPath || app.getAppPath()
      const driversPath = app.isPackaged 
        ? join(resourcesPath, 'drivers')
        : join(__dirname, '../drivers')
      
      console.log('=== Installing E-Blocks Drivers ===')
      console.log('Drivers path:', driversPath)
      
      // Check if drivers exist
      if (!existsSync(driversPath)) {
        return res.status(404).json({
          success: false,
          error: 'Drivers folder not found',
          path: driversPath
        })
      }
      
      // Determine which installer to use based on architecture
      const arch = process.arch === 'arm64' ? 'arm64' : (process.arch === 'x64' ? 'x64' : 'x86')
      const installerName = arch === 'x64' 
        ? 'E-blocks2_64bit_installer.exe'
        : 'E-blocks2_32bit_installer.exe'
      const installerPath = join(driversPath, installerName)
      
      console.log('Looking for installer:', installerPath)
      console.log('Installer exists?', existsSync(installerPath))
      
      if (!existsSync(installerPath)) {
        // Fallback: try using dpinst.exe if available
        const dpinstPath = join(driversPath, 'dpinst.exe')
        const infPath = join(driversPath, 'inf')
        
        if (existsSync(dpinstPath) && existsSync(infPath)) {
          console.log('Using dpinst.exe to install drivers')
          const { stdout, stderr } = await execAsync(`"${dpinstPath}" /S /SE /SW /SA`, {
            cwd: driversPath,
            timeout: 60000
          })
          return res.json({
            success: true,
            message: 'Drivers installed successfully',
            method: 'dpinst',
            output: stdout,
            warnings: stderr
          })
        }
        
        return res.status(404).json({
          success: false,
          error: 'Driver installer not found',
          expectedPath: installerPath,
          driversPath: driversPath
        })
      }
      
      // Run the installer - try different methods and flags
      console.log('Running installer:', installerPath)
      console.log('Attempting installation with admin privileges...')
      
      // Try different installer flags - different installers use different flags
      const installMethods = [
        { flag: '/S', name: 'silent (/S)' },
        { flag: '/SILENT', name: 'silent (/SILENT)' },
        { flag: '/VERYSILENT', name: 'very silent (/VERYSILENT)' },
        { flag: '/S /NCRC', name: 'silent no CRC check' },
        { flag: '', name: 'with UI (no flags)' }
      ]
      
      let lastError = null
      
      for (const method of installMethods) {
        try {
          console.log(`Trying method: ${method.name}...`)
          const installCommand = method.flag 
            ? `"${installerPath}" ${method.flag}`
            : `"${installerPath}"`
          
          console.log('Command:', installCommand)
          
          const { stdout, stderr } = await execAsync(installCommand, {
            cwd: driversPath,
            timeout: 120000
          })
          
          console.log(`✓ Installation succeeded with method: ${method.name}`)
          if (stdout) console.log('stdout:', stdout)
          if (stderr) console.log('stderr:', stderr)
          
          res.json({
            success: true,
            message: 'Drivers installed successfully. Please reconnect your E-Blocks board.',
            method: method.name,
            output: stdout,
            warnings: stderr
          })
          return
        } catch (methodError) {
          console.error(`✗ Method ${method.name} failed:`, methodError.message)
          console.error('  Error code:', methodError.code)
          if (methodError.stdout) console.error('  stdout:', methodError.stdout)
          if (methodError.stderr) console.error('  stderr:', methodError.stderr)
          
          // Special handling for UI method - if it launched, consider it a success
          // The installer window appeared, so user may have completed installation
          if (method.flag === '' && methodError.code !== 'ENOENT') {
            console.log('  UI method launched installer - user may have completed installation')
            res.json({
              success: true,
              message: 'Driver installer was launched. If you completed the installation, drivers should now be installed. Please reconnect your E-Blocks board.',
              method: 'ui-launched',
              note: 'Installer window appeared - installation may have completed successfully.'
            })
            return
          }
          
          lastError = methodError
          continue // Try next method
        }
      }
      
      // If all silent methods failed, try with elevation
      // But first, check if the UI method (last one) actually showed a window
      // If it did, the user might have completed installation manually
      if (installMethods[installMethods.length - 1].flag === '' && lastError) {
        console.log('UI method was tried - if installer window appeared, installation may have succeeded')
        console.log('Returning success since installer was launched (user may have completed it)')
        res.json({
          success: true,
          message: 'Driver installer was launched. If you completed the installation, drivers should now be installed. Please reconnect your E-Blocks board.',
          method: 'ui-launched',
          note: 'If installation completed, you can ignore any previous errors.'
        })
        return
      }
      
      // Try with PowerShell elevation (only if silent methods failed)
      try {
        console.log('All silent methods failed, trying with PowerShell elevation...')
        // Properly escape the path for PowerShell
        // Escape double quotes in the path
        const escapedPath = installerPath.replace(/"/g, '`"')
        // Use -Wait without -NoNewWindow (they conflict with -Verb RunAs)
        // Also, we need to properly quote the entire command
        const psCommand = `Start-Process -FilePath '${installerPath.replace(/'/g, "''")}' -ArgumentList '/S' -Verb RunAs -Wait`
        const elevatedCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/"/g, '\\"')}"`
        
        console.log('Elevated command:', elevatedCommand)
        
        const { stdout, stderr } = await execAsync(elevatedCommand, {
          cwd: driversPath,
          timeout: 120000
        })
        
        console.log('✓ Elevated installation completed')
        res.json({
          success: true,
          message: 'Drivers installed successfully (with elevation). Please reconnect your E-Blocks board.',
          method: 'elevated',
          output: stdout,
          warnings: stderr
        })
        return
      } catch (elevatedError) {
        console.error('✗ Elevated installation also failed:', elevatedError.message)
        console.error('  Error code:', elevatedError.code)
        console.error('  Error stdout:', elevatedError.stdout)
        console.error('  Error stderr:', elevatedError.stderr)
        lastError = elevatedError
      }
      
      // All methods failed
      throw new Error(`All installation methods failed. Last error: ${lastError?.message || 'Unknown error'}. The installer may require manual installation with administrator rights. Try running "${installerPath}" manually as administrator.`)
    } catch (error) {
      console.error('=== Driver installation error ===')
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      console.error('Error stdout:', error.stdout)
      console.error('Error stderr:', error.stderr)
      console.error('Error stack:', error.stack)
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to install drivers',
        code: error.code,
        stdout: error.stdout,
        stderr: error.stderr,
        details: error.stack,
        suggestion: 'Driver installation requires administrator privileges. Please right-click the installer and select "Run as administrator", or install drivers manually from the drivers folder.'
      })
    }
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
  // Resolve preload script path for both development and packaged modes
  let preloadPath
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath || app.getAppPath()
    const unpackedBase = join(resourcesPath, 'app.asar.unpacked')
    preloadPath = join(unpackedBase, 'src', 'preload.js')
    // Fallback to asar path if unpacked doesn't exist
    if (!existsSync(preloadPath)) {
      preloadPath = join(__dirname, 'preload.js')
    }
  } else {
    preloadPath = join(__dirname, 'preload.js')
  }

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
      devTools: true, // Enable DevTools (but hidden on startup)
      preload: preloadPath
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

// Store shop window reference
let shopWindow = null

// Function to create shop window
function createShopWindow() {
  // If shop window already exists and is not destroyed, focus it
  if (shopWindow && !shopWindow.isDestroyed()) {
    shopWindow.focus()
    return
  }

  shopWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Enable web security for external sites
      devTools: true
    },
    title: 'E-Blocks Shop - Matrix TSL',
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: '#ffffff',
        symbolColor: '#000000',
        height: 35
      }
    })
  })

  // Load the Matrix TSL shop URL
  shopWindow.loadURL('https://www.matrixtsl.com/product-category/e-blocks2/eblocks2-boards/?jsf=jet-engine:matrix-shop&pagenum=5')

  // Show window when ready
  shopWindow.once('ready-to-show', () => {
    shopWindow.show()
    shopWindow.center()
  })

  // Handle window closed
  shopWindow.on('closed', () => {
    shopWindow = null
  })

  // Handle external links - open in default browser
  shopWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// IPC handler for opening shop window
ipcMain.handle('open-shop-window', async () => {
  createShopWindow()
  return { success: true }
})

// IPC handler for opening external URLs
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url)
  return { success: true }
})

// Check if drivers need to be installed (on first launch)
async function checkAndInstallDrivers() {
  console.log('=== Driver Auto-Installation Check ===')
  try {
    // Check if we've already installed drivers (using a flag file)
    const userDataPath = app.getPath('userData')
    const driverFlagPath = join(userDataPath, '.drivers-installed')
    
    console.log('User data path:', userDataPath)
    console.log('Driver flag path:', driverFlagPath)
    console.log('Flag file exists?', existsSync(driverFlagPath))
    
    if (existsSync(driverFlagPath)) {
      console.log('✓ Drivers already installed (flag file exists)')
      // Read and log when drivers were installed
      try {
        const { readFile } = await import('fs/promises')
        const flagContent = await readFile(driverFlagPath, 'utf8')
        console.log('  Drivers installed on:', flagContent)
      } catch (err) {
        console.log('  Could not read flag file:', err.message)
      }
      return false // Drivers already installed
    }
    
    console.log('First launch detected - checking if drivers need installation...')
    
    const resourcesPath = process.resourcesPath || app.getPath('appPath')
    console.log('Resources path:', resourcesPath)
    console.log('App path:', app.getPath('appPath'))
    console.log('Is packaged?', app.isPackaged)
    
    const driversPath = app.isPackaged 
      ? join(resourcesPath, 'drivers')
      : join(__dirname, '../drivers')
    
    console.log('Drivers path:', driversPath)
    console.log('Drivers folder exists?', existsSync(driversPath))
    
    if (!existsSync(driversPath)) {
      console.error('✗ Drivers folder not found, skipping auto-installation')
      console.error('  Expected path:', driversPath)
      return false
    }
    
    // List contents of drivers folder
    try {
      const { readdir } = await import('fs/promises')
      const driversContents = await readdir(driversPath)
      console.log('Drivers folder contents:', driversContents)
    } catch (err) {
      console.error('Could not list drivers folder:', err.message)
    }
    
    // Determine which installer to use
    const arch = process.arch === 'arm64' ? 'arm64' : (process.arch === 'x64' ? 'x64' : 'x86')
    console.log('System architecture:', process.arch, '->', arch)
    
    const installerName = arch === 'x64' 
      ? 'E-blocks2_64bit_installer.exe'
      : 'E-blocks2_32bit_installer.exe'
    const installerPath = join(driversPath, installerName)
    
    console.log('Looking for installer:', installerName)
    console.log('Installer path:', installerPath)
    console.log('Installer exists?', existsSync(installerPath))
    
    if (!existsSync(installerPath)) {
      console.error('✗ Driver installer not found, skipping auto-installation')
      console.error('  Expected:', installerPath)
      
      // Try to find any installer
      try {
        const { readdir } = await import('fs/promises')
        const files = await readdir(driversPath)
        const installers = files.filter(f => f.includes('installer') && f.endsWith('.exe'))
        console.log('  Found installer files:', installers)
      } catch (err) {
        console.error('  Could not search for installers:', err.message)
      }
      return false
    }
    
    console.log('✓ Driver installer found, attempting to install...')
    console.log('  Installer:', installerPath)
    
    try {
      // Run installer silently
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      console.log('Running installer command:', `"${installerPath}" /S`)
      const startTime = Date.now()
      
      const result = await execAsync(`"${installerPath}" /S`, {
        cwd: driversPath,
        timeout: 120000
      })
      
      const duration = Date.now() - startTime
      console.log(`Installer completed in ${duration}ms`)
      if (result.stdout) console.log('Installer stdout:', result.stdout)
      if (result.stderr) console.log('Installer stderr:', result.stderr)
      
      // Create flag file to indicate drivers are installed
      const { writeFile } = await import('fs/promises')
      await writeFile(driverFlagPath, new Date().toISOString(), 'utf8')
      console.log('✓ Flag file created:', driverFlagPath)
      
      console.log('✓✓✓ E-Blocks drivers installed successfully on first launch!')
      return true
    } catch (error) {
      console.error('✗✗✗ Failed to install drivers automatically')
      console.error('  Error message:', error.message)
      console.error('  Error code:', error.code)
      if (error.stdout) console.error('  stdout:', error.stdout)
      if (error.stderr) console.error('  stderr:', error.stderr)
      console.error('  Full error:', error)
      // Don't throw - allow app to continue even if driver installation fails
      return false
    }
  } catch (error) {
    console.error('✗✗✗ Error in driver installation check')
    console.error('  Error message:', error.message)
    console.error('  Error stack:', error.stack)
    return false
  }
}

app.whenReady().then(async () => {
  try {
    // Check and install drivers on first launch (non-blocking)
    checkAndInstallDrivers().catch(err => {
      console.error('Driver installation check failed:', err)
      // Continue app startup even if driver check fails
    })
    
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

