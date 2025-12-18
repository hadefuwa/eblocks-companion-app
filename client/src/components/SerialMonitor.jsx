import { useState, useEffect, useRef } from 'react'
import './SerialMonitor.css'

function SerialMonitor({ port, isConnected, onData, data }) {
  const [baudRate, setBaudRate] = useState(115200)
  const [isReading, setIsReading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState('')
  const monitorRef = useRef(null)
  const readerRef = useRef(null)

  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

  useEffect(() => {
    if (port && isConnected) {
      startReading()
    } else {
      stopReading()
    }

    return () => {
      stopReading()
    }
  }, [port, isConnected, baudRate])

  useEffect(() => {
    if (autoScroll && monitorRef.current) {
      monitorRef.current.scrollTop = monitorRef.current.scrollHeight
    }
  }, [data, autoScroll])

  const startReading = async () => {
    if (!port || isReading) return

    try {
      // Close existing reader if any
      if (readerRef.current) {
        await readerRef.current.cancel()
      }

      setIsReading(true)
      const reader = port.readable.getReader()
      readerRef.current = reader

      while (true) {
        const { value, done } = await reader.read()
        
        if (done) {
          break
        }

        if (value) {
          // Convert Uint8Array to string
          const text = new TextDecoder().decode(value)
          if (onData) {
            onData(text)
          }
        }
      }
    } catch (error) {
      console.error('Serial read error:', error)
      setIsReading(false)
    }
  }

  const stopReading = async () => {
    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
        await readerRef.current.releaseLock()
      } catch (error) {
        console.error('Error stopping reader:', error)
      }
      readerRef.current = null
    }
    setIsReading(false)
  }

  const sendData = async (text) => {
    if (!port || !isConnected) return

    try {
      const writer = port.writable.getWriter()
      const encoder = new TextEncoder()
      await writer.write(encoder.encode(text))
      writer.releaseLock()
    } catch (error) {
      console.error('Serial write error:', error)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    const input = e.target.elements['serial-input']
    const text = input.value
    if (text.trim()) {
      sendData(text + '\n')
      input.value = ''
    }
  }

  const clearMonitor = () => {
    window.dispatchEvent(new CustomEvent('clearSerialMonitor'))
  }

  const filteredData = filter
    ? data.filter(item => item.data.toLowerCase().includes(filter.toLowerCase()))
    : data

  return (
    <div className="serial-monitor">
      <div className="monitor-header">
        <h2>Serial Monitor</h2>
        <div className="monitor-controls">
          <label>
            Baud Rate:
            <select
              value={baudRate}
              onChange={(e) => {
                setBaudRate(Number(e.target.value))
                // Reconnect with new baud rate
                if (port && isConnected) {
                  stopReading().then(() => {
                    // Note: Web Serial API doesn't support changing baud rate on the fly
                    // User would need to reconnect
                  })
                }
              }}
              disabled={isConnected}
            >
              {baudRates.map(rate => (
                <option key={rate} value={rate}>{rate}</option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button onClick={clearMonitor} className="btn btn-sm btn-outline">
            Clear
          </button>
        </div>
      </div>

      <div className="monitor-filter">
        <input
          type="text"
          placeholder="Filter messages..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
        />
      </div>

      <div className="monitor-content" ref={monitorRef}>
        {filteredData.length === 0 ? (
          <div className="monitor-empty">
            {isConnected ? 'Waiting for data...' : 'Not connected'}
          </div>
        ) : (
          filteredData.map((item, index) => (
            <div key={index} className="monitor-line">
              <span className="monitor-timestamp">
                {item.timestamp.toLocaleTimeString()}
              </span>
              <span className="monitor-data">{item.data}</span>
            </div>
          ))
        )}
      </div>

      <div className="monitor-input-section">
        <form onSubmit={handleSend} className="monitor-input-form">
          <input
            type="text"
            name="serial-input"
            placeholder="Type message to send..."
            disabled={!isConnected}
            className="monitor-input"
          />
          <button
            type="submit"
            disabled={!isConnected}
            className="btn btn-primary btn-send"
          >
            Send
          </button>
        </form>
      </div>

      {isConnected && (
        <div className="monitor-status">
          <div className={`status-indicator ${isReading ? 'active' : ''}`}></div>
          <span>{isReading ? 'Reading' : 'Paused'}</span>
        </div>
      )}
    </div>
  )
}

export default SerialMonitor

