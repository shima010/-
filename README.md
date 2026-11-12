# 管理部門ツール集

| ツール | 内容 |
|---|---|
| [月次経営分析ツール](#月次経営分析ツール-monthly_review) | 月次財務諸表を全社・店舗・販売・教室の観点で分析し、経営者向けの注意点レポートを作る |
| [PDF to Excel Converter](#pdf-to-excel-converter) | PDF内の表をExcelに変換する |

---

# 月次経営分析ツール (monthly_review)

月次の財務諸表と販売・教室データを読み込み、7つの観点で自動分析して、経営者に伝えるべき注意点を重要度順に出力します。

| 観点 | 主な分析内容 |
|---|---|
| 全社PL | 予算比・前年比・期首累計、粗利率/販管費率/人件費率の変化、営業利益の前年差 要因分解 |
| 全社BS | 在庫回転日数、売掛金回転日数、手元資金(月商倍率)、自己資本比率、有利子負債、前受金 |
| 店舗 | 予算達成、既存店前年比(客数×客単価に分解)、連続赤字・連続前年割れ、人件費率・在庫の外れ値、エリア別 |
| 販売動向 | 部門別の前年比と寄与度、3か月基調、粗利率の差異分解(ミックス効果/レート効果)、チャネル(店舗/EC) |
| 音楽教室 | 会員数・純増、入会/退会率(12か月平均で季節性を除く)、体験→入会率、コース別・店舗別 |
| 複合 | 物販と教室会員の同時減少店舗、相関、人件費と売上の伸びの乖離 |
| データ品質 | 全社PLと店舗合計、店舗と部門別、教室と部門別、会員数の連続性、BSの貸借一致 |

## 使い方

```bash
pip install -r requirements.txt

# ダミーデータで動作確認(実在の数値ではありません)
python -m monthly_review --sample

# 実データで実行
python -m monthly_review --data data/2026-10 --month 2026-10
```

出力(`output/YYYYMM/`):

| ファイル | 用途 |
|---|---|
| `report.html` | 経営者向けレポート(結論・KPI・注意点・グラフ・明細表)。ブラウザで開く |
| `report.md` | Obsidian 用の要約メモ |
| `detail.xlsx` | 注意点一覧と全明細表 |
| `findings.json` | Claude Code が結論メモを書くときに読む機械判定の結果 |

サンプル出力: [docs/sample_report.html](docs/sample_report.html)(ダミーデータ。ダウンロードしてブラウザで開いてください)

入力データの形式は [docs/data_spec.md](docs/data_spec.md)、判定のしきい値は `config/thresholds.json`(決算期の開始月もここで設定)で変更できます。

## Claude Code スキル

`.claude/skills/monthly-financial-review/` に、このツールの出力を起点に Claude が追加検証を行い、
経営者向けの結論メモ(`executive_memo.md`)を書くためのスキルを同梱しています。
Claude Code でこのリポジトリを開き、「2026年10月の月次分析をして」のように依頼すると使われます。

## 注意事項

- 判定は数値ルールによる機械判定です。「要因(推測)」は検証前の仮説です。
- 減損・評価損・税務に関わる判断は、会計監査人・税理士に最終確認してください。
- `data/` と `output/` は `.gitignore` 済みです。実際の財務データをコミットしないでください。

---

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
