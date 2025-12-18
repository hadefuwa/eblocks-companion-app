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
    if (!checkWebSerialSupport()) {
      setError('Web Serial API is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const port = await navigator.serial.requestPort()
      
      await port.open({ baudRate: 115200 })
      
      const info = {
        manufacturer: port.getInfo().usbVendorId ? `Vendor: 0x${port.getInfo().usbVendorId?.toString(16)}` : 'Unknown',
        product: port.getInfo().usbProductId ? `Product: 0x${port.getInfo().usbProductId?.toString(16)}` : 'Unknown',
        name: port.getInfo().serialNumber || 'E-Blocks 3 Device'
      }

      // Try to get more info from the port
      const portInfo = port.getInfo()
      
      // Detect board type based on various characteristics
      let boardType = 'Unknown'
      const nameUpper = info.name.toUpperCase()
      const vendorId = portInfo.usbVendorId?.toString(16) || ''
      const productId = portInfo.usbProductId?.toString(16) || ''
      
      // Check for EBLOCKS3 ARD MEGA (Arduino Mega)
      if (nameUpper.includes('MEGA') || nameUpper.includes('ARD MEGA') || nameUpper.includes('ARDUINO')) {
        boardType = 'Arduino Mega'
      } 
      // Check for ESP32
      else if (nameUpper.includes('ESP32') || nameUpper.includes('ESP-32')) {
        boardType = 'ESP32'
      } 
      // Check for PIC
      else if (nameUpper.includes('PIC') || nameUpper.includes('EBLOCKS3 PIC')) {
        boardType = 'PIC'
      }
      // Try to detect from vendor/product IDs (common Arduino/ESP32 IDs)
      else if (vendorId === '2341' || vendorId === '2a03') { // Arduino vendor IDs
        boardType = 'Arduino Mega'
      } else if (vendorId === '10c4' || vendorId === '1a86') { // Common ESP32/CH340 vendor IDs
        // Could be ESP32 or Arduino clone
        boardType = 'ESP32' // Default to ESP32, user can change
      }

      setCurrentPort(port)
      onConnect(port, { ...info, boardType, port: port })
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
        await currentPort.close()
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

      {!checkWebSerialSupport() && (
        <div className="browser-warning">
          <p>⚠️ Web Serial API requires Chrome or Edge browser</p>
        </div>
      )}
    </div>
  )
}

export default DeviceConnection

