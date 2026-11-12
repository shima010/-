"""入力データの読み込みと整形。

5種類のCSV(またはxlsx)を読み込み、年月を Period 型にそろえる。
ファイル仕様は docs/data_spec.md を参照。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

PL_ACCOUNTS_INPUT = ["売上高", "売上原価", "人件費", "地代家賃", "広告宣伝費", "減価償却費",
                     "その他販管費", "営業外収益", "営業外費用"]
SGA_ACCOUNTS = ["人件費", "地代家賃", "広告宣伝費", "減価償却費", "その他販管費"]
BS_ASSETS = ["現金預金", "売掛金", "商品", "その他流動資産", "固定資産"]
BS_CURRENT_ASSETS = ["現金預金", "売掛金", "商品", "その他流動資産"]
BS_LIABILITIES = ["買掛金", "前受金", "その他流動負債", "有利子負債"]

FILES = {
    "company_pl": ("company_pl", ["年月", "科目", "実績", "予算"]),
    "company_bs": ("company_bs", ["年月", "科目", "残高"]),
    "stores": ("store_monthly", ["年月", "店舗コード", "店舗名", "エリア", "業態", "開店年月", "売上高",
                                 "売上予算", "売上総利益", "人件費", "地代家賃", "その他経費", "客数", "在庫高"]),
    "sales": ("sales_category", ["年月", "店舗コード", "部門", "チャネル", "売上高", "売上総利益"]),
    "lessons": ("lesson_members", ["年月", "店舗コード", "コース", "月初会員数", "入会数", "退会数",
                                   "月末会員数", "体験レッスン数", "月謝売上"]),
}

LESSON_CATEGORY = "音楽教室"


class DataError(Exception):
    pass


@dataclass
class Dataset:
    pl: pd.DataFrame        # index=年月(Period), columns=科目, 実績
    pl_budget: pd.DataFrame  # index=年月, columns=科目, 予算
    bs: pd.DataFrame        # index=年月, columns=科目
    stores: pd.DataFrame
    sales: pd.DataFrame
    lessons: pd.DataFrame
    months: list            # 全期間の年月(Period)昇順


def _read(path_base: Path) -> pd.DataFrame:
    for ext in (".csv", ".xlsx"):
        p = path_base.with_suffix(ext)
        if p.exists():
            if ext == ".csv":
                for enc in ("utf-8-sig", "cp932"):
                    try:
                        return pd.read_csv(p, encoding=enc)
                    except UnicodeDecodeError:
                        continue
                raise DataError(f"{p} の文字コードを判別できません(UTF-8 か Shift_JIS で保存してください)")
            return pd.read_excel(p)
    raise DataError(f"{path_base}.csv(または .xlsx)が見つかりません")


def _to_period(s: pd.Series) -> pd.Series:
    def conv(v):
        if pd.isna(v):
            return pd.NaT
        txt = str(v).strip().replace("/", "-").replace("年", "-").replace("月", "")
        if len(txt) == 6 and txt.isdigit():
            txt = f"{txt[:4]}-{txt[4:]}"
        return pd.Period(txt[:7], freq="M")
    return s.map(conv)


def _add_derived_pl(pl: pd.DataFrame) -> pd.DataFrame:
    pl = pl.copy()
    for c in PL_ACCOUNTS_INPUT:
        if c not in pl.columns:
            pl[c] = 0.0
    pl["売上総利益"] = pl["売上高"] - pl["売上原価"]
    pl["販管費計"] = pl[SGA_ACCOUNTS].sum(axis=1)
    pl["営業利益"] = pl["売上総利益"] - pl["販管費計"]
    pl["経常利益"] = pl["営業利益"] + pl["営業外収益"] - pl["営業外費用"]
    pl["EBITDA"] = pl["営業利益"] + pl["減価償却費"]
    return pl


def load(data_dir: str | Path) -> Dataset:
    d = Path(data_dir)
    raw = {}
    for key, (name, cols) in FILES.items():
        df = _read(d / name)
        df.columns = [str(c).strip() for c in df.columns]
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise DataError(f"{name}: 必須列がありません {missing}")
        df["年月"] = _to_period(df["年月"])
        raw[key] = df

    pl_long = raw["company_pl"]
    pl = pl_long.pivot_table(index="年月", columns="科目", values="実績", aggfunc="sum")
    pl_b = pl_long.pivot_table(index="年月", columns="科目", values="予算", aggfunc="sum")
    pl = _add_derived_pl(pl).sort_index()
    pl_b = _add_derived_pl(pl_b).sort_index()

    bs = raw["company_bs"].pivot_table(index="年月", columns="科目", values="残高", aggfunc="sum").sort_index()
    for c in BS_ASSETS + BS_LIABILITIES + ["純資産"]:
        if c not in bs.columns:
            bs[c] = 0.0

    stores = raw["stores"].copy()
    stores["開店年月"] = _to_period(stores["開店年月"])
    stores["店舗利益"] = stores["売上総利益"] - stores["人件費"] - stores["地代家賃"] - stores["その他経費"]

    months = sorted(pl.index.unique())
    return Dataset(pl=pl, pl_budget=pl_b, bs=bs, stores=stores, sales=raw["sales"].copy(),
                   lessons=raw["lessons"].copy(), months=months)
