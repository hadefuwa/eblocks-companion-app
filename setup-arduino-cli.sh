#!/bin/bash

# Setup script for Arduino CLI
# This script helps set up Arduino CLI for the E-Blocks 3 Companion App

echo "E-Blocks 3 Companion App - Arduino CLI Setup"
echo "============================================"
echo ""

# Check if arduino-cli is already installed
if command -v arduino-cli &> /dev/null; then
    echo "✓ Arduino CLI is already installed"
    arduino-cli version
    echo ""
else
    echo "Arduino CLI is not installed."
    echo "Please install it from: https://arduino.github.io/arduino-cli/"
    echo ""
    echo "Or use one of these methods:"
    echo "  macOS:   brew install arduino-cli"
    echo "  Windows: choco install arduino-cli"
    echo "  Linux:   See https://arduino.github.io/arduino-cli/installation/"
    exit 1
fi

# Initialize config if it doesn't exist
if [ ! -f ~/.arduino15/arduino-cli.yaml ]; then
    echo "Initializing Arduino CLI configuration..."
    arduino-cli config init
fi

# Update core index
echo "Updating core index..."
arduino-cli core update-index

# Install Arduino AVR core (for Arduino Mega)
echo "Installing Arduino AVR core (for Arduino Mega)..."
arduino-cli core install arduino:avr

# Install ESP32 core
echo "Installing ESP32 core..."
arduino-cli core install esp32:esp32

echo ""
echo "Setup complete!"
echo ""
echo "Installed cores:"
arduino-cli core list

