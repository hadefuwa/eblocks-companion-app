import { useState, useRef } from 'react'
import Editor from '@monaco-editor/react'
import './CodeEditor.css'

const DEFAULT_CODE = `/*
  Title:     E-Blocks 3 Mega + Combo Board Serial Monitor Example
  Company:   Matrix TSL (E-Blocks 3 System)
  Date:      11 November 2025
  Author:    Example Program for Educational Use

  Description:
  -------------------------------------------------------------
  This example program demonstrates how to read all 8 digital
  inputs from Port A and Port B on an E-Blocks 3 Combo Board
  (EB083) when connected to an E-Blocks 3 Arduino Mega board.

  The input states are displayed on the Arduino Serial Monitor
  using Serial2, since the E-Blocks 3 Mega board routes its USB
  connection to UART2 instead of the default Serial0.

  Port A and Port B each provide 8 digital I/O lines.
  The program continuously reads all pins and prints their
  HIGH (1) or LOW (0) logic states in order.

  Notes:
  - Connect the Combo Board directly to Port A and Port B headers
    on the E-Blocks 3 Mega.
  - The leftmost switch corresponds to bit 0 (LSB).
  - The rightmost switch corresponds to bit 7 (MSB).
  - Open the Serial Monitor at 115200 baud.
  - Each line shows the full port state, updating every 0.5 s.
  -------------------------------------------------------------
*/

// Port A pin mapping (confirmed correct)
int portA[] = {29, 28, 27, 26, 25, 24, 23, 22};

// Port B pin mapping (leftmost switch = bit 0, rightmost = bit 7)
int portB[] = {13, 12, 11, 10, 50, 51, 52, 53};

void setup() {
  // Begin serial communication on Serial2 at 115200 baud.
  // The E-Blocks 3 Mega uses Serial2 for its USB-to-PC connection.
  Serial2.begin(115200);
  delay(2000); // Allow time for Serial Monitor to open

  // Display program header
  Serial2.println("=== E-Blocks 3 Mega + Combo Board ===");
  Serial2.println("Digital Input Monitor Example");
  Serial2.println("Port A and Port B Logic States");
  Serial2.println("Baud: 115200");
  Serial2.println("-------------------------------------");
  Serial2.println();

  // Configure Port A and Port B pins as inputs
  for (int i = 0; i < 8; i++) {
    pinMode(portA[i], INPUT);
    pinMode(portB[i], INPUT);
  }
}

void loop() {
  // Display the current state of all Port A inputs
  Serial2.print("Port A: ");
  for (int i = 0; i < 8; i++) {
    int state = digitalRead(portA[i]);  // Read each digital pin
    Serial2.print(state);
    Serial2.print(" ");
  }

  // Display the current state of all Port B inputs
  Serial2.print("| Port B: ");
  for (int i = 0; i < 8; i++) {
    int state = digitalRead(portB[i]);  // Read each digital pin
    Serial2.print(state);
    Serial2.print(" ");
  }

  Serial2.println();  // Move to the next line for the next reading
  delay(500);         // Wait 0.5 s between updates
}`

function CodeEditor({ port, isConnected, deviceInfo }) {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [selectedBoard, setSelectedBoard] = useState('arduino:avr:mega')
  const editorRef = useRef(null)

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

      // Use Electron IPC if available, otherwise fall back to HTTP
      let result
      if (window.electronAPI) {
        result = await window.electronAPI.uploadCode({
          code,
          board: boardFQBN,
          port: port?.path || 'auto'
        })
      } else {
        // Fallback for web version (if needed)
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, board: boardFQBN, port: 'auto' })
        })
        result = await response.json()
      }

      if (result.success) {
        setUploadStatus({ 
          type: 'success', 
          message: result.message || 'Code uploaded successfully!' 
        })
      } else {
        setUploadStatus({ 
          type: 'error', 
          message: result.error || 'Upload failed' 
        })
      }
    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Upload failed' 
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
        <Editor
          height="100%"
          defaultLanguage="cpp"
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={(editor) => { editorRef.current = editor }}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            padding: { top: 10 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
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

