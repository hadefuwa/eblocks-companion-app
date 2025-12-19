import { useState, useEffect } from 'react'
import './SetupPage.css'

function SetupPage({ onPortSelect, selectedPort }) {
  const [ports, setPorts] = useState([])
  const [isScanning, setIsScanning] = useState(false)

  const scanPorts = async () => {
    setIsScanning(true)
    try {
      if (window.electronAPI && window.electronAPI.listPorts) {
        const availablePorts = await window.electronAPI.listPorts()
        setPorts(availablePorts)
      } else {
        // Web Serial API fallback
        const devices = await navigator.serial.getPorts()
        const portList = devices.map((port, index) => ({
          path: `Port ${index + 1}`,
          manufacturer: 'Unknown',
          serialNumber: '',
        }))
        setPorts(portList)
      }
    } catch (error) {
      console.error('Error scanning ports:', error)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    scanPorts()
  }, [])

  return (
    <div className="setup-page">
      <div className="setup-section">
        <div className="section-header">
          <h3>Connection Setup</h3>
        </div>

        <div className="setup-item">
          <label htmlFor="com-port-select">COM Port</label>
          <div className="port-selector-group">
            <select
              id="com-port-select"
              value={selectedPort || ''}
              onChange={(e) => onPortSelect(e.target.value)}
              className="port-select"
            >
              <option value="">Select a port...</option>
              {ports.map((port, index) => (
                <option key={index} value={port.path}>
                  {port.path}
                  {port.manufacturer && ` - ${port.manufacturer}`}
                </option>
              ))}
            </select>
            <button
              onClick={scanPorts}
              disabled={isScanning}
              className="btn-scan"
              title="Refresh ports"
            >
              {isScanning ? '⟳' : '↻'}
            </button>
          </div>
        </div>

        <div className="setup-item">
          <label>Status</label>
          <div className="status-indicator">
            <span className={`status-dot ${selectedPort ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {selectedPort ? `Connected to ${selectedPort}` : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      <div className="setup-section">
        <div className="section-header">
          <h3>Board Configuration</h3>
        </div>

        <div className="setup-item">
          <label htmlFor="board-type-select">Board Type</label>
          <select id="board-type-select" className="board-select">
            <option value="arduino:avr:mega">Arduino Mega 2560</option>
            <option value="esp32:esp32:esp32">ESP32 Dev Module</option>
            <option value="arduino:avr:uno">Arduino Uno</option>
            <option value="arduino:avr:nano">Arduino Nano</option>
          </select>
        </div>

        <div className="setup-item">
          <label htmlFor="baud-rate-select">Baud Rate</label>
          <select id="baud-rate-select" className="baud-select">
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200" selected>115200</option>
            <option value="230400">230400</option>
          </select>
        </div>
      </div>

      <div className="setup-section">
        <div className="section-header">
          <h3>About</h3>
        </div>
        <div className="about-text">
          <p>E-Blocks 3 Companion App</p>
          <p className="version">Version 1.0.0</p>
          <p className="description">
            Connect, program, and monitor your E-Blocks 3 devices with ease.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SetupPage
