import { useState, useEffect } from 'react'
import DeviceConnection from './components/DeviceConnection'
import CodeEditor from './components/CodeEditor'
import SerialMonitor from './components/SerialMonitor'
import ArduinoCLIStatus from './components/ArduinoCLIStatus'
import './App.css'

function App() {
  const [port, setPort] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [serialData, setSerialData] = useState([])

  const handleConnect = (connectedPort, info) => {
    setPort(connectedPort)
    setIsConnected(true)
    setDeviceInfo(info)
  }

  const handleDisconnect = () => {
    setPort(null)
    setIsConnected(false)
    setDeviceInfo(null)
    setSerialData([])
  }

  const handleSerialData = (data) => {
    setSerialData(prev => [...prev, { timestamp: new Date(), data }])
  }

  // Handle clear serial monitor event
  useEffect(() => {
    const handleClear = () => {
      setSerialData([])
    }
    window.addEventListener('clearSerialMonitor', handleClear)
    return () => window.removeEventListener('clearSerialMonitor', handleClear)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>E-Blocks 3 Companion</h1>
        <p>Connect, Upload, and Monitor your E-Blocks 3 devices</p>
      </header>

      <main className="app-main">
        <ArduinoCLIStatus />
        <div className="app-layout">
          <div className="left-panel">
            <DeviceConnection
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isConnected={isConnected}
              deviceInfo={deviceInfo}
            />
            
            <CodeEditor
              port={port}
              isConnected={isConnected}
              deviceInfo={deviceInfo}
            />
          </div>

          <div className="right-panel">
            <SerialMonitor
              port={port}
              isConnected={isConnected}
              onData={handleSerialData}
              data={serialData}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

