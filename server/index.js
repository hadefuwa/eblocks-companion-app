import express from 'express'
import cors from 'cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const execAsync = promisify(exec)
const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, '../client/dist')))

// Ensure temp directories exist
const tempDir = join(__dirname, 'temp')
const uploadsDir = join(__dirname, 'uploads')

async function ensureDirectories() {
  try {
    await mkdir(tempDir, { recursive: true })
    await mkdir(uploadsDir, { recursive: true })
  } catch (error) {
    console.error('Error creating directories:', error)
  }
}

ensureDirectories()

// Helper function to find Arduino CLI
async function findArduinoCLI() {
  try {
    // Try common locations
    const commands = [
      'arduino-cli',
      'arduino-cli.exe',
      process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
    ]

    for (const cmd of commands) {
      try {
        await execAsync(`"${cmd}" version`)
        return cmd
      } catch (error) {
        continue
      }
    }

    // Try with which/where
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    try {
      const { stdout } = await execAsync(`${whichCmd} arduino-cli`)
      return stdout.trim()
    } catch (error) {
      throw new Error('Arduino CLI not found. Please install it from https://arduino.github.io/arduino-cli/')
    }
  } catch (error) {
    throw new Error('Arduino CLI not found. Please install it from https://arduino.github.io/arduino-cli/')
  }
}

// Get list of available serial ports
app.get('/api/ports', async (req, res) => {
  try {
    const arduinoCLI = await findArduinoCLI()
    const { stdout } = await execAsync(`"${arduinoCLI}" board list`)
    
    const ports = []
    const lines = stdout.split('\n').slice(1) // Skip header
    
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
    
    res.json({ success: true, ports })
  } catch (error) {
    console.error('Error getting ports:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get serial ports' 
    })
  }
})

// Upload code to device
app.post('/api/upload', async (req, res) => {
  const { code, board, port: portName } = req.body

  if (!code) {
    return res.status(400).json({ success: false, error: 'No code provided' })
  }

  if (!board) {
    return res.status(400).json({ success: false, error: 'No board specified' })
  }

  let arduinoCLI
  let sketchDir
  let sketchFile

  try {
    // Find Arduino CLI
    arduinoCLI = await findArduinoCLI()

    // Create temporary sketch directory
    const timestamp = Date.now()
    sketchDir = join(tempDir, `sketch_${timestamp}`)
    await mkdir(sketchDir, { recursive: true })

    // Write code to .ino file
    sketchFile = join(sketchDir, 'sketch.ino')
    await writeFile(sketchFile, code, 'utf8')

    // Update core index and install board if needed
    console.log('Updating core index...')
    try {
      await execAsync(`"${arduinoCLI}" core update-index`, { timeout: 60000 })
    } catch (error) {
      console.warn('Core update failed, continuing...', error.message)
    }

    // Install board core if not already installed
    const coreName = board.split(':').slice(0, 2).join(':')
    console.log(`Installing core: ${coreName}...`)
    try {
      await execAsync(`"${arduinoCLI}" core install ${coreName}`, { timeout: 120000 })
    } catch (error) {
      console.warn('Core install failed, may already be installed:', error.message)
    }

    // Compile the sketch
    console.log('Compiling sketch...')
    const compileCommand = `"${arduinoCLI}" compile --fqbn ${board} "${sketchDir}"`
    const compileResult = await execAsync(compileCommand, { timeout: 120000 })
    
    if (compileResult.stderr && !compileResult.stderr.includes('Sketch uses')) {
      console.warn('Compile warnings:', compileResult.stderr)
    }

    // Find the port automatically if not specified
    let uploadPort = portName
    if (!uploadPort || uploadPort === 'auto') {
      const { stdout: portList } = await execAsync(`"${arduinoCLI}" board list`)
      const lines = portList.split('\n').slice(1)
      const firstPort = lines.find(line => line.trim() && !line.includes('Disconnected'))
      if (firstPort) {
        uploadPort = firstPort.trim().split(/\s+/)[0]
      }
    }

    if (!uploadPort) {
      return res.status(400).json({ 
        success: false, 
        error: 'No serial port found. Please connect your device.' 
      })
    }

    // Upload the sketch
    console.log(`Uploading to port: ${uploadPort}...`)
    const uploadCommand = `"${arduinoCLI}" upload -p ${uploadPort} --fqbn ${board} "${sketchDir}"`
    const uploadResult = await execAsync(uploadCommand, { timeout: 60000 })

    // Clean up
    await rm(sketchDir, { recursive: true, force: true })

    res.json({ 
      success: true, 
      message: 'Code uploaded successfully',
      port: uploadPort,
      output: uploadResult.stdout
    })

  } catch (error) {
    console.error('Upload error:', error)
    
    // Clean up on error
    if (sketchDir) {
      try {
        await rm(sketchDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
    }

    // Parse error message
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Check Arduino CLI installation
app.get('/api/check-cli', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`API available at http://localhost:${PORT}/api`)
})

