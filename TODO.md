# TODO List

## 1. Combo Board Graphical Representation

Create a graphical representation of the combo board showing 8-bit LEDs for Port A and Port B, linked to the example code.

### Tasks

- [ ] **Design HTML structure** - Create HTML structure for combo board visualization component (16 LEDs total: 8 for Port A, 8 for Port B)
- [ ] **Style LED indicators** - Style the combo board visualization with LED indicators (on/off states, colors matching physical board)
- [ ] **Implement JavaScript logic** - Parse serial monitor output and update LED states in real-time
- [ ] **Link to example code** - Automatically show LEDs when combo board example code (DEFAULT_CODE) is loaded
- [ ] **Integrate with serial monitor** - Read Port A and Port B states from serial output and update LED visualization
- [ ] **Add to UI** - Place combo board visualization in UI (likely in left sidebar or as a separate panel)
- [ ] **Test visualization** - Verify LEDs update correctly based on serial monitor output

---

## 2. LCD Graphical Editor

Create a graphical editor for the LCD screen to write to ESP32 and the 3.5" LCD attached to E-Blocks. See `docs/graphical.md` for detailed architecture.

### Phase 1: Protocol & Firmware

- [ ] **Define graphics API protocol** - Design graphics API for ESP32 LCD communication (clear, pixel, line, rect, text, bitmap commands)
- [ ] **Design UART protocol** - Create binary UART protocol between eBlocks MCU and ESP32 (framed packets with CRC, see graphical.md Phase 3)
- [ ] **Develop ESP32 firmware** - Build ESP32 firmware to receive UART commands and render graphics on 3.5" LCD (Phase 3 from graphical.md)
- [ ] **Create MCU driver library** - Develop eBlocks MCU display driver library (C/C++) that serializes graphics commands over UART to ESP32

### Phase 2: Graphical Editor UI

- [ ] **Build WYSIWYG editor** - Create graphical editor UI with canvas for 3.5" LCD (320x240 or actual resolution)
- [ ] **Implement drag-drop widgets** - Add drag-drop functionality for widgets (text, shapes, images, buttons, etc.)
- [ ] **Create property panel** - Build property panel for selected widgets (x, y, text, font, color, size, etc.)

### Phase 3: Code Generation

- [ ] **Implement code generator** - Build code generation pipeline: GUI layout → JSON → C code with display_*() function calls
- [ ] **Export functionality** - Add export to C code for eBlocks MCU integration
- [ ] **JSON layout format** - Define and implement JSON layout file format for versioning and diffability

### Phase 4: Integration & Testing

- [ ] **End-to-end testing** - Test complete flow: Graphical editor → Generated code → eBlocks MCU → ESP32 → LCD display
- [ ] **Error handling** - Add error handling for UART communication failures
- [ ] **Documentation** - Document the graphics API, protocol, and usage examples

---

## Notes

- **Combo Board**: Port A uses pins {29, 28, 27, 26, 25, 24, 23, 22}, Port B uses pins {13, 12, 11, 10, 50, 51, 52, 53}
- **LCD Architecture**: PC IDE → eBlocks MCU → ESP32 (via UART J0/J1) → LCD panel
- **ESP32 Communication**: ESP32 acts as graphics coprocessor, receives commands via UART from eBlocks MCU
- **Code Generation**: The PC editor generates code, it never talks directly to ESP32

---

## Priority

1. **High Priority**: Combo Board Visualization (simpler, provides immediate visual feedback)
2. **Medium Priority**: LCD Graphical Editor Protocol & Firmware (foundation for editor)
3. **Medium Priority**: LCD Graphical Editor UI (user-facing feature)
4. **Low Priority**: Advanced features (simulator, advanced widgets, etc.)

