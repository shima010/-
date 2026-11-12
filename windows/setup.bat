@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

echo === PDF to Excel 変換ツール セットアップ ===
echo.

rem Python の起動コマンドを探す（py ランチャー優先）
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
    where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
    echo Python が見つかりません。
    echo https://www.python.org/downloads/ からインストールし、
    echo インストール時に "Add python.exe to PATH" にチェックを入れてください。
    pause
    exit /b 1
)

echo 1/2 仮想環境を作成しています...
%PY% -m venv .venv
if errorlevel 1 (
    echo 仮想環境の作成に失敗しました。
    pause
    exit /b 1
)

echo 2/2 必要なライブラリを導入しています...
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo ライブラリの導入に失敗しました。社内ネットワークのプロキシ設定を確認してください。
    pause
    exit /b 1
)

echo.
echo セットアップが完了しました。
echo 以後は windows\run_gui.bat をダブルクリックして起動してください。
pause
