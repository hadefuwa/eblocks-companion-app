import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SetupPage from './components/SetupPage'
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
  const [selectedPortPath, setSelectedPortPath] = useState(null)

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

  const handlePortSelect = (portPath) => {
    setSelectedPortPath(portPath)
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
      <header className="app-titlebar">
        <div className="titlebar-icon">⚡</div>
        <div className="titlebar-title">E-Blocks 3 Companion</div>
        <div className="titlebar-menu">
          <ArduinoCLIStatus />
        </div>
      </header>

      <main className="app-container">
        <Sidebar side="left" defaultWidth={300}>
          <SetupPage
            onPortSelect={handlePortSelect}
            selectedPort={selectedPortPath}
          />
          <DeviceConnection
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            isConnected={isConnected}
            deviceInfo={deviceInfo}
          />
        </Sidebar>

        <div className="app-main">
          <CodeEditor
            port={port}
            isConnected={isConnected}
            deviceInfo={deviceInfo}
          />
        </div>

        <Sidebar side="right" defaultWidth={400}>
          <SerialMonitor
            port={port}
            isConnected={isConnected}
            onData={handleSerialData}
            data={serialData}
          />
        </Sidebar>
      </main>
    </div>
  )
}

export default App

