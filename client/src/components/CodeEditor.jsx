import { useState, useRef } from 'react'
import axios from 'axios'
import './CodeEditor.css'

function CodeEditor({ port, isConnected, deviceInfo }) {
  const [code, setCode] = useState(`void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("LED OFF");
  delay(1000);
}`)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [selectedBoard, setSelectedBoard] = useState('arduino:avr:mega')
  const textareaRef = useRef(null)

  const boardOptions = [
    { value: 'arduino:avr:mega', label: 'Arduino Mega', fqbn: 'arduino:avr:mega' },
    { value: 'esp32:esp32:esp32', label: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  ]

  const handleUpload = async () => {
    if (!isConnected) {
      setUploadStatus({ type: 'error', message: 'Please connect a device first' })
      return
    }

    if (!code.trim()) {
      setUploadStatus({ type: 'error', message: 'Please enter some code to upload' })
      return
    }

    setIsUploading(true)
    setUploadStatus({ type: 'info', message: 'Compiling code...' })

    try {
      // Determine board type from device info or selection
      let boardFQBN = selectedBoard
      if (deviceInfo?.boardType === 'Arduino Mega') {
        boardFQBN = 'arduino:avr:mega'
      } else if (deviceInfo?.boardType === 'ESP32') {
        boardFQBN = 'esp32:esp32:esp32'
      }

      // Get port name from Web Serial API
      // Note: We need to get the port path from the backend
      setUploadStatus({ type: 'info', message: 'Uploading code...' })

      const response = await axios.post('/api/upload', {
        code,
        board: boardFQBN,
        port: 'auto' // Backend will detect the port
      }, {
        timeout: 60000 // 60 second timeout for compilation
      })

      if (response.data.success) {
        setUploadStatus({ 
          type: 'success', 
          message: 'Code uploaded successfully!' 
        })
      } else {
        setUploadStatus({ 
          type: 'error', 
          message: response.data.error || 'Upload failed' 
        })
      }
    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: error.response?.data?.error || error.message || 'Upload failed' 
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sketch.ino'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ino,.txt,.cpp,.c'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setCode(event.target.result)
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>Code Editor</h2>
        <div className="editor-actions">
          <button onClick={handleLoad} className="btn btn-sm btn-outline">
            Load
          </button>
          <button onClick={handleSave} className="btn btn-sm btn-outline">
            Save
          </button>
        </div>
      </div>

      <div className="board-selector">
        <label htmlFor="board-select">Board Type:</label>
        <select
          id="board-select"
          value={selectedBoard}
          onChange={(e) => setSelectedBoard(e.target.value)}
          disabled={!isConnected}
        >
          {boardOptions.map(option => (
            <option key={option.value} value={option.fqbn}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-container">
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="code-textarea"
          placeholder="Enter your Arduino code here..."
          spellCheck={false}
        />
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}

      <div className="upload-actions">
        <button
          onClick={handleUpload}
          disabled={!isConnected || isUploading}
          className="btn btn-primary btn-upload"
        >
          {isUploading ? 'Uploading...' : 'Upload Code'}
        </button>
        {isConnected && (
          <p className="upload-note">
            Note: If upload fails, try disconnecting and reconnecting the device, or close the Serial Monitor temporarily.
          </p>
        )}
      </div>
    </div>
  )
}

export default CodeEditor

