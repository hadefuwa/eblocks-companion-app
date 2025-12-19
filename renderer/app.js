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
let serialData = [];

// Initialize Monaco Editor
require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });

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

// Check Arduino CLI status on load
async function checkArduinoCLI() {
  const statusEl = document.getElementById('arduino-cli-status');
  try {
    const result = await window.electronAPI.checkCLI();
    if (result.success && result.installed) {
      statusEl.classList.add('success');
      statusEl.querySelector('.status-text').textContent = `Arduino CLI ${result.version}`;
    } else {
      statusEl.classList.add('error');
      statusEl.querySelector('.status-text').textContent = 'Arduino CLI not found';
    }
  } catch (error) {
    statusEl.classList.add('error');
    statusEl.querySelector('.status-text').textContent = 'Arduino CLI error';
  }
}

// Refresh COM ports
async function refreshPorts() {
  const select = document.getElementById('com-port-select');
  const btn = document.getElementById('refresh-ports-btn');

  btn.disabled = true;
  btn.textContent = '⟳';

  try {
    const result = await window.electronAPI.getPorts();
    select.innerHTML = '<option value="">Select a port...</option>';

    if (result.success && result.ports.length > 0) {
      result.ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.port;
        option.textContent = `${port.port} - ${port.board}`;
        select.appendChild(option);
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
function updateConnectionStatus(connected, port = null) {
  isConnected = connected;
  selectedPort = port;

  const dot = document.getElementById('connection-status-dot');
  const text = document.getElementById('connection-status-text');

  if (connected && port) {
    dot.classList.add('connected');
    text.textContent = `Connected to ${port}`;
  } else {
    dot.classList.remove('connected');
    text.textContent = 'Not connected';
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
    const uploadPromise = window.electronAPI.uploadCode({ code, board, port });
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
  // TODO: Implement serial send via Electron API
  console.log('Send serial:', data);
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
    const result = await window.electronAPI.serialConnect({ port: portPath, baudRate });

    if (result.success) {
      updateConnectionStatus(true, portPath);
      showUploadStatus('success', `Connected to ${portPath}`);
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

  document.getElementById('serial-send-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('serial-input');
    if (input.value.trim()) {
      sendSerialData(input.value);
      input.value = '';
    }
  });

  // Listen for serial data from Electron
  if (window.electronAPI && window.electronAPI.onSerialData) {
    window.electronAPI.onSerialData((data) => {
      if (data.data) {
        addSerialLine(data.data);
      }
    });
  }
});
