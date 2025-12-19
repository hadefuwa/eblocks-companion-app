// Default Arduino code
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
}`;

// Global state
let monacoEditor = null;
let isConnected = false;
let selectedPort = null;
let detectedBoardFQBN = null; // Store the detected board FQBN from the connected port
let portInfoMap = new Map(); // Map to store port information (port -> {fqbn, board})
let serialData = [];

// Initialize Monaco Editor
require.config({ paths: { vs: '/node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
  const editorContainer = document.getElementById('monaco-editor');

  monacoEditor = monaco.editor.create(editorContainer, {
    value: DEFAULT_CODE,
    language: 'cpp',
    theme: 'vs-dark',
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
  });

  // Ensure editor resizes when window resizes
  window.addEventListener('resize', () => {
    if (monacoEditor) {
      monacoEditor.layout();
    }
  });

  // Force initial layout
  setTimeout(() => {
    if (monacoEditor) {
      monacoEditor.layout();
    }
  }, 100);
});

// Check Arduino CLI status on load (removed from UI, but kept for logging)
async function checkArduinoCLI() {
  try {
    const response = await fetch('/api/check-cli');
    const result = await response.json();
    if (result.success && result.installed) {
      console.log('Arduino CLI:', result.version);
    } else {
      console.warn('Arduino CLI not found');
    }
  } catch (error) {
    console.error('Arduino CLI check error:', error);
  }
}

// Refresh COM ports
async function refreshPorts() {
  const select = document.getElementById('com-port-select');
  const btn = document.getElementById('refresh-ports-btn');

  btn.disabled = true;
  btn.textContent = '⟳';

  try {
    const response = await fetch('/api/ports');
    const result = await response.json();
    select.innerHTML = '<option value="">Select a port...</option>';

    if (result.success && result.ports.length > 0) {
      result.ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.port;
        option.textContent = `${port.port} - ${port.board}`;
        option.dataset.fqbn = port.fqbn || '';
        select.appendChild(option);
        // Store port information
        portInfoMap.set(port.port, { fqbn: port.fqbn, board: port.board });
        // Debug logging
        console.log('Port detected:', port.port, 'Board:', port.board, 'FQBN:', port.fqbn, 'USB Info:', port.usbInfo);
      });
    }
  } catch (error) {
    console.error('Error refreshing ports:', error);
  } finally {
    btn.disabled = false;
    btn.textContent = '↻';
  }
}

// Update connection status
function updateConnectionStatus(connected, port = null, detectedFQBN = null) {
  isConnected = connected;
  selectedPort = port;
  if (detectedFQBN !== undefined) {
    detectedBoardFQBN = detectedFQBN;
  }

  const dot = document.getElementById('connection-status-dot');
  const text = document.getElementById('connection-status-text');
  const boardImage = document.getElementById('board-image');
  const boardSelect = document.getElementById('editor-board-select');
  const selectedBoardType = boardSelect ? boardSelect.value : null;

  // Check if the selected board type matches the detected board type
  // For PIC boards, Arduino CLI won't detect them, so allow connection without FQBN
  let boardTypeMatches = false;
  
  // Debug logging
  console.log('Board type check:', {
    selectedBoardType,
    detectedBoardFQBN,
    port,
    connected
  });
  
  if (selectedBoardType === 'pic') {
    // PIC boards won't be detected by Arduino CLI, so allow connection if port is selected
    boardTypeMatches = port !== null;
  } else if (selectedBoardType && detectedBoardFQBN) {
    // For Arduino/ESP32, check if FQBN matches the board type
    // Arduino CLI returns FQBN like "arduino:avr:mega:cpu=atmega2560" for Mega
    // We need to check if it starts with our board type
    if (selectedBoardType === 'arduino:avr:mega') {
      boardTypeMatches = detectedBoardFQBN.startsWith('arduino:avr:mega');
      console.log('Arduino Mega match check:', detectedBoardFQBN, 'starts with arduino:avr:mega?', boardTypeMatches);
    } else if (selectedBoardType === 'esp32:esp32:esp32') {
      boardTypeMatches = detectedBoardFQBN.startsWith('esp32:esp32');
    } else {
      // Exact match for other board types
      boardTypeMatches = detectedBoardFQBN === selectedBoardType || 
                         detectedBoardFQBN.startsWith(selectedBoardType + ':');
    }
  } else if (selectedBoardType && !detectedBoardFQBN && connected) {
    // If no FQBN detected, we should have detected it via USB info
    // If we still don't have it, the board couldn't be identified
    console.warn('Board type could not be detected for port', port, '- selected:', selectedBoardType);
    boardTypeMatches = false;
  }

  if (connected && port && boardTypeMatches) {
    dot.classList.add('connected');
    text.textContent = `Connected to ${port}`;
    // Update board image glow to green
    if (boardImage) {
      boardImage.classList.remove('disconnected');
      boardImage.classList.add('connected');
    }
  } else {
    dot.classList.remove('connected');
    if (connected && port && !boardTypeMatches) {
      text.textContent = `Connected to ${port} (board mismatch)`;
    } else {
      text.textContent = 'Not connected';
    }
    // Update board image glow to red
    if (boardImage) {
      boardImage.classList.remove('connected');
      boardImage.classList.add('disconnected');
    }
    // Stop polling when disconnected or board mismatch
    if (window.stopSerialPolling) {
      window.stopSerialPolling();
    }
  }
}

// Upload code
async function uploadCode() {
  if (!monacoEditor) {
    showUploadStatus('error', 'Editor not ready');
    return;
  }

  const code = monacoEditor.getValue();
  const board = document.getElementById('editor-board-select').value;
  const portSelect = document.getElementById('com-port-select');
  const port = portSelect.value || 'auto';

  if (!code.trim()) {
    showUploadStatus('error', 'Please enter some code to upload');
    return;
  }

  const uploadBtn = document.getElementById('upload-btn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Compiling...';
  showUploadStatus('info', 'Compiling code...');

  try {
    // Add a timeout wrapper
    const uploadPromise = fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, board, port }),
    }).then(res => res.json());
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Upload timeout - this may take a while for first-time uploads')), 180000) // 3 minute timeout
    );

    const result = await Promise.race([uploadPromise, timeoutPromise]);

    if (result.success) {
      uploadBtn.textContent = 'Upload Code';
      showUploadStatus('success', result.message || 'Code uploaded successfully!');
      if (result.port) {
        updateConnectionStatus(true, result.port);
      }
    } else {
      uploadBtn.textContent = 'Upload Code';
      showUploadStatus('error', result.error || 'Upload failed');
    }
  } catch (error) {
    uploadBtn.textContent = 'Upload Code';
    console.error('Upload error:', error);
    showUploadStatus('error', error.message || 'Upload failed - check console for details');
  } finally {
    uploadBtn.disabled = false;
  }
}

// Show upload status
function showUploadStatus(type, message) {
  const statusEl = document.getElementById('upload-status');
  statusEl.className = `upload-status ${type}`;
  statusEl.textContent = message;
  statusEl.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }
}

// Save code to file
function saveCode() {
  if (!monacoEditor) return;

  const code = monacoEditor.getValue();
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sketch.ino';
  a.click();
  URL.revokeObjectURL(url);
}

// Load code from file
function loadCode() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ino,.txt,.cpp,.c';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file && monacoEditor) {
      const reader = new FileReader();
      reader.onload = (event) => {
        monacoEditor.setValue(event.target.result);
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

// Serial Monitor
function addSerialLine(data) {
  const content = document.getElementById('monitor-content');
  const empty = content.querySelector('.monitor-empty');
  if (empty) empty.remove();

  const line = document.createElement('div');
  line.className = 'monitor-line';

  const timestamp = document.createElement('span');
  timestamp.className = 'monitor-timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();

  const dataSpan = document.createElement('span');
  dataSpan.className = 'monitor-data';
  dataSpan.textContent = data;

  line.appendChild(timestamp);
  line.appendChild(dataSpan);
  content.appendChild(line);

  // Auto-scroll
  if (document.getElementById('autoscroll-checkbox').checked) {
    content.scrollTop = content.scrollHeight;
  }

  serialData.push({ timestamp: new Date(), data });
}

// Clear serial monitor
function clearSerialMonitor() {
  const content = document.getElementById('monitor-content');
  content.innerHTML = '<div class="monitor-empty">Waiting for serial data...</div>';
  serialData = [];
}

// Send serial data
async function sendSerialData(data) {
  if (!selectedPort || !isConnected) {
    console.error('Not connected to a port');
    return;
  }
  
  try {
    const response = await fetch('/api/serial/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connectionId: selectedPort, data }),
    });
    const result = await response.json();
    if (!result.success) {
      console.error('Failed to send serial data:', result.error);
    }
  } catch (error) {
    console.error('Error sending serial data:', error);
  }
}

// Update board image based on selected board type
function updateBoardImage() {
  const boardSelect = document.getElementById('editor-board-select');
  const boardImage = document.getElementById('board-image');
  
  if (!boardSelect || !boardImage) return;
  
  const boardType = boardSelect.value;
  let imagePath = '';
  
  // Map board types to image paths
  switch (boardType) {
    case 'arduino:avr:mega':
      imagePath = '/assets/eblocks_Ard.png';
      break;
    case 'esp32:esp32:esp32':
      imagePath = '/assets/eblocks_esp32.png';
      break;
    case 'pic':
      imagePath = '/assets/eblocks_pic.png';
      break;
    default:
      imagePath = '/assets/eblocks_Ard.png'; // Default to Arduino
  }
  
  boardImage.src = imagePath;
  
  // Re-validate connection status when board type changes
  // Check if the selected board type matches the detected board type
  if (isConnected && selectedPort) {
    const portInfo = portInfoMap.get(selectedPort);
    const detectedFQBN = portInfo ? portInfo.fqbn : null;
    updateConnectionStatus(isConnected, selectedPort, detectedFQBN);
  } else {
    updateConnectionStatus(false);
  }
}

// Sidebar collapse/expand
function setupSidebar(sidebarId, toggleId) {
  const sidebar = document.getElementById(sidebarId);
  const toggle = document.getElementById(toggleId);

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
      toggle.textContent = sidebar.classList.contains('sidebar-left') ? '→' : '←';
    } else {
      toggle.textContent = sidebar.classList.contains('sidebar-left') ? '←' : '→';
    }
  });
}

// Sidebar resizing
function setupResizer(resizerId, sidebarId) {
  const resizer = document.getElementById(resizerId);
  const sidebar = document.getElementById(sidebarId);
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const isLeft = sidebar.classList.contains('sidebar-left');
    const delta = isLeft ? (e.clientX - startX) : (startX - e.clientX);
    const newWidth = startWidth + delta;

    if (newWidth >= 200 && newWidth <= 600) {
      sidebar.style.width = `${newWidth}px`;

      // Trigger Monaco editor layout update
      if (monacoEditor) {
        monacoEditor.layout();
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      // Final layout update after resize
      if (monacoEditor) {
        monacoEditor.layout();
      }
    }
  });
}

// Auto-connect to selected port
async function autoConnectToPort(portPath) {
  if (!portPath) {
    updateConnectionStatus(false);
    return;
  }

  try {
    updateConnectionStatus(false);
    showUploadStatus('info', `Connecting to ${portPath}...`);

    const baudRate = document.getElementById('baud-rate-select').value;
    const response = await fetch('/api/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ port: portPath, baudRate }),
    });
    const result = await response.json();

    if (result.success) {
      // Get the detected board FQBN for this port
      const portInfo = portInfoMap.get(portPath);
      const detectedFQBN = portInfo ? portInfo.fqbn : null;
      
      updateConnectionStatus(true, portPath, detectedFQBN);
      showUploadStatus('success', `Connected to ${portPath}`);
      // Start polling for serial data
      if (window.startSerialPolling && result.connectionId) {
        window.startSerialPolling(result.connectionId);
      }
      setTimeout(() => {
        document.getElementById('upload-status').style.display = 'none';
      }, 3000);
    } else {
      updateConnectionStatus(false);
      showUploadStatus('error', result.error || 'Connection failed');
    }
  } catch (error) {
    console.error('Connection error:', error);
    updateConnectionStatus(false);
    showUploadStatus('error', error.message || 'Connection failed');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check Arduino CLI
  checkArduinoCLI();

  // Setup sidebars
  setupSidebar('leftSidebar', 'leftSidebarToggle');
  setupSidebar('rightSidebar', 'rightSidebarToggle');
  setupResizer('leftResizer', 'leftSidebar');
  setupResizer('rightResizer', 'rightSidebar');

  // Refresh ports on load
  refreshPorts();

  // Event listeners
  document.getElementById('refresh-ports-btn').addEventListener('click', refreshPorts);
  document.getElementById('upload-btn').addEventListener('click', uploadCode);
  document.getElementById('save-btn').addEventListener('click', saveCode);
  document.getElementById('load-btn').addEventListener('click', loadCode);
  document.getElementById('clear-monitor-btn').addEventListener('click', clearSerialMonitor);

  // Auto-connect when COM port is selected
  document.getElementById('com-port-select').addEventListener('change', (e) => {
    autoConnectToPort(e.target.value);
  });

  // Update board image when board type changes
  document.getElementById('editor-board-select').addEventListener('change', updateBoardImage);
  
  // Initialize board image on load
  updateBoardImage();
  
  // Initialize board image with disconnected state (red glow)
  const boardImage = document.getElementById('board-image');
  if (boardImage) {
    boardImage.classList.add('disconnected');
  }

  document.getElementById('serial-send-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('serial-input');
    if (input.value.trim()) {
      sendSerialData(input.value);
      input.value = '';
    }
  });

  // Poll for serial data from the server
  let serialPollInterval = null;
  function startSerialPolling(connectionId) {
    if (serialPollInterval) {
      clearInterval(serialPollInterval);
    }
    serialPollInterval = setInterval(async () => {
      if (connectionId && isConnected) {
        try {
          const response = await fetch(`/api/serial/data/${connectionId}`);
          const result = await response.json();
          if (result.success && result.data && result.data.length > 0) {
            result.data.forEach(data => {
              addSerialLine(data);
            });
          }
        } catch (error) {
          console.error('Error polling serial data:', error);
        }
      }
    }, 100); // Poll every 100ms
  }
  
  function stopSerialPolling() {
    if (serialPollInterval) {
      clearInterval(serialPollInterval);
      serialPollInterval = null;
    }
  }
  
  // Start polling when connected
  // This will be called from autoConnectToPort
  window.startSerialPolling = startSerialPolling;
  window.stopSerialPolling = stopSerialPolling;
});
