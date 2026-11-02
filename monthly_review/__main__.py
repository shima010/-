"""月次経営分析ツールのコマンドライン入口。

使い方:
    python -m monthly_review --data data/2026-10 --month 2026-10
    python -m monthly_review --sample          # ダミーデータで動作確認
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .analysis import Analyzer
from .loader import DataError, load
from .report import write_all

ROOT = Path(__file__).resolve().parent.parent


def main(argv=None):
    ap = argparse.ArgumentParser(prog="monthly_review", description="月次財務諸表の多角的分析と、経営者向け注意点レポートの作成")
    ap.add_argument("--data", help="入力CSVのフォルダ(docs/data_spec.md 参照)")
    ap.add_argument("--month", help="対象月 YYYY-MM(省略時はデータの最終月)")
    ap.add_argument("--config", default=str(ROOT / "config" / "thresholds.json"), help="しきい値設定ファイル")
    ap.add_argument("--out", default="output", help="出力先フォルダ")
    ap.add_argument("--company", default="島村楽器", help="レポートに表示する会社名")
    ap.add_argument("--sample", action="store_true", help="ダミーデータを生成して実行")
    args = ap.parse_args(argv)

    if args.sample:
        from .sample_data import generate
        args.data = str(generate(ROOT / "data" / "sample"))
        args.company = f"{args.company}(サンプルデータ)"
    if not args.data:
        ap.error("--data か --sample を指定してください")

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    try:
        ds = load(args.data)
        result = Analyzer(ds, cfg, args.month).run()
    except (DataError, ValueError) as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1
    paths = write_all(result, args.out, args.company)

    print("\n".join(result.summary))
    print()
    cnt = {s: sum(1 for f in result.findings if f.severity == s) for s in ("高", "中", "低", "情報")}
    print("注意点: " + " / ".join(f"{k} {v}件" for k, v in cnt.items()))
    for f in result.findings:
        if f.severity == "高":
            print(f"  [高] {f.area}: {f.title}")
    print()
    for k, p in paths.items():
        print(f"{k:5s}: {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
