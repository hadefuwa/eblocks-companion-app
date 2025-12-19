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
        // Update port dropdown to show the uploaded port
        const portSelect = document.getElementById('com-port-select');
        if (portSelect.value !== result.port) {
          portSelect.value = result.port;
        }
        
        // Wait a moment for device to reset after upload, then reconnect
        showUploadStatus('info', 'Waiting for device to reset...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Reconnect to serial port for monitoring
        try {
          const baudRate = document.getElementById('baud-rate-select').value;
          const connectResult = await window.electronAPI.serialConnect({ 
            port: result.port, 
            baudRate: parseInt(baudRate) || 115200 
          });
          
          if (connectResult.success) {
            updateConnectionStatus(true, result.port);
            showUploadStatus('success', `Connected to ${result.port} - Serial monitor active`);
            setTimeout(() => {
              document.getElementById('upload-status').style.display = 'none';
            }, 3000);
          } else {
            updateConnectionStatus(false);
            showUploadStatus('warning', `Upload successful but couldn't reconnect: ${connectResult.error}`);
          }
        } catch (connectError) {
          console.error('Reconnection error:', connectError);
          updateConnectionStatus(false);
          showUploadStatus('warning', 'Upload successful but serial monitor not connected');
        }
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

// Curriculum Data
const curriculumData = {
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
};

// Worksheet Content Data
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
      'Investigate variable types: Change `int count` to `byte count`, `unsigned int count`, or `long count`. See how this affects the maximum count value.',
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
  }
};

// Load and display curriculum
function loadCurriculum() {
  const content = document.getElementById('curriculum-content');
  if (!content) return;

  content.innerHTML = '';

  // Create levels
  const levels = [
    { key: 'bronze', title: 'Bronze', class: 'bronze' },
    { key: 'silver', title: 'Silver', class: 'silver' },
    { key: 'gold', title: 'Gold', class: 'gold' }
  ];

  levels.forEach(level => {
    const levelDiv = document.createElement('div');
    levelDiv.className = 'curriculum-level';

    const header = document.createElement('div');
    header.className = `curriculum-level-header ${level.class}`;
    header.innerHTML = `<span class="curriculum-level-title">${level.title}</span>`;

    const lessonsDiv = document.createElement('div');
    lessonsDiv.className = 'curriculum-lessons';

    curriculumData[level.key].forEach(lesson => {
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

    levelDiv.appendChild(header);
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

  // Display worksheet content
  displayWorksheet(lesson.number);
}

// Display worksheet content
function displayWorksheet(worksheetNumber) {
  const worksheet = worksheetContent[worksheetNumber];
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
    const videoId = worksheet.videoUrl.split('/').pop();
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
      const code = loadCodeBtn.getAttribute('data-code');
      if (code && monacoEditor) {
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
  
  // Force a reflow to ensure proper height calculation
  void viewer.offsetHeight;
  
  // Ensure worksheet-content can scroll
  setTimeout(() => {
    const content = document.getElementById('worksheet-content');
    if (content) {
      content.style.height = 'auto';
      content.style.maxHeight = 'none';
    }
  }, 10);
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
}

// Tab switching
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Load curriculum when curriculum tab is opened
      if (targetTab === 'curriculum') {
        loadCurriculum();
      }
    });
  });
  
  // Load curriculum on initial page load if curriculum tab is visible
  const curriculumTab = document.getElementById('curriculum-tab');
  if (curriculumTab && curriculumTab.classList.contains('active')) {
    loadCurriculum();
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Setup tabs
  setupTabs();

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
      console.log('Received serial data:', data);
      if (data && data.data) {
        addSerialLine(data.data);
      }
    });
  } else {
    console.warn('Serial data listener not available');
  }

  // Worksheet viewer close button
  const worksheetCloseBtn = document.getElementById('worksheet-close-btn');
  if (worksheetCloseBtn) {
    worksheetCloseBtn.addEventListener('click', closeWorksheet);
  }
});
