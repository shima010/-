#!/usr/bin/env bash
# macOS / Linux 用セットアップ
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip >/dev/null
./.venv/bin/python -m pip install -r requirements.txt

echo
echo "セットアップが完了しました。"
echo "  画面版:     ./.venv/bin/python gui.py"
echo "  コマンド版: ./.venv/bin/python pdf_to_excel.py 変換したい.pdf"
