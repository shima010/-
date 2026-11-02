"""外部ライブラリなしで描く軽量SVGチャート。

色はCSS変数(--s1 など)で指定し、ライト/ダークの切り替えはHTML側で行う。
各マークに data-tip を付け、HTML側のスクリプトでツールチップを表示する。
"""

from __future__ import annotations

import html
import math

import numpy as np


def _esc(s) -> str:
    return html.escape(str(s), quote=True)


def _nice_ticks(lo: float, hi: float, n: int = 5) -> list[float]:
    if hi == lo:
        hi = lo + 1
    span = hi - lo
    step = 10 ** math.floor(math.log10(span / n))
    for m in (1, 2, 2.5, 5, 10):
        if span / (step * m) <= n:
            step *= m
            break
    start = math.floor(lo / step) * step
    ticks = []
    v = start
    while v <= hi + step * 0.5:
        ticks.append(round(v, 10))
        v += step
    return ticks


def _frame(w, h, body, title):
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{_esc(title)}" '
            f'preserveAspectRatio="xMidYMid meet" class="chart">{body}</svg>')


def line_chart(labels: list[str], series: dict[str, list[float]], fmt=lambda v: f"{v:,.0f}",
               title: str = "", y_from_zero: bool = False, ref: float | None = None, w=720, h=260) -> str:
    """折れ線(最大4系列)。series の順に --s1, --s2 ... を割り当てる。"""
    ml, mr, mt, mb = 64, 16, 12, 30
    pw, ph = w - ml - mr, h - mt - mb
    vals = [v for s in series.values() for v in s if v is not None and not np.isnan(v)]
    if not vals:
        return ""
    lo, hi = min(vals), max(vals)
    if ref is not None:
        lo, hi = min(lo, ref), max(hi, ref)
    if y_from_zero:
        lo = min(0, lo)
    pad = (hi - lo) * 0.08 or 1
    ticks = _nice_ticks(lo - pad, hi + pad)
    y0, y1 = ticks[0], ticks[-1]
    n = len(labels)
    x = lambda i: ml + (pw * i / max(1, n - 1))
    y = lambda v: mt + ph - (v - y0) / (y1 - y0) * ph
    parts = []
    for t in ticks:
        parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/>'
                     f'<text x="{ml - 6}" y="{y(t) + 4:.1f}" class="tick" text-anchor="end">{_esc(fmt(t))}</text>')
    step = max(1, n // 8)
    for i, lb in enumerate(labels):
        if i % step == 0 or i == n - 1:
            parts.append(f'<text x="{x(i):.1f}" y="{h - 8}" class="tick" text-anchor="middle">{_esc(lb)}</text>')
    if ref is not None:
        parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(ref):.1f}" y2="{y(ref):.1f}" class="ref"/>')
    for k, (name, s) in enumerate(series.items(), start=1):
        pts = [(x(i), y(v)) for i, v in enumerate(s) if v is not None and not np.isnan(v)]
        if not pts:
            continue
        d = "M" + " L".join(f"{a:.1f},{b:.1f}" for a, b in pts)
        dash = ' stroke-dasharray="5 4"' if k == 2 else ""
        parts.append(f'<path d="{d}" class="ln" style="stroke:var(--s{k})"{dash}/>')
        lx, ly = pts[-1]
        parts.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="4" style="fill:var(--s{k})" class="dot"/>')
    # ホバー用の列(各月ごとに全系列の値を表示)
    colw = pw / max(1, n - 1)
    for i, lb in enumerate(labels):
        tip = lb + " / " + " / ".join(f"{nm}: {fmt(s[i])}" for nm, s in series.items()
                                       if s[i] is not None and not np.isnan(s[i]))
        parts.append(f'<rect x="{x(i) - colw / 2:.1f}" y="{mt}" width="{colw:.1f}" height="{ph}" class="hit" data-tip="{_esc(tip)}" data-x="{x(i):.1f}"/>')
    return _frame(w, h, "".join(parts), title)


def bar_chart(labels: list[str], values: list[float], fmt=lambda v: f"{v:,.0f}", title: str = "",
              w=720, h=240, highlight_negative: bool = True) -> str:
    """縦棒(単一系列)。負の値は基準線より下に描く。"""
    ml, mr, mt, mb = 64, 16, 12, 30
    pw, ph = w - ml - mr, h - mt - mb
    vs = [0 if v is None or np.isnan(v) else v for v in values]
    ticks = _nice_ticks(min(0, min(vs)), max(0, max(vs)))
    y0, y1 = ticks[0], ticks[-1]
    y = lambda v: mt + ph - (v - y0) / (y1 - y0) * ph
    n = len(vs)
    bw = pw / n
    parts = []
    for t in ticks:
        parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/>'
                     f'<text x="{ml - 6}" y="{y(t) + 4:.1f}" class="tick" text-anchor="end">{_esc(fmt(t))}</text>')
    for i, (lb, v) in enumerate(zip(labels, vs)):
        x0 = ml + i * bw + 1
        top, bot = (y(v), y(0)) if v >= 0 else (y(0), y(v))
        cls = "neg" if (v < 0 and highlight_negative) else ""
        parts.append(f'<rect x="{x0:.1f}" y="{top:.1f}" width="{max(1, bw - 2):.1f}" height="{max(0.5, bot - top):.1f}" rx="2" '
                     f'class="bar {cls}" data-tip="{_esc(lb)}: {_esc(fmt(v))}"/>')
        if i % max(1, n // 8) == 0 or i == n - 1:
            parts.append(f'<text x="{x0 + bw / 2:.1f}" y="{h - 8}" class="tick" text-anchor="middle">{_esc(lb)}</text>')
    parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(0):.1f}" y2="{y(0):.1f}" class="axis"/>')
    return _frame(w, h, "".join(parts), title)


def hbar_diverging(labels: list[str], values: list[float], fmt=lambda v: f"{v:+.2f}", title: str = "",
                   w=720, ref: float = 0.0, label_w=170) -> str:
    """横棒(基準値からの差)。基準より大きい=青、小さい=赤。"""
    row = 26
    h = row * len(labels) + 24
    ml, mr = label_w, 70
    pw = w - ml - mr
    vs = [ref if v is None or np.isnan(v) else v for v in values]
    lo, hi = min(min(vs), ref), max(max(vs), ref)
    span = (hi - lo) or 1
    # 値ラベルが店舗名の列や右端にはみ出さないよう、両側に余白を取る
    lo -= span * 0.14 if lo < ref else 0
    hi += span * 0.14 if hi > ref else 0
    span = (hi - lo) or 1
    x = lambda v: ml + (v - lo) / span * pw
    parts = [f'<line x1="{x(ref):.1f}" x2="{x(ref):.1f}" y1="4" y2="{h - 18}" class="axis"/>']
    for i, (lb, v) in enumerate(zip(labels, vs)):
        yy = 6 + i * row
        a, b = sorted([x(ref), x(v)])
        cls = "pos" if v >= ref else "negd"
        parts.append(f'<text x="{ml - 8}" y="{yy + 15}" class="lbl" text-anchor="end">{_esc(lb)}</text>'
                     f'<rect x="{a:.1f}" y="{yy + 3}" width="{max(1, b - a):.1f}" height="{row - 9}" rx="3" class="{cls}" '
                     f'data-tip="{_esc(lb)}: {_esc(fmt(v))}"/>'
                     f'<text x="{(b + 6) if v >= ref else (a - 6):.1f}" y="{yy + 15}" class="val" '
                     f'text-anchor="{"start" if v >= ref else "end"}">{_esc(fmt(v))}</text>')
    return _frame(w, h, "".join(parts), title)


def waterfall(labels: list[str], values: list[float], fmt=lambda v: f"{v:,.1f}", title: str = "", w=720, h=290) -> str:
    """最初と最後が合計、中間が増減のウォーターフォール。"""
    ml, mr, mt, mb = 64, 64, 16, 74
    pw, ph = w - ml - mr, h - mt - mb
    run, bars = 0.0, []
    for i, v in enumerate(values):
        if i == 0 or i == len(values) - 1:
            bars.append((0, v, "tot"))
            run = v
        else:
            bars.append((run, run + v, "pos" if v >= 0 else "negd"))
            run += v
    allv = [b for a in bars for b in a[:2]]
    ticks = _nice_ticks(min(0, min(allv)), max(allv))
    y0, y1 = ticks[0], ticks[-1]
    y = lambda v: mt + ph - (v - y0) / (y1 - y0) * ph
    n = len(values)
    bw = pw / n
    parts = []
    for t in ticks:
        parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/>'
                     f'<text x="{ml - 6}" y="{y(t) + 4:.1f}" class="tick" text-anchor="end">{_esc(fmt(t))}</text>')
    for i, ((a, b, cls), lb, v) in enumerate(zip(bars, labels, values)):
        x0 = ml + i * bw + 4
        top, bot = y(max(a, b)), y(min(a, b))
        parts.append(f'<rect x="{x0:.1f}" y="{top:.1f}" width="{bw - 8:.1f}" height="{max(1, bot - top):.1f}" rx="2" class="{cls}" '
                     f'data-tip="{_esc(lb)}: {_esc(fmt(v))}"/>')
        parts.append(f'<text x="{x0 + (bw - 8) / 2:.1f}" y="{top - 4:.1f}" class="val" text-anchor="middle">{_esc(fmt(v))}</text>')
        parts.append(f'<text transform="translate({x0 + (bw - 8) / 2:.1f},{h - mb + 14}) rotate(30)" class="tick">{_esc(lb)}</text>')
    parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(0):.1f}" y2="{y(0):.1f}" class="axis"/>')
    return _frame(w, h, "".join(parts), title)


def scatter_quadrant(points: list[tuple[str, float, float]], xlabel: str, ylabel: str, title: str = "",
                     w=720, h=360, fmt=lambda v: f"{v * 100:.1f}%") -> str:
    """散布図。基準線 x=1, y=1 で4象限に分ける。両方1未満の点を強調する。"""
    ml, mr, mt, mb = 64, 16, 16, 44
    pw, ph = w - ml - mr, h - mt - mb
    xs = [p[1] for p in points] + [1.0]
    ys = [p[2] for p in points] + [1.0]
    xt = _nice_ticks(min(xs) - 0.01, max(xs) + 0.01, 6)
    yt = _nice_ticks(min(ys) - 0.01, max(ys) + 0.01, 6)
    x = lambda v: ml + (v - xt[0]) / (xt[-1] - xt[0]) * pw
    y = lambda v: mt + ph - (v - yt[0]) / (yt[-1] - yt[0]) * ph
    parts = []
    for t in yt:
        parts.append(f'<line x1="{ml}" x2="{w - mr}" y1="{y(t):.1f}" y2="{y(t):.1f}" class="grid"/>'
                     f'<text x="{ml - 6}" y="{y(t) + 4:.1f}" class="tick" text-anchor="end">{_esc(fmt(t))}</text>')
    for t in xt:
        parts.append(f'<text x="{x(t):.1f}" y="{h - mb + 16}" class="tick" text-anchor="middle">{_esc(fmt(t))}</text>')
    parts.append(f'<rect x="{ml}" y="{y(1):.1f}" width="{x(1) - ml:.1f}" height="{mt + ph - y(1):.1f}" class="zone"/>')
    parts.append(f'<line x1="{x(1):.1f}" x2="{x(1):.1f}" y1="{mt}" y2="{mt + ph}" class="axis"/>'
                 f'<line x1="{ml}" x2="{w - mr}" y1="{y(1):.1f}" y2="{y(1):.1f}" class="axis"/>')
    parts.append(f'<text x="{ml + 6}" y="{mt + ph - 6}" class="tick">両方減</text>')
    parts.append(f'<text x="{w - mr}" y="{h - 6}" class="tick" text-anchor="end">{_esc(xlabel)} →</text>')
    parts.append(f'<text x="{ml + 4}" y="{mt + 10}" class="tick">↑ {_esc(ylabel)}</text>')
    for name, vx, vy in points:
        bad = vx < 1 and vy < 1
        parts.append(f'<circle cx="{x(vx):.1f}" cy="{y(vy):.1f}" r="{6 if bad else 5}" class="{"pt bad" if bad else "pt"}" '
                     f'data-tip="{_esc(name)} / {_esc(xlabel)} {_esc(fmt(vx))} / {_esc(ylabel)} {_esc(fmt(vy))}"/>')
        if bad:
            parts.append(f'<text x="{x(vx) + 8:.1f}" y="{y(vy) + 4:.1f}" class="val">{_esc(name)}</text>')
    return _frame(w, h, "".join(parts), title)
