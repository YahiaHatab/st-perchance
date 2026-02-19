@echo off
cd /d "%~dp0"
echo Starting Perchance Bridge Server...
if not exist node_modules (
    echo node_modules not found, installing dependencies...
    call npm install
)
call npm start
pause
