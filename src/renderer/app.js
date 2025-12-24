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

// Initialize Monaco Editor - REQUIRED, app cannot function without it
if (typeof require === 'undefined' || typeof require.config !== 'function') {
  const errorMsg = 'CRITICAL ERROR: Monaco Editor is not available.\n\n' +
                  'require is not defined or require.config is not a function.\n' +
                  'The app cannot function without Monaco Editor.\n\n' +
                  'Please check:\n' +
                  '1. That loader.js loaded correctly\n' +
                  '2. That node_modules/monaco-editor is accessible\n' +
                  '3. Check the browser console for detailed errors';
  alert(errorMsg);
  console.error('Monaco Editor initialization failed: require is not available');
  throw new Error('Monaco Editor is required but not available');
}

require.config({ paths: { vs: '/node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
  const editorContainer = document.getElementById('monaco-editor');
  
  if (!editorContainer) {
    const errorMsg = 'CRITICAL ERROR: Monaco Editor container not found.\n\n' +
                    'The #monaco-editor element does not exist in the DOM.';
    alert(errorMsg);
    console.error('Monaco Editor container (#monaco-editor) not found');
    throw new Error('Monaco Editor container not found');
  }

  try {
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

    console.log('Monaco Editor initialized successfully');

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
  } catch (error) {
    const errorMsg = 'CRITICAL ERROR: Failed to create Monaco Editor instance.\n\n' +
                    'Error: ' + error.message + '\n\n' +
                    'Check the console for details.';
    alert(errorMsg);
    console.error('Monaco Editor creation failed:', error);
    throw error;
  }
}, function (error) {
  const errorMsg = 'CRITICAL ERROR: Failed to load Monaco Editor main module.\n\n' +
                  'Error: ' + (error.message || error) + '\n\n' +
                  'This usually means:\n' +
                  '1. The Monaco Editor files are not accessible\n' +
                  '2. The path configuration is incorrect\n' +
                  '3. Check the browser console and network tab for 404 errors';
  alert(errorMsg);
  console.error('Monaco Editor main module load failed:', error);
  throw error;
});

// Check Arduino CLI status on load (removed from UI, but kept for logging)
async function checkArduinoCLI() {
  try {
    const response = await fetch('/api/check-cli');
    const result = await response.json();
    if (result.success && result.installed) {
      console.log('✓ Arduino CLI found:', result.version);
      console.log('  Path:', result.path);
    } else {
      console.error('✗ Arduino CLI not found');
      console.error('  Error:', result.error);
      if (result.details) {
        console.error('  Details:', {
          resourcesPath: result.details.resourcesPath,
          appPath: result.details.appPath,
          isPackaged: result.details.isPackaged,
          platform: result.details.platform,
          arch: result.details.arch
        });
      }
    }
  } catch (error) {
    console.error('Arduino CLI check error:', error);
  }
}

// Check if E-Blocks drivers are installed and show/hide banner
async function checkDrivers() {
  try {
    const response = await fetch('/api/check-drivers');
    const result = await response.json();
    const banner = document.getElementById('driver-banner');
    
    if (!banner) {
      console.warn('Driver banner element not found');
      return;
    }
    
    if (result.success && result.installed) {
      // Drivers are installed - hide banner
      banner.style.display = 'none';
      console.log('✓ E-Blocks drivers are installed');
    } else {
      // Drivers not installed - show banner
      banner.style.display = 'flex';
      console.log('⚠ E-Blocks drivers are not installed');
    }
  } catch (error) {
    console.error('Driver check error:', error);
    // On error, show banner to be safe
    const banner = document.getElementById('driver-banner');
    if (banner) {
      banner.style.display = 'flex';
    }
  }
}

// Install E-Blocks drivers
async function installDrivers() {
  const btn = document.getElementById('install-drivers-btn');
  const bannerBtn = document.getElementById('driver-banner-install-btn');
  const statusDiv = document.getElementById('driver-status');
  
  // Disable both buttons if they exist
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Installing...';
  }
  if (bannerBtn) {
    bannerBtn.disabled = true;
    bannerBtn.textContent = 'Installing...';
  }
  
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'driver-status driver-status-info';
    statusDiv.textContent = 'Installing E-Blocks USB drivers... This may take a moment.';
  }
  
  try {
    const response = await fetch('/api/install-drivers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (statusDiv) {
        statusDiv.className = 'driver-status driver-status-success';
        statusDiv.textContent = result.message || 'Drivers installed successfully! Please reconnect your E-Blocks board and refresh ports.';
      }
      if (btn) {
        btn.textContent = '✓ Installed';
      }
      if (bannerBtn) {
        bannerBtn.textContent = '✓ Installed';
      }
      
      // Refresh ports after a short delay
      setTimeout(() => {
        refreshPorts();
      }, 2000);
      
      // Reset buttons after 5 seconds
      setTimeout(() => {
        if (btn) {
          btn.textContent = '🔧 Install Drivers';
          btn.disabled = false;
        }
        if (bannerBtn) {
          bannerBtn.textContent = 'Install Drivers';
          bannerBtn.disabled = false;
        }
      }, 5000);
      
      // Recheck drivers to hide banner if installation succeeded
      setTimeout(checkDrivers, 2000);
    } else {
      if (statusDiv) {
        statusDiv.className = 'driver-status driver-status-error';
        statusDiv.textContent = result.error || 'Failed to install drivers. Please try running the installer manually from the drivers folder.';
      }
      if (btn) {
        btn.textContent = '🔧 Install Drivers';
        btn.disabled = false;
      }
      if (bannerBtn) {
        bannerBtn.textContent = 'Install Drivers';
        bannerBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Driver installation error:', error);
    statusDiv.className = 'driver-status driver-status-error';
    statusDiv.textContent = 'Error installing drivers: ' + error.message;
    btn.textContent = '🔧 Install Drivers';
    btn.disabled = false;
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

  // Get upload button and enable/disable based on connection
  const uploadBtn = document.getElementById('upload-btn');
  const isFullyConnected = connected && port && boardTypeMatches;

  if (isFullyConnected) {
    dot.classList.add('connected');
    text.textContent = `Connected to ${port}`;
    // Update board image glow to green
    if (boardImage) {
      boardImage.classList.remove('disconnected');
      boardImage.classList.add('connected');
    }
    // Enable upload button when fully connected
    if (uploadBtn) {
      uploadBtn.disabled = false;
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
    // Disable upload button when not connected or board mismatch
    if (uploadBtn) {
      uploadBtn.disabled = true;
    }
    // Stop polling when disconnected or board mismatch
    if (window.stopSerialPolling) {
      window.stopSerialPolling();
    }
  }
}

// Flash warning when no port is selected
function flashPortWarning() {
  const portSelect = document.getElementById('com-port-select');
  const warning = document.getElementById('port-warning');
  
  if (!portSelect || !warning) return;
  
  // Check if port is selected
  if (!portSelect.value || portSelect.value === '') {
    // Add flash class to dropdown
    portSelect.classList.add('flash-warning');
    
    // Show and flash warning message
    warning.style.display = 'block';
    
    // Remove flash class after animation completes
    setTimeout(() => {
      portSelect.classList.remove('flash-warning');
    }, 1500); // 3 flashes * 0.5s = 1.5s
    
    // Hide warning message after animation
    setTimeout(() => {
      warning.style.display = 'none';
    }, 1500);
  }
}

// Get the reason why upload is disabled
function getUploadDisabledReason() {
  const portSelect = document.getElementById('com-port-select');
  const port = portSelect ? portSelect.value : null;
  const boardSelect = document.getElementById('editor-board-select');
  const selectedBoardType = boardSelect ? boardSelect.value : null;
  
  // Check if port is selected
  if (!port || port === '') {
    return 'no-port';
  }
  
  // Check connection status
  const isFullyConnected = isConnected && selectedPort && 
    (selectedBoardType === 'pic' ? selectedPort !== null : 
     (detectedBoardFQBN && (
       (selectedBoardType === 'arduino:avr:mega' && detectedBoardFQBN.startsWith('arduino:avr:mega')) ||
       (selectedBoardType === 'esp32:esp32:esp32' && detectedBoardFQBN.startsWith('esp32:esp32')) ||
       (detectedBoardFQBN === selectedBoardType || detectedBoardFQBN.startsWith(selectedBoardType + ':'))
     )));
  
  if (!isFullyConnected) {
    return 'board-disconnected';
  }
  
  return null; // Not disabled
}

// Flash upload button warning
function flashUploadWarning() {
  const uploadBtn = document.getElementById('upload-btn');
  const uploadStatus = document.getElementById('upload-status');
  
  if (!uploadBtn || !uploadStatus) return;
  
  const reason = getUploadDisabledReason();
  if (!reason) return; // Button is enabled, no warning needed
  
  // Determine message based on reason
  let message = '';
  if (reason === 'no-port') {
    message = 'No COM port selected';
  } else if (reason === 'board-disconnected') {
    message = 'E-Blocks board disconnected';
  }
  
  // Add flash class to button
  uploadBtn.classList.add('flash-warning');
  
  // Show warning message
  uploadStatus.className = 'upload-status error';
  uploadStatus.textContent = message;
  uploadStatus.style.display = 'block';
  
  // Remove flash class after animation completes
  setTimeout(() => {
    uploadBtn.classList.remove('flash-warning');
  }, 1500);
  
  // Hide warning message after animation
  setTimeout(() => {
    uploadStatus.style.display = 'none';
  }, 2000);
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

  // Check if port is selected
  if (!portSelect.value || portSelect.value === '') {
    flashPortWarning();
    showUploadStatus('error', 'Please select a COM port first');
    return;
  }

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
  if (!portPath || portPath === '') {
    updateConnectionStatus(false);
    flashPortWarning();
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

// Curriculum Data
// Top-level curriculum list
const curriculumList = [
  { code: 'CP4807', title: 'Introduction to microcontrollers' },
  { code: 'CP0507', title: 'Motors and microcontrollers' },
  { code: 'CP1972', title: 'Sensors and microcontrollers' },
  { code: 'CP4436', title: 'PC and web interfacing' }
];

// Curriculum data organized by curriculum code, then by level
const curriculumData = {
  'CP4807': {
  bronze: [
    { number: 1, title: 'First program', code: 'CP4807-1' },
    { number: 2, title: 'Performing calculations', code: 'CP4807-2' },
    { number: 3, title: 'Connection points', code: 'CP4807-3' },
    { number: 4, title: 'Digital inputs', code: 'CP4807-4' },
    { number: 5, title: 'Making decisions', code: 'CP4807-5' },
    { number: 6, title: 'Macros / subroutines', code: 'CP4807-6' },
    { number: 7, title: 'Using prototype boards', code: 'CP4807-7' }
  ],
  silver: [
    { number: 8, title: 'Colour graphical displays', code: 'CP4807-8' },
    { number: 9, title: 'Pin interrupts', code: 'CP4807-9' },
    { number: 10, title: 'Timer interrupts', code: 'CP4807-10' }
  ],
  gold: [
    { number: 11, title: 'Touch control systems', code: 'CP4807-11' },
    { number: 12, title: 'Web mirror', code: 'CP4807-12' }
  ]
  },
  'CP0507': {
    bronze: [
      { number: 1, title: 'Basic DC motor control', code: 'CP0507-1' },
      { number: 2, title: 'Full bridge motor control', code: 'CP0507-2' },
      { number: 3, title: 'Servo motor control', code: 'CP0507-3' },
      { number: 4, title: 'Stepper motor control', code: 'CP0507-4' }
    ],
    silver: [],
    gold: [
      { number: 5, title: 'DC motor speed control', code: 'CP0507-5' }
    ]
  },
  'CP1972': {
    bronze: [
      { number: 1, title: 'Analogue inputs', code: 'CP1972-1' },
      { number: 2, title: 'Light sensor', code: 'CP1972-2' },
      { number: 3, title: 'Analogue temperature sensor', code: 'CP1972-3' },
      { number: 4, title: 'Digital temperature sensor', code: 'CP1972-4' },
      { number: 5, title: 'Digital accelerometer', code: 'CP1972-5' }
    ],
    silver: [
      { number: 6, title: 'Floats and ints', code: 'CP1972-6' }
    ],
    gold: [
      { number: 7, title: 'Thermocouple', code: 'CP1972-7' },
      { number: 8, title: 'Flow sensor', code: 'CP1972-8' },
      { number: 9, title: 'Compressive force sensor', code: 'CP1972-9' },
      { number: 10, title: 'Strain sensor', code: 'CP1972-10' },
      { number: 11, title: 'Pressure sensor', code: 'CP1972-11' }
    ]
  },
  'CP4436': {
    bronze: [
      { number: 1, title: 'Beginning hardware interfacing - PC to hardware', code: 'CP4436-1' },
      { number: 2, title: 'Bidirectional hardware control', code: 'CP4436-2' },
      { number: 3, title: 'JSON encoding', code: 'CP4436-3' }
    ],
    silver: [
      { number: 4, title: 'Full PC - Embedded project', code: 'CP4436-4' }
    ],
    gold: []
  }
};

// Worksheet Content Data - This is a large object, so we'll load it from the curriculum file
// For now, we'll use a simplified version that can be expanded
const worksheetContent = {
  1: {
    title: 'First program',
    code: 'CP4807-1',
    description: 'This first program introduces you to several Arduino programming concepts: digital output, loops, and delays.',
    details: 'In this first program you will learn how to control a single LED on the E-Blocks combo board, making it turn on and off using Arduino programming commands.',
    videoUrl: 'https://youtu.be/h8-7BsXBpLc',
    exampleCode: `/*
  Worksheet 1: First Program
  This program flashes a single LED on the combo board
*/

// Define the LED pin (Port B, bit 0 - pin 13 on Arduino Mega)
const int LED_PIN = 13;

void setup() {
  // Initialize the LED pin as an output
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize Serial2 for E-Blocks 3 Mega (USB connection)
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 1: First Program Started");
}

void loop() {
  // Turn LED on
  digitalWrite(LED_PIN, HIGH);
  delay(500);  // Wait 500 milliseconds (0.5 seconds)
  
  // Turn LED off
  digitalWrite(LED_PIN, LOW);
  delay(500);  // Wait 500 milliseconds (0.5 seconds)
}`,
    tasks: [
      'Open the E-Blocks 3 Companion App and create a new program.',
      'Copy the example code provided above into the code editor.',
      'Select your board type (Arduino Mega) and COM port.',
      'Upload the code to your E-Blocks 3 board using the Upload Code button.',
      'Observe the LED flashing on the combo board.'
    ],
    challenges: [
      'Delay: Change the delay values (currently 500ms). Try 100ms, 1000ms, and 2000ms. Notice how this affects the LED flashing speed.',
      'Port A and B: Modify the code to use a pin from Port A (pins 22-29) or Port B (pins 10-13, 50-53). Change LED_PIN to a different pin number.',
      'Multiple LEDs: Add a second LED and make them flash alternately (one on while the other is off).',
      'Limited loops: Instead of flashing forever, make the LED flash exactly 10 times, then stop. Use a for loop with a counter.',
      'Advanced: Create a program that flashes Port B bit 0 (pin 13) 10 times, then Port B bit 1 (pin 12) 9 times, then Port B bit 2 (pin 11) 8 times.'
    ],
    hints: [
      'Use a for loop: for(int i = 0; i < 10; i++) { ... } to repeat code a specific number of times.',
      'To control different pins, change the pin number in pinMode() and digitalWrite() commands. Port A pins are 22-29, Port B pins are 10-13 and 50-53.',
      'You can define multiple pins: const int LED1 = 13; const int LED2 = 12; then use digitalWrite(LED1, HIGH) and digitalWrite(LED2, LOW) to control them.',
      'Remember to set pinMode() for each pin you use in the setup() function.',
      'Use Serial2.println() to send debug messages to the Serial Monitor (set to 115200 baud).'
    ]
  },
  2: {
    title: 'Performing calculations',
    code: 'CP4807-2',
    description: 'Microcontroller brains are not wired like human beings. This has consequences for mathematics, variables and input output processes that you need to understand.',
    details: 'In this worksheet you explore calculations and binary and hexadecimal numbering systems.',
    videoUrl: 'https://youtu.be/iEkocOsMj6Q',
    exampleCode: `/*
  Worksheet 2: Performing Calculations
  Binary Counter Example
*/

int count = 0;

void setup() {
  // Initialize Serial2 for E-Blocks 3 Mega
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 2: Binary Counter");
  
  // Set Port B as output (pins 10-13, 50-53)
  DDRB = 0xFF;  // Set all Port B pins as outputs
}

void loop() {
  // Output count value to Port B (binary representation)
  PORTB = count;
  
  // Print count in decimal, binary, and hex
  Serial2.print("Decimal: ");
  Serial2.print(count);
  Serial2.print(" | Binary: ");
  Serial2.print(count, BIN);
  Serial2.print(" | Hex: ");
  Serial2.println(count, HEX);
  
  count++;
  if (count > 255) {
    count = 0;  // Reset after 255 (8-bit limit)
  }
  
  delay(500);  // Wait 0.5 seconds
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Observe the LEDs on Port B counting in binary (0 to 255).',
      'Watch the Serial Monitor to see the count in decimal, binary, and hexadecimal formats.',
      'Understand how numbers are represented in different number systems.'
    ],
    challenges: [
      'Slow down the program by increasing the delay. Make sure you understand the counting sequence.',
      'Investigate variable types: Change \`int count\` to \`byte count\`, \`unsigned int count\`, or \`long count\`. See how this affects the maximum count value.',
      'Alter the program so that initially count = 1 (before the loop). Change the calculation so that count = count * 2 instead of count = count + 1. Can you explain what happens?',
      'Alter the program so that after the 7th LED is lit (count = 128), the program then counts down, lighting bit 6, then bit 5, etc. (Use division operator / instead of multiplication).'
    ],
    hints: [
      'In Arduino, you can use different variable types: byte (0-255), int (-32,768 to 32,767), unsigned int (0 to 65,535), long (-2.1 billion to 2.1 billion).',
      'Use Serial2.print(value, BIN) to print in binary, Serial2.print(value, HEX) for hexadecimal.',
      'To count down, use count = count / 2 or count = count >> 1 (bit shift right).',
      'PORTB = count directly writes the binary value to all 8 pins of Port B.',
      'Remember: Binary counting goes 0, 1, 10, 11, 100, 101, 110, 111, 1000...'
    ]
  },
  3: {
    title: 'Connection points',
    code: 'CP4807-3',
    description: 'There are always multiple ways of making a program. Sometimes this is down to personal preference, sometimes this is down to good programming technique.',
    details: 'In this exercise you explore different ways of structuring programs using loops and program flow control.',
    exampleCode: `/*
  Worksheet 3: Connection Points / Program Flow
  Traffic Light Example
*/

const int RED_PIN = 13;
const int AMBER_PIN = 12;
const int GREEN_PIN = 11;

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(AMBER_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 3: Traffic Light");
}

void loop() {
  // Red for 10 seconds
  digitalWrite(RED_PIN, HIGH);
  digitalWrite(AMBER_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  delay(10000);
  
  // Amber for 1 second
  digitalWrite(RED_PIN, LOW);
  digitalWrite(AMBER_PIN, HIGH);
  digitalWrite(GREEN_PIN, LOW);
  delay(1000);
  
  // Green for 10 seconds
  digitalWrite(RED_PIN, LOW);
  digitalWrite(AMBER_PIN, LOW);
  digitalWrite(GREEN_PIN, HIGH);
  delay(10000);
  
  // Amber for 1 second
  digitalWrite(RED_PIN, LOW);
  digitalWrite(AMBER_PIN, HIGH);
  digitalWrite(GREEN_PIN, LOW);
  delay(1000);
  
  // Loop repeats (back to Red)
}`,
    tasks: [
      'Load the example code and understand how it creates a continuous traffic light sequence.',
      'Modify the timing to see how it affects the sequence.',
      'Try creating the same program using a for loop instead of sequential code.'
    ],
    challenges: [
      'Using the traffic light example, modify it to use a single for loop with conditional statements (if/else) to achieve the same result.',
      'Create a program that flashes an LED in a pattern: 3 quick flashes, pause, 2 quick flashes, pause, repeat.',
      'Which programming style is easier to understand - sequential code or loops with conditions?'
    ],
    hints: [
      'You can use a for loop with a counter and if statements: if (counter < 100) { red }, else if (counter < 110) { amber }, etc.',
      'Use modulo operator (%) to create repeating patterns: if (counter % 20 < 10) { on } else { off }',
      'The loop() function in Arduino automatically repeats forever - this is like a "goto connection point" in flowchart programming.',
      'Break complex sequences into smaller functions for better organization.'
    ]
  },
  4: {
    title: 'Digital inputs',
    code: 'CP4807-4',
    description: 'We need a way of controlling electronic devices locally. Often this is done in a digital context - with different types of switches.',
    details: 'In this exercise you look at how to get command data into a microcontroller using digital inputs.',
    videoUrl: 'https://youtu.be/Xvs7-iTPXcQ',
    exampleCode: `/*
  Worksheet 4: Digital Inputs
  Read switch and control LED
*/

const int SWITCH_PIN = 22;  // Port A, bit 0
const int LED_PIN = 13;     // Port B, bit 0

void setup() {
  pinMode(SWITCH_PIN, INPUT_PULLUP);  // Input with internal pull-up resistor
  pinMode(LED_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 4: Digital Inputs");
}

void loop() {
  // Read the switch state (LOW when pressed due to pull-up)
  int switchState = digitalRead(SWITCH_PIN);
  
  // Reflect input to output (inverted because pull-up makes pressed = LOW)
  digitalWrite(LED_PIN, !switchState);
  
  // Print status
  Serial2.print("Switch: ");
  Serial2.println(switchState == LOW ? "PRESSED" : "RELEASED");
  
  delay(100);  // Small delay for stability
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a switch to Port A, bit 0 (pin 22).',
      'Observe how the LED on Port B, bit 0 (pin 13) reflects the switch state.',
      'Test the program and make sure you understand how digitalRead() works.'
    ],
    challenges: [
      'Alter the program to read only bit 0 and store it in a boolean variable. Use this to control bit 7 of the same port.',
      'Add a second switch on bit 1. Create a program where the LED only lights when BOTH switches are pressed (use AND operator: &&).',
      'Experiment with logical operators: OR (||), XOR (^), and NOT (!). Create different combinations of switch logic.',
      'Create a program where different switch combinations produce different LED patterns.'
    ],
    hints: [
      'Use INPUT_PULLUP mode for switches - this means pressed = LOW (0), released = HIGH (1).',
      'Boolean logic: Use && for AND, || for OR, ^ for XOR, ! for NOT.',
      'Example: if (switch1 == LOW && switch2 == LOW) { LED on }',
      'You can read entire port: int portValue = PINA; then check individual bits using bitRead(portValue, 0).',
      'Remember: With pull-up resistors, pressed switches read as LOW (0), not HIGH (1).'
    ]
  },
  5: {
    title: 'Making decisions',
    code: 'CP4807-5',
    description: 'The behaviour of a program and its processes will often depend on the choices made by the user via a control panel or input from sensors.',
    details: 'In this worksheet you explore how decisions are made in microcontroller programs using if statements and switch statements.',
    videoUrl: 'https://youtu.be/jBTPa4wSFsI',
    exampleCode: `/*
  Worksheet 5: Making Decisions
  Switch-controlled LED pattern
*/

// Port A pins for switches (22-29)
const int SWITCH_A0 = 22;
const int SWITCH_A1 = 23;
const int SWITCH_A4 = 26;

// Port B pins for LEDs (10-13, 50-53)
const int LED_B0 = 10;
const int LED_B1 = 11;
const int LED_B7 = 50;

void setup() {
  // Configure switches as inputs with pull-up
  pinMode(SWITCH_A0, INPUT_PULLUP);
  pinMode(SWITCH_A1, INPUT_PULLUP);
  pinMode(SWITCH_A4, INPUT_PULLUP);
  
  // Configure LEDs as outputs
  pinMode(LED_B0, OUTPUT);
  pinMode(LED_B1, OUTPUT);
  pinMode(LED_B7, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 5: Making Decisions");
}

void loop() {
  // Read switch states
  bool switch0 = digitalRead(SWITCH_A0) == LOW;
  bool switch1 = digitalRead(SWITCH_A1) == LOW;
  bool switch4 = digitalRead(SWITCH_A4) == LOW;
  
  // Decision making with if statements
  if (switch0 && switch4) {
    // Both A0 and A4 pressed - light all Port B LEDs
    PORTB = 0xFF;  // All bits high
    Serial2.println("Both switches pressed - All LEDs ON");
  } else {
    PORTB = 0x00;  // All LEDs off
  }
  
  delay(50);  // Debounce delay
}`,
    tasks: [
      'Load the example code and understand how if statements control program flow.',
      'Test the program with different switch combinations.',
      'Modify the code to respond to different switch patterns.'
    ],
    challenges: [
      'Create a switch statement (or if-else chain) with 8 branches. When switch A0 is pressed, light LED B7. When A1 is pressed, light B6, etc.',
      'Use binary knowledge: Calculate what value you get when A0 AND A4 are pressed together.',
      'Create a program that lights different LEDs based on which single switch is pressed.',
      'Add Serial2 output to display which switch combination was detected.'
    ],
    hints: [
      'Use if-else if-else chain or switch-case statement for multiple conditions.',
      'Read entire port: int portA = PINA; then check bits using bitRead(portA, 0).',
      'Binary values: A0 = bit 0 (1), A1 = bit 1 (2), A4 = bit 4 (16). A0 AND A4 = 1 + 16 = 17.',
      'Example switch-case: switch(portA) { case 1: /* A0 only */ break; case 2: /* A1 only */ break; }',
      'Use bitwise operators: if (PINA & 0x01) checks bit 0, if (PINA & 0x11) checks bits 0 and 4.'
    ]
  },
  6: {
    title: 'Macros / subroutines',
    code: 'CP4807-6',
    description: 'In designing microcontroller systems we use code that is very repetitive. We can simplify development by using functions (subroutines).',
    details: 'In this worksheet you explore the use of functions to organize and reuse code.',
    videoUrl: 'https://youtu.be/hNBSxdb72v4',
    exampleCode: `/*
  Worksheet 6: Functions / Subroutines
  Using functions to organize code
*/

int count = 0;

void setup() {
  Serial2.begin(115200);
  delay(2000);
  initialize();  // Call our custom function
  Serial2.println("Worksheet 6: Functions");
}

void loop() {
  count++;
  printCount();  // Call function to print count
  delay(1000);
}

// Custom function to initialize
void initialize() {
  Serial2.println("System Initialized");
  count = 0;
}

// Custom function to print count with label
void printCount() {
  Serial2.print("Count is: ");
  Serial2.println(count);
}

// Function to display on 7-segment (example)
void displayNumber(int number) {
  // This would control 7-segment displays
  // Implementation depends on your hardware
  Serial2.print("Display: ");
  Serial2.println(number);
}`,
    tasks: [
      'Load the example code and understand how functions organize code.',
      'Create your own functions for common tasks.',
      'Use functions to make your code more readable and reusable.'
    ],
    challenges: [
      'Modify the program to print "Count is: " followed by the count number using a string variable.',
      'Create a function called initialize() that sets up all your pins and variables. Call it from setup().',
      'Create a function to convert a number into units, tens, and hundreds digits (use modulo % and division /).',
      'If you have 7-segment displays, create a function to display a digit on them.'
    ],
    hints: [
      'Functions in Arduino: void functionName() { ... } to define, functionName(); to call.',
      'Use String type for text: String message = "Count is: "; then Serial2.print(message + count);',
      'To split a number: units = number % 10; tens = (number / 10) % 10; hundreds = number / 100;',
      'Functions can take parameters: void displayDigit(int digit) { ... }',
      'Functions can return values: int addNumbers(int a, int b) { return a + b; }',
      'Break complex programs into small, focused functions - one function, one job.'
    ]
  },
  7: {
    title: 'Using prototype boards',
    code: 'CP4807-7',
    description: 'So far you have developed programs using boards which are manufactured for you. At some point you will need to create your own circuits using a prototype board.',
    details: 'In this worksheet you explore the use of prototype boards in microcontroller circuits.',
    exampleCode: `/*
  Worksheet 7: Using Prototype Boards
  Multiple tasks with timing
*/

const int SWITCH1_PIN = 22;  // Active high switch
const int SWITCH2_PIN = 23;  // Active low switch (with pull-up)
const int LED_PIN = 13;
const int BUZZER_PIN = 12;

unsigned long lastLEDToggle = 0;
bool ledState = false;

void setup() {
  pinMode(SWITCH1_PIN, INPUT);
  pinMode(SWITCH2_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 7: Prototype Board");
}

void loop() {
  // Read both switches
  bool switch1 = digitalRead(SWITCH1_PIN) == HIGH;  // Active high
  bool switch2 = digitalRead(SWITCH2_PIN) == LOW;   // Active low (pressed = LOW)
  
  // If both switches pressed, activate buzzer
  if (switch1 && switch2) {
    digitalWrite(BUZZER_PIN, HIGH);
    Serial2.println("Both switches pressed - Buzzer ON");
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
  
  // Flash LED once per second (non-blocking)
  unsigned long currentTime = millis();
  if (currentTime - lastLEDToggle >= 1000) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastLEDToggle = currentTime;
  }
  
  delay(10);  // Small delay for stability
}`,
    tasks: [
      'Build a circuit on a prototype board with two switches (one active high, one active low), an LED, and a buzzer.',
      'Connect the circuit to your E-Blocks system on any available port.',
      'Load the example code and upload it to test your circuit.',
      'Verify that both functions work simultaneously (buzzer when both switches pressed, LED flashing every second).'
    ],
    challenges: [
      'Modify the timing so the LED flashes at different rates (every 0.5 seconds, every 2 seconds).',
      'Add a third switch that changes the LED flash rate when pressed.',
      'Create a pattern where the LED flashes 3 times quickly, then pauses, then repeats.',
      'Experiment with different buzzer patterns (beep patterns, different frequencies if using PWM).'
    ],
    hints: [
      'Use millis() for non-blocking timing instead of delay() when you need multiple timed events.',
      'Active high switch: pressed = HIGH, needs pull-down resistor or INPUT mode.',
      'Active low switch: pressed = LOW, use INPUT_PULLUP mode.',
      'To do multiple things "at once", use state machines and millis() timing instead of delay().',
      'Example: if (millis() - lastTime >= interval) { doSomething(); lastTime = millis(); }',
      'For buzzer tones, use tone(pin, frequency) function if your buzzer supports it.'
    ]
  },
  8: {
    title: 'Colour graphical displays',
    code: 'CP4807-8',
    description: 'Graphical displays extend the functionality of electronic systems, allow more information to be displayed, and allow information to be displayed in more easily understood formats.',
    details: 'In this worksheet you explore how colour graphical displays work with microcontrollers.',
    videoUrl: 'https://youtu.be/wBFTZGid_Ck',
    tasks: [
      'If you have a colour graphical display module, connect it to your E-Blocks system.',
      'Research Arduino libraries for your specific display (e.g., TFT, OLED, or E-Blocks display).',
      'Create a program that displays switch states and sensor values graphically.',
      'Use the display to show data in visual formats like graphs, bars, or status indicators.'
    ],
    challenges: [
      'Create a program that shows the status of 8 switches on the Combo board as coloured indicators (red for off, green for on).',
      'Display a potentiometer value as a bar graph or XY plot on the screen.',
      'Add text labels to identify different components on your display.',
      'Create a custom bitmap image and display it on the screen.',
      'Make the display refresh at appropriate intervals without flickering.'
    ],
    hints: [
      'Different displays require different libraries. Common ones: Adafruit_GFX, TFT_eSPI, U8g2 for OLED.',
      'For E-Blocks specific displays, check the Matrix TSL documentation for their library.',
      'Use appropriate refresh rates - too fast causes flicker, too slow feels unresponsive.',
      'Organize your display code into functions: drawStatus(), drawGraph(), updateDisplay(), etc.',
      'For graphs, store historical data in an array and plot it over time.',
      'Use different colors to make information easy to understand at a glance.'
    ]
  },
  9: {
    title: 'Pin interrupts',
    code: 'CP4807-9',
    description: 'In some systems there are possible events that are really important - like the kill switch on a factory machine. When switches like this are activated you need your program to stop whatever it is doing and take action immediately.',
    details: 'In this worksheet you explore how pin interrupts work to respond to critical events.',
    videoUrl: 'https://youtu.be/imTq19jX408',
    exampleCode: `/*
  Worksheet 9: Pin Interrupts
  Emergency stop with interrupt
*/

const int STOP_PIN = 2;      // Interrupt pin (INT0 on pin 2, INT1 on pin 3)
const int CLEAR_PIN = 22;    // Clear/reset switch
const int LED_PIN = 13;      // Status LED
const int WORK_LED = 12;     // Working indicator

volatile bool stopFlag = false;
bool isStopped = false;

void setup() {
  pinMode(STOP_PIN, INPUT_PULLUP);
  pinMode(CLEAR_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(WORK_LED, OUTPUT);
  
  // Attach interrupt to STOP_PIN (INT0)
  attachInterrupt(digitalPinToInterrupt(STOP_PIN), stopInterrupt, FALLING);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 9: Pin Interrupts");
  Serial2.println("Press interrupt pin to stop, clear pin to resume");
}

void loop() {
  if (!isStopped) {
    // Normal operation - flash working LED
    digitalWrite(WORK_LED, HIGH);
    delay(100);
    digitalWrite(WORK_LED, LOW);
    delay(100);
  } else {
    // Stopped - wait for clear
    digitalWrite(LED_PIN, HIGH);  // Stop indicator
    while (isStopped) {
      if (digitalRead(CLEAR_PIN) == LOW) {
        isStopped = false;
        stopFlag = false;
        digitalWrite(LED_PIN, LOW);
        Serial2.println("Cleared - Resuming operation");
      }
      delay(10);
    }
  }
}

// Interrupt Service Routine (ISR)
void stopInterrupt() {
  stopFlag = true;
  isStopped = true;
  Serial2.println("INTERRUPT: Stop activated!");
}`,
    tasks: [
      'Load the example code and understand how interrupts work.',
      'Connect a switch to an interrupt-capable pin (pin 2 or 3 on Arduino Mega).',
      'Test the interrupt functionality - the program should stop immediately when the interrupt pin is triggered.',
      'Test the clear function to resume operation.'
    ],
    challenges: [
      'Modify the program so a LED flashes during normal operation in the main loop.',
      'Add a second interrupt pin for a different emergency function.',
      'Create a system where different interrupt pins trigger different responses.',
      'Add Serial2 output to log when interrupts occur and when the system resumes.'
    ],
    hints: [
      'Interrupt-capable pins on Arduino Mega: Pin 2 (INT4), Pin 3 (INT5), Pin 18 (INT5), Pin 19 (INT4), Pin 20 (INT3), Pin 21 (INT2).',
      'Use attachInterrupt(digitalPinToInterrupt(pin), functionName, mode) where mode is RISING, FALLING, or CHANGE.',
      'ISR functions should be short and fast. Use flags (volatile variables) to communicate with main loop.',
      'volatile keyword is required for variables used in ISRs: volatile bool flag = false;',
      'Keep ISR code minimal - just set flags, don\'t do Serial prints or long operations in ISR.',
      'Use while loops in main code to wait for conditions set by interrupts.'
    ]
  },
  10: {
    title: 'Timer interrupts',
    code: 'CP4807-10',
    description: 'Many microcontroller systems need some kind of timing system. Microcontrollers have dedicated internal hardware that counts clock pulses and converts them into time.',
    details: 'In this worksheet you explore how timer interrupts work to manage time-based code.',
    videoUrl: 'https://youtu.be/E5SWKxIjvno',
    exampleCode: `/*
  Worksheet 10: Timer Interrupts
  Clock/Timer using timer interrupt
*/

#include <TimerOne.h>  // Or use built-in timers

volatile int secondCount = 0;
volatile int minuteCount = 0;
volatile int hourCount = 0;
const int RESET_PIN = 2;  // Pin interrupt to reset timer

void setup() {
  pinMode(RESET_PIN, INPUT_PULLUP);
  
  // Attach pin interrupt for reset
  attachInterrupt(digitalPinToInterrupt(RESET_PIN), resetTimer, FALLING);
  
  // Setup timer interrupt (1 second)
  // Note: TimerOne library or similar needed, or use Arduino's Timer libraries
  // Timer1.initialize(1000000);  // 1 second in microseconds
  // Timer1.attachInterrupt(timerISR);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet 10: Timer Interrupts");
  Serial2.println("Timer started - Press reset pin to clear");
}

void loop() {
  // Main loop - can do other tasks
  // Timer interrupt handles counting
  
  // Update minutes and hours in main loop (not in ISR)
  if (secondCount >= 60) {
    secondCount = 0;
    minuteCount++;
  }
  
  if (minuteCount >= 60) {
    minuteCount = 0;
    hourCount++;
  }
  
  if (hourCount >= 24) {
    hourCount = 0;
  }
  
  // Display time
  Serial2.print("Time: ");
  Serial2.print(hourCount);
  Serial2.print(":");
  if (minuteCount < 10) Serial2.print("0");
  Serial2.print(minuteCount);
  Serial2.print(":");
  if (secondCount < 10) Serial2.print("0");
  Serial2.println(secondCount);
  
  delay(1000);  // Update display every second
}

// Timer interrupt (would be called by timer library)
void timerISR() {
  secondCount++;
}

// Pin interrupt to reset timer
void resetTimer() {
  secondCount = 0;
  minuteCount = 0;
  hourCount = 0;
  Serial2.println("Timer reset!");
}`,
    tasks: [
      'Understand how timer interrupts work to create precise timing.',
      'Create a program that uses timer interrupts to count seconds, minutes, and hours.',
      'Add a pin interrupt to reset the timer when a switch is pressed.',
      'Display the time on Serial Monitor or a display.'
    ],
    challenges: [
      'Modify the program to calculate and display hours, minutes, and seconds that have elapsed.',
      'Add a pin interrupt to clear/reset the timer to 00:00:00.',
      'Create a stopwatch that can start, stop, and reset.',
      'Use the timer interrupt to flash an LED at precise intervals (e.g., exactly 1 Hz).'
    ],
    hints: [
      'Arduino has built-in timers. For Mega: Timer1, Timer3, Timer4, Timer5. Use libraries like TimerOne or configure registers directly.',
      'Keep ISR code minimal - just increment counters. Do calculations and displays in main loop.',
      'Use volatile for variables shared between ISR and main: volatile int count = 0;',
      'Timer interrupts are more precise than delay() or millis() for exact timing.',
      'For 1-second interrupt: Timer1.initialize(1000000); Timer1.attachInterrupt(timerISR);',
      'Combine timer interrupts with pin interrupts for complex timing systems.'
    ]
  },
  11: {
    title: 'Touch control systems',
    code: 'CP4807-11',
    description: 'Touchscreen systems are replacing the use of switches, potentiometers, LEDs and other electronic devices. Using a graphical touch screen reduces costs and enhances functionality.',
    details: 'In this worksheet you learn how to develop a system that uses a touch screen display to control a simple system.',
    videoUrl: 'https://youtu.be/vS7P8RzybKc',
    tasks: [
      'If you have a touch screen display, connect it to your E-Blocks system.',
      'Research and install the appropriate Arduino library for your touch screen.',
      'Create a program with touch buttons and display elements.',
      'Use the touch screen to control output variables and display their values.'
    ],
    challenges: [
      'Create a program with two touch buttons: "+" and "-" that control a variable (0-255).',
      'Display the variable value on 8 LEDs (showing binary representation).',
      'Add a text field on the display showing the current value.',
      'Create a more complex interface with multiple buttons and displays.',
      'Make the touch interface responsive and provide visual feedback when buttons are pressed.'
    ],
    hints: [
      'Touch screen libraries vary by hardware. Common ones: TFT_eSPI, Adafruit_TouchScreen, or E-Blocks specific libraries.',
      'Touch coordinates need to be mapped to screen regions for buttons.',
      'Use different colors or visual feedback to show when buttons are pressed.',
      'Store the output variable and update it based on touch input.',
      'Display the variable value both numerically and visually (LEDs, bars, etc.).',
      'Debounce touch inputs to avoid multiple triggers from a single touch.',
      'Organize code into functions: checkTouch(), updateDisplay(), handleButtonPress(), etc.'
    ]
  },
  12: {
    title: 'Web mirror',
    code: 'CP4807-12',
    description: 'Touchscreen systems can be extended to work over the internet, allowing remote control and monitoring of your hardware.',
    details: 'In this worksheet you learn how to develop a touch screen system that can be controlled remotely via web interface.',
    videoUrl: 'https://youtu.be/rdSOYW6AXn0',
    tasks: [
      'If you have a touch screen with web mirror capability, set it up according to manufacturer instructions.',
      'Configure network settings (WiFi credentials, server name, password).',
      'Create a program that mirrors the touch screen interface to a web server.',
      'Test remote control using a mobile phone or computer browser.',
      'Verify that you can control and monitor your hardware remotely.'
    ],
    challenges: [
      'Take your Touch Control Systems program and enable web mirror functionality.',
      'Configure the web mirror settings in your touch screen component/library.',
      'Test remote control from a mobile device.',
      'Add security features like password protection.',
      'Create a responsive web interface that works on both mobile and desktop browsers.'
    ],
    hints: [
      'Web mirror functionality is typically built into E-Blocks touch screen modules - check Matrix TSL documentation.',
      'You may need to configure WiFi settings, server name, and passwords in your code.',
      'The web interface usually generates a QR code for easy mobile access.',
      'Ensure your Arduino and touch screen are on the same network.',
      'Test locally first before trying remote access.',
      'Web mirror allows real-time bidirectional communication - changes on screen reflect on web and vice versa.',
      'Some systems may require additional setup for external network access (port forwarding, etc.).'
    ]
  },
  // CP0507 Worksheets
  'CP0507-1': {
    title: 'Basic DC motor control',
    code: 'CP0507-1',
    description: 'There is a huge number of devices that use small motors including toys, electric toothbrushes, medical and mechatronics systems. Turning them on and off requires the use of a relay or a transistor. Varying the speed requires the use of Pulse Width Modulation as a power control technique.',
    details: 'In this worksheet you will learn how to use a potentiometer and PWM to control the speed of a simple DC motor.',
    videoUrl: 'https://youtu.be/e4gB8YcOp8I',
    exampleCode: `/*
  Worksheet CP0507-1: Basic DC Motor Control
  Control motor speed using PWM and potentiometer
*/

const int MOTOR_PIN = 9;        // PWM pin for motor control
const int POTENTIOMETER_PIN = A0;  // Analog input for potentiometer

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(POTENTIOMETER_PIN, INPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP0507-1: DC Motor Control");
}

void loop() {
  // Read potentiometer value (0-1023)
  int potValue = analogRead(POTENTIOMETER_PIN);
  
  // Convert to PWM value (0-255)
  int motorSpeed = map(potValue, 0, 1023, 0, 255);
  
  // Control motor speed using PWM
  analogWrite(MOTOR_PIN, motorSpeed);
  
  // Print values to Serial Monitor
  Serial2.print("Potentiometer: ");
  Serial2.print(potValue);
  Serial2.print(" | Motor Speed: ");
  Serial2.println(motorSpeed);
  
  delay(100);  // Small delay for stability
}`,
    tasks: [
      'Watch the video "Controlling DC motors - Simple DC" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a potentiometer to analog pin A0 and a DC motor to pin 9.',
      'The program allows you to control the speed of the motor using a potentiometer.'
    ],
    challenges: [
      'Modify the program so that two switches control the speed of the motor: plus and minus.',
      'Print the speed on the LCD.'
    ],
    hints: [
      'In the main loop detect if a switch has been pressed - say switch PORTA0 and PORTA1 on a combo board or switch board on port A.',
      'Use a variable SPEED and add or subtract 1 from SPEED as the appropriate switch is detected.',
      'Use two IF icons for the logic - IF switch A0 is pressed or IF switch A1 is pressed',
      'Put the appropriate logic in the YES branch of the IF icons',
      'Replace the two IF icons with a SWITCH icon.'
    ]
  },
  'CP0507-2': {
    title: 'Full bridge motor control',
    code: 'CP0507-2',
    description: 'Sometimes we need to control the direction of a motor - for example an electric wheelchair. Wheelchairs typically make use of a pair of 12 or 24V DC motors - one on each drive wheel. A microcontroller /joystick system allows users to go forwards, backwards and also turn left and right. A full bridge circuit - typically in a single chip/module these days - provides this control.',
    details: 'In this worksheet you learn how to control a motor using a full bridge system.',
    videoUrl: 'https://youtu.be/-ajj-YChfro',
    exampleCode: `/*
  Worksheet CP0507-2: Full Bridge Motor Control
  Control motor direction using H-bridge (L298N or similar)
*/

const int MOTOR_PIN1 = 9;   // Motor control pin 1 (PWM)
const int MOTOR_PIN2 = 10;  // Motor control pin 2 (PWM)
const int ENABLE_PIN = 8;    // Enable pin

void setup() {
  pinMode(MOTOR_PIN1, OUTPUT);
  pinMode(MOTOR_PIN2, OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);
  
  digitalWrite(ENABLE_PIN, HIGH);  // Enable motor driver
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP0507-2: Full Bridge Motor Control");
}

void loop() {
  // Forward direction
  Serial2.println("Motor: FORWARD");
  analogWrite(MOTOR_PIN1, 200);  // Speed
  analogWrite(MOTOR_PIN2, 0);
  delay(3000);
  
  // Stop briefly
  analogWrite(MOTOR_PIN1, 0);
  analogWrite(MOTOR_PIN2, 0);
  delay(500);
  
  // Reverse direction
  Serial2.println("Motor: REVERSE");
  analogWrite(MOTOR_PIN1, 0);
  analogWrite(MOTOR_PIN2, 200);  // Speed
  delay(3000);
  
  // Stop briefly
  analogWrite(MOTOR_PIN1, 0);
  analogWrite(MOTOR_PIN2, 0);
  delay(500);
}`,
    tasks: [
      'Watch the video "Controlling DC motors - full bridge" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect an H-bridge motor driver (e.g., L298N) to pins 8, 9, and 10.',
      'The program cycles the motor forwards and backwards at a fixed speed.'
    ],
    challenges: [
      'Modify the program so that two switches control the direction of the motor: forwards and backwards and two switches control the speed.',
      'Print speed and the direction on the LCD.'
    ],
    hints: [
      'In the main loop detect if a switch has been pressed - say A0, A1, A2, A3',
      'Use a SWITCH icon for the logic - assume only one switch is pressed at any time',
      'Put the appropriate logic in the branches of the SWITCH icon.'
    ]
  },
  'CP0507-3': {
    title: 'Servo motor control',
    code: 'CP0507-3',
    description: 'Small servo motors use a miniature DC motor with positional feedback control to allow you to control the angle of a motor rather than the speed. The angle is changed to a linear position control by using a small arm on the rotor with a rod. This allows the flaps on radio-controlled aeroplanes to be controlled remotely.',
    details: 'In this worksheet you learn how to control simple servo motors.',
    videoUrl: 'https://youtu.be/U-GoNwE5kPk',
    exampleCode: `/*
  Worksheet CP0507-3: Servo Motor Control
  Control servo position using potentiometer
*/

#include <Servo.h>

Servo myServo;
const int SERVO_PIN = 9;
const int POTENTIOMETER_PIN = A0;

void setup() {
  myServo.attach(SERVO_PIN);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP0507-3: Servo Motor Control");
}

void loop() {
  // Read potentiometer value (0-1023)
  int potValue = analogRead(POTENTIOMETER_PIN);
  
  // Convert to servo angle (0-180 degrees)
  int angle = map(potValue, 0, 1023, 0, 180);
  
  // Set servo position
  myServo.write(angle);
  
  // Print values
  Serial2.print("Potentiometer: ");
  Serial2.print(potValue);
  Serial2.print(" | Angle: ");
  Serial2.print(angle);
  Serial2.println(" degrees");
  
  delay(15);  // Small delay for servo stability
}`,
    tasks: [
      'Watch the video "Controlling Servo motors" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a servo motor to pin 9 and a potentiometer to analog pin A0.',
      'The program uses a potentiometer to adjust the position of the servo motor.'
    ],
    challenges: [
      'Use a logic analyser to view the waveform generated by the microcontroller for different positions of the servo motor.',
      'Calibrate the motor angle for 0 and 255 full scale.',
      'Use some maths to display the angle on the LCD.'
    ],
    hints: [
      'Set up a Real Type variable - Angle.',
      'Make sure you use the decimal point on all Real calculations: e.g. "2.0" not "2".',
      'Measure the angle (visually) for an output of 0 and 255.',
      'Calculate the angle and display it on the LCD.'
    ]
  },
  'CP0507-4': {
    title: 'Stepper motor control',
    code: 'CP0507-4',
    description: 'Stepper motors are used to accurately rotate a motor one step at a time. These have lots of applications including CNC machines for shaping wood and metal. (The spindle here is often a DC motor with speed control).',
    details: 'In this worksheet you will learn how to control a stepper motor.',
    videoUrl: 'https://youtu.be/8Ihe7q362RA',
    exampleCode: `/*
  Worksheet CP0507-4: Stepper Motor Control
  Control stepper motor rotation
*/

#include <Stepper.h>

// Define stepper motor steps per revolution
const int stepsPerRevolution = 200;

// Initialize stepper motor (pins: IN1, IN2, IN3, IN4)
Stepper myStepper(stepsPerRevolution, 8, 9, 10, 11);

void setup() {
  // Set motor speed (RPM)
  myStepper.setSpeed(60);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP0507-4: Stepper Motor Control");
}

void loop() {
  // Rotate clockwise one revolution
  Serial2.println("Rotating clockwise...");
  myStepper.step(stepsPerRevolution);
  delay(1000);
  
  // Rotate counterclockwise one revolution
  Serial2.println("Rotating counterclockwise...");
  myStepper.step(-stepsPerRevolution);
  delay(1000);
}`,
    tasks: [
      'Watch the video "Controlling stepper motors" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a stepper motor driver to pins 8, 9, 10, and 11.'
    ],
    challenges: [
      'Develop a program that cycles the motor forwards or backwards in 10 degree steps when a forward or backward switch is pressed.'
    ],
    hints: [
      'Use the Actuators board datasheet to understand how many steps are in a 360 degree circle.',
      'In the main loop detect if a +10 degree or -10 degree switch has been pressed - say switch PORTA0 and PORTA1 on a combo board.',
      'Use a SWITCH icon for the logic and a LOOP inside each branch that moves the motor forwards or backwards by the appropriate step count.',
      'Use the display to show the program function.'
    ]
  },
  'CP0507-5': {
    title: 'DC motor speed control',
    code: 'CP0507-5',
    description: 'Varying the power varies the speed, but that does not tell you how fast the motor is turning. For a DC motor some kind of feedback is needed. Then you can form a "closed loop" system with a microcontroller: the microcontroller measures the speed and varies the power until the required speed of the motor is reached. This technique is used in all sorts of machines.',
    details: 'In this worksheet you learn how to make a system that will allow you to measure and then control motor speed.',
    videoUrl: 'https://youtu.be/-hRHCYSXBSE',
    exampleCode: `/*
  Worksheet CP0507-5: DC Motor Speed Control with Feedback
  Closed-loop speed control system
*/

const int MOTOR_PIN = 9;           // PWM pin for motor
const int SPEED_SENSOR_PIN = 2;    // Interrupt pin for speed sensor (hall effect)
const int INCREASE_PIN = 22;       // Switch to increase target speed
const int DECREASE_PIN = 23;       // Switch to decrease target speed

volatile int pulseCount = 0;
int targetRPM = 100;               // Target speed in RPM
int currentRPM = 0;
unsigned long lastTime = 0;
unsigned long lastPulseTime = 0;
int motorSpeed = 128;              // Current PWM value (0-255)

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(SPEED_SENSOR_PIN, INPUT_PULLUP);
  pinMode(INCREASE_PIN, INPUT_PULLUP);
  pinMode(DECREASE_PIN, INPUT_PULLUP);
  
  // Attach interrupt for speed sensor
  attachInterrupt(digitalPinToInterrupt(SPEED_SENSOR_PIN), countPulse, RISING);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP0507-5: Motor Speed Control");
}

void loop() {
  // Read target speed adjustment switches
  if (digitalRead(INCREASE_PIN) == LOW) {
    targetRPM += 10;
    if (targetRPM > 500) targetRPM = 500;
    delay(200);  // Debounce
  }
  if (digitalRead(DECREASE_PIN) == LOW) {
    targetRPM -= 10;
    if (targetRPM < 0) targetRPM = 0;
    delay(200);  // Debounce
  }
  
  // Calculate current RPM (assuming 1 pulse per revolution)
  unsigned long currentTime = millis();
  if (currentTime - lastPulseTime > 1000) {
    // Calculate RPM from pulse count
    currentRPM = (pulseCount * 60) / 1;  // Pulses per minute
    pulseCount = 0;
    lastPulseTime = currentTime;
  }
  
  // Closed-loop control: adjust motor speed based on error
  int error = targetRPM - currentRPM;
  motorSpeed += error / 5;  // Simple proportional control
  
  // Limit motor speed
  if (motorSpeed > 255) motorSpeed = 255;
  if (motorSpeed < 0) motorSpeed = 0;
  
  analogWrite(MOTOR_PIN, motorSpeed);
  
  // Display values every second
  if (currentTime - lastTime >= 1000) {
    Serial2.print("Target RPM: ");
    Serial2.print(targetRPM);
    Serial2.print(" | Current RPM: ");
    Serial2.print(currentRPM);
    Serial2.print(" | Motor Speed: ");
    Serial2.println(motorSpeed);
    lastTime = currentTime;
  }
  
  delay(10);
}

// Interrupt service routine for speed sensor
void countPulse() {
  pulseCount++;
}`,
    tasks: [
      'Watch the video "Controlling DC motors - speed control" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a speed sensor (hall effect) to pin 2, motor to pin 9, and switches to pins 22 and 23.',
      'Set up the hardware as detailed in the program and test the closed-loop speed control.'
    ],
    challenges: [
      'Use the logic analyser to understand the function of the program.',
      'Modify the program to form a closed loop system that varies the speed of the DC motor. Use two push to make switches to increase and decrease the speed.'
    ],
    hints: [
      'The program you have measures the speed in RPM.',
      'In the Main loop detect which switches are pressed - if any.',
      'Create a variable TARGET_RPM',
      'Change the display so that TARGET_RPM and RPM speed are displayed. Use the update-display routine for writing to the display.',
      'Vary the DC motor power up or down depending on whether the TARGET_RPM is lower or greater than the RPM.'
    ]
  },
  // CP1972 Worksheets
  'CP1972-1': {
    title: 'Analogue inputs',
    code: 'CP1972-1',
    description: 'Computers work in 1\'s and 0\'s - the digital world. Sometimes we need to convert a varying voltage into a format a microcontroller can understand. For example: the voltage on a potentiometer on a radio, or from a sensor. We need to convert an analogue signal into a digital value.',
    details: 'In this worksheet you explore this with a simple potentiometer.',
    videoUrl: 'https://youtu.be/HPHHLHAWRVM',
    exampleCode: `/*
  Worksheet CP1972-1: Analogue Inputs
  Read and display analog values from potentiometer
*/

const int POTENTIOMETER_PIN = A0;  // Analog input pin
const int LED_PIN = 13;            // LED indicator

void setup() {
  pinMode(POTENTIOMETER_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-1: Analogue Inputs");
}

void loop() {
  // Read analog value (0-1023)
  int analogValue = analogRead(POTENTIOMETER_PIN);
  
  // Convert to 0-255 range (8-bit)
  int mappedValue = map(analogValue, 0, 1023, 0, 255);
  
  // Display values
  Serial2.print("Analog Reading: ");
  Serial2.print(analogValue);
  Serial2.print(" | Mapped Value: ");
  Serial2.println(mappedValue);
  
  // Flash LED when value exceeds threshold
  if (analogValue > 512) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  
  delay(100);
}`,
    tasks: [
      'Watch the video "Analogue inputs" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a potentiometer to analog pin A0.',
      'The program displays the reading on an analogue port from 0 to 255 based on the supply voltage on microcontroller board.'
    ],
    challenges: [
      'Modify the program so that it displays the potentiometer voltage on the display',
      'Modify the program so that a LED comes on when the voltage input is more than 1V.'
    ],
    hints: [
      'Set up a new variable - POTVOLT - with Type Float',
      'Use the GetVoltage macro to read the potentiometer input as a voltage into POTVOLT',
      'Use an IF icon to test POTVOLT - make sure you use "1.0" as a comparison not "1" to make sure the floating point operator works properly.',
      'Use the PRINTFLOAT macro on the LCD component'
    ]
  },
  'CP1972-2': {
    title: 'Light sensor',
    code: 'CP1972-2',
    description: 'The output voltage from a light sensor either gets higher with more light, or lower. This allows us to detect the light level so that we know when to turn street lights on and off.',
    details: 'In this example you investigate the light level and make an adjustable light switch.',
    exampleCode: `/*
  Worksheet CP1972-2: Light Sensor
  Read light level and control LED based on threshold
*/

const int LIGHT_SENSOR_PIN = A0;  // Light sensor analog input
const int LED_PIN = 13;            // LED output
const int THRESHOLD_PIN = A1;      // Potentiometer for threshold adjustment

int lightLevel = 0;
int threshold = 512;

void setup() {
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(THRESHOLD_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-2: Light Sensor");
}

void loop() {
  // Read light sensor value (0-1023)
  lightLevel = analogRead(LIGHT_SENSOR_PIN);
  
  // Read threshold from potentiometer
  threshold = analogRead(THRESHOLD_PIN);
  
  // Control LED based on light level
  if (lightLevel < threshold) {
    digitalWrite(LED_PIN, HIGH);  // Dark - turn LED on
  } else {
    digitalWrite(LED_PIN, LOW);   // Bright - turn LED off
  }
  
  // Display values
  Serial2.print("Light Level: ");
  Serial2.print(lightLevel);
  Serial2.print(" | Threshold: ");
  Serial2.print(threshold);
  Serial2.print(" | LED: ");
  Serial2.println(digitalRead(LED_PIN) ? "ON" : "OFF");
  
  delay(200);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a light sensor to analog pin A0 and a potentiometer to A1.',
      'The program reads the value of the light sensor and displays it as a number.',
      'Shine a mobile phone light or a torch on the sensor to establish what the numerical range of the sensors is.'
    ],
    challenges: [
      'Make an electronic light switch that turns a LED off when the light level goes high.',
      'Add a potentiometer to your program which adjusts the light level at which the switch is made.'
    ],
    hints: [
      'Add a variable LightLevel and read the light sensor value into this variable',
      'In the Main loop use an IF icon to compare LightLevel to the light sensor input. Alter the LED output accordingly.',
      'Use two lines on the LCD display to show light input level, LightLevel, and to make sure your program is working.'
    ]
  },
  'CP1972-3': {
    title: 'Analogue temperature sensor',
    code: 'CP1972-3',
    description: 'A thermistor\'s resistance varies with temperature. This means that you can use a simple voltage divider to measure temperature. One difficulty here is that the variation of resistance with temperature is not linear, so the program needs to take this into account. Flowcode does this for you in the thermistor component',
    details: 'In this example you develop a simple temperature measuring system.',
    videoUrl: 'https://youtu.be/rI4F64wz6Lk',
    exampleCode: `/*
  Worksheet CP1972-3: Analogue Temperature Sensor (Thermistor)
  Read temperature using thermistor and voltage divider
*/

const int THERMISTOR_PIN = A0;    // Thermistor analog input
const int LED_PIN = 13;            // LED indicator
const int TEMP_THRESHOLD = 25;     // Temperature threshold in Celsius

void setup() {
  pinMode(THERMISTOR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-3: Temperature Sensor");
}

void loop() {
  // Read analog value from thermistor
  int analogValue = analogRead(THERMISTOR_PIN);
  
  // Convert to voltage (0-5V)
  float voltage = (analogValue / 1023.0) * 5.0;
  
  // Simple temperature calculation (Steinhart-Hart approximation)
  // This is a simplified version - actual thermistors need calibration
  float temperature = (voltage - 0.5) * 100.0;  // Rough approximation
  
  // Control LED when temperature exceeds threshold
  if (temperature > TEMP_THRESHOLD) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  
  // Display values
  Serial2.print("Analog: ");
  Serial2.print(analogValue);
  Serial2.print(" | Voltage: ");
  Serial2.print(voltage, 2);
  Serial2.print("V | Temperature: ");
  Serial2.print(temperature, 1);
  Serial2.println("°C");
  
  delay(500);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a thermistor circuit to analog pin A0.',
      'The program reads the value of the temperature and displays it.',
      'Using your fingers touch the sensor and see what the variation is. You can breathe on it as well.'
    ],
    challenges: [
      'Make an electronic temperature sensor that turns a LED on when the temperature reaches a set level.',
      'Alter the program so that the LCD displays the switch temperature as well as the actual temperature.'
    ],
    hints: [
      'Add a variable SwitchTemp and read the Temperature value into this variable',
      'In the Main loop use an IF icon to compare SwitchTemp to the temperature sensor input. Alter the LED output accordingly.'
    ]
  },
  'CP1972-4': {
    title: 'Digital temperature sensor',
    code: 'CP1972-4',
    description: 'Analogue temperature sensors are very cheap, very easy to use, but very inaccurate. Accurate digital temperature sensors chips are very precise but require a little more programming technique.',
    details: 'In this worksheet you investigate the use of a digital temperature sensor which uses serial communication to transfer information.',
    videoUrl: 'https://youtu.be/7r7SHiJQJMA',
    exampleCode: `/*
  Worksheet CP1972-4: Digital Temperature Sensor (DHT22/DHT11)
  Read temperature and humidity from digital sensor
*/

#include <DHT.h>

#define DHT_PIN 2        // Digital pin connected to DHT sensor
#define DHT_TYPE DHT22   // DHT22 (or DHT11)

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial2.begin(115200);
  delay(2000);
  dht.begin();
  Serial2.println("Worksheet CP1972-4: Digital Temperature Sensor");
}

void loop() {
  // Wait a few seconds between measurements
  delay(2000);
  
  // Read temperature and humidity
  float temperature = dht.readTemperature();  // Celsius
  float humidity = dht.readHumidity();       // Percentage
  
  // Check if readings are valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial2.println("Failed to read from DHT sensor!");
    return;
  }
  
  // Display values
  Serial2.print("Temperature: ");
  Serial2.print(temperature, 1);
  Serial2.print("°C | Humidity: ");
  Serial2.print(humidity, 1);
  Serial2.println("%");
}`,
    tasks: [
      'Watch the video "Dig Temp sensor" on the Flowcode YouTube site.',
      'Load the example code and upload it to your board.',
      'Connect a DHT22 or DHT11 sensor to pin 2.',
      'The program shows the temperature and humidity from the digital temperature sensor.'
    ],
    challenges: [
      'Place your finger on top of the sensor and observe how the temperature reading changes.',
      'The sensor also measures humidity. Modify the program so that it measures humidity and prints it on the display.'
    ],
    hints: [
      'Add a variable HUMINT (of Type INT) and read the humidity value into this variable using the GetHumidityInt macro',
      'Set the cursor to a new line and print the value of HUMINT'
    ]
  },
  'CP1972-5': {
    title: 'Digital accelerometer',
    code: 'CP1972-5',
    description: 'Digital accelerometer chips are used in software to measure the orientation of a device - like the digital level software on your mobile phone. These serial devices give out data on the X, Y, Z orientation of the chip.',
    details: 'In this worksheet you investigate a typical digital accelerometer.',
    exampleCode: `/*
  Worksheet CP1972-5: Digital Accelerometer (MPU6050)
  Read X, Y, Z acceleration values
*/

#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

void setup() {
  Serial2.begin(115200);
  delay(2000);
  
  Wire.begin();
  mpu.initialize();
  
  if (mpu.testConnection()) {
    Serial2.println("Worksheet CP1972-5: Accelerometer");
    Serial2.println("MPU6050 connection successful!");
  } else {
    Serial2.println("MPU6050 connection failed!");
  }
}

void loop() {
  // Read accelerometer values
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  
  // Convert to g-force (divide by 16384 for ±2g range)
  float accelX = ax / 16384.0;
  float accelY = ay / 16384.0;
  float accelZ = az / 16384.0;
  
  // Display values
  Serial2.print("X: ");
  Serial2.print(accelX, 2);
  Serial2.print("g | Y: ");
  Serial2.print(accelY, 2);
  Serial2.print("g | Z: ");
  Serial2.print(accelZ, 2);
  Serial2.println("g");
  
  delay(500);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect an MPU6050 accelerometer module via I2C (SDA/SCL pins).',
      'The program shows the X, Y, Z values of acceleration.'
    ],
    challenges: [
      'Modify the program to make a system that shows the board is level in the X plane.',
      'Modify the text output so that it also displays the angle of the board.'
    ],
    hints: [
      'Use Graphical display macros to draw a background rectangle for the level at the bottom of the screen',
      'Use the DrawCircle command to draw a circle representing the level air bubble. The circle is in the centre of the rectangle when the device is level and it at either end when the board is at 90 degrees.',
      'Use a new variable XInt which is type Integer.',
      'Use the calculation command XIntNew = XFloat * 200 + 200 to turn the Float value XFloat into an integer that can be used in the Graphical Display DrawCircle macro.',
      'Use another variable XIntOld to track the old X value. Draw a black circle over the old X position to "wipe" that portion of the display.'
    ]
  },
  'CP1972-6': {
    title: 'Floats and ints',
    code: 'CP1972-6',
    description: 'As you start to measure real world quantities you will need to understand how to manipulate numbers outside the range of a single byte: 0 to 255.',
    details: 'Variables of type INT have a range of -32768 to + 32767. Floating point numbers allow you to manipulate numbers with decimal points.',
    exampleCode: `/*
  Worksheet CP1972-6: Floats and Ints
  Demonstrating different variable types and their ranges
*/

int integerValue = 1000;
float floatValue = 3.14159;
byte byteValue = 255;
long longValue = 1000000;

void setup() {
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-6: Floats and Ints");
  Serial2.println("--- Variable Types Demo ---");
}

void loop() {
  // Integer operations
  integerValue += 100;
  if (integerValue > 32767) integerValue = -32768;  // Wrap around
  
  // Float operations
  floatValue += 0.1;
  if (floatValue > 10.0) floatValue = 0.0;
  
  // Byte operations (0-255)
  byteValue++;
  if (byteValue > 255) byteValue = 0;
  
  // Long operations
  longValue += 1000;
  
  // Display all values
  Serial2.print("Integer: ");
  Serial2.print(integerValue);
  Serial2.print(" | Float: ");
  Serial2.print(floatValue, 2);
  Serial2.print(" | Byte: ");
  Serial2.print(byteValue);
  Serial2.print(" | Long: ");
  Serial2.println(longValue);
  
  // Demonstrate calculations
  float result = (floatValue * integerValue) / 100.0;
  Serial2.print("Calculation (float * int / 100): ");
  Serial2.println(result, 2);
  
  delay(1000);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'The program shows how Floats and Ints are used in programs.',
      'Make sure you read the comments thoroughly, so you understand how to use these new types of variables.'
    ],
    challenges: [
      'Use the BL0144 temperature and humidity sensor to make a small weather station with the following properties:',
      'A display of temperature, and humidity to 2 decimal places. Temperature range -10C to +40C. Humidity from 0% to 100%.',
      'A graph showing temperature variation over time - refreshing every 24 hours.',
      'A clock'
    ],
    hints: [
      'Review the worksheets in Introduction to microcontrollers where you will find examples of graphs and graphical displays, and touchable buttons for graphical displays.',
      'Review the worksheets in Introduction to microcontrollers where you will find information on timer interrupts.'
    ]
  },
  'CP1972-7': {
    title: 'Thermocouple',
    code: 'CP1972-7',
    description: 'Thermocouples are often used for measuring temperature in industrial processes. They are not as accurate as some modern chips - but they have a much greater range - up to 2,500C.',
    details: 'In this worksheet / project you learn how to use a thermocouple to make a temperature control system.',
    exampleCode: `/*
  Worksheet CP1972-7: Thermocouple Temperature Sensor
  Read high-temperature measurements using thermocouple
*/

#include <MAX6675.h>

// MAX6675 thermocouple amplifier
const int SO_PIN = 50;   // Serial Out
const int CS_PIN = 51;   // Chip Select
const int SCK_PIN = 52;  // Serial Clock
const int HEATER_PIN = 9; // PWM pin for heater control

MAX6675 thermocouple(SCK_PIN, CS_PIN, SO_PIN);

float targetTemp = 100.0;  // Target temperature in Celsius
float currentTemp = 0.0;
int heaterPower = 0;

void setup() {
  pinMode(HEATER_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-7: Thermocouple");
}

void loop() {
  // Read temperature from thermocouple
  currentTemp = thermocouple.readCelsius();
  
  // Simple proportional control
  float error = targetTemp - currentTemp;
  heaterPower = constrain((int)(error * 2.5), 0, 255);
  analogWrite(HEATER_PIN, heaterPower);
  
  // Display values
  Serial2.print("Temperature: ");
  Serial2.print(currentTemp, 1);
  Serial2.print("°C | Target: ");
  Serial2.print(targetTemp, 1);
  Serial2.print("°C | Heater: ");
  Serial2.print(heaterPower);
  Serial2.println("%");
  
  delay(500);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a MAX6675 thermocouple amplifier module to pins 50, 51, 52.',
      'Make sure you understand how the program works.'
    ],
    challenges: [
      'Modify the program to make a heating controller which includes the following features:',
      'A display of temperature, set temperature and heater status',
      'A graph showing temperature variation over time - refreshing every 30 minutes. Temperature range 15C to 30C.',
      'An LED that lights up when the target temperature is over run',
      'A way of altering the set temperature with either switches or graphical display touch areas "+" and "-".'
    ],
    hints: [
      'Review the worksheets in Introduction to microcontrollers where you will find examples of graphs and graphical displays, and touchable buttons for graphical displays.'
    ]
  },
  'CP1972-8': {
    title: 'Flow sensor',
    code: 'CP1972-8',
    description: 'Flow rate sensors are everywhere: from petrol pumps, to drug delivery systems to water meters and industrial processors. At the heart of them all is a flow rate sensor.',
    details: 'In this worksheet / project you learn how flow rate sensors work and use one to make a water flow regulator.',
    exampleCode: `/*
  Worksheet CP1972-8: Flow Sensor
  Measure flow rate and control pump
*/

const int FLOW_SENSOR_PIN = 2;    // Interrupt pin for flow sensor
const int PUMP_PIN = 9;            // PWM pin for pump control
const int TARGET_FLOW_PIN = A0;    // Potentiometer for target flow

volatile int pulseCount = 0;
float flowRate = 0.0;              // Flow rate in L/min
float targetFlow = 1.0;            // Target flow rate
int pumpSpeed = 128;               // Pump PWM value

void setup() {
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(TARGET_FLOW_PIN, INPUT);
  
  // Attach interrupt for flow sensor
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), countPulse, RISING);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-8: Flow Sensor");
}

void loop() {
  // Read target flow from potentiometer (0-5 L/min)
  int potValue = analogRead(TARGET_FLOW_PIN);
  targetFlow = map(potValue, 0, 1023, 0, 500) / 100.0;  // Convert to L/min
  
  // Calculate flow rate (assuming 450 pulses per liter)
  static unsigned long lastTime = 0;
  unsigned long currentTime = millis();
  
  if (currentTime - lastTime >= 1000) {
    // Calculate flow rate: pulses per second * 60 / pulses per liter
    flowRate = (pulseCount * 60.0) / 450.0;
    pulseCount = 0;
    lastTime = currentTime;
  }
  
  // Closed-loop control: adjust pump speed based on error
  float error = targetFlow - flowRate;
  pumpSpeed += (int)(error * 50);
  pumpSpeed = constrain(pumpSpeed, 0, 255);
  analogWrite(PUMP_PIN, pumpSpeed);
  
  // Display values
  Serial2.print("Flow Rate: ");
  Serial2.print(flowRate, 2);
  Serial2.print(" L/min | Target: ");
  Serial2.print(targetFlow, 2);
  Serial2.print(" L/min | Pump: ");
  Serial2.println(pumpSpeed);
  
  delay(100);
}

// Interrupt service routine
void countPulse() {
  pulseCount++;
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a flow sensor to pin 2 (interrupt) and a pump to pin 9.',
      'Make sure you understand how the program works. To start with you can blow through the sensor to make sure it works.'
    ],
    challenges: [
      'Make a mechanical rig that allows fluid or air to pass through the sensor. You may need a pump, a tank and appropriate pipes. You will need to use the Power board and power supply to activate a 12 or 24V pump.',
      'Modify the program to make a water flow regulator and meter with the following characteristics:',
      'Microcontroller system, sensor, tank, pump, pipes',
      'A display of flow rate, set flow rate and pump status',
      'A graph showing flow rate variation over time - refreshing every 30 minutes.',
      'An LED that lights up when the target flow rate is over run',
      'A way of altering the set flow rate with either switches or graphical display touch areas "+" and "-".'
    ],
    hints: [
      'There is a worksheet in Microcontrollers and motors where you can learn how to use the BL0110 Power board.',
      'Review the worksheets in Introduction to microcontrollers where you will find examples of graphs and graphical displays, and touchable buttons for graphical displays.'
    ]
  },
  'CP1972-9': {
    title: 'Compressive force sensor',
    code: 'CP1972-9',
    description: 'Force sensors are used with some mechanical attachment for measuring weight.',
    details: 'In this worksheet / project you learn how compressive force sensors are used to measure weight.',
    exampleCode: `/*
  Worksheet CP1972-9: Compressive Force Sensor
  Measure weight using force sensor (load cell with HX711)
*/

#include <HX711.h>

// HX711 amplifier for load cell
const int DOUT_PIN = 3;
const int SCK_PIN = 4;
const int ZERO_PIN = 22;  // Button to zero/tare the scale

HX711 scale;
float calibrationFactor = 1000.0;  // Adjust based on your load cell
float weight = 0.0;
float zeroOffset = 0.0;

void setup() {
  pinMode(ZERO_PIN, INPUT_PULLUP);
  
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(calibrationFactor);
  scale.tare();  // Reset to zero
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-9: Force Sensor");
  Serial2.println("Place object on scale, press button to zero");
}

void loop() {
  // Zero/tare the scale when button pressed
  if (digitalRead(ZERO_PIN) == LOW) {
    scale.tare();
    Serial2.println("Scale zeroed!");
    delay(500);
  }
  
  // Read weight
  weight = scale.get_units(10);  // Average of 10 readings
  
  // Display weight
  Serial2.print("Weight: ");
  Serial2.print(weight, 2);
  Serial2.println(" kg");
  
  delay(200);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a load cell with HX711 amplifier to pins 3 and 4.',
      'Make sure you understand how the program works. To start with you can compress the sensors to get a measurement.'
    ],
    challenges: [
      'Make a mechanical rig that compresses the sensor',
      'Modify the program to make a weighing scale with the following characteristics:',
      'Force sensor with a platform',
      'A display showing the weight of the object',
      'A zero switch or touch object'
    ],
    hints: [
      'Review the worksheets in Introduction to microcontrollers where you will find examples of touchable buttons for graphical displays.'
    ]
  },
  'CP1972-10': {
    title: 'Strain sensor',
    code: 'CP1972-10',
    description: 'Strain sensors are extensively used to measure the force in beams and mechanical systems. The choice of compressive or strain sensors is governed by the mechanical properties of the system being measured.',
    details: 'In this worksheet / project you learn how strain sensors are used to forces in beams.',
    exampleCode: `/*
  Worksheet CP1972-10: Strain Sensor
  Measure strain/force in beams using strain gauge
*/

#include <HX711.h>

// HX711 amplifier for strain gauge
const int DOUT_PIN = 3;
const int SCK_PIN = 4;
const int LED_PIN = 13;  // LED indicator for strain detection

HX711 scale;
float calibrationFactor = 1000.0;
float strain = 0.0;
float threshold = 100.0;  // Strain threshold

void setup() {
  pinMode(LED_PIN, OUTPUT);
  
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(calibrationFactor);
  scale.tare();  // Zero the sensor
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-10: Strain Sensor");
}

void loop() {
  // Read strain value
  strain = scale.get_units(10);  // Average of 10 readings
  
  // Indicate when strain exceeds threshold
  if (abs(strain) > threshold) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  
  // Display strain value
  Serial2.print("Strain: ");
  Serial2.print(strain, 2);
  Serial2.print(" | Threshold: ");
  Serial2.print(threshold, 2);
  Serial2.print(" | Status: ");
  Serial2.println(abs(strain) > threshold ? "EXCEEDED" : "OK");
  
  delay(200);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a strain gauge with HX711 amplifier to pins 3 and 4.',
      'Make sure you understand how the program works. To start with you can activate the sensor with your hands to get a measurement.'
    ],
    challenges: [
      'Create a project using strain sensors to measure forces in beams or mechanical systems.'
    ],
    hints: [
      'Review the worksheets in Introduction to microcontrollers where you will find examples of touchable buttons for graphical displays.'
    ]
  },
  'CP1972-11': {
    title: 'Pressure sensor',
    code: 'CP1972-11',
    description: 'Pressure sensors are used extensively in the automotive industry for tyre pressure monitoring in vehicles, in carburettors, and exhaust systems.',
    details: 'In this worksheet / project you learn how to use pressure sensors in microcontroller circuits.',
    exampleCode: `/*
  Worksheet CP1972-11: Pressure Sensor
  Read pressure values from analog pressure sensor
*/

const int PRESSURE_SENSOR_PIN = A0;  // Analog pressure sensor
const int LED_PIN = 13;              // LED indicator
const int TARGET_PRESSURE_PIN = A1;   // Potentiometer for target pressure

float pressure = 0.0;        // Pressure in PSI (or kPa)
float targetPressure = 50.0; // Target pressure
int pressureRaw = 0;

void setup() {
  pinMode(PRESSURE_SENSOR_PIN, INPUT);
  pinMode(TARGET_PRESSURE_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  
  Serial2.begin(115200);
  delay(2000);
  Serial2.println("Worksheet CP1972-11: Pressure Sensor");
}

void loop() {
  // Read pressure sensor (0-1023)
  pressureRaw = analogRead(PRESSURE_SENSOR_PIN);
  
  // Convert to pressure (calibrate based on your sensor)
  // Example: 0-1023 maps to 0-100 PSI
  pressure = map(pressureRaw, 0, 1023, 0, 1000) / 10.0;  // Convert to PSI
  
  // Read target pressure from potentiometer
  int potValue = analogRead(TARGET_PRESSURE_PIN);
  targetPressure = map(potValue, 0, 1023, 0, 1000) / 10.0;
  
  // Control LED when pressure exceeds target
  if (pressure > targetPressure) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  
  // Display values
  Serial2.print("Pressure: ");
  Serial2.print(pressure, 1);
  Serial2.print(" PSI | Target: ");
  Serial2.print(targetPressure, 1);
  Serial2.print(" PSI | Status: ");
  Serial2.println(pressure > targetPressure ? "HIGH" : "OK");
  
  delay(200);
}`,
    tasks: [
      'Load the example code and upload it to your board.',
      'Connect a pressure sensor to analog pin A0.',
      'Make sure you understand how the program works. To start with you can blow, or suck, on the sensor to make sure it works.'
    ],
    challenges: [
      'Get hold of a syringe style pump and hose to attach to the sensor.',
      'Modify the program to make a pressure measuring system with the following characteristics:',
      'Microcontroller system, sensor, pump and hose',
      'A display of pressure rate, set flow rate and pump status',
      'A graph showing flow rate variation over time - refreshing every 30 seconds.',
      'An LED that lights up when the target flow rate is over run',
      'A way of altering the set flow rate with either switches or graphical display touch areas "+" and "-".'
    ],
    hints: [
      'Review the worksheets in Introduction to microcontrollers where you will find examples of graphs and graphical displays, and touchable buttons for graphical displays.'
    ]
  },
  // CP4436 Worksheets
  'CP4436-1': {
    title: 'Beginning hardware interfacing - PC to hardware',
    code: 'CP4436-1',
    description: 'Traditional electronic control panels take a lot of putting together. It is far easier to create a virtual control panel on a PC link that to some low cost interface - like an Arduino Uno.',
    details: 'In this worksheet you learn how you can use a PC to control and monitor the state I/O lines on an Embedded device.',
    videoUrl: 'https://youtu.be/uWSrXF2Y3M4',
    tasks: [
      'Watch the video "PC Developer first USB project" on the Flowcode YouTube site.',
      'For this learning package there will be two programs: Embedded and PC Developer.',
      'Load the file "First USB - PIC" into Flowcode. Set up the hardware appropriately and compile this to the microcontroller.',
      'Load the file "First USB - PC". Set up the USART com port to the Embedded USB connection. Select DEBUG->RUN.',
      'The embedded program looks at the status of a switch on the microcontroller and sends this as a 1 or a 0 to the PC.',
      'The PC program looks at the USB port for data: in this case a 1 or a 0, and it alters the status of an on-screen LED accordingly.'
    ],
    challenges: [
      'Alter the Embedded program so that it sends the value of a potentiometer - between 0 and 255 - to the PC.',
      'Alter the PC program so that it receives a single number and shows it on a display.'
    ],
    hints: [
      'Embedded program: Set up a new variable - POTVOLT - with Type Byte. Use the GetVoltage macro to read the potentiometer input as a voltage into POTVOLT. Use the UART Sendnumber command to send this to the PC via USB.',
      'PC program: Put a Circular Gauge component on the panel. This takes variables of Type Float - not just a simple byte. Create a new variable FloatPot type Float. You will need to assign this to the value of the incoming PotVolt variable with a command like: FloatPot = FLOAT PotVolt. Use the Circular Gauge to display the incoming value.'
    ]
  },
  'CP4436-2': {
    title: 'Bidirectional hardware control',
    code: 'CP4436-2',
    description: 'In practice most Human Machine Interfaces need bidirectional transfer of information - in this case using the USB lead.',
    details: 'In this worksheet you implement your first proper HMI.',
    videoUrl: 'https://youtu.be/DCghD8VH_a4',
    tasks: [
      'Watch the video "PC Developer third USB project" on the Flowcode YouTube site.',
      'For this worksheet there will be two programs: Embedded and PC Developer.',
      'Load the file "Third USB - PIC" into Flowcode. Set up the hardware appropriately and compile this to the microcontroller.',
      'Open a 2nd Flowcode Window and Load the file "Third USB - PC". Set up the USART com port to the Embedded USB connection. Select DEBUG->RUN.',
      'This is a bidirectional data transfer system: both the PC and the embedded system look for the status of a switch locally and send it via USB. Each system then looks for incoming data and puts it on a LED.'
    ],
    challenges: [
      'For the embedded system: Develop the program so that it reads the value of a potentiometer and transmits it as a number via USB to the PC. Develop the program so that it receives a number in the range 0 - 255 and displays it on the local LCD display.',
      'For the PC system: Develop the program so that it reads the number and publishes it on a gauge. Develop the program so that it reads the value of a circular knob and transmits if via USB.'
    ],
    hints: [
      'Use UART Sendnumber to send data from embedded to PC.',
      'Use UART Receive to get data from PC to embedded.',
      'Make sure both programs are running and connected to the same COM port.',
      'Test bidirectional communication by sending data both ways simultaneously.'
    ]
  },
  'CP4436-3': {
    title: 'JSON encoding',
    code: 'CP4436-3',
    description: 'As you get larger amounts of data going between a PC and an embedded system, tracking each bit of data in a packet gets harder. The JSON encoding scheme makes data management much easier.',
    details: 'In this worksheet you learn how the JSON system works.',
    videoUrl: 'https://youtu.be/liKAzXWhHyU',
    tasks: [
      'Watch the video "PC Developer program to monitor temperature and humidity on the PC" on the Flowcode YouTube site.',
      'For this worksheet there will be two programs: Embedded and PC Developer.',
      'Load the file "Temp Hum JSON - Ard" into Flowcode. Set up the hardware appropriately and compile this to the microcontroller.',
      'Load the file "Temp Hum JSON - PC". Set up the USART com port to the Embedded USB connection. Select DEBUG->RUN.',
      'This program uses JSON encoding to send temperature data to the PC via the USB lead.',
      'Use the Console to see the incoming data from the Embedded system - this allows you to see the JSON data packet structure.'
    ],
    challenges: [
      'Flowcode Embedded: Modify the program so that the status of two switches are also transmitted with in JSON packet.',
      'Flowcode PC developer: modify the program to include two panel switches that reflect the status of the switches on the hardware.',
      'Add a text box that shows the value of the Humidity data sent in the JSON packet.'
    ],
    hints: [
      'Embedded: Add two switches to the Embedded panel and two Type Byte variables. Associate the value of the variables with the state of the switches. Add these to the JSON packet.',
      'PC Developer: Add two LEDs to the PC Developer panel. Extract the value of the switches from the incoming JSON packet. Alter the state of the LEDs accordingly.'
    ]
  },
  'CP4436-4': {
    title: 'Full PC - Embedded project',
    code: 'CP4436-4',
    description: 'Once you understand JSON then larger bidirectional control and monitoring projects are just larger programs.',
    details: 'In this worksheet you establish quite a significant PC control and monitoring system that you can adapt for your own projects.',
    videoUrl: 'https://youtu.be/YxShbPy_JJE',
    tasks: [
      'Watch the video "PC Developer full USB project" on the Flowcode YouTube site.',
      'For this worksheet there will be two programs: Embedded and PC Developer.',
      'Load the file "Full USB project - Ard" into Flowcode. Set up the hardware appropriately and compile this to the microcontroller.',
      'Load the file "Full USB project - PC". Set up the USART com port to the Embedded USB connection. Select DEBUG->RUN.',
      'This program uses JSON encoding to send data to and from the Embedded system and the PC to form a quite comprehensive Human Machine Interface.',
      'In PC Developer use the Console to see the incoming data from the Embedded system whilst altering the status of the Embedded system IO. The console allows you to see the JSON data packet structure.'
    ],
    challenges: [
      'Flowcode Embedded: add a DC motor to the Embedded system. Alter the program so that the speed is controlled from the PC Developer program. Alter the program so that one of the PC Developer switches controls the direction of the motor.',
      'Flowcode PC Developer: Set the cursor to a new line and print the value of HUMINT'
    ],
    hints: [
      'Add a motors component to the Embedded panel. Use the incoming data and the DC motor hardware macros to trap incoming data and make appropriate adjustments.',
      'An issue with this system is the timing between the Embedded System and the PC Developer system. In practice this is better controlled with an interrupt to monitor incoming communications on the USB port and a circular buffer to store data.'
    ]
  }
};

// Load and display curriculum
// Global state for curriculum navigation
let currentCurriculumCode = null;

// Curriculum file mapping
const curriculumFiles = {
  'CP4807': 'curriculum1.txt',
  'CP0507': 'CP0507 - Motors and microconrtollers.txt',
  'CP1972': 'CP1972 - Sensors and microcontrollers.txt',
  'CP4436': 'CP4436 - PC and web interfacing.txt'
};

// Level mapping for different curriculum formats
const levelMapping = {
  'Bronze': 'bronze',
  'Silver': 'silver',
  'Gold': 'gold',
  'Pass': 'bronze',
  'Pass +': 'silver',
  'Distinction': 'gold'
};

// Parser functions removed - using manual data instead
async function loadCurriculumFromFiles() {
  // Manual data is already loaded in curriculumData and worksheetContent
  return Promise.resolve();
}

function loadCurriculum() {
  const content = document.getElementById('curriculum-content');
  if (!content) return;

  // Hide worksheet viewer if visible
  const worksheetViewer = document.getElementById('worksheet-viewer');
  const curriculumListEl = document.getElementById('curriculum-list');
  if (worksheetViewer) worksheetViewer.style.display = 'none';
  if (curriculumListEl) curriculumListEl.style.display = 'block';

  content.innerHTML = '';

  // Show top-level curriculum list
  curriculumList.forEach(curriculum => {
    const curriculumDiv = document.createElement('div');
    curriculumDiv.className = 'curriculum-item';
    curriculumDiv.innerHTML = `
      <div class="curriculum-item-icon">📚</div>
      <div class="curriculum-item-info">
        <div class="curriculum-item-code">${curriculum.code}</div>
        <div class="curriculum-item-title">${curriculum.title}</div>
      </div>
    `;
    curriculumDiv.addEventListener('click', () => selectCurriculum(curriculum.code));
    content.appendChild(curriculumDiv);
  });
}

// Select a curriculum and show its worksheets
function selectCurriculum(curriculumCode) {
  currentCurriculumCode = curriculumCode;
  const content = document.getElementById('curriculum-content');
  if (!content) return;

  // Hide worksheet viewer if visible, show curriculum list
  const worksheetViewer = document.getElementById('worksheet-viewer');
  const curriculumListEl = document.getElementById('curriculum-list');
  if (worksheetViewer) worksheetViewer.style.display = 'none';
  if (curriculumListEl) curriculumListEl.style.display = 'block';

  content.innerHTML = '';

  const curriculum = curriculumList.find(c => c.code === curriculumCode);
  if (!curriculum) return;

  // Add back button
  const backButton = document.createElement('div');
  backButton.className = 'curriculum-back-button';
  backButton.innerHTML = '← Back to Curriculums';
  backButton.addEventListener('click', () => {
    currentCurriculumCode = null;
    loadCurriculum();
  });
  content.appendChild(backButton);

  // Add curriculum header
  const header = document.createElement('div');
  header.className = 'curriculum-selected-header';
  header.innerHTML = `
    <div class="curriculum-selected-code">${curriculum.code}</div>
    <div class="curriculum-selected-title">${curriculum.title}</div>
  `;
  content.appendChild(header);

  // Get worksheets for this curriculum
  const worksheets = curriculumData[curriculumCode];
  if (!worksheets) return;

  // Create levels
  const levels = [
    { key: 'bronze', title: 'Bronze', class: 'bronze' },
    { key: 'silver', title: 'Silver', class: 'silver' },
    { key: 'gold', title: 'Gold', class: 'gold' }
  ];

  levels.forEach(level => {
    const levelWorksheets = worksheets[level.key];
    if (!levelWorksheets || levelWorksheets.length === 0) return;

    const levelDiv = document.createElement('div');
    levelDiv.className = 'curriculum-level';

    const headerEl = document.createElement('div');
    headerEl.className = `curriculum-level-header ${level.class}`;
    headerEl.innerHTML = `<span class="curriculum-level-title">${level.title}</span>`;

    const lessonsDiv = document.createElement('div');
    lessonsDiv.className = 'curriculum-lessons';

    levelWorksheets.forEach(lesson => {
      const lessonDiv = document.createElement('div');
      lessonDiv.className = 'curriculum-lesson';
      lessonDiv.innerHTML = `
        <span class="curriculum-lesson-number">Worksheet ${lesson.number}</span>
        <span class="curriculum-lesson-title">${lesson.title}</span>
        <span class="curriculum-lesson-code">${lesson.code}</span>
      `;
      lessonDiv.addEventListener('click', (e) => selectLesson(lesson, level, e.currentTarget));
      lessonsDiv.appendChild(lessonDiv);
    });

    levelDiv.appendChild(headerEl);
    levelDiv.appendChild(lessonsDiv);
    content.appendChild(levelDiv);
  });
}

// Select a lesson
function selectLesson(lesson, level, eventElement) {
  // Remove active class from all lessons
  document.querySelectorAll('.curriculum-lesson').forEach(el => {
    el.classList.remove('active');
  });

  // Add active class to selected lesson
  if (eventElement) {
    eventElement.classList.add('active');
  }

  // Hide curriculum list and show worksheet viewer
  const curriculumListEl = document.getElementById('curriculum-list');
  if (curriculumListEl) curriculumListEl.style.display = 'none';

  // Display worksheet content
  displayWorksheet(lesson.number);
}

// Display worksheet content
function displayWorksheet(worksheetNumber) {
  // Try to find worksheet by number in current curriculum
  let worksheet = null;

  if (currentCurriculumCode) {
    // Try curriculum-specific key first (e.g., "CP4807-1")
    const worksheetKey = `${currentCurriculumCode}-${worksheetNumber}`;
    worksheet = worksheetContent[worksheetKey];
  }

  // Fallback to number-only key (for CP4807 compatibility with existing data)
  if (!worksheet) {
    worksheet = worksheetContent[worksheetNumber];
  }

  if (!worksheet) {
    showUploadStatus('info', `Worksheet ${worksheetNumber} content is being prepared.`);
    return;
  }

  const viewer = document.getElementById('worksheet-viewer');
  const titleEl = document.getElementById('worksheet-viewer-title');
  const codeEl = document.getElementById('worksheet-viewer-code');
  const contentEl = document.getElementById('worksheet-content');

  // Set title and code
  titleEl.textContent = `Worksheet ${worksheetNumber}: ${worksheet.title}`;
  codeEl.textContent = worksheet.code;

  // Build content HTML
  let html = '';

  if (worksheet.description) {
    html += `<div class="worksheet-section"><p class="worksheet-description">${worksheet.description}</p></div>`;
  }

  if (worksheet.details) {
    html += `<div class="worksheet-section"><p>${worksheet.details}</p></div>`;
  }

  if (worksheet.videoUrl) {
    html += `<div class="worksheet-section">
      <h3>Video Tutorial</h3>
      <div class="worksheet-video">
        <a href="${worksheet.videoUrl}" target="_blank" class="worksheet-video-link">
          <span>▶</span> Watch on YouTube: ${worksheet.videoUrl}
        </a>
      </div>
    </div>`;
  }

  if (worksheet.exampleCode) {
    html += `<div class="worksheet-section">
      <h3>Example Code</h3>
      <div class="worksheet-code-block">
        <pre><code>${escapeHtml(worksheet.exampleCode)}</code></pre>
        <button class="btn-sm btn-outline worksheet-load-code" data-code="${escapeHtml(worksheet.exampleCode)}">Load into Editor</button>
      </div>
    </div>`;
  }

  if (worksheet.tasks && worksheet.tasks.length > 0) {
    html += `<div class="worksheet-section">
      <h3>Over to you:</h3>
      <ul class="worksheet-list">`;
    worksheet.tasks.forEach(task => {
      html += `<li>${task}</li>`;
    });
    html += `</ul></div>`;
  }

  if (worksheet.challenges && worksheet.challenges.length > 0) {
    html += `<div class="worksheet-section">
      <h3>Challenges:</h3>
      <ul class="worksheet-list">`;
    worksheet.challenges.forEach(challenge => {
      html += `<li>${challenge}</li>`;
    });
    html += `</ul></div>`;
  }

  if (worksheet.hints && worksheet.hints.length > 0) {
    html += `<div class="worksheet-section">
      <h3>Hints:</h3>
      <ol class="worksheet-list">`;
    worksheet.hints.forEach(hint => {
      html += `<li>${hint}</li>`;
    });
    html += `</ol></div>`;
  }

  contentEl.innerHTML = html;

  // Add event listener for load code button
  const loadCodeBtn = contentEl.querySelector('.worksheet-load-code');
  if (loadCodeBtn && monacoEditor) {
    loadCodeBtn.addEventListener('click', () => {
      // Get the code from data attribute and unescape HTML entities
      let code = loadCodeBtn.getAttribute('data-code');
      if (code && monacoEditor) {
        // Unescape HTML entities
        const div = document.createElement('div');
        div.innerHTML = code;
        code = div.textContent || div.innerText || code;
        
        monacoEditor.setValue(code);
        closeWorksheet();
        showUploadStatus('success', 'Example code loaded into editor');
      }
    });
  }

  // Show the viewer and hide curriculum list
  viewer.style.display = 'flex';
  const curriculumList = document.getElementById('curriculum-list');
  if (curriculumList) {
    curriculumList.style.display = 'none';
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close worksheet viewer
function closeWorksheet() {
  const viewer = document.getElementById('worksheet-viewer');
  const curriculumList = document.getElementById('curriculum-list');
  
  if (viewer) {
    viewer.style.display = 'none';
  }
  
  if (curriculumList) {
    curriculumList.style.display = 'block';
  }
  
  // Remove active class from all lessons
  document.querySelectorAll('.curriculum-lesson').forEach(el => {
    el.classList.remove('active');
  });

  // If we have a current curriculum, show its worksheets, otherwise show curriculum list
  if (currentCurriculumCode) {
    selectCurriculum(currentCurriculumCode);
  } else {
    loadCurriculum();
  }
}

// Tab switching functionality
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      // Remove active class from all tabs and content
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
      });
      
      // Add active class to clicked tab
      btn.classList.add('active');
      
      // Show corresponding content
      const content = document.getElementById(`${tabName}-tab`);
      if (content) {
        content.style.display = 'block';
        content.classList.add('active');
      }
    });
  });
}

// Initialize app - this runs regardless of Monaco Editor status
function initializeApp() {
  console.log('Initializing app...');
  
  // Check Arduino CLI
  checkArduinoCLI();
  
  // Check drivers and show/hide banner
  checkDrivers();
  
  // Recheck drivers periodically (every 30 seconds) in case they get installed
  setInterval(checkDrivers, 30000);
  
  // Load curriculum UI (data is manually coded, no file parsing needed)
  try {
    loadCurriculum();
  } catch (error) {
    console.error('Error loading curriculum:', error);
  }
  
  // Worksheet close button
  const worksheetCloseBtn = document.getElementById('worksheet-close-btn');
  if (worksheetCloseBtn) {
    worksheetCloseBtn.addEventListener('click', closeWorksheet);
  }

  // Setup sidebars
  try {
    setupSidebar('leftSidebar', 'leftSidebarToggle');
    setupSidebar('rightSidebar', 'rightSidebarToggle');
    setupResizer('leftResizer', 'leftSidebar');
    setupResizer('rightResizer', 'rightSidebar');
  } catch (error) {
    console.error('Error setting up sidebars:', error);
  }

  // Refresh ports on load
  try {
    refreshPorts();
  } catch (error) {
    console.error('Error refreshing ports:', error);
  }

  // Event listeners
  try {
    document.getElementById('refresh-ports-btn').addEventListener('click', refreshPorts);
    
    // Driver installation buttons (sidebar and banner)
    const installDriversBtn = document.getElementById('install-drivers-btn');
    if (installDriversBtn) {
      installDriversBtn.addEventListener('click', installDrivers);
    }
    
    const bannerInstallBtn = document.getElementById('driver-banner-install-btn');
    if (bannerInstallBtn) {
      bannerInstallBtn.addEventListener('click', async () => {
        await installDrivers();
        // Recheck drivers after installation to hide banner
        setTimeout(checkDrivers, 2000);
      });
    }
    
    // Setup upload button - initially disabled until connection is established
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.disabled = true; // Disabled by default until board is connected
      uploadBtn.addEventListener('click', (e) => {
        if (uploadBtn.disabled) {
          flashUploadWarning();
          e.preventDefault();
          return;
        }
        uploadCode();
      });
      
      // Add hover handler for disabled state
      uploadBtn.addEventListener('mouseenter', () => {
        if (uploadBtn.disabled) {
          flashUploadWarning();
        }
      });
    }
    
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
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded, initialize immediately
  initializeApp();
}
