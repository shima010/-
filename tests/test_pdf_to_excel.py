"""pdf_to_excel の単体テスト（標準ライブラリの unittest のみで実行できます）。

実行: python -m unittest discover -s tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook

import pdf_to_excel as p2e


class ParseNumberTest(unittest.TestCase):
    def test_plain_and_comma(self):
        self.assertEqual(p2e.parse_number("1234"), (1234, False))
        self.assertEqual(p2e.parse_number("1,234"), (1234, False))
        self.assertEqual(p2e.parse_number("1,234.50"), (1234.5, False))

    def test_accounting_negatives(self):
        self.assertEqual(p2e.parse_number("△1,234"), (-1234, False))
        self.assertEqual(p2e.parse_number("▲1,234"), (-1234, False))
        self.assertEqual(p2e.parse_number("(1,234)"), (-1234, False))
        self.assertEqual(p2e.parse_number("-1,234"), (-1234, False))

    def test_units_and_percent(self):
        self.assertEqual(p2e.parse_number("¥1,234"), (1234, False))
        self.assertEqual(p2e.parse_number("1,234円"), (1234, False))
        value, percent = p2e.parse_number("12.5%")
        self.assertAlmostEqual(value, 0.125)
        self.assertTrue(percent)

    def test_fullwidth(self):
        self.assertEqual(p2e.parse_number("１２３"), (123, False))
        self.assertEqual(p2e.parse_number("１，２３４"), (1234, False))

    def test_not_numbers(self):
        for text in ["売上高", "", None, "-", "―", "2024/01/01", "03-1234-5678", "A1"]:
            self.assertIsNone(p2e.parse_number(text), text)

    def test_codes_are_kept_as_text(self):
        # 勘定科目コードや伝票番号を数値化して桁落ちさせない
        self.assertIsNone(p2e.parse_number("001"))
        self.assertIsNone(p2e.parse_number("4912345678901234"))

    def test_number_format(self):
        self.assertEqual(p2e._number_format(1234, False, "1,234"), "#,##0")
        self.assertEqual(p2e._number_format(1234.5, False, "1,234.5"), "#,##0.0")
        self.assertEqual(p2e._number_format(0.125, True, "12.5%"), "0.0%")


class SanitizeTest(unittest.TestCase):
    def test_removes_control_characters(self):
        self.assertEqual(p2e._sanitize("A\x00B"), "AB")

    def test_empty_becomes_none(self):
        self.assertIsNone(p2e._sanitize(""))
        self.assertIsNone(p2e._sanitize("   "))
        self.assertIsNone(p2e._sanitize(None))

    def test_keeps_newline(self):
        self.assertEqual(p2e._sanitize(" 売上 \n 原価 "), "売上\n原価")


class SheetNameTest(unittest.TestCase):
    def test_invalid_characters_and_duplicates(self):
        used = set()
        self.assertEqual(p2e._safe_sheet_name("Page1", used), "Page1")
        self.assertEqual(p2e._safe_sheet_name("Page1", used), "Page1_2")
        self.assertEqual(p2e._safe_sheet_name("A/B:C", used), "A_B_C")

    def test_length_limit(self):
        name = p2e._safe_sheet_name("X" * 50, set())
        self.assertLessEqual(len(name), 31)


class SplitTextLineTest(unittest.TestCase):
    def test_splits_on_wide_gaps(self):
        self.assertEqual(p2e._split_text_line("売上高    1,000   1,200"), ["売上高", "1,000", "1,200"])

    def test_single_space_is_not_a_separator(self):
        self.assertEqual(p2e._split_text_line("当期 純利益"), ["当期 純利益"])


class WriteExcelTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = str(Path(self.tmp.name) / "out.xlsx")
        self.data = [{
            "page": 1,
            "tables": [{
                "kind": "table",
                "rows": [
                    ["科目", "前期", "当期"],
                    ["売上高", "1,000", "1,200"],
                    ["営業利益", "△50", "(30)"],
                    [None, None, None],
                    ["利益率", "12.5%", "001"],
                ],
            }],
        }]

    def tearDown(self):
        self.tmp.cleanup()

    def test_numbers_are_written_as_numbers(self):
        p2e.write_to_excel(self.data, self.out)
        ws = load_workbook(self.out)["Sheet1"]
        rows = list(ws.iter_rows(values_only=True))
        # 1行目はページ見出し、2行目がヘッダー
        self.assertEqual(rows[0][0], "--- Page 1 ---")
        self.assertEqual(rows[1], ("科目", "前期", "当期"))
        self.assertEqual(rows[2][1], 1000)
        self.assertEqual(rows[3][1], -50)
        self.assertEqual(rows[3][2], -30)
        # 空行は詰められる
        self.assertEqual(rows[4][0], "利益率")
        self.assertAlmostEqual(rows[4][1], 0.125)
        self.assertEqual(rows[4][2], "001")

    def test_no_numbers_option(self):
        p2e.write_to_excel(self.data, self.out, convert_numbers=False)
        ws = load_workbook(self.out)["Sheet1"]
        self.assertEqual(ws.cell(row=3, column=2).value, "1,000")

    def test_separate_sheets(self):
        data = self.data + [{"page": 2, "tables": [{"kind": "table", "rows": [["A"], ["1"]]}]}]
        p2e.write_to_excel(data, self.out, separate_sheets=True)
        wb = load_workbook(self.out)
        self.assertEqual(wb.sheetnames, ["Page1", "Page2"])

    def test_empty_data(self):
        p2e.write_to_excel([], self.out)
        ws = load_workbook(self.out)["Sheet1"]
        self.assertEqual(ws["A1"].value, "テーブルが見つかりませんでした")


class ConvertGuardTest(unittest.TestCase):
    def test_missing_file(self):
        with self.assertRaises(p2e.ConversionError):
            p2e.convert("存在しない.pdf", log=None)

    def test_non_pdf(self):
        with tempfile.NamedTemporaryFile(suffix=".txt") as f:
            with self.assertRaises(p2e.ConversionError):
                p2e.convert(f.name, log=None)

    def test_convert_many_reports_errors_and_continues(self):
        ok, errors = p2e.convert_many(["A.pdf", "B.pdf"], log=None)
        self.assertEqual(ok, [])
        self.assertEqual(len(errors), 2)


class CollectPdfsTest(unittest.TestCase):
    def test_directory_expansion(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "a.pdf").write_bytes(b"")
            (root / "b.txt").write_text("x")
            sub = root / "sub"
            sub.mkdir()
            (sub / "c.pdf").write_bytes(b"")

            self.assertEqual([p.name for p in p2e.collect_pdfs([str(root)])], ["a.pdf"])
            self.assertEqual(
                sorted(p.name for p in p2e.collect_pdfs([str(root)], recursive=True)),
                ["a.pdf", "c.pdf"],
            )


if __name__ == "__main__":
    unittest.main()
