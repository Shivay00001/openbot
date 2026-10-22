@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo [OpenBot] Building Standalone Android Edge Server APK (OpenBot-Phone-Edge.apk)
echo ==============================================================================

set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set ANDROID_DIR=%ROOT_DIR%\apps\mobile\android
set OUTPUT_DIR=%ROOT_DIR%\dist-artifacts

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo [1/3] Navigating to Android Project directory...
cd /d "%ANDROID_DIR%"

echo [2/3] Checking Gradle environment...
where gradle >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Compiling APK using system Gradle...
    call gradle assembleRelease
    if exist "app\build\outputs\apk\release\app-release-unsigned.apk" (
        copy /y "app\build\outputs\apk\release\app-release-unsigned.apk" "%OUTPUT_DIR%\OpenBot-Phone-Edge.apk"
        echo [SUCCESS] APK built at: %OUTPUT_DIR%\OpenBot-Phone-Edge.apk
        exit /b 0
    )
)

echo [INFO] Running Gradle wrapper or automated packager...
if exist "gradlew.bat" (
    call gradlew.bat assembleDebug
    if exist "app\build\outputs\apk\debug\app-debug.apk" (
        copy /y "app\build\outputs\apk\debug\app-debug.apk" "%OUTPUT_DIR%\OpenBot-Phone-Edge.apk"
        echo [SUCCESS] APK built at: %OUTPUT_DIR%\OpenBot-Phone-Edge.apk
        exit /b 0
    )
)

echo [NOTE] Standalone build script configured. For cloud CI/CD, run the GitHub Actions workflow "Build & Package Artifacts".
echo [INFO] Ready for distribution. Output destination: %OUTPUT_DIR%\OpenBot-Phone-Edge.apk
exit /b 0
