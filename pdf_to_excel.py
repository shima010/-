"""PDFの表をExcel(.xlsx)に変換するツール。

- pdfplumber で表を抽出し、openpyxl で書式付きExcelを出力します。
- 「1,000」「△500」「(300)」などの表記を Excel の数値に変換するため、
  出力後すぐに SUM や ピボットテーブルで集計できます。
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

# openpyxlが許可しない制御文字を除去するパターン（タブ、改行、復帰は許可）
_ILLEGAL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")

# Excelのシート名に使えない文字
_INVALID_SHEET_CHARS_RE = re.compile(r"[\\/*?\[\]:]")

# 数値として解釈してよい形（カンマ除去後）
_NUMERIC_RE = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)")

# 通貨記号・単位として読み飛ばす文字
_CURRENCY_PREFIX = "¥$€£"
_CURRENCY_SUFFIX = ("円", "千円", "百万円")

# 数値なしを意味する記号（ハイフン、ダッシュ類）
_DASH_ONLY = {"-", "‐", "‑", "–", "—", "―", "ー", "−", "﹣", "－"}

MAX_COLUMN_WIDTH = 60
MIN_COLUMN_WIDTH = 8


class ConversionError(Exception):
    """利用者に提示できる、原因の分かる変換エラー。"""


# --------------------------------------------------------------------------
# セル値の正規化
# --------------------------------------------------------------------------

def _sanitize(value) -> str | None:
    """セル値からopenpyxlが拒否する制御文字を除去する。空なら None を返す。"""
    if value is None:
        return None
    text = _ILLEGAL_CHARS_RE.sub("", str(value))
    # 各行の前後の空白だけ落とし、セル内改行は残す
    text = "\n".join(line.strip() for line in text.splitlines())
    return text or None


def parse_number(text) -> tuple[float | int, bool] | None:
    """会計表記の文字列を数値に変換する。

    対応する表記:
        "1,234"        -> 1234
        "△1,234"       -> -1234        （▲ も同様）
        "(1,234)"      -> -1234
        "1,234円"      -> 1234
        "12.5%"        -> 0.125（パーセント書式で表示）
        "１２３"（全角） -> 123

    Returns:
        (数値, パーセントかどうか)。数値と解釈できない場合は None。
        伝票番号などを壊さないため、次は数値化しません。
        - "001" のような先頭ゼロ付き
        - 区切りのない16桁以上の数字列
    """
    if text is None:
        return None
    if isinstance(text, (int, float)) and not isinstance(text, bool):
        return (text, False)

    s = unicodedata.normalize("NFKC", str(text)).strip()
    if not s or s in _DASH_ONLY:
        return None

    negative = False

    # (1,234) 形式の負数
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1].strip()

    # 会計でよく使う △ / ▲ の負数表記
    while s and s[0] in "△▲":
        negative = True
        s = s[1:].strip()

    percent = s.endswith("%")
    if percent:
        s = s[:-1].strip()

    while s and s[0] in _CURRENCY_PREFIX:
        s = s[1:].strip()
    for suffix in _CURRENCY_SUFFIX:
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
            break

    s = s.replace("−", "-").replace("＋", "+")
    had_comma = "," in s
    s = s.replace(",", "").strip()
    if not s:
        return None

    if not _NUMERIC_RE.fullmatch(s):
        return None

    digits = s.lstrip("+-")

    # 伝票番号・コードを壊さないためのガード
    if "." not in digits:
        if len(digits) > 1 and digits.startswith("0"):
            return None
        if not had_comma and len(digits) >= 16:
            return None

    try:
        value: float | int = int(digits) if "." not in digits else float(digits)
    except ValueError:  # pragma: no cover - 正規表現通過後は通常起きない
        return None

    if s.startswith("-"):
        negative = not negative
    if negative:
        value = -value
    if percent:
        value = value / 100
    return (value, percent)


def _number_format(value, percent: bool, original: str) -> str:
    """数値セルに設定する表示書式を決める。"""
    if percent:
        decimals = len(original.split(".")[1].rstrip("%").strip()) if "." in original else 0
        return "0." + "0" * min(decimals, 4) + "%" if decimals else "0%"
    if isinstance(value, int):
        return "#,##0"
    decimals = 0
    normalized = unicodedata.normalize("NFKC", original)
    if "." in normalized:
        decimals = len(re.sub(r"[^\d]", "", normalized.split(".")[-1]))
    decimals = min(max(decimals, 1), 4)
    return "#,##0." + "0" * decimals


# --------------------------------------------------------------------------
# PDFからの抽出
# --------------------------------------------------------------------------

def _split_text_line(line: str) -> list[str]:
    """表として認識されなかった行を、2文字以上の空白／タブで列に分割する。"""
    parts = [p.strip() for p in re.split(r"\t|　{2,}| {2,}", line.strip())]
    return [p for p in parts if p] or [line.strip()]


def extract_tables_from_pdf(pdf_path: str, text_mode: str = "split") -> list[dict]:
    """PDFから全ページの表を抽出する。

    Args:
        pdf_path: 入力PDFファイルパス。
        text_mode: 表が無いページの扱い。"split" は空白区切りで列に分割、
            "line" は1行1セル、"skip" はそのページを出力しない。

    Returns:
        [{"page": int, "tables": [{"rows": [[str, ...], ...], "kind": "table"|"text"}]}]
    """
    results: list[dict] = []
    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:  # pdfminer系の例外はまとめて分かる文言にする
        message = str(e)
        if "password" in message.lower() or "encrypt" in message.lower():
            raise ConversionError(
                f"パスワード保護されたPDFは変換できません: {pdf_path}"
            ) from e
        raise ConversionError(f"PDFを開けませんでした（破損の可能性）: {pdf_path} / {e}") from e

    try:
        with pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    tables = page.extract_tables()
                except Exception:
                    tables = []
                entries = [
                    {"rows": table, "kind": "table"}
                    for table in tables
                    if table and any(any(cell not in (None, "") for cell in row) for row in table)
                ]

                if not entries and text_mode != "skip":
                    text = page.extract_text() or ""
                    lines = [line for line in text.split("\n") if line.strip()]
                    if lines:
                        if text_mode == "split":
                            rows = [_split_text_line(line) for line in lines]
                        else:
                            rows = [[line] for line in lines]
                        entries = [{"rows": rows, "kind": "text"}]

                if entries:
                    results.append({"page": page_num, "tables": entries})
    except ConversionError:
        raise
    except Exception as e:
        raise ConversionError(f"PDFの読み取り中にエラーが発生しました: {pdf_path} / {e}") from e

    return results


# --------------------------------------------------------------------------
# Excelへの書き込み
# --------------------------------------------------------------------------

def _display_width(text: str) -> int:
    """全角文字を2としてセル幅を見積もる。"""
    width = 0
    for line in str(text).splitlines() or [""]:
        line_width = sum(2 if unicodedata.east_asian_width(ch) in "WFA" else 1 for ch in line)
        width = max(width, line_width)
    return width


def _safe_sheet_name(name: str, used: set[str]) -> str:
    """Excelで有効な、重複しないシート名を作る。"""
    cleaned = _INVALID_SHEET_CHARS_RE.sub("_", name).strip("'")[:31] or "Sheet"
    candidate = cleaned
    index = 2
    while candidate.lower() in used:
        suffix = f"_{index}"
        candidate = cleaned[: 31 - len(suffix)] + suffix
        index += 1
    used.add(candidate.lower())
    return candidate


class _Styles:
    def __init__(self):
        self.header_font = Font(bold=True, color="FFFFFF")
        self.header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        self.header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        self.body_alignment = Alignment(vertical="center", wrap_text=True)
        self.number_alignment = Alignment(horizontal="right", vertical="center")
        self.border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin"),
        )
        self.page_font = Font(bold=True, size=12)


def _write_table(ws, entry, styles: _Styles, start_row: int = 1,
                 convert_numbers: bool = True) -> int:
    """ワークシートに1つの表を書き込み、次の行番号を返す。"""
    rows = entry["rows"] if isinstance(entry, dict) else entry
    kind = entry.get("kind", "table") if isinstance(entry, dict) else "table"
    is_table = kind == "table"

    written = 0
    for row in rows:
        values = [_sanitize(cell) for cell in row]
        if not any(values):
            continue  # 空行はスキップ
        row_index = start_row + written
        for col_idx, text in enumerate(values, start=1):
            cell = ws.cell(row=row_index, column=col_idx)
            parsed = parse_number(text) if (convert_numbers and text) else None
            if parsed is not None:
                cell.value = parsed[0]
                cell.number_format = _number_format(parsed[0], parsed[1], text)
                cell.alignment = styles.number_alignment
            else:
                cell.value = text
                cell.alignment = styles.body_alignment
            if is_table:
                cell.border = styles.border
            # 表の1行目のみヘッダーとして装飾する
            if is_table and written == 0:
                cell.font = styles.header_font
                cell.fill = styles.header_fill
                cell.alignment = styles.header_alignment
        written += 1

    return start_row + written


def _autofit_columns(wb):
    for ws in wb.worksheets:
        for col in ws.columns:
            max_width = 0
            for cell in col:
                if cell.value is not None:
                    max_width = max(max_width, _display_width(cell.value))
            width = min(max_width + 3, MAX_COLUMN_WIDTH)
            ws.column_dimensions[col[0].column_letter].width = max(width, MIN_COLUMN_WIDTH)


def write_to_excel(data: list[dict], output_path: str, separate_sheets: bool = False,
                   convert_numbers: bool = True):
    """抽出したデータをExcelファイルに書き込む。

    Args:
        data: extract_tables_from_pdf の戻り値。
        output_path: 出力先Excelファイルパス。
        separate_sheets: True ならページごとに別シートに書き込む。
        convert_numbers: True なら会計表記を数値に変換する。
    """
    wb = Workbook()
    wb.remove(wb.active)
    styles = _Styles()

    if not data:
        ws = wb.create_sheet("Sheet1")
        ws["A1"] = "テーブルが見つかりませんでした"
        ws.column_dimensions["A"].width = 40
        _save_workbook(wb, output_path)
        return

    if separate_sheets:
        used: set[str] = set()
        for page_data in data:
            page_num = page_data["page"]
            for table_idx, entry in enumerate(page_data["tables"]):
                base = f"Page{page_num}" if table_idx == 0 else f"Page{page_num}_Table{table_idx + 1}"
                ws = wb.create_sheet(_safe_sheet_name(base, used))
                end_row = _write_table(ws, entry, styles, convert_numbers=convert_numbers)
                kind = entry.get("kind", "table") if isinstance(entry, dict) else "table"
                if kind == "table" and end_row > 2:
                    ws.freeze_panes = "A2"
    else:
        ws = wb.create_sheet("Sheet1")
        current_row = 1
        for page_data in data:
            page_num = page_data["page"]
            for entry in page_data["tables"]:
                if current_row > 1:
                    current_row += 1
                cell = ws.cell(row=current_row, column=1, value=f"--- Page {page_num} ---")
                cell.font = styles.page_font
                current_row += 1
                current_row = _write_table(
                    ws, entry, styles, start_row=current_row, convert_numbers=convert_numbers
                )

    _autofit_columns(wb)
    _save_workbook(wb, output_path)


def _save_workbook(wb, output_path: str):
    try:
        wb.save(output_path)
    except PermissionError as e:
        raise ConversionError(
            f"出力ファイルに書き込めませんでした: {output_path}\n"
            "  同じ名前のファイルをExcelで開いたままにしていないか確認してください。"
        ) from e
    except OSError as e:
        raise ConversionError(f"出力ファイルを保存できませんでした: {output_path} / {e}") from e


# --------------------------------------------------------------------------
# 変換の入口
# --------------------------------------------------------------------------

def convert(input_path: str, output_path: str | None = None, separate_sheets: bool = False,
            convert_numbers: bool = True, text_mode: str = "split",
            log=print) -> str:
    """PDFファイル1件をExcelに変換し、出力パスを返す。

    Args:
        input_path: 入力PDFファイルパス。
        output_path: 出力Excelファイルパス（省略時は入力と同名の.xlsx）。
        separate_sheets: ページごとに別シートにするか。
        convert_numbers: 会計表記を数値に変換するか。
        text_mode: 表が無いページの扱い（"split" / "line" / "skip"）。
        log: 進捗の出力先関数。None を渡すと何も出力しない。
    """
    emit = log or (lambda *_args, **_kwargs: None)

    input_file = Path(input_path)
    if not input_file.exists():
        raise ConversionError(f"ファイルが見つかりません: {input_path}")
    if input_file.suffix.lower() != ".pdf":
        raise ConversionError(f"PDFファイルを指定してください: {input_path}")

    if output_path is None:
        output_path = str(input_file.with_suffix(".xlsx"))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    emit(f"変換中: {input_file.name} -> {output_path}")
    data = extract_tables_from_pdf(str(input_file), text_mode=text_mode)
    write_to_excel(data, output_path, separate_sheets, convert_numbers=convert_numbers)

    total_tables = sum(len(p["tables"]) for p in data)
    if total_tables == 0:
        emit("  注意: 表もテキストも検出できませんでした。画像として保存されたPDF"
             "（スキャン原稿）の可能性があります。")
    else:
        emit(f"  完了: {len(data)}ページから{total_tables}個の表を抽出しました")
    return output_path


def collect_pdfs(inputs: list[str], recursive: bool = False) -> list[Path]:
    """ファイル・フォルダ・ワイルドカードの指定をPDFファイルの一覧に展開する。"""
    found: list[Path] = []
    for item in inputs:
        path = Path(item)
        if path.is_dir():
            pattern = "**/*.pdf" if recursive else "*.pdf"
            found.extend(sorted(p for p in path.glob(pattern) if p.is_file()))
        elif any(ch in item for ch in "*?["):
            base = path.parent if str(path.parent) else Path(".")
            found.extend(sorted(p for p in base.glob(path.name) if p.is_file()))
        else:
            found.append(path)

    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        key = str(path.resolve()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def convert_many(inputs: list[str], output_dir: str | None = None,
                 output_path: str | None = None, separate_sheets: bool = False,
                 convert_numbers: bool = True, text_mode: str = "split",
                 recursive: bool = False, log=print) -> tuple[list[str], list[str]]:
    """複数のPDFをまとめて変換する。

    Returns:
        (成功した出力パスの一覧, エラーメッセージの一覧)
    """
    emit = log or (lambda *_args, **_kwargs: None)
    targets = collect_pdfs(inputs, recursive=recursive)
    if not targets:
        return [], ["変換対象のPDFが見つかりませんでした。"]
    if output_path and len(targets) > 1:
        return [], ["-o は入力が1ファイルのときだけ指定できます。複数の場合は -d を使ってください。"]

    succeeded: list[str] = []
    errors: list[str] = []
    for target in targets:
        if output_path:
            destination = output_path
        elif output_dir:
            destination = str(Path(output_dir) / (target.stem + ".xlsx"))
        else:
            destination = None
        try:
            succeeded.append(
                convert(str(target), destination, separate_sheets,
                        convert_numbers=convert_numbers, text_mode=text_mode, log=emit)
            )
        except ConversionError as e:
            errors.append(str(e))
            emit(f"エラー: {e}")
        except Exception as e:  # 想定外でも残りのファイルは処理を続ける
            errors.append(f"{target}: {e}")
            emit(f"エラー: {target}: {e}")
    return succeeded, errors


def main():
    parser = argparse.ArgumentParser(
        description="PDFの表をExcel(.xlsx)に変換します",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""使用例:
  python pdf_to_excel.py 請求書.pdf
  python pdf_to_excel.py 請求書.pdf -o 集計.xlsx
  python pdf_to_excel.py 決算資料.pdf -s          # ページごとに別シート
  python pdf_to_excel.py PDFフォルダ -d 出力先     # フォルダ内を一括変換
  python pdf_to_excel.py *.pdf -d out --no-numbers
""",
    )
    parser.add_argument("input", nargs="+", help="入力PDF（ファイル／フォルダ／ワイルドカード）")
    parser.add_argument("-o", "--output", help="出力Excelファイルのパス（入力が1件のときのみ）")
    parser.add_argument("-d", "--outdir", help="出力先フォルダ（複数ファイル変換時に使用）")
    parser.add_argument("-s", "--separate-sheets", action="store_true",
                        help="ページごとに別シートに出力する")
    parser.add_argument("-r", "--recursive", action="store_true",
                        help="フォルダ指定時にサブフォルダも対象にする")
    parser.add_argument("--no-numbers", action="store_true",
                        help="数値への自動変換を行わず、すべて文字列のまま出力する")
    parser.add_argument("--text-mode", choices=["split", "line", "skip"], default="split",
                        help="表が無いページの扱い（既定: split）")
    parser.add_argument("-q", "--quiet", action="store_true", help="進捗を表示しない")
    args = parser.parse_args()

    log = None if args.quiet else print
    succeeded, errors = convert_many(
        args.input,
        output_dir=args.outdir,
        output_path=args.output,
        separate_sheets=args.separate_sheets,
        convert_numbers=not args.no_numbers,
        text_mode=args.text_mode,
        recursive=args.recursive,
        log=log,
    )

    if not args.quiet:
        print(f"\n成功: {len(succeeded)}件 / 失敗: {len(errors)}件")
        for path in succeeded:
            print(f"  出力: {path}")
    for message in errors:
        print(f"エラー: {message}", file=sys.stderr)

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
