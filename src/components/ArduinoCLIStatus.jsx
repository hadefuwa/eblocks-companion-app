import { useState, useEffect } from 'react'
import './ArduinoCLIStatus.css'

function ArduinoCLIStatus() {
  const [status, setStatus] = useState({ loading: true, installed: false, error: null, version: null })

  useEffect(() => {
    checkCLI()
  }, [])

  const checkCLI = async () => {
    try {
      let result
      if (window.electronAPI) {
        result = await window.electronAPI.checkCLI()
      } else {
        // Fallback for web version
        const response = await fetch('/api/check-cli')
        result = await response.json()
      }
      setStatus({
        loading: false,
        installed: result.installed,
        error: result.error || null,
        version: result.version || null
      })
    } catch (error) {
      setStatus({
        loading: false,
        installed: false,
        error: 'Failed to check Arduino CLI status',
        version: null
      })
    }
  }

  if (status.loading) {
    return (
      <div className="cli-status">
        <span className="status-text">Checking Arduino CLI...</span>
      </div>
    )
  }

  if (!status.installed) {
    return (
      <div className="cli-status error">
        <span className="status-icon">⚠️</span>
        <div className="status-content">
          <strong>Arduino CLI not found</strong>
          <p>Code upload requires Arduino CLI. <a href="https://arduino.github.io/arduino-cli/" target="_blank" rel="noopener noreferrer">Install it here</a></p>
        </div>
        <button onClick={checkCLI} className="btn-refresh">Refresh</button>
      </div>
    )
  }

  return (
    <div className="cli-status success">
      <span className="status-icon">✓</span>
      <div className="status-content">
        <strong>Arduino CLI installed</strong>
        {status.version && <p>Version: {status.version}</p>}
      </div>
    </div>
  )
}

export default ArduinoCLIStatus

