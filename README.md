# PDF to Excel Converter

PDFの表をExcel(.xlsx)に変換するツールです。決算資料・請求書・残高一覧などのPDFを、
そのまま集計できるExcelに落とし込むことを目的にしています。

- 「1,234」「△500」「(300)」「12.5%」といった会計表記を **Excelの数値** に変換します（SUMやピボットがそのまま使えます）
- 「001」などの先頭ゼロ付きコード、16桁以上の番号は文字列のまま残します（桁落ち防止）
- 複数ファイル・フォルダ単位の一括変換に対応
- コマンド操作が不要な **画面版（GUI）** を同梱

## 導入（Windows）

1. Python 3.10以降を導入します（未導入の場合は https://www.python.org/downloads/ から。
   インストール時に「Add python.exe to PATH」にチェック）。
2. このフォルダの `windows\setup.bat` をダブルクリックします。

以降は次の2つの使い方ができます。

| 操作 | 方法 |
| --- | --- |
| 画面から変換する | `windows\run_gui.bat` をダブルクリック |
| PDFをまとめて変換する | `windows\convert_drop.bat` にPDFをドラッグ＆ドロップ |

## 導入（macOS / Linux）

```bash
./setup.sh
./.venv/bin/python gui.py                 # 画面版
./.venv/bin/python pdf_to_excel.py a.pdf  # コマンド版
```

手動で導入する場合は `pip install -r requirements.txt` でも動作します。

## コマンドでの使い方

```bash
# 基本（出力は input.xlsx として同じフォルダに作成）
python pdf_to_excel.py 請求書.pdf

# 出力ファイル名を指定
python pdf_to_excel.py 請求書.pdf -o 集計.xlsx

# ページごとに別シートへ
python pdf_to_excel.py 決算資料.pdf -s

# フォルダ内のPDFを一括変換して、出力先フォルダにまとめる
python pdf_to_excel.py PDFフォルダ -d 出力先

# サブフォルダも対象にする
python pdf_to_excel.py PDFフォルダ -r -d 出力先

# 数値変換をせず、すべて文字列のまま出力する
python pdf_to_excel.py 明細.pdf --no-numbers
```

### オプション一覧

| オプション | 内容 |
| --- | --- |
| `-o`, `--output` | 出力Excelのパス（入力が1件のときのみ） |
| `-d`, `--outdir` | 出力先フォルダ（一括変換時） |
| `-s`, `--separate-sheets` | ページごとに別シートへ出力 |
| `-r`, `--recursive` | フォルダ指定時にサブフォルダも対象 |
| `--no-numbers` | 数値への自動変換を行わない |
| `--text-mode` | 表が無いページの扱い。`split`（既定・空白区切りで列に分割） / `line`（1行1セル） / `skip`（出力しない） |
| `-q`, `--quiet` | 進捗を表示しない |

終了コードは、1件でも失敗があれば 1、すべて成功なら 0 です（バッチ処理での判定に使えます）。

## 数値変換の規則

| PDF上の表記 | Excelの値 | 表示書式 |
| --- | --- | --- |
| `1,234` | 1234 | `#,##0` |
| `△1,234` / `▲1,234` / `(1,234)` / `-1,234` | -1234 | `#,##0` |
| `¥1,234` / `1,234円` | 1234 | `#,##0` |
| `1,234.50` | 1234.5 | `#,##0.00` |
| `12.5%` | 0.125 | `0.0%` |
| `１２３`（全角） | 123 | `#,##0` |
| `001`（先頭ゼロ） | `001` | 文字列のまま |
| `4912345678901234`（16桁以上） | そのまま | 文字列のまま |
| `-` / `―` / 空欄 | 空セル | ― |

意図せず数値化されると困る場合は `--no-numbers`（画面版はチェックボックス）で無効にできます。

## Pythonモジュールとして使用

```python
from pdf_to_excel import convert, convert_many, ConversionError

try:
    convert("input.pdf", "output.xlsx", separate_sheets=True)
except ConversionError as e:
    print(e)

# 複数ファイル・フォルダをまとめて
succeeded, errors = convert_many(["PDFフォルダ"], output_dir="出力先")
```

## テスト

```bash
python -m unittest discover -s tests
```

## 制約事項

- **スキャンした画像PDFは変換できません。** 文字情報を持たないため、OCR（別途製品）が必要です。
  この場合は「表もテキストも検出できませんでした」と表示されます。
- パスワード保護されたPDFは変換できません。保護を解除してから実行してください。
- 罫線のない資料は、表ではなくテキストとして空白区切りで列に分割します。列がずれる場合は
  `--text-mode line` を指定し、Excel側で区切り直してください。
- セル結合を含む表は、結合元のセルに値が入り、他は空欄になります。
