@echo off
REM Setup script for Arduino CLI (Windows)
REM This script helps set up Arduino CLI for the E-Blocks 3 Companion App

echo E-Blocks 3 Companion App - Arduino CLI Setup
echo ============================================
echo.

REM Check if arduino-cli is installed
where arduino-cli >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Arduino CLI is already installed
    arduino-cli version
    echo.
) else (
    echo Arduino CLI is not installed.
    echo Please install it from: https://arduino.github.io/arduino-cli/
    echo.
    echo Or use: choco install arduino-cli
    pause
    exit /b 1
)

REM Initialize config if it doesn't exist
if not exist "%USERPROFILE%\.arduino15\arduino-cli.yaml" (
    echo Initializing Arduino CLI configuration...
    arduino-cli config init
)

REM Update core index
echo Updating core index...
arduino-cli core update-index

REM Install Arduino AVR core (for Arduino Mega)
echo Installing Arduino AVR core (for Arduino Mega)...
arduino-cli core install arduino:avr

REM Install ESP32 core
echo Installing ESP32 core...
arduino-cli core install esp32:esp32

echo.
echo Setup complete!
echo.
echo Installed cores:
arduino-cli core list

pause

