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
