@echo off
setlocal
cd /d "%~dp0.."

py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if not errorlevel 1 goto run_py

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if not errorlevel 1 goto run_python

echo Python 3.9 or newer is required.
pause
exit /b 1

:run_py
py -3 all\vesper_launcher.py stop
exit /b %errorlevel%

:run_python
python all\vesper_launcher.py stop
exit /b %errorlevel%
