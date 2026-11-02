"""動作確認用のダミーデータを生成する。

実在の島村楽器の数値ではありません。店舗名・金額はすべて架空です。
分析ロジックが反応するよう、いくつかの「異常」を意図的に埋め込んでいます。
  - S07: 売上が減少し、直近数か月は店舗赤字が続く
  - S15: 売上に対して在庫が積み上がる
  - S03, S22: 教室の退会率が上昇
  - 部門: ギター・ベースが前年割れ、DTM・音響は増収だが粗利率が低下
  - 全社: 人件費(賃上げ)の伸びが売上の伸びを上回る
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

AREAS = ["北海道・東北", "関東", "中部", "関西", "中国・四国・九州"]

# 部門: (売上構成比, 粗利率, 年率成長, 客単価)
CATEGORIES = {
    "ピアノ・電子ピアノ": (0.22, 0.27, 0.03),
    "ギター・ベース": (0.20, 0.30, 0.00),
    "管楽器": (0.10, 0.27, 0.02),
    "ドラム・打楽器": (0.06, 0.29, -0.01),
    "DTM・音響機器": (0.12, 0.23, 0.06),
    "弦楽器": (0.04, 0.30, 0.00),
    "アクセサリ・楽譜": (0.18, 0.42, 0.01),
    "修理・サービス": (0.08, 0.60, 0.05),
}
LESSON_CATEGORY = "音楽教室"

# コース: (会員構成比, 月謝単価)
COURSES = {
    "ピアノ": (0.24, 11000),
    "ギター・ベース": (0.18, 10500),
    "ボーカル": (0.17, 10500),
    "ドラム": (0.10, 10500),
    "管楽器": (0.10, 11000),
    "キッズ・リトミック": (0.13, 8000),
    "DTM・その他": (0.08, 11500),
}

# 月別季節指数(物販)
SALES_SEASON = {1: 0.92, 2: 0.85, 3: 1.12, 4: 1.08, 5: 0.93, 6: 0.90,
                7: 0.98, 8: 1.02, 9: 0.92, 10: 0.95, 11: 1.03, 12: 1.30}
# 入会率・退会率の季節性
NEW_RATE = {1: 0.030, 2: 0.028, 3: 0.035, 4: 0.065, 5: 0.045, 6: 0.032,
            7: 0.035, 8: 0.030, 9: 0.033, 10: 0.034, 11: 0.030, 12: 0.025}
CHURN_RATE = {1: 0.026, 2: 0.027, 3: 0.055, 4: 0.030, 5: 0.026, 6: 0.025,
              7: 0.027, 8: 0.030, 9: 0.028, 10: 0.026, 11: 0.025, 12: 0.030}


def _months(end: str, n: int) -> list[pd.Period]:
    end_p = pd.Period(end, freq="M")
    return [end_p - i for i in range(n - 1, -1, -1)]


def generate(out_dir: str | Path, end_month: str = "2026-10", n_months: int = 25, seed: int = 7) -> Path:
    rng = np.random.default_rng(seed)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    months = _months(end_month, n_months)
    last = months[-1]

    # ---- 店舗マスタ ----
    stores = []
    for i in range(1, 31):
        code = f"S{i:02d}"
        opened = "2010-04"
        if i == 29:
            opened = (last - 9).strftime("%Y-%m")  # 新店(前年比較対象外)
        stores.append({
            "店舗コード": code,
            "店舗名": f"サンプル{AREAS[(i - 1) % 5][:2]}店{i:02d}",
            "エリア": AREAS[(i - 1) % 5],
            "業態": "SC" if i % 3 else "路面",
            "開店年月": opened,
            "base": rng.uniform(18e6, 55e6),
            "members": int(rng.uniform(180, 650)),
            "rent": rng.uniform(1.2e6, 2.6e6),
        })
        if code == "S07":
            stores[-1].update(base=30e6, rent=6.2e6, members=200)
    stores.append({"店舗コード": "EC01", "店舗名": "オンラインストア", "エリア": "EC", "業態": "EC",
                   "開店年月": "2015-04", "base": 70e6, "members": 0, "rent": 0.8e6})

    sales_rows, store_rows, lesson_rows = [], [], []

    for st in stores:
        code = st["店舗コード"]
        opened = pd.Period(st["開店年月"], freq="M")
        is_ec = code == "EC01"
        # コース別会員(初期値)
        course_members = {c: st["members"] * s for c, (s, _) in COURSES.items()}
        inv = st["base"] * 0.75 * 2.2
        for t_idx, m in enumerate(months):
            if m < opened:
                continue
            age = (m - opened).n
            years = t_idx / 12
            ramp = min(1.0, 0.55 + age * 0.05) if age < 12 else 1.0
            season = SALES_SEASON[m.month]
            store_trend = 1.0
            if code == "S07":
                store_trend = 1.0 - 0.014 * max(0, t_idx - 8)  # じり貧
            if is_ec:
                store_trend = (1.12) ** years

            # ---- 部門別売上 ----
            prod_sales_total, prod_gp_total = 0.0, 0.0
            for cat, (share, margin, growth) in CATEGORIES.items():
                if is_ec and cat in ("修理・サービス",):
                    continue
                g = growth
                mg = margin
                if cat == "ギター・ベース" and t_idx >= n_months - 9:
                    g = -0.10  # 直近で前年割れ
                if cat == "DTM・音響機器" and t_idx >= n_months - 5:
                    mg = margin - 0.035  # 値下げ競争で粗利率低下
                share_adj = share * (1.6 if (is_ec and cat == "DTM・音響機器") else 1.0)
                val = (st["base"] * share_adj * season * ramp * store_trend
                       * (1 + g) ** years * rng.normal(1.0, 0.05))
                if cat == "ギター・ベース" and t_idx >= n_months - 9:
                    val *= 0.95
                gp = val * mg * rng.normal(1.0, 0.02)
                sales_rows.append({"年月": m.strftime("%Y-%m"), "店舗コード": code, "部門": cat,
                                   "チャネル": "EC" if is_ec else "店舗", "売上高": round(val),
                                   "売上総利益": round(gp)})
                prod_sales_total += val
                prod_gp_total += gp

            # ---- 教室 ----
            tuition_total = 0.0
            if not is_ec:
                for course, (_, fee) in COURSES.items():
                    begin = course_members[course]
                    nr = NEW_RATE[m.month] * rng.normal(1.0, 0.08)
                    cr = CHURN_RATE[m.month] * rng.normal(1.0, 0.08)
                    if course == "ピアノ":
                        nr *= 0.85  # ピアノコースは入会が弱い
                    if code in ("S03", "S22") and t_idx >= n_months - 6:
                        cr += 0.018  # 講師退職等で退会増
                    if age < 12:
                        nr *= 1.8
                    new = int(round(begin * nr)) if begin > 0 else int(round(10 * ramp))
                    if age == 0:
                        begin = 0
                        new = int(st["members"] * COURSES[course][0] * 0.3)
                    wd = int(round(begin * cr))
                    end = max(0, int(round(begin)) + new - wd)
                    trials = int(round(new / max(0.35, rng.normal(0.55, 0.04)
                                                   - (0.08 if code in ("S03", "S22") and t_idx >= n_months - 6 else 0))))
                    rev = (begin + end) / 2 * fee * rng.normal(1.0, 0.01)
                    lesson_rows.append({"年月": m.strftime("%Y-%m"), "店舗コード": code, "コース": course,
                                        "月初会員数": int(round(begin)), "入会数": new, "退会数": wd,
                                        "月末会員数": end, "体験レッスン数": trials, "月謝売上": round(rev)})
                    course_members[course] = end
                    tuition_total += rev
                tuition_gp = tuition_total * 0.48
                sales_rows.append({"年月": m.strftime("%Y-%m"), "店舗コード": code, "部門": LESSON_CATEGORY,
                                   "チャネル": "店舗", "売上高": round(tuition_total), "売上総利益": round(tuition_gp)})
            else:
                tuition_gp = 0.0

            # ---- 店舗PL ----
            sales = prod_sales_total + tuition_total
            gp = prod_gp_total + tuition_gp
            labor = st["base"] * 0.09 * (1.05 ** years) * rng.normal(1.0, 0.02)
            if is_ec:
                labor = st["base"] * 0.04 * (1.05 ** years)
            rent = st["rent"]
            other = sales * 0.035 * rng.normal(1.0, 0.05)
            inv_target = prod_sales_total * 0.72 * (2.0 if not is_ec else 1.5)
            if code == "S15" and t_idx >= n_months - 8:
                inv = inv * 1.045  # 在庫積み上がり
            else:
                inv = inv * 0.8 + inv_target * 0.2
            store_rows.append({
                "年月": m.strftime("%Y-%m"), "店舗コード": code, "店舗名": st["店舗名"], "エリア": st["エリア"],
                "業態": st["業態"], "開店年月": st["開店年月"], "売上高": round(sales),
                "売上総利益": round(gp), "人件費": round(labor), "地代家賃": round(rent),
                "その他経費": round(other), "客数": int(prod_sales_total / rng.normal(9500, 300)),
                "在庫高": round(inv),
            })

    store_df = pd.DataFrame(store_rows)
    sales_df = pd.DataFrame(sales_rows)
    lesson_df = pd.DataFrame(lesson_rows)

    # ---- 店舗予算: 前年同月実績 x 1.03(前年がない月は当月実績ベース) ----
    store_df["_p"] = pd.PeriodIndex(store_df["年月"], freq="M")
    prev = store_df.set_index(["店舗コード", "_p"])["売上高"]
    budgets = []
    for _, r in store_df.iterrows():
        key = (r["店舗コード"], r["_p"] - 12)
        base = prev.get(key, r["売上高"] * 0.98)
        budgets.append(round(base * 1.03 * rng.normal(1.0, 0.01)))
    store_df["売上予算"] = budgets
    store_df = store_df.drop(columns="_p")
    cols = ["年月", "店舗コード", "店舗名", "エリア", "業態", "開店年月", "売上高", "売上予算",
            "売上総利益", "人件費", "地代家賃", "その他経費", "客数", "在庫高"]
    store_df = store_df[cols]

    # ---- 全社PL/BS ----
    agg = store_df.groupby("年月")[["売上高", "売上総利益", "人件費", "地代家賃", "その他経費", "在庫高", "売上予算"]].sum()
    tuition = sales_df[sales_df["部門"] == LESSON_CATEGORY].groupby("年月")["売上高"].sum()
    pl_rows, bs_rows = [], []
    cash = 2.6e9
    for ym, r in agg.iterrows():
        t_idx = months.index(pd.Period(ym, freq="M"))
        years = t_idx / 12
        hq_labor = 40e6 * (1.05 ** years)
        hq_rent = 8e6
        ad = r["売上高"] * 0.012
        dep = 25e6
        hq_other = 30e6 * rng.normal(1.0, 0.03)
        cogs = r["売上高"] - r["売上総利益"]
        actual = {
            "売上高": r["売上高"], "売上原価": cogs, "人件費": r["人件費"] + hq_labor,
            "地代家賃": r["地代家賃"] + hq_rent, "広告宣伝費": ad, "減価償却費": dep,
            "その他販管費": r["その他経費"] + hq_other, "営業外収益": 9e6, "営業外費用": 6e6,
        }
        bud_sales = r["売上予算"]
        py = str(pd.Period(ym, freq="M") - 12)
        gp_rate = (agg.loc[py, "売上総利益"] / agg.loc[py, "売上高"]) if py in agg.index else r["売上総利益"] / r["売上高"]
        budget = {
            "売上高": bud_sales, "売上原価": bud_sales * (1 - gp_rate), "人件費": (r["人件費"] + hq_labor) * 0.985,
            "地代家賃": actual["地代家賃"], "広告宣伝費": bud_sales * 0.012, "減価償却費": dep,
            "その他販管費": actual["その他販管費"] * 0.98, "営業外収益": 9e6, "営業外費用": 6e6,
        }
        for k in actual:
            pl_rows.append({"年月": ym, "科目": k, "実績": round(actual[k]), "予算": round(budget[k])})

        op = r["売上総利益"] - (actual["人件費"] + actual["地代家賃"] + ad + dep + actual["その他販管費"])
        cash = cash + op * 0.8 - 30e6 + rng.normal(0, 40e6)
        if t_idx >= n_months - 6:
            cash -= 60e6  # 在庫増・設備投資で資金流出
        inventory = r["在庫高"] + 1.1e9  # 物流センター在庫を加算
        receivable = r["売上高"] * 0.55 * (1.0 + (0.12 if t_idx >= n_months - 3 else 0))
        bs = {
            "現金預金": cash, "売掛金": receivable, "商品": inventory, "その他流動資産": 0.6e9,
            "固定資産": 6.8e9 - dep * t_idx * 0.3,
            "買掛金": cogs * 1.1, "前受金": tuition.get(ym, 0) * 1.0, "その他流動負債": 1.1e9,
            "有利子負債": 3.2e9 + (0.3e9 if t_idx >= n_months - 4 else 0),
        }
        assets = bs["現金預金"] + bs["売掛金"] + bs["商品"] + bs["その他流動資産"] + bs["固定資産"]
        liab = bs["買掛金"] + bs["前受金"] + bs["その他流動負債"] + bs["有利子負債"]
        bs["純資産"] = assets - liab
        for k, v in bs.items():
            bs_rows.append({"年月": ym, "科目": k, "残高": round(v)})

    pd.DataFrame(pl_rows).to_csv(out / "company_pl.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(bs_rows).to_csv(out / "company_bs.csv", index=False, encoding="utf-8-sig")
    store_df.to_csv(out / "store_monthly.csv", index=False, encoding="utf-8-sig")
    sales_df.to_csv(out / "sales_category.csv", index=False, encoding="utf-8-sig")
    lesson_df.to_csv(out / "lesson_members.csv", index=False, encoding="utf-8-sig")
    return out


def main():
    ap = argparse.ArgumentParser(description="ダミーデータを生成します(実データではありません)")
    ap.add_argument("-o", "--out", default="data/sample")
    ap.add_argument("--end", default="2026-10", help="最終月 YYYY-MM")
    ap.add_argument("--months", type=int, default=25)
    args = ap.parse_args()
    p = generate(args.out, args.end, args.months)
    print(f"サンプルデータを生成しました: {p}")


if __name__ == "__main__":
    main()
