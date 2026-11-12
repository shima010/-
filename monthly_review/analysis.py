"""多角的な月次分析。

全社PL / 全社BS / 店舗 / 販売動向 / 教室会員 / 複合(クロス) / データ品質 の
7つの観点で表と注意点(Finding)を作る。判定はすべて数値ルールに基づく。
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .findings import Finding, sev, sort_findings
from .loader import LESSON_CATEGORY, SGA_ACCOUNTS, Dataset

DAYS_PER_MONTH = 30.4


# ---------------------------------------------------------------- 表示用ヘルパー
def m_yen(v) -> str:
    """円 → 百万円表記。"""
    if v is None or pd.isna(v):
        return "-"
    return f"{v / 1e6:,.1f}百万円"


def pct(v, digits=1) -> str:
    if v is None or pd.isna(v):
        return "-"
    return f"{v * 100:.{digits}f}%"


def pt(v, digits=1) -> str:
    if v is None or pd.isna(v):
        return "-"
    return f"{v:+.{digits}f}pt"


def ratio(a, b):
    try:
        if b is None or pd.isna(b) or b == 0 or a is None or pd.isna(a):
            return np.nan
        return a / b
    except Exception:
        return np.nan


def trailing_true(flags: list[bool]) -> int:
    n = 0
    for f in reversed(flags):
        if f:
            n += 1
        else:
            break
    return n


def join_names(names: list[str], limit: int = 6) -> str:
    if len(names) <= limit:
        return "、".join(names)
    return "、".join(names[:limit]) + f" ほか{len(names) - limit}件"


@dataclass
class Result:
    target: pd.Period
    findings: list[Finding] = field(default_factory=list)
    tables: dict[str, pd.DataFrame] = field(default_factory=dict)
    series: dict[str, pd.DataFrame] = field(default_factory=dict)
    kpi: dict[str, float] = field(default_factory=dict)
    summary: list[str] = field(default_factory=list)


class Analyzer:
    def __init__(self, ds: Dataset, cfg: dict, target: str | None = None):
        self.ds = ds
        self.cfg = cfg
        self.T = pd.Period(target, freq="M") if target else ds.months[-1]
        if self.T not in ds.pl.index:
            raise ValueError(f"対象月 {self.T} のPLデータがありません")
        self.PY = self.T - 12
        self.PM = self.T - 1
        fs = cfg.get("fiscal_year_start_month", 4)
        start_year = self.T.year if self.T.month >= fs else self.T.year - 1
        self.fy_start = pd.Period(f"{start_year}-{fs:02d}", freq="M")
        self.ytd = [m for m in ds.months if self.fy_start <= m <= self.T]
        self.ytd_py = [m - 12 for m in self.ytd]
        self.has_py = self.PY in ds.pl.index
        self.r = Result(target=self.T)
        self.store_names = (ds.stores.sort_values("年月").drop_duplicates("店舗コード", keep="last")
                            .set_index("店舗コード")["店舗名"].to_dict())

    def sname(self, code) -> str:
        return f"{self.store_names.get(code, code)}({code})"

    def add(self, f: Finding | None):
        if f is not None:
            self.r.findings.append(f)

    # ============================================================ 全社PL
    def company_pl(self):
        c = self.cfg["company"]
        pl, b = self.ds.pl, self.ds.pl_budget
        T, PY = self.T, self.PY
        rows = ["売上高", "売上原価", "売上総利益", "人件費", "地代家賃", "広告宣伝費", "減価償却費",
                "その他販管費", "販管費計", "営業利益", "経常利益", "EBITDA"]

        def val(df, m, k):
            return df.at[m, k] if (m in df.index and k in df.columns) else np.nan

        def ysum(df, ms, k):
            ms = [m for m in ms if m in df.index]
            return df.loc[ms, k].sum() if ms else np.nan

        tbl = []
        for k in rows:
            a, bud, p = val(pl, T, k), val(b, T, k), val(pl, PY, k)
            ya, yb, yp = ysum(pl, self.ytd, k), ysum(b, self.ytd, k), ysum(pl, self.ytd_py, k)
            tbl.append({"科目": k, "当月実績": a, "当月予算": bud, "予算差": a - bud, "予算比": ratio(a, bud),
                        "前年同月": p, "前年差": a - p, "前年比": ratio(a, p),
                        "累計実績": ya, "累計予算": yb, "累計予算比": ratio(ya, yb), "累計前年比": ratio(ya, yp)})
        t = pd.DataFrame(tbl).set_index("科目")
        # 比率行
        s = t.loc["売上高"]
        for name, num in [("粗利率", "売上総利益"), ("販管費率", "販管費計"), ("人件費率", "人件費"), ("営業利益率", "営業利益")]:
            n = t.loc[num]
            t.loc[name, ["当月実績", "当月予算", "前年同月", "累計実績", "累計予算"]] = [
                ratio(n["当月実績"], s["当月実績"]), ratio(n["当月予算"], s["当月予算"]),
                ratio(n["前年同月"], s["前年同月"]), ratio(n["累計実績"], s["累計実績"]),
                ratio(n["累計予算"], s["累計予算"])]
            t.loc[name, "予算差"] = (t.loc[name, "当月実績"] - t.loc[name, "当月予算"]) * 100
            t.loc[name, "前年差"] = (t.loc[name, "当月実績"] - t.loc[name, "前年同月"]) * 100
        self.r.tables["全社PL"] = t

        sales, sales_b, sales_p = t.at["売上高", "当月実績"], t.at["売上高", "当月予算"], t.at["売上高", "前年同月"]
        op, op_b, op_p = t.at["営業利益", "当月実績"], t.at["営業利益", "当月予算"], t.at["営業利益", "前年同月"]
        self.r.kpi.update({"売上高": sales, "売上予算比": ratio(sales, sales_b), "売上前年比": ratio(sales, sales_p),
                           "営業利益": op, "営業利益予算差": op - op_b, "営業利益前年差": op - op_p,
                           "粗利率": t.at["粗利率", "当月実績"], "粗利率前年差pt": t.at["粗利率", "前年差"],
                           "累計売上予算比": t.at["売上高", "累計予算比"], "累計営業利益": t.at["営業利益", "累計実績"],
                           "累計営業利益予算差": t.at["営業利益", "累計実績"] - t.at["営業利益", "累計予算"]})

        # --- 判定: 売上
        br = ratio(sales, sales_b)
        s1 = sev(br, c["sales_budget_ratio_mid"], c["sales_budget_ratio_high"])
        if s1:
            self.add(Finding(s1, "全社PL", f"売上高が予算未達(予算比 {pct(br)})",
                             f"当月売上 {m_yen(sales)}、予算 {m_yen(sales_b)}、差額 {m_yen(sales - sales_b)}。"
                             f"期首からの累計予算比は {pct(t.at['売上高', '累計予算比'])}。",
                             "店舗別・部門別のどこで未達が出ているかは下の店舗・販売動向の項を参照。",
                             "未達額の大きい店舗・部門から順に、一過性(天候・催事日程)か構造的(競合・品揃え)かを確認する。",
                             metric=br, impact_yen=sales - sales_b))
        yy = ratio(sales, sales_p)
        s2 = sev(yy, c["sales_yoy_mid"], c["sales_yoy_high"])
        if s2 and self.has_py:
            self.add(Finding(s2, "全社PL", f"売上高が前年割れ(前年比 {pct(yy)})",
                             f"当月 {m_yen(sales)}、前年同月 {m_yen(sales_p)}。",
                             metric=yy, impact_yen=sales - sales_p))
        # --- 判定: 粗利率
        gm_d = t.at["粗利率", "前年差"]
        s3 = sev(gm_d, c["gross_margin_yoy_pt_mid"], c["gross_margin_yoy_pt_high"])
        if s3 and self.has_py:
            self.add(Finding(s3, "全社PL", f"粗利率が前年から {pt(gm_d)} 低下",
                             f"当月粗利率 {pct(t.at['粗利率', '当月実績'])}、前年同月 {pct(t.at['粗利率', '前年同月'])}。"
                             f"粗利額への影響は約 {m_yen(gm_d / 100 * sales)}。",
                             "部門構成の変化(ミックス)と部門ごとの値下げ(レート)のどちらが主因かは販売動向の項で分解。",
                             "値引き・下取り施策、仕入条件、在庫評価損の計上有無を確認する。",
                             metric=gm_d, impact_yen=gm_d / 100 * sales))
        # --- 判定: 販管費率・人件費率
        sga_d = t.at["販管費率", "前年差"]
        s4 = sev(sga_d, c["sga_ratio_yoy_pt_mid"], c["sga_ratio_yoy_pt_high"], lower_is_bad=False)
        if s4 and self.has_py:
            inc = {k: t.at[k, "前年差"] for k in SGA_ACCOUNTS}
            top = sorted(inc.items(), key=lambda x: -x[1])[:2]
            self.add(Finding(s4, "全社PL", f"販管費率が前年から {pt(sga_d)} 上昇",
                             f"販管費率 {pct(t.at['販管費率', '当月実績'])}(前年 {pct(t.at['販管費率', '前年同月'])})。"
                             f"増加額の大きい科目: " + "、".join(f"{k} {m_yen(v)}" for k, v in top) + "。",
                             "売上の伸びに対して固定費(人件費・家賃)が先行している可能性(推測)。",
                             metric=sga_d, impact_yen=-sga_d / 100 * sales))
        lab_d = t.at["人件費率", "前年差"]
        if self.has_py and lab_d > c["labor_ratio_yoy_pt_mid"]:
            lab_yoy = ratio(t.at["人件費", "当月実績"], t.at["人件費", "前年同月"])
            self.add(Finding("中", "全社PL", f"人件費率が前年から {pt(lab_d)} 上昇",
                             f"人件費の前年比 {pct(lab_yoy)} に対し、売上の前年比 {pct(yy)}。",
                             "賃上げ・採用増の効果が売上に表れていない可能性(推測)。",
                             "店舗別の人時売上高(売上÷総労働時間)で効率を確認する。勤怠データの連携を推奨。",
                             metric=lab_d, impact_yen=-lab_d / 100 * sales))
        # --- 判定: 営業利益
        gap = op - op_b
        gap_r = ratio(gap, abs(op_b))
        if gap < 0:
            s5 = "高" if gap_r < c["op_income_budget_gap_ratio_high"] else "中"
            self.add(Finding(s5, "全社PL", f"営業利益が予算を {m_yen(-gap)} 下回る",
                             f"当月営業利益 {m_yen(op)}(予算 {m_yen(op_b)}、予算比 {pct(ratio(op, op_b))})。"
                             f"累計では予算差 {m_yen(self.r.kpi['累計営業利益予算差'])}。",
                             action="下の「営業利益の前年差 要因分解」で、売上・粗利率・費用のどれが効いているかを確認する。",
                             metric=gap_r, impact_yen=gap))
        if self.has_py and op < op_p:
            self.add(Finding("中" if op > 0 else "高", "全社PL", f"営業利益が前年同月を {m_yen(op_p - op)} 下回る",
                             f"当月 {m_yen(op)}、前年同月 {m_yen(op_p)}、営業利益率 {pct(t.at['営業利益率', '当月実績'])}"
                             f"(前年 {pct(t.at['営業利益率', '前年同月'])})。", impact_yen=op - op_p))

        # --- 営業利益 前年差の要因分解
        if self.has_py:
            gm_p = t.at["粗利率", "前年同月"]
            bridge = [("前年同月 営業利益", op_p),
                      ("売上増減の影響", (sales - sales_p) * gm_p),
                      ("粗利率変化の影響", sales * (t.at["粗利率", "当月実績"] - gm_p))]
            for k in SGA_ACCOUNTS:
                bridge.append((f"{k}の増減", -(t.at[k, "当月実績"] - t.at[k, "前年同月"])))
            bridge.append(("当月 営業利益", op))
            self.r.tables["営業利益前年差_要因分解"] = pd.DataFrame(bridge, columns=["要因", "金額"]).set_index("要因")

        # --- 推移(直近24か月)
        hist = self.ds.pl.loc[[m for m in self.ds.months if m <= self.T][-24:]]
        ser = pd.DataFrame({"売上高": hist["売上高"], "営業利益": hist["営業利益"],
                            "売上予算": self.ds.pl_budget["売上高"].reindex(hist.index),
                            "粗利率": hist["売上総利益"] / hist["売上高"]})
        ser["売上前年比"] = [ratio(self.ds.pl.at[m, "売上高"], self.ds.pl.at[m - 12, "売上高"])
                          if (m - 12) in self.ds.pl.index else np.nan for m in ser.index]
        self.r.series["全社推移"] = ser

        # 3か月移動の前年比(単月のぶれを除いた基調)
        last3 = [self.T - i for i in range(3)]
        if all((m in pl.index and (m - 12) in pl.index) for m in last3):
            y3 = ratio(pl.loc[last3, "売上高"].sum(), pl.loc[[m - 12 for m in last3], "売上高"].sum())
            self.r.kpi["売上前年比_3か月"] = y3
            if y3 < 1 and yy >= 1:
                self.add(Finding("低", "全社PL", "単月は前年超えだが、3か月累計では前年割れ",
                                 f"直近3か月の前年比 {pct(y3)}、当月単月 {pct(yy)}。",
                                 "当月は曜日・催事などの一時要因で押し上げられた可能性(推測)。", metric=y3))

    # ============================================================ 全社BS
    def company_bs(self):
        c = self.cfg["company"]
        bs, pl = self.ds.bs, self.ds.pl
        T, PY = self.T, self.PY
        if T not in bs.index:
            self.add(Finding("中", "データ品質", "対象月のBSデータがありません", f"{T} の company_bs が未登録です。"))
            return

        def metrics(m):
            if m not in bs.index:
                return None
            r = bs.loc[m]
            ms3 = [m - i for i in range(3) if (m - i) in pl.index]
            ms12 = [m - i for i in range(12) if (m - i) in pl.index]
            cogs3 = pl.loc[ms3, "売上原価"].mean()
            sales12 = pl.loc[ms12, "売上高"].mean()
            assets = sum(r.get(k, 0) for k in ["現金預金", "売掛金", "商品", "その他流動資産", "固定資産"])
            cur_a = sum(r.get(k, 0) for k in ["現金預金", "売掛金", "商品", "その他流動資産"])
            cur_l = sum(r.get(k, 0) for k in ["買掛金", "前受金", "その他流動負債"])
            return {
                "現金預金": r["現金預金"], "商品": r["商品"], "売掛金": r["売掛金"], "前受金": r["前受金"],
                "有利子負債": r["有利子負債"], "純資産": r["純資産"], "総資産": assets,
                "在庫回転日数": ratio(r["商品"], cogs3) * DAYS_PER_MONTH,
                "売掛金回転日数": ratio(r["売掛金"], pl.at[m, "売上高"]) * DAYS_PER_MONTH if m in pl.index else np.nan,
                "手元資金(月商倍率)": ratio(r["現金預金"], sales12),
                "流動比率": ratio(cur_a, cur_l),
                "自己資本比率": ratio(r["純資産"], assets),
                "純有利子負債": r["有利子負債"] - r["現金預金"],
                "貸借差額": assets - (cur_l + r["有利子負債"] + r["純資産"]),
            }

        cur, prv = metrics(T), metrics(PY)
        pm = metrics(self.PM)
        t = pd.DataFrame({"当月": cur, "前月": pm or {}, "前年同月": prv or {}})
        t["前年差"] = t["当月"] - t["前年同月"]
        self.r.tables["全社BS"] = t.drop(index="貸借差額")
        self.r.kpi.update({"在庫回転日数": cur["在庫回転日数"], "手元資金月商倍率": cur["手元資金(月商倍率)"],
                           "自己資本比率": cur["自己資本比率"]})

        tol = self.cfg["data_quality"]["tolerance_ratio"]
        if abs(cur["貸借差額"]) > cur["総資産"] * tol:
            self.add(Finding("中", "データ品質", "BSの貸借が一致しません",
                             f"資産合計と負債・純資産合計の差 {m_yen(cur['貸借差額'])}。科目の集計漏れの可能性があります。"))

        if prv:
            inc = ratio(cur["在庫回転日数"], prv["在庫回転日数"]) - 1
            s = sev(inc, c["inventory_days_yoy_increase_mid"], c["inventory_days_yoy_increase_high"], lower_is_bad=False)
            inv_yoy = ratio(cur["商品"], prv["商品"])
            sales_yoy = self.r.kpi.get("売上前年比_3か月", self.r.kpi.get("売上前年比"))
            gap_pt = (inv_yoy - sales_yoy) * 100 if sales_yoy == sales_yoy else np.nan
            if gap_pt == gap_pt and gap_pt > c["inventory_vs_sales_growth_gap_pt_high"]:
                s = "高"
            if s:
                self.add(Finding(s, "全社BS", f"在庫が積み上がっている(回転日数 {cur['在庫回転日数']:.0f}日、前年 {prv['在庫回転日数']:.0f}日)",
                                 f"商品残高 {m_yen(cur['商品'])}(前年比 {pct(inv_yoy)})に対し、売上の前年比は {pct(sales_yoy)}。",
                                 "季節前の先行仕入か、売れ残り(滞留在庫)の増加か、BSだけでは判別できない。",
                                 "店舗別在庫(下表)と、年齢別在庫(入荷から180日超)の一覧を確認する。評価損の要否も検討。",
                                 metric=inc, impact_yen=-(cur["商品"] - prv["商品"] * sales_yoy) if sales_yoy == sales_yoy else None))
            ar = ratio(cur["売掛金回転日数"], prv["売掛金回転日数"]) - 1
            if ar > c["receivable_days_yoy_increase_mid"]:
                self.add(Finding("中", "全社BS", f"売掛金の回収期間が延びている({cur['売掛金回転日数']:.1f}日、前年 {prv['売掛金回転日数']:.1f}日)",
                                 f"売掛金 {m_yen(cur['売掛金'])}(前年 {m_yen(prv['売掛金'])})。",
                                 "クレジット・ショッピングローン比率の上昇、または法人・学校向け掛売りの増加(推測)。",
                                 "決済手段別の売上構成と、期日超過の売掛金を確認する。", metric=ar))
            er = (cur["自己資本比率"] - prv["自己資本比率"]) * 100
            if er < -c["equity_ratio_drop_pt_mid"]:
                self.add(Finding("中", "全社BS", f"自己資本比率が前年から {pt(er)} 低下",
                                 f"当月 {pct(cur['自己資本比率'])}、前年 {pct(prv['自己資本比率'])}。", metric=er))
            dr = ratio(cur["有利子負債"], prv["有利子負債"]) - 1
            if dr > c["debt_yoy_increase_mid"]:
                self.add(Finding("中", "全社BS", f"有利子負債が前年から {pct(dr)} 増加",
                                 f"有利子負債 {m_yen(cur['有利子負債'])}(前年 {m_yen(prv['有利子負債'])})、"
                                 f"純有利子負債 {m_yen(cur['純有利子負債'])}。",
                                 "在庫増・設備投資の資金を借入で賄っている可能性(推測)。",
                                 "借入の使途と返済予定、コベナンツの有無を確認する。", metric=dr))
            adv = ratio(cur["前受金"], prv["前受金"])
            if adv < c["advance_received_yoy_mid"]:
                self.add(Finding("中", "全社BS", f"前受金(教室月謝等)が前年比 {pct(adv)}",
                                 f"前受金 {m_yen(cur['前受金'])}(前年 {m_yen(prv['前受金'])})。",
                                 "教室会員数の減少が先行して表れている可能性(推測)。教室の項と合わせて確認。", metric=adv))
        cm = cur["手元資金(月商倍率)"]
        s = sev(cm, c["cash_months_of_sales_mid"], c["cash_months_of_sales_high"])
        if s:
            self.add(Finding(s, "全社BS", f"手元資金が月商の {cm:.2f}か月分",
                             f"現金預金 {m_yen(cur['現金預金'])}。",
                             action="今後3か月の資金繰り表(仕入支払・賞与・納税)と当座貸越枠を確認する。", metric=cm))

        hist = [m for m in self.ds.months if m <= T and m in bs.index][-24:]
        self.r.series["BS推移"] = pd.DataFrame({m: metrics(m) for m in hist}).T[["在庫回転日数", "手元資金(月商倍率)", "商品", "現金預金"]]

    # ============================================================ 店舗
    def stores(self):
        c = self.cfg["store"]
        st = self.ds.stores
        T, PY = self.T, self.PY
        sales_cat = self.ds.sales
        prod = sales_cat[sales_cat["部門"] != LESSON_CATEGORY]
        prod_cogs = (prod.assign(原価=prod["売上高"] - prod["売上総利益"])
                     .groupby(["店舗コード", "年月"])["原価"].sum())

        cur = st[st["年月"] == T].set_index("店舗コード")
        prv = st[st["年月"] == PY].set_index("店舗コード")
        if cur.empty:
            self.add(Finding("高", "データ品質", "対象月の店舗データがありません", f"{T} の store_monthly が空です。"))
            return
        piv = {k: st.pivot_table(index="年月", columns="店舗コード", values=k, aggfunc="sum")
               for k in ["売上高", "店舗利益", "在庫高"]}

        rows = []
        for code, r in cur.iterrows():
            p = prv.loc[code] if code in prv.index else None
            existing = (T - r["開店年月"]).n >= c["existing_store_min_months"] if pd.notna(r["開店年月"]) else p is not None
            cogs3 = np.nanmean([prod_cogs.get((code, T - i), np.nan) for i in range(3)])
            inv_days = ratio(r["在庫高"], cogs3) * DAYS_PER_MONTH
            # 連続赤字・連続前年割れ
            hist_m = [m for m in piv["店舗利益"].index if m <= T][-12:]
            deficit_flags = [piv["店舗利益"].at[m, code] < 0 if pd.notna(piv["店舗利益"].at[m, code]) else False for m in hist_m]
            yoy_flags = []
            for m in hist_m:
                a = piv["売上高"].at[m, code] if code in piv["売上高"].columns else np.nan
                b = piv["売上高"].at[m - 12, code] if (m - 12) in piv["売上高"].index else np.nan
                yoy_flags.append(bool(pd.notna(a) and pd.notna(b) and a < b))
            ytd_profit = st[(st["店舗コード"] == code) & (st["年月"].isin(self.ytd))]["店舗利益"].sum()
            unit = ratio(r["売上高"], r["客数"])
            row = {
                "店舗コード": code, "店舗名": r["店舗名"], "エリア": r["エリア"], "業態": r["業態"],
                "既存店": existing, "売上高": r["売上高"], "予算比": ratio(r["売上高"], r["売上予算"]),
                "予算差": r["売上高"] - r["売上予算"],
                "前年比": ratio(r["売上高"], p["売上高"]) if p is not None else np.nan,
                "客数前年比": ratio(r["客数"], p["客数"]) if p is not None else np.nan,
                "客単価前年比": ratio(unit, ratio(p["売上高"], p["客数"])) if p is not None else np.nan,
                "粗利率": ratio(r["売上総利益"], r["売上高"]), "人件費率": ratio(r["人件費"], r["売上高"]),
                "家賃率": ratio(r["地代家賃"], r["売上高"]),
                "人件費前年比": ratio(r["人件費"], p["人件費"]) if p is not None else np.nan,
                "店舗利益": r["店舗利益"], "店舗利益率": ratio(r["店舗利益"], r["売上高"]),
                "累計店舗利益": ytd_profit, "在庫高": r["在庫高"], "在庫日数": inv_days,
                "在庫前年比": ratio(r["在庫高"], p["在庫高"]) if p is not None else np.nan,
                "連続赤字月数": trailing_true(deficit_flags), "連続前年割れ月数": trailing_true(yoy_flags),
            }
            rows.append(row)
        t = pd.DataFrame(rows).set_index("店舗コード")
        self.r.tables["店舗別"] = t

        # 既存店前年比と、客数・客単価への分解
        ex = t[t["既存店"]].index
        ex_prv = prv.loc[prv.index.intersection(ex)]
        ex_cur = cur.loc[ex_prv.index]
        if not ex_prv.empty:
            ssy = ratio(ex_cur["売上高"].sum(), ex_prv["売上高"].sum())
            cy = ratio(ex_cur["客数"].sum(), ex_prv["客数"].sum())
            uy = ratio(ssy, cy)
            self.r.kpi.update({"既存店売上前年比": ssy, "既存店客数前年比": cy, "既存店客単価前年比": uy})
            if ssy < 1:
                driver = "客数" if cy < uy else "客単価"
                self.add(Finding("中" if ssy >= 0.97 else "高", "店舗", f"既存店売上が前年割れ(前年比 {pct(ssy)})",
                                 f"既存店{len(ex_prv)}店の合計。客数 {pct(cy)} × 客単価 {pct(uy)}。主因は{driver}側。",
                                 "客数減なら集客(催事・教室からの送客)、客単価減なら高額品の失速や値引きを疑う(推測)。",
                                 metric=ssy))

        # エリア別
        a = t.groupby("エリア").agg(売上高=("売上高", "sum"), 予算差=("予算差", "sum"), 店舗利益=("店舗利益", "sum"))
        pa = prv.groupby("エリア")["売上高"].sum()
        ba = cur.groupby("エリア")["売上予算"].sum()
        a["予算比"] = a["売上高"] / ba
        a["前年比"] = a["売上高"] / pa.reindex(a.index)
        a["店舗数"] = t.groupby("エリア").size()
        self.r.tables["エリア別"] = a.sort_values("予算比")

        # --- 判定
        phys = t[t["業態"] != "EC"]
        hi = phys[phys["予算比"] < c["budget_ratio_high"]].sort_values("予算差")
        if not hi.empty:
            self.add(Finding("高", "店舗", f"予算比{pct(c['budget_ratio_high'], 0)}未満の店舗が{len(hi)}店",
                             "、".join(f"{self.sname(i)} {pct(r['予算比'])}" for i, r in hi.head(8).iterrows())
                             + f"。未達額合計 {m_yen(hi['予算差'].sum())}。",
                             action="各店長に要因(一過性か構造的か)と翌月の挽回策を確認する。",
                             targets=list(hi.index), impact_yen=hi["予算差"].sum()))
        mid = phys[(phys["予算比"] >= c["budget_ratio_high"]) & (phys["予算比"] < c["budget_ratio_mid"])]
        if not mid.empty:
            self.add(Finding("低", "店舗", f"予算比{pct(c['budget_ratio_high'], 0)}〜{pct(c['budget_ratio_mid'], 0)}の店舗が{len(mid)}店",
                             join_names([self.sname(i) for i in mid.sort_values("予算差").index], 10) + "。",
                             targets=list(mid.index), impact_yen=mid["予算差"].sum()))
        for code, r in phys[phys["連続赤字月数"] >= c["consecutive_deficit_months_high"]].iterrows():
            self.add(Finding("高", "店舗", f"{self.sname(code)} が{int(r['連続赤字月数'])}か月連続の店舗赤字",
                             f"当月店舗利益 {m_yen(r['店舗利益'])}、期首累計 {m_yen(r['累計店舗利益'])}。"
                             f"売上前年比 {pct(r['前年比'])}、家賃率 {pct(r['家賃率'])}、人件費率 {pct(r['人件費率'])}。",
                             "売上減に対して固定費(家賃・人件費)が下がらない構造になっている可能性(推測)。",
                             "損益分岐売上、賃貸借契約の更新時期・解約条件、人員配置を確認し、改善計画か撤退判断の検討に入る。"
                             "減損の兆候(営業損益が継続してマイナス)にも該当しうるため、会計監査人との協議要否を確認する。",
                             targets=[code], impact_yen=r["累計店舗利益"]))
        newdef = phys[(phys["店舗利益"] < 0) & (phys["連続赤字月数"] < c["consecutive_deficit_months_high"])]
        if not newdef.empty:
            self.add(Finding("中", "店舗", f"当月店舗赤字の店舗が{len(newdef)}店",
                             join_names([f"{self.sname(i)} {m_yen(r['店舗利益'])}" for i, r in newdef.iterrows()]) + "。",
                             targets=list(newdef.index), impact_yen=newdef["店舗利益"].sum()))
        cons = phys[phys["連続前年割れ月数"] >= c["consecutive_yoy_decline_months_mid"]].sort_values("連続前年割れ月数", ascending=False)
        if not cons.empty:
            self.add(Finding("中", "店舗", f"{c['consecutive_yoy_decline_months_mid']}か月以上連続で前年割れの店舗が{len(cons)}店",
                             join_names([f"{self.sname(i)}({int(r['連続前年割れ月数'])}か月)" for i, r in cons.iterrows()], 10) + "。",
                             "一時的な要因ではなく、商圏の変化・競合出店・人員体制など構造要因の可能性(推測)。",
                             targets=list(cons.index)))
        # 人件費率の外れ値
        z = (phys["人件費率"] - phys["人件費率"].mean()) / phys["人件費率"].std(ddof=0)
        out = phys[z > c["labor_ratio_zscore"]]
        if not out.empty:
            self.add(Finding("中", "店舗", f"人件費率が他店より突出して高い店舗が{len(out)}店",
                             join_names([f"{self.sname(i)} {pct(r['人件費率'])}" for i, r in out.iterrows()])
                             + f"(全店平均 {pct(phys['人件費率'].mean())})。", targets=list(out.index)))
        # 在庫
        inv_gap = (phys["在庫前年比"] - phys["前年比"]) * 100
        zi = (phys["在庫日数"] - phys["在庫日数"].mean()) / phys["在庫日数"].std(ddof=0)
        inv_out = phys[(inv_gap > c["inventory_vs_sales_growth_gap_pt_mid"]) | (zi > c["inventory_days_zscore"])]
        if not inv_out.empty:
            self.add(Finding("中", "店舗", f"在庫が売上に比べて過大な店舗が{len(inv_out)}店",
                             "、".join(f"{self.sname(i)} 在庫日数{r['在庫日数']:.0f}日(在庫前年比{pct(r['在庫前年比'])}・売上前年比{pct(r['前年比'])})"
                                      for i, r in inv_out.iterrows()) + f"。全店平均 {phys['在庫日数'].mean():.0f}日。",
                             "店舗独自の仕入、催事用の在庫の戻し遅れ、滞留品の可能性(推測)。",
                             "単品別の滞留在庫を確認し、店間移動・EC出品・評価損計上を検討する。",
                             targets=list(inv_out.index)))

        self.r.series["店舗売上推移"] = piv["売上高"]

    # ============================================================ 販売動向
    def sales_trend(self):
        c = self.cfg["sales"]
        s = self.ds.sales
        T, PY = self.T, self.PY
        g = s.groupby(["年月", "部門"])[["売上高", "売上総利益"]].sum()
        piv = g["売上高"].unstack("部門").sort_index()
        gp = g["売上総利益"].unstack("部門").sort_index()
        if T not in piv.index:
            return
        cur, prv = piv.loc[T], piv.loc[PY] if PY in piv.index else None
        tot_c, tot_p = cur.sum(), (prv.sum() if prv is not None else np.nan)
        rows = []
        for cat in piv.columns:
            a = cur.get(cat, 0)
            p = prv.get(cat, np.nan) if prv is not None else np.nan
            gm_c = ratio(gp.at[T, cat], a)
            gm_p = ratio(gp.at[PY, cat], p) if prv is not None else np.nan
            last3 = [T - i for i in range(3)]
            y3 = ratio(piv.loc[[m for m in last3 if m in piv.index], cat].sum(),
                       piv.loc[[m - 12 for m in last3 if (m - 12) in piv.index], cat].sum())
            hist = [m for m in piv.index if m <= T and (m - 12) in piv.index][-12:]
            flags = [piv.at[m, cat] < piv.at[m - 12, cat] for m in hist]
            rows.append({"部門": cat, "売上高": a, "構成比": ratio(a, tot_c), "前年比": ratio(a, p),
                         "前年比寄与度pt": (a - p) / tot_p * 100 if tot_p == tot_p else np.nan,
                         "前年比_3か月": y3, "粗利率": gm_c, "粗利率前年差pt": (gm_c - gm_p) * 100,
                         "粗利額前年差": gp.at[T, cat] - (gp.at[PY, cat] if prv is not None else np.nan),
                         "連続前年割れ月数": trailing_true(flags)})
        t = pd.DataFrame(rows).set_index("部門").sort_values("売上高", ascending=False)
        self.r.tables["部門別"] = t

        # チャネル
        ch = s.groupby(["年月", "チャネル"])["売上高"].sum().unstack("チャネル")
        if T in ch.index:
            ct = pd.DataFrame({"売上高": ch.loc[T], "構成比": ch.loc[T] / ch.loc[T].sum(),
                               "前年比": ch.loc[T] / ch.loc[PY] if PY in ch.index else np.nan})
            self.r.tables["チャネル別"] = ct
            if "EC" in ct.index:
                self.r.kpi["EC比率"] = ct.at["EC", "構成比"]
                self.r.kpi["EC前年比"] = ct.at["EC", "前年比"]

        if prv is None:
            return
        # 粗利率の差異分解(ミックス効果/レート効果)
        sh_c, sh_p = cur / tot_c, prv / tot_p
        gm_c = gp.loc[T] / cur
        gm_p = gp.loc[PY] / prv
        mix = ((sh_c - sh_p) * gm_p).sum() * 100
        rate = (sh_c * (gm_c - gm_p)).sum() * 100
        self.r.tables["粗利率差異分解"] = pd.DataFrame(
            {"pt": [mix, rate, mix + rate]}, index=["部門構成の変化(ミックス効果)", "部門内の粗利率変化(レート効果)", "合計"])
        rate_by = (sh_c * (gm_c - gm_p) * 100).sort_values()
        if mix + rate < self.cfg["company"]["gross_margin_yoy_pt_mid"] / 2:
            main = "ミックス" if mix < rate else "レート"
            self.add(Finding("中", "販売動向", f"粗利率低下の主因は{main}効果(ミックス {pt(mix, 2)}、レート {pt(rate, 2)})",
                             "レート効果が大きい部門: " + "、".join(f"{k} {pt(v, 2)}" for k, v in rate_by.head(3).items() if v < 0) + "。",
                             "ミックス効果は低粗利部門の構成比上昇、レート効果は値引き・仕入原価上昇を示す。",
                             metric=mix + rate))

        # --- 判定
        for cat, r in t.iterrows():
            if r["構成比"] < c["min_category_share_for_alert"] or cat == LESSON_CATEGORY:
                continue
            s1 = sev(r["前年比_3か月"], c["category_yoy_mid"], c["category_yoy_high"])
            if s1:
                drv = self._category_store_drivers(cat)
                self.add(Finding(s1, "販売動向", f"{cat}が前年割れ(当月 {pct(r['前年比'])}、3か月 {pct(r['前年比_3か月'])})",
                                 f"構成比 {pct(r['構成比'])}、全社売上前年比への寄与 {pt(r['前年比寄与度pt'], 2)}。"
                                 f"{int(r['連続前年割れ月数'])}か月連続で前年割れ。減少額の大きい店舗: {drv}。",
                                 "市場全体の需要減か、品揃え・人員(専門スタッフ)の問題かを切り分ける必要がある(推測)。",
                                 "メーカー別・価格帯別の販売数量と、業界統計・競合動向を照合する。",
                                 metric=r["前年比_3か月"], impact_yen=r["売上高"] - r["売上高"] / r["前年比"]))
            if r["粗利率前年差pt"] < c["category_margin_yoy_pt_mid"]:
                self.add(Finding("中", "販売動向", f"{cat}の粗利率が {pt(r['粗利率前年差pt'])} 低下",
                                 f"当月粗利率 {pct(r['粗利率'])}、売上前年比 {pct(r['前年比'])}、粗利額の前年差 {m_yen(r['粗利額前年差'])}。",
                                 "売上を値引きで確保している可能性(推測)。増収減益型になっていないか要確認。",
                                 "値引率・特価品の比率、仕入単価の推移を確認する。",
                                 metric=r["粗利率前年差pt"], impact_yen=r["粗利率前年差pt"] / 100 * r["売上高"]))
        if "EC前年比" in self.r.kpi and self.r.kpi["EC前年比"] > 1.05:
            self.add(Finding("情報", "販売動向", f"EC売上は前年比 {pct(self.r.kpi['EC前年比'])}(構成比 {pct(self.r.kpi['EC比率'])})",
                             "店舗売上の減少をECが補っている構図かどうか、部門別に確認するとよい。"))
        self.r.series["部門別推移"] = piv

    def _category_store_drivers(self, cat: str, n: int = 3) -> str:
        s = self.ds.sales[self.ds.sales["部門"] == cat]
        a = s[s["年月"] == self.T].groupby("店舗コード")["売上高"].sum()
        b = s[s["年月"] == self.PY].groupby("店舗コード")["売上高"].sum()
        d = (a - b).dropna().sort_values().head(n)
        return "、".join(f"{self.sname(k)} {m_yen(v)}" for k, v in d.items()) or "-"

    # ============================================================ 教室
    def lessons(self):
        c = self.cfg["lesson"]
        L = self.ds.lessons
        if L.empty:
            return
        T, PY = self.T, self.PY

        def agg(df):
            s = df[["月初会員数", "入会数", "退会数", "月末会員数", "体験レッスン数", "月謝売上"]].sum()
            s["退会率"] = ratio(s["退会数"], s["月初会員数"])
            s["入会率"] = ratio(s["入会数"], s["月初会員数"])
            s["体験入会率"] = ratio(s["入会数"], s["体験レッスン数"])
            s["純増"] = s["入会数"] - s["退会数"]
            s["会員単価"] = ratio(s["月謝売上"], (s["月初会員数"] + s["月末会員数"]) / 2)
            return s

        tot = L.groupby("年月").apply(agg, include_groups=False).sort_index()
        self.r.series["教室推移"] = tot.loc[[m for m in tot.index if m <= T]].tail(25)
        if T not in tot.index:
            return
        cur = tot.loc[T]
        prv = tot.loc[PY] if PY in tot.index else None
        ytd_net = tot.loc[[m for m in self.ytd if m in tot.index], "純増"].sum()
        ytd_net_p = tot.loc[[m for m in self.ytd_py if m in tot.index], "純増"].sum()
        last12 = [m for m in tot.index if T - 11 <= m <= T]
        churn12 = tot.loc[last12, "退会数"].sum() / tot.loc[last12, "月初会員数"].sum()
        churn12_p = np.nan
        last12p = [m - 12 for m in last12 if (m - 12) in tot.index]
        if len(last12p) == 12:
            churn12_p = tot.loc[last12p, "退会数"].sum() / tot.loc[last12p, "月初会員数"].sum()
        summary = pd.DataFrame({
            "当月": cur, "前年同月": prv if prv is not None else np.nan,
        })
        summary["前年比/差"] = [ratio(cur[k], prv[k]) if prv is not None else np.nan for k in summary.index]
        self.r.tables["教室サマリー"] = summary
        self.r.kpi.update({"教室会員数": cur["月末会員数"], "教室会員前年比": ratio(cur["月末会員数"], prv["月末会員数"]) if prv is not None else np.nan,
                           "退会率": cur["退会率"], "退会率_12か月": churn12, "退会率_12か月_前年": churn12_p,
                           "期首来純増": ytd_net, "期首来純増_前年": ytd_net_p})

        # コース別
        def by(key, df_cur, df_prv):
            a = df_cur.groupby(key).apply(agg, include_groups=False)
            b = df_prv.groupby(key).apply(agg, include_groups=False) if not df_prv.empty else None
            out = pd.DataFrame({"会員数": a["月末会員数"], "純増": a["純増"], "入会数": a["入会数"],
                                "退会率": a["退会率"], "体験入会率": a["体験入会率"], "月謝売上": a["月謝売上"]})
            if b is not None:
                out["会員前年比"] = a["月末会員数"] / b["月末会員数"].reindex(a.index)
                out["入会前年比"] = a["入会数"] / b["入会数"].reindex(a.index)
                out["退会率前年差pt"] = (a["退会率"] - b["退会率"].reindex(a.index)) * 100
            return out

        lc, lp = L[L["年月"] == T], L[L["年月"] == PY]
        course = by("コース", lc, lp)
        self.r.tables["コース別"] = course.sort_values("会員数", ascending=False)
        # 店舗別は直近3か月の退会率で判定(単月のぶれを抑える)
        l3 = L[L["年月"].isin([T - i for i in range(3)])]
        store = by("店舗コード", lc, lp)
        ch3 = l3.groupby("店舗コード").apply(lambda d: ratio(d["退会数"].sum(), d["月初会員数"].sum()), include_groups=False)
        store["退会率_3か月"] = ch3
        store.insert(0, "店舗名", [self.store_names.get(i, i) for i in store.index])
        self.r.tables["教室_店舗別"] = store.sort_values("退会率_3か月", ascending=False)

        if prv is None:
            return
        my = ratio(cur["月末会員数"], prv["月末会員数"])
        s1 = sev(my, c["members_yoy_mid"], c["members_yoy_high"])
        if s1:
            self.add(Finding(s1, "教室", f"教室会員数が前年比 {pct(my)}({cur['月末会員数']:,.0f}名)",
                             f"前年同月 {prv['月末会員数']:,.0f}名、差 {cur['月末会員数'] - prv['月末会員数']:+,.0f}名。"
                             f"期首からの純増 {ytd_net:+,.0f}名(前年同期 {ytd_net_p:+,.0f}名)。",
                             "教室は毎月の安定収益であり、物販の来店動機にもなるため、会員減は時間差で店舗売上に響く(推測)。",
                             metric=my, impact_yen=(cur["月末会員数"] - prv["月末会員数"]) * cur["会員単価"] * 12))
        cd = (churn12 - churn12_p) * 100 if churn12_p == churn12_p else (cur["退会率"] - prv["退会率"]) * 100
        s2 = sev(cd, c["churn_rate_yoy_pt_mid"], c["churn_rate_yoy_pt_high"], lower_is_bad=False)
        cd_m = (cur["退会率"] - prv["退会率"]) * 100
        if s2 is None and cd_m > c["churn_rate_yoy_pt_high"]:
            s2 = "中"
        if s2:
            self.add(Finding(s2, "教室", f"退会率が上昇(当月 {pct(cur['退会率'], 2)}、前年同月比 {pt(cd_m, 2)})",
                             f"12か月平均の月次退会率 {pct(churn12, 2)}(前年 {pct(churn12_p, 2)})。",
                             "講師の異動・退職、振替制度の変更、月謝改定などが典型的な要因(推測)。",
                             "退会理由アンケートの集計と、退会率が高い店舗の講師異動履歴を確認する。", metric=cd))
        ny = ratio(cur["入会数"], prv["入会数"])
        if ny < c["new_yoy_mid"]:
            self.add(Finding("中", "教室", f"入会数が前年比 {pct(ny)}",
                             f"当月入会 {cur['入会数']:,.0f}名(前年 {prv['入会数']:,.0f}名)、体験レッスン {cur['体験レッスン数']:,.0f}件"
                             f"(前年 {prv['体験レッスン数']:,.0f}件)。", metric=ny))
        cv = (cur["体験入会率"] - prv["体験入会率"]) * 100
        if cv < c["trial_conversion_yoy_pt_mid"]:
            self.add(Finding("中", "教室", f"体験レッスンからの入会率が {pt(cv)} 低下",
                             f"当月 {pct(cur['体験入会率'])}(前年 {pct(prv['体験入会率'])})。",
                             "体験後のフォロー、空き枠(希望曜日・時間)の不足が考えられる(推測)。", metric=cv))
        weak = course[course.get("会員前年比", pd.Series(dtype=float)) < c["course_members_yoy_mid"]]
        if not weak.empty:
            self.add(Finding("中", "教室", f"会員が減少しているコース: {join_names(list(weak.index))}",
                             "、".join(f"{k} {pct(r['会員前年比'])}(入会前年比 {pct(r['入会前年比'])}、退会率差 {pt(r['退会率前年差pt'], 2)})"
                                      for k, r in weak.iterrows()) + "。",
                             "入会が弱いのか退会が多いのかで打ち手が異なる(集客施策か、継続支援か)。",
                             targets=list(weak.index)))
        hs = store[(store["退会率_3か月"] > c["store_churn_rate_high"]) |
                   (store.get("会員前年比", pd.Series(dtype=float)) < c["store_members_yoy_high"])]
        if not hs.empty:
            self.add(Finding("高", "教室", f"会員が急減・退会率が高い教室が{len(hs)}店",
                             "、".join(f"{self.sname(i)} 退会率(3か月){pct(r['退会率_3か月'], 1)}・会員前年比{pct(r['会員前年比'])}"
                                      for i, r in hs.iterrows()) + f"。全社の当月退会率は {pct(cur['退会率'], 2)}。",
                             "店舗固有の要因(講師退職、教室の移転・改装、運営責任者の交代)の可能性が高い(推測)。",
                             "該当店の講師在籍状況と退会理由を個別に確認する。", targets=list(hs.index),
                             impact_yen=(store.loc[hs.index, "純増"].sum()) * cur["会員単価"] * 12))

    # ============================================================ 複合
    def cross(self):
        t = self.r.tables.get("店舗別")
        ls = self.r.tables.get("教室_店舗別")
        s = self.ds.sales
        if t is None or ls is None or "会員前年比" not in ls.columns:
            return
        prod = s[s["部門"] != LESSON_CATEGORY]
        a = prod[prod["年月"] == self.T].groupby("店舗コード")["売上高"].sum()
        b = prod[prod["年月"] == self.PY].groupby("店舗コード")["売上高"].sum()
        df = pd.DataFrame({"物販前年比": a / b, "会員前年比": ls["会員前年比"]}).dropna()
        df = df[df.index.isin(t[t["既存店"]].index)]
        if df.empty:
            return
        df["店舗名"] = [self.store_names.get(i, i) for i in df.index]

        def quad(r):
            if r["物販前年比"] >= 1 and r["会員前年比"] >= 1:
                return "物販・教室とも増"
            if r["物販前年比"] < 1 and r["会員前年比"] < 1:
                return "物販・教室とも減"
            return "物販のみ減" if r["物販前年比"] < 1 else "教室のみ減"
        df["区分"] = df.apply(quad, axis=1)
        order = {"物販・教室とも減": 0, "教室のみ減": 1, "物販のみ減": 2, "物販・教室とも増": 3}
        df = df.assign(_o=df["区分"].map(order)).sort_values(["_o", "物販前年比"]).drop(columns="_o")
        self.r.tables["物販×教室"] = df[["店舗名", "区分", "物販前年比", "会員前年比"]]
        both = df[(df["区分"] == "物販・教室とも減") & ((df["物販前年比"] < 0.95) | (df["会員前年比"] < 0.97))]
        if not both.empty:
            self.add(Finding("高", "複合", f"物販と教室会員がともに減少している店舗が{len(both)}店",
                             "、".join(f"{self.sname(i)}(物販{pct(r['物販前年比'])}・会員{pct(r['会員前年比'])})" for i, r in both.iterrows()) + "。",
                             "店舗全体の集客力の低下(商圏・競合・店舗運営)を示している可能性(推測)。",
                             "店長・教室責任者へのヒアリングと、商圏内の競合出店・人口動態を確認する。",
                             targets=list(both.index)))
        if len(df) >= 8:
            corr = df["物販前年比"].corr(df["会員前年比"])
            self.r.kpi["物販と会員の相関"] = corr
            self.add(Finding("情報", "複合", f"店舗間で見た「物販前年比」と「会員前年比」の相関係数 {corr:.2f}",
                             f"既存店{len(df)}店で算出。",
                             "相関は因果を示さない。教室が物販の来店を生んでいるかは、会員の購買履歴(会員ID連携)で検証が必要。"))
        # 人件費の伸び > 売上の伸び
        x = t[(t["業態"] != "EC") & t["既存店"]]
        lab = x[(x["人件費前年比"] - x["前年比"]) * 100 > 8]
        if len(lab) >= 3:
            self.add(Finding("低", "複合", f"人件費の伸びが売上の伸びを8pt以上上回る店舗が{len(lab)}店",
                             join_names([f"{self.sname(i)}(人件費{pct(r['人件費前年比'])}・売上{pct(r['前年比'])})" for i, r in lab.iterrows()], 8) + "。",
                             "賃上げを吸収できる売上・粗利の確保ができていない(推測)。", targets=list(lab.index)))

    # ============================================================ データ品質
    def data_quality(self):
        tol = self.cfg["data_quality"]["tolerance_ratio"]
        T = self.T
        st = self.ds.stores[self.ds.stores["年月"] == T]
        msgs = []
        ss = st["売上高"].sum()
        pls = self.ds.pl.at[T, "売上高"]
        if abs(ss - pls) > pls * tol:
            msgs.append(f"店舗売上合計 {m_yen(ss)} と全社PL売上 {m_yen(pls)} が {m_yen(ss - pls)} 不一致")
        sc = self.ds.sales[self.ds.sales["年月"] == T].groupby("店舗コード")["売上高"].sum()
        diff = (sc - st.set_index("店舗コード")["売上高"]).dropna()
        bad = diff[diff.abs() > st.set_index("店舗コード")["売上高"].reindex(diff.index) * tol]
        if not bad.empty:
            msgs.append(f"部門別売上の合計と店舗売上が一致しない店舗 {len(bad)}店({join_names(list(bad.index))})")
        L = self.ds.lessons
        lt = L[L["年月"] == T].groupby("店舗コード")["月謝売上"].sum()
        sl = self.ds.sales[(self.ds.sales["年月"] == T) & (self.ds.sales["部門"] == LESSON_CATEGORY)].groupby("店舗コード")["売上高"].sum()
        d2 = (lt - sl).dropna()
        bad2 = d2[d2.abs() > sl.reindex(d2.index) * 0.02]
        if not bad2.empty:
            msgs.append(f"教室の月謝売上と部門別「音楽教室」売上の差が2%超の店舗 {len(bad2)}店")
        lc = L[L["年月"] == T]
        calc = lc["月初会員数"] + lc["入会数"] - lc["退会数"]
        nbad = int((calc != lc["月末会員数"]).sum())
        if nbad:
            msgs.append(f"教室: 月初+入会-退会 ≠ 月末 の行が {nbad}行(休会・コース変更の扱いを確認)")
        lp = L[L["年月"] == self.PM].set_index(["店舗コード", "コース"])["月末会員数"]
        lcur = lc.set_index(["店舗コード", "コース"])["月初会員数"]
        cont = (lcur - lp).dropna()
        if (cont != 0).sum():
            msgs.append(f"教室: 前月末会員数と当月初会員数が一致しない行が {int((cont != 0).sum())}行")
        prev_codes = set(self.ds.stores[self.ds.stores["年月"] == self.PM]["店舗コード"])
        missing = prev_codes - set(st["店舗コード"])
        if missing:
            msgs.append(f"前月にあって当月にない店舗 {join_names(sorted(missing))}(閉店か取込漏れか確認)")
        if msgs:
            self.add(Finding("中", "データ品質", f"データの整合性チェックで{len(msgs)}件の不一致",
                             " / ".join(msgs), action="分析結論を出す前に、元データ(GRANDIT等)の抽出条件を確認する。"))
        else:
            self.add(Finding("情報", "データ品質", "整合性チェックはすべて通過",
                             "全社PLと店舗合計、店舗と部門別、教室と部門別、会員数の連続性を確認済み。"))

    # ============================================================ 総評
    def build_summary(self):
        k = self.r.kpi
        f = sort_findings(self.r.findings)
        self.r.findings = f
        high = [x for x in f if x.severity == "高"]
        mid = [x for x in f if x.severity == "中"]
        s1 = (f"{self.T.year}年{self.T.month}月の売上高は{m_yen(k.get('売上高'))}(予算比 {pct(k.get('売上予算比'))}、"
              f"前年比 {pct(k.get('売上前年比'))})、営業利益は{m_yen(k.get('営業利益'))}"
              f"(予算差 {m_yen(k.get('営業利益予算差'))}、前年差 {m_yen(k.get('営業利益前年差'))})でした。")
        s2 = f"注意度「高」は{len(high)}件、「中」は{len(mid)}件です。"
        if high:
            s2 += "優先して確認すべき点は、" + "、".join(f"「{h.title}」" for h in high[:3]) + "です。"
        op_b, op_y = k.get("営業利益予算差", 0), k.get("営業利益前年差", np.nan)
        if not self.has_py or pd.isna(op_y):
            s3 = ("前年同月のデータがないため前年比較はできていません。" +
                  ("予算は下回っています。" if op_b < 0 else "予算は確保しています。"))
        elif op_b < 0 and op_y < 0:
            s3 = "利益は予算・前年の双方を下回っており、売上未達に加えて費用構造(粗利率・人件費)の両面から手当てが必要な状況です。"
        elif op_b < 0:
            s3 = "前年は上回っているものの予算には届いておらず、計画の前提(既存店成長率など)の妥当性も含めて確認が必要です。"
        elif op_y < 0:
            s3 = "予算は確保していますが前年を下回っており、予算水準が保守的でないかを確認する余地があります。"
        else:
            s3 = "利益は予算・前年とも上回っています。個別の注意点が全体を毀損しないうちに手当てすることが重要です。"
        self.r.summary = [s1, s2, s3]

    def run(self) -> Result:
        if not self.has_py:
            self.add(Finding("情報", "データ品質", "前年同月のデータがありません",
                             f"{self.PY} のデータがないため、前年比・季節性を考慮した判定は行っていません。"
                             "前年比較には対象月を含め13か月以上のデータが必要です。"))
        self.company_pl()
        self.company_bs()
        self.stores()
        self.sales_trend()
        self.lessons()
        self.cross()
        self.data_quality()
        self.build_summary()
        return self.r
