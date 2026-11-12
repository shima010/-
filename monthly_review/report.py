"""分析結果をHTML / Markdown / Excel / JSON に出力する。"""

from __future__ import annotations

import html
import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import charts
from .analysis import Result, m_yen, pct, pt

AREA_ORDER = ["全社PL", "全社BS", "店舗", "販売動向", "教室", "複合", "データ品質"]
SEV_ICON = {"高": "▲", "中": "●", "低": "○", "情報": "i"}


# ---------------------------------------------------------------- 表の書式
def _fmt_cell(col: str, v) -> str:
    if isinstance(v, (bool, np.bool_)):
        return "○" if v else ""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "-"
    if isinstance(v, (int, float, np.integer, np.floating)):
        c = str(col)
        if "pt" in c:
            return f"{v:+.2f}"
        if any(k in c for k in ("比", "率")) and abs(v) < 20:
            return f"{v * 100:.1f}%"
        if "日数" in c:
            return f"{v:,.0f}"
        if "月数" in c:
            return f"{int(v)}"
        if any(k in c for k in ("会員", "入会", "退会", "純増", "体験", "店舗数", "客数")):
            return f"{v:,.0f}"
        if "相関" in c:
            return f"{v:.2f}"
        if abs(v) >= 1e5 or v == 0:
            return f"{v / 1e6:,.1f}"
        return f"{v:,.2f}"
    return str(v)


def _fmt_row_aware(df: pd.DataFrame) -> pd.DataFrame:
    """行ラベルに比率系(粗利率など)が含まれる表は行名で書式を決める。"""
    out = df.copy().astype(object)
    for i in df.index:
        for c in df.columns:
            key = str(i) if any(k in str(i) for k in ("率", "倍率", "日数", "会員", "入会", "退会", "純増", "体験", "単価", "相関")) else c
            v = df.at[i, c]
            if str(i).endswith("率") and any(k in str(c) for k in ("差",)) and not str(c).endswith("比"):
                out.at[i, c] = "-" if pd.isna(v) else f"{v:+.2f}pt"
            elif "倍率" in str(i):
                out.at[i, c] = "-" if pd.isna(v) else (f"{v:.2f}" if "比" not in str(c) else f"{v * 100:.1f}%")
            elif any(k in str(i) for k in ("会員", "入会", "退会", "純増", "体験")) and not str(i).endswith("率"):
                out.at[i, c] = "-" if pd.isna(v) else (f"{v:,.0f}" if "比" not in str(c) else f"{v * 100:.1f}%")
            elif str(i) == "会員単価":
                out.at[i, c] = "-" if pd.isna(v) else (f"{v:,.0f}円" if "比" not in str(c) else f"{v * 100:.1f}%")
            elif str(i) == "月謝売上":
                out.at[i, c] = "-" if pd.isna(v) else (f"{v / 1e6:,.1f}" if "比" not in str(c) else f"{v * 100:.1f}%")
            else:
                out.at[i, c] = _fmt_cell(key, v)
    return out


ROW_AWARE = {"全社PL", "全社BS", "教室サマリー"}


def table_html(name: str, df: pd.DataFrame, max_rows: int | None = None) -> str:
    d = df.head(max_rows) if max_rows else df
    f = _fmt_row_aware(d) if name in ROW_AWARE else d.apply(lambda col: col.map(lambda v: _fmt_cell(col.name, v)))
    head = "".join(f"<th>{html.escape(str(c))}</th>" for c in [d.index.name or ""] + list(d.columns))
    body = []
    for i, r in f.iterrows():
        cells = "".join(f'<td class="{"num" if _is_num(d.at[i, c]) else ""}">{html.escape(str(v))}</td>' for c, v in r.items())
        body.append(f"<tr><th>{html.escape(str(i))}</th>{cells}</tr>")
    note = '<p class="note">金額の単位は百万円(表示)。比率は%、pt はパーセントポイント。</p>'
    return f'<div class="tbl-wrap"><table><thead><tr>{head}</tr></thead><tbody>{"".join(body)}</tbody></table></div>{note}'


def _is_num(v) -> bool:
    return isinstance(v, (int, float, np.integer, np.floating)) and not isinstance(v, (bool, np.bool_))


# ---------------------------------------------------------------- HTML
CSS = """
:root{color-scheme:light;--bg:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;
--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;
--pos:#2a78d6;--neg:#e34948;--good:#0ca30c;--warn:#fab219;--serious:#ec835a;--crit:#d03b3b;--zone:rgba(227,73,72,.07)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#0d0d0d;--surface:#1a1a19;
--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;
--s3:#199e70;--pos:#3987e5;--neg:#e66767;--zone:rgba(230,103,103,.10)}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;
--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--s3:#199e70;--pos:#3987e5;--neg:#e66767;--zone:rgba(230,103,103,.10)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font-family:system-ui,-apple-system,"Segoe UI","Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.65}
main{max-width:1080px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.15rem;margin:40px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--grid)}
h3{font-size:1rem;margin:24px 0 8px;color:var(--ink2)}
.sub{color:var(--ink2);font-size:.9rem;margin:0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin:12px 0}
.conclusion p{margin:.3em 0}.conclusion{border-left:4px solid var(--s1)}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:12px 0}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.kpi .l{font-size:.78rem;color:var(--ink2)}.kpi .v{font-size:1.3rem;font-weight:600}.kpi .d{font-size:.78rem;color:var(--ink2)}
.f{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:10px 0}
.f .h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.f .t{font-weight:600}
.badge{display:inline-block;font-size:.75rem;padding:1px 8px;border-radius:999px;border:1px solid var(--border);white-space:nowrap}
.sev-高 .badge.s{background:var(--crit);color:#fff;border-color:var(--crit)}
.sev-中 .badge.s{background:var(--warn);color:#0b0b0b;border-color:var(--warn)}
.sev-低 .badge.s{background:var(--surface);color:var(--ink2)}
.sev-情報 .badge.s{background:var(--surface);color:var(--ink2)}
.f dl{display:grid;grid-template-columns:88px 1fr;gap:2px 10px;margin:8px 0 0;font-size:.9rem}
.f dt{color:var(--ink2)}.f dd{margin:0}
.tbl-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)}
table{border-collapse:collapse;font-size:.82rem;width:100%}th,td{padding:5px 8px;border-bottom:1px solid var(--grid);white-space:nowrap;text-align:left}
thead th{position:sticky;top:0;background:var(--surface);color:var(--ink2);font-weight:600}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:.75rem;color:var(--muted);margin:4px 0 0}
.chart{width:100%;max-width:820px;height:auto;display:block}
.chart .grid{stroke:var(--grid);stroke-width:1}.chart .axis{stroke:var(--axis);stroke-width:1.5}
.chart .ref{stroke:var(--muted);stroke-dasharray:3 3}
.chart .tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.chart .lbl{fill:var(--ink2);font-size:12px}.chart .val{fill:var(--ink2);font-size:11px}
.chart .ln{fill:none;stroke-width:2}.chart .dot{stroke:var(--surface);stroke-width:2}
.chart .bar{fill:var(--s1)}.chart .bar.neg,.chart .negd{fill:var(--neg)}.chart .pos{fill:var(--pos)}.chart .tot{fill:var(--muted)}
.chart .pt{fill:var(--s1);stroke:var(--surface);stroke-width:2}.chart .pt.bad{fill:var(--neg)}
.chart .zone{fill:var(--zone)}.chart .hit{fill:transparent}.chart [data-tip]:hover{opacity:.85}
.legend{display:flex;gap:16px;font-size:.8rem;color:var(--ink2);margin:4px 0}
.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:6px;border-radius:2px}
#tip{position:fixed;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--border);
border-radius:6px;padding:4px 8px;font-size:.8rem;box-shadow:0 2px 8px rgba(0,0,0,.15);display:none;z-index:9;max-width:360px}
#xh{position:absolute;pointer-events:none}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:760px){.grid2{grid-template-columns:1fr}}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}nav a{font-size:.8rem;color:var(--ink2);text-decoration:none;
border:1px solid var(--border);border-radius:999px;padding:2px 10px;background:var(--surface)}
.disclaimer{font-size:.78rem;color:var(--muted);margin-top:32px}
"""

JS = """
const tip=document.getElementById('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest('[data-tip]');
if(!t){tip.style.display='none';return}tip.textContent=t.dataset.tip;tip.style.display='block';
const x=Math.min(e.clientX+14,window.innerWidth-tip.offsetWidth-8);tip.style.left=x+'px';tip.style.top=(e.clientY+14)+'px';});
"""


def _legend(items):
    return '<div class="legend">' + "".join(
        f'<span><i style="background:var(--s{k})"></i>{html.escape(n)}</span>' for k, n in enumerate(items, start=1)) + "</div>"


def _finding_html(f) -> str:
    dl = f"<dt>事実</dt><dd>{html.escape(f.fact)}</dd>"
    if f.hypothesis:
        dl += f"<dt>要因(推測)</dt><dd>{html.escape(f.hypothesis)}</dd>"
    if f.action:
        dl += f"<dt>確認・対応</dt><dd>{html.escape(f.action)}</dd>"
    return (f'<div class="f sev-{f.severity}"><div class="h"><span class="badge s">{SEV_ICON[f.severity]} {f.severity}</span>'
            f'<span class="badge">{html.escape(f.area)}</span><span class="t">{html.escape(f.title)}</span></div><dl>{dl}</dl></div>')


def _kpi(label, value, delta=""):
    return f'<div class="kpi"><div class="l">{html.escape(label)}</div><div class="v">{html.escape(value)}</div><div class="d">{html.escape(delta)}</div></div>'


def render_html(r: Result, company: str = "島村楽器") -> str:
    k = r.kpi
    T = r.target
    ym = f"{T.year}年{T.month}月"
    kpis = "".join([
        _kpi("売上高", m_yen(k.get("売上高")), f"予算比 {pct(k.get('売上予算比'))} / 前年比 {pct(k.get('売上前年比'))}"),
        _kpi("営業利益", m_yen(k.get("営業利益")), f"予算差 {m_yen(k.get('営業利益予算差'))}"),
        _kpi("粗利率", pct(k.get("粗利率")), f"前年差 {pt(k.get('粗利率前年差pt'))}"),
        _kpi("既存店売上前年比", pct(k.get("既存店売上前年比")), f"客数 {pct(k.get('既存店客数前年比'))} / 客単価 {pct(k.get('既存店客単価前年比'))}"),
        _kpi("累計売上予算比", pct(k.get("累計売上予算比")), f"累計営業利益 予算差 {m_yen(k.get('累計営業利益予算差'))}"),
        _kpi("教室会員数", f"{k.get('教室会員数', float('nan')):,.0f}名", f"前年比 {pct(k.get('教室会員前年比'))}"),
        _kpi("月次退会率(12か月平均)", pct(k.get("退会率_12か月"), 2), f"前年 {pct(k.get('退会率_12か月_前年'), 2)}"),
        _kpi("在庫回転日数", f"{k.get('在庫回転日数', float('nan')):.0f}日", ""),
        _kpi("手元資金", f"月商の{k.get('手元資金月商倍率', float('nan')):.2f}か月", f"自己資本比率 {pct(k.get('自己資本比率'))}"),
        _kpi("EC比率", pct(k.get("EC比率")), f"EC前年比 {pct(k.get('EC前年比'))}"),
    ])
    key = [f for f in r.findings if f.severity in ("高", "中")]
    sections = []

    # 全社
    ser = r.series.get("全社推移")
    s_html = ""
    if ser is not None:
        labels = [f"{p.year % 100:02d}/{p.month:02d}" for p in ser.index]
        s_html += "<h3>売上高の推移(実績と予算、百万円)</h3>" + _legend(["実績", "予算"]) + charts.line_chart(
            labels, {"実績": list(ser["売上高"] / 1e6), "予算": list(ser["売上予算"] / 1e6)}, fmt=lambda v: f"{v:,.0f}",
            title="売上高の推移")
        s_html += "<h3>営業利益の推移(百万円)</h3>" + charts.bar_chart(labels, list(ser["営業利益"] / 1e6), fmt=lambda v: f"{v:,.1f}", title="営業利益の推移")
    br = r.tables.get("営業利益前年差_要因分解")
    if br is not None:
        s_html += "<h3>営業利益 前年同月からの増減要因(百万円)</h3>" + charts.waterfall(list(br.index), list(br["金額"] / 1e6), title="営業利益の要因分解")
    s_html += "<h3>全社損益(予算・前年対比)</h3>" + table_html("全社PL", r.tables["全社PL"])
    sections.append(("全社PL", "全社損益", s_html))
    if "全社BS" in r.tables:
        b = r.tables["全社BS"]
        sections.append(("全社BS", "財政状態", table_html("全社BS", b)))

    # 店舗
    if "店舗別" in r.tables:
        t = r.tables["店舗別"]
        ph = t[t["業態"] != "EC"].sort_values("予算比")
        s_html = "<h3>店舗別 予算達成率(100%からの差、pt)</h3>" + charts.hbar_diverging(
            [f"{n}" for n in ph["店舗名"]], list((ph["予算比"] - 1) * 100), fmt=lambda v: f"{v:+.1f}pt", title="店舗別予算達成")
        s_html += "<h3>エリア別</h3>" + table_html("エリア別", r.tables["エリア別"])
        cols = ["店舗名", "エリア", "売上高", "予算比", "前年比", "客数前年比", "客単価前年比", "粗利率", "人件費率", "家賃率",
                "店舗利益", "累計店舗利益", "在庫日数", "連続赤字月数", "連続前年割れ月数"]
        s_html += "<h3>店舗別一覧(予算比の低い順)</h3>" + table_html("店舗別", t.sort_values("予算比")[cols])
        sections.append(("店舗", "店舗", s_html))

    # 販売動向
    if "部門別" in r.tables:
        d = r.tables["部門別"]
        dd = d.sort_values("前年比寄与度pt")
        s_html = "<h3>部門別 全社売上前年比への寄与度(pt)</h3>" + charts.hbar_diverging(
            list(dd.index), list(dd["前年比寄与度pt"]), fmt=lambda v: f"{v:+.2f}pt", title="部門別寄与度")
        s_html += "<h3>部門別</h3>" + table_html("部門別", d)
        if "粗利率差異分解" in r.tables:
            s_html += "<h3>粗利率の前年差の分解</h3>" + table_html("粗利率差異分解", r.tables["粗利率差異分解"])
        if "チャネル別" in r.tables:
            s_html += "<h3>チャネル別</h3>" + table_html("チャネル別", r.tables["チャネル別"])
        sections.append(("販売動向", "販売動向", s_html))

    # 教室
    if "教室推移" in r.series:
        ls = r.series["教室推移"]
        labels = [f"{p.year % 100:02d}/{p.month:02d}" for p in ls.index]
        s_html = "<h3>教室会員数(月末)の推移</h3>" + charts.line_chart(labels, {"会員数": list(ls["月末会員数"])}, fmt=lambda v: f"{v:,.0f}", title="会員数推移")
        s_html += "<h3>月次退会率の推移</h3>" + charts.line_chart(labels, {"退会率": list(ls["退会率"] * 100)}, fmt=lambda v: f"{v:.1f}%", title="退会率推移")
        s_html += "<h3>教室サマリー</h3>" + table_html("教室サマリー", r.tables["教室サマリー"])
        s_html += "<h3>コース別</h3>" + table_html("コース別", r.tables["コース別"])
        s_html += "<h3>店舗別(直近3か月の退会率が高い順、上位15店)</h3>" + table_html("教室_店舗別", r.tables["教室_店舗別"], 15)
        sections.append(("教室", "音楽教室", s_html))

    # 複合
    if "物販×教室" in r.tables:
        q = r.tables["物販×教室"]
        s_html = "<h3>既存店の物販前年比と教室会員前年比</h3>" + charts.scatter_quadrant(
            [(row["店舗名"], row["物販前年比"], row["会員前年比"]) for _, row in q.iterrows()], "物販前年比", "会員前年比", title="物販×教室")
        s_html += '<p class="note">左下(網掛け)は物販・教室ともに前年割れの店舗。点にマウスを合わせると店舗名が表示されます。</p>'
        s_html += "<h3>区分別一覧</h3>" + table_html("物販×教室", q)
        sections.append(("複合", "複合分析", s_html))

    by_area = {a: [f for f in r.findings if f.area == a] for a in AREA_ORDER}
    nav = "".join(f'<a href="#{a}">{t}</a>' for a, t, _ in sections)
    body = []
    for a, t, s in sections:
        fs = "".join(_finding_html(f) for f in by_area.get(a, []))
        body.append(f'<section id="{a}"><h2>{t}</h2>{fs}{s}</section>')
    dq = "".join(_finding_html(f) for f in by_area.get("データ品質", []))

    return f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>月次経営分析 {ym}</title><style>{CSS}</style></head><body><main>
<h1>{html.escape(company)} 月次経営分析レポート</h1><p class="sub">対象月: {ym} / 自動分析(数値ルールによる判定)</p>
<div class="card conclusion"><strong>結論(自動要約)</strong>{''.join(f'<p>{html.escape(s)}</p>' for s in r.summary)}</div>
<div class="kpis">{kpis}</div>
<h2>経営者に伝えるべき注意点(重要度順)</h2>
{''.join(_finding_html(f) for f in key) or '<p>重要度「高」「中」の注意点はありません。</p>'}
<nav>{nav}<a href="#dq">データ品質</a></nav>
{''.join(body)}
<section id="dq"><h2>データ品質</h2>{dq}</section>
<p class="disclaimer">本レポートは入力データとしきい値(config/thresholds.json)に基づく機械判定です。「要因(推測)」は検証前の仮説であり、事実ではありません。
最終的な経営判断の前に、担当部署での裏付け確認を行ってください。会計処理(減損・評価損等)や税務上の判断は、会計監査人・税理士への確認が必要です。</p>
</main><div id="tip"></div><script>{JS}</script></body></html>"""


# ---------------------------------------------------------------- Markdown(Obsidian向け)
def render_markdown(r: Result, company: str = "島村楽器") -> str:
    T = r.target
    lines = [f"---", f"type: 月次経営分析", f"month: {T}", f"tags: [月次決算, 経営分析]", f"---", "",
             f"# {company} 月次経営分析 {T.year}年{T.month}月", "", "## 結論(自動要約)", ""]
    lines += [f"- {s}" for s in r.summary]
    lines += ["", "## 主要指標", "", "| 指標 | 値 |", "|---|---|"]
    k = r.kpi
    for label, v in [("売上高", m_yen(k.get("売上高"))), ("売上予算比", pct(k.get("売上予算比"))), ("売上前年比", pct(k.get("売上前年比"))),
                     ("営業利益", m_yen(k.get("営業利益"))), ("営業利益 予算差", m_yen(k.get("営業利益予算差"))),
                     ("粗利率(前年差)", f"{pct(k.get('粗利率'))}({pt(k.get('粗利率前年差pt'))})"),
                     ("既存店売上前年比", pct(k.get("既存店売上前年比"))), ("教室会員数(前年比)", f"{k.get('教室会員数', 0):,.0f}名({pct(k.get('教室会員前年比'))})"),
                     ("在庫回転日数", f"{k.get('在庫回転日数', float('nan')):.0f}日"), ("手元資金(月商倍率)", f"{k.get('手元資金月商倍率', float('nan')):.2f}か月")]:
        lines.append(f"| {label} | {v} |")
    lines += ["", "## 注意点(重要度順)", ""]
    for f in r.findings:
        if f.severity == "情報":
            continue
        lines.append(f"### [{f.severity}] {f.area}: {f.title}")
        lines.append(f"- 事実: {f.fact}")
        if f.hypothesis:
            lines.append(f"- 要因(推測): {f.hypothesis}")
        if f.action:
            lines.append(f"- 確認・対応: {f.action}")
        lines.append("")
    info = [f for f in r.findings if f.severity == "情報"]
    if info:
        lines += ["## 参考情報", ""] + [f"- {f.title}: {f.fact} {f.hypothesis}" for f in info]
    lines += ["", "> 本メモは機械判定です。「要因(推測)」は未検証の仮説です。会計・税務上の判断は専門家に確認してください。"]
    return "\n".join(lines)


# ---------------------------------------------------------------- Excel
def write_excel(r: Result, path: Path):
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        pd.DataFrame({"結論(自動要約)": r.summary}).to_excel(xw, sheet_name="サマリー", index=False)
        pd.DataFrame([f.to_dict() for f in r.findings]).rename(columns={
            "severity": "重要度", "area": "領域", "title": "見出し", "fact": "事実", "hypothesis": "要因(推測)",
            "action": "確認・対応", "metric": "指標値", "targets": "対象", "impact_yen": "金額影響目安(円)"
        }).to_excel(xw, sheet_name="注意点", index=False)
        pd.Series(r.kpi, name="値").to_frame().to_excel(xw, sheet_name="KPI")
        for name, df in r.tables.items():
            df.to_excel(xw, sheet_name=name[:31])
        for name, df in r.series.items():
            d = df.copy()
            d.index = d.index.astype(str)
            d.to_excel(xw, sheet_name=name[:31])
        hdr = PatternFill(start_color="2A78D6", end_color="2A78D6", fill_type="solid")
        for ws in xw.book.worksheets:
            for cell in ws[1]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = hdr
                cell.alignment = Alignment(horizontal="center")
            for col in ws.columns:
                width = max(len(str(c.value)) if c.value is not None else 0 for c in col)
                ws.column_dimensions[get_column_letter(col[0].column)].width = min(60, max(10, width * 1.6))
            ws.freeze_panes = "B2"


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return str(o)


def write_all(r: Result, out_dir: str | Path, company: str = "島村楽器") -> dict[str, Path]:
    out = Path(out_dir) / str(r.target).replace("-", "")
    out.mkdir(parents=True, exist_ok=True)
    paths = {"html": out / "report.html", "md": out / "report.md", "xlsx": out / "detail.xlsx", "json": out / "findings.json"}
    paths["html"].write_text(render_html(r, company), encoding="utf-8")
    paths["md"].write_text(render_markdown(r, company), encoding="utf-8")
    write_excel(r, paths["xlsx"])
    payload = {"target_month": str(r.target), "summary": r.summary, "kpi": r.kpi,
               "findings": [f.to_dict() for f in r.findings]}
    paths["json"].write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")
    return paths
