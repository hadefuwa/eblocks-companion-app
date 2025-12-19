import { useState, useEffect } from 'react'
import './DeviceConnection.css'

function DeviceConnection({ onConnect, onDisconnect, isConnected, deviceInfo }) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [currentPort, setCurrentPort] = useState(null)

  const checkWebSerialSupport = () => {
    if (!navigator.serial) {
      return false
    }
    return true
  }

  const connectDevice = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Use Electron IPC if available
      if (window.electronAPI) {
        // Get available ports
        const portsResult = await window.electronAPI.getPorts()
        if (!portsResult.success || portsResult.ports.length === 0) {
          setError('No devices found. Please connect your device via USB.')
          setIsConnecting(false)
          return
        }

        // For now, use the first available port (could add a port picker UI later)
        const selectedPort = portsResult.ports[0]
        const portName = selectedPort.port

        // Connect via Electron IPC
        const connectResult = await window.electronAPI.serialConnect({
          port: portName,
          baudRate: 115200
        })

        if (!connectResult.success) {
          setError(connectResult.error || 'Failed to connect to device')
          setIsConnecting(false)
          return
        }

        // Detect board type
        let boardType = 'Unknown'
        const boardName = selectedPort.board.toUpperCase()
        if (boardName.includes('MEGA') || boardName.includes('ARDUINO')) {
          boardType = 'Arduino Mega'
        } else if (boardName.includes('ESP32')) {
          boardType = 'ESP32'
        } else if (boardName.includes('PIC')) {
          boardType = 'PIC'
        }

        const info = {
          name: selectedPort.board || 'E-Blocks 3 Device',
          boardType: boardType,
          port: portName
        }

        setCurrentPort({ connectionId: connectResult.connectionId, port: portName })
        onConnect({ connectionId: connectResult.connectionId, port: portName }, info)
      } else if (checkWebSerialSupport()) {
        // Fallback to Web Serial API for browser
        const port = await navigator.serial.requestPort()
        await port.open({ baudRate: 115200 })
        
        const info = {
          manufacturer: port.getInfo().usbVendorId ? `Vendor: 0x${port.getInfo().usbVendorId?.toString(16)}` : 'Unknown',
          product: port.getInfo().usbProductId ? `Product: 0x${port.getInfo().usbProductId?.toString(16)}` : 'Unknown',
          name: port.getInfo().serialNumber || 'E-Blocks 3 Device'
        }

        const portInfo = port.getInfo()
        let boardType = 'Unknown'
        const nameUpper = info.name.toUpperCase()
        const vendorId = portInfo.usbVendorId?.toString(16) || ''
        
        if (nameUpper.includes('MEGA') || nameUpper.includes('ARD MEGA') || nameUpper.includes('ARDUINO')) {
          boardType = 'Arduino Mega'
        } else if (nameUpper.includes('ESP32') || nameUpper.includes('ESP-32')) {
          boardType = 'ESP32'
        } else if (nameUpper.includes('PIC') || nameUpper.includes('EBLOCKS3 PIC')) {
          boardType = 'PIC'
        } else if (vendorId === '2341' || vendorId === '2a03') {
          boardType = 'Arduino Mega'
        } else if (vendorId === '10c4' || vendorId === '1a86') {
          boardType = 'ESP32'
        }

        setCurrentPort(port)
        onConnect(port, { ...info, boardType, port: port })
      } else {
        setError('Serial communication not available. Please use Electron app or Chrome/Edge browser.')
      }
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setError('No device selected.')
      } else if (err.name === 'SecurityError') {
        setError('Permission denied. Please allow access to the serial port.')
      } else {
        setError(`Connection error: ${err.message}`)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectDevice = async () => {
    try {
      if (currentPort) {
        if (window.electronAPI && currentPort.connectionId) {
          // Disconnect via Electron IPC
          await window.electronAPI.serialDisconnect({ connectionId: currentPort.connectionId })
        } else if (currentPort.close) {
          // Web Serial API
          await currentPort.close()
        }
        setCurrentPort(null)
      }
      onDisconnect()
      setError(null)
    } catch (err) {
      setError(`Disconnect error: ${err.message}`)
    }
  }

  useEffect(() => {
    if (!checkWebSerialSupport()) {
      setError('Web Serial API is not supported. Please use Chrome or Edge browser.')
    }
  }, [])

  return (
    <div className="device-connection">
      <h2>Device Connection</h2>
      
      {!isConnected ? (
        <div className="connection-status disconnected">
          <div className="status-indicator"></div>
          <span>Not Connected</span>
        </div>
      ) : (
        <div className="connection-status connected">
          <div className="status-indicator"></div>
          <span>Connected</span>
        </div>
      )}

      {deviceInfo && (
        <div className="device-info">
          <div className="info-item">
            <strong>Device:</strong> {deviceInfo.name}
          </div>
          <div className="info-item">
            <strong>Board Type:</strong> {deviceInfo.boardType}
          </div>
          {deviceInfo.manufacturer && (
            <div className="info-item">
              <strong>Manufacturer:</strong> {deviceInfo.manufacturer}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="connection-actions">
        {!isConnected ? (
          <button
            onClick={connectDevice}
            disabled={isConnecting || !checkWebSerialSupport()}
            className="btn btn-primary"
          >
            {isConnecting ? 'Connecting...' : 'Connect Device'}
          </button>
        ) : (
          <button
            onClick={disconnectDevice}
            className="btn btn-secondary"
          >
            Disconnect
          </button>
        )}
      </div>

      {!window.electronAPI && !checkWebSerialSupport() && (
        <div className="browser-warning">
          <p>⚠️ Serial communication requires Electron app or Chrome/Edge browser</p>
        </div>
      )}
    </div>
  )
}

export default DeviceConnection

