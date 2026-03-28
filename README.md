# PDF to Excel Converter

PDFファイル内のテーブルデータをExcel(.xlsx)に変換するツールです。

## セットアップ

```bash
pip install -r requirements.txt
```

## 使い方

```bash
# 基本的な変換（出力ファイル名は自動で input.xlsx になります）
python pdf_to_excel.py input.pdf

# 出力ファイル名を指定
python pdf_to_excel.py input.pdf -o output.xlsx

# ページごとに別シートに出力
python pdf_to_excel.py input.pdf -s
```

## Pythonモジュールとして使用

```python
from pdf_to_excel import convert

convert("input.pdf", "output.xlsx", separate_sheets=True)
```
