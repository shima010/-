@echo off
chcp 65001 >nul
cd /d "%~dp0.."

if "%~1"=="" (
    echo このファイルに PDF をドラッグ＆ドロップすると、同じ場所に Excel を作成します。
    pause
    exit /b 0
)

if not exist ".venv\Scripts\python.exe" (
    echo セットアップが済んでいません。先に windows\setup.bat を実行してください。
    pause
    exit /b 1
)

".venv\Scripts\python.exe" pdf_to_excel.py %*
echo.
pause
