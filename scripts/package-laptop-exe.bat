@echo off
setlocal
echo ==============================================================================
echo [OpenBot] Building Standalone Laptop Edge Server (OpenBot-Laptop-Edge.exe)
echo ==============================================================================
powershell -ExecutionPolicy Bypass -File "%~dp0package-laptop-exe.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Executable ready at dist-artifacts\OpenBot-Laptop-Edge.exe
)
pause
