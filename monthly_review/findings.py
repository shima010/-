"""分析結果(注意点)の共通データ構造。"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

SEVERITY_ORDER = {"高": 0, "中": 1, "低": 2, "情報": 3}


@dataclass
class Finding:
    severity: str            # 高 / 中 / 低 / 情報
    area: str                # 全社PL / 全社BS / 店舗 / 販売動向 / 教室 / 複合 / データ品質
    title: str               # 一行の見出し
    fact: str                # 数値で確認できる事実
    hypothesis: str = ""     # 考えられる要因(推測。検証が必要)
    action: str = ""         # 確認・対応の提案
    metric: float | None = None
    targets: list[str] = field(default_factory=list)  # 対象店舗・部門など
    impact_yen: float | None = None                   # 金額影響の目安(並べ替えに使用)

    def to_dict(self):
        return asdict(self)


def sort_findings(items: list[Finding]) -> list[Finding]:
    return sorted(items, key=lambda f: (SEVERITY_ORDER.get(f.severity, 9), -abs(f.impact_yen or 0)))


def sev(value: float, mid: float, high: float, lower_is_bad: bool = True) -> str | None:
    """値としきい値から重要度を返す。該当しなければ None。"""
    if value is None:
        return None
    if lower_is_bad:
        if value < high:
            return "高"
        if value < mid:
            return "中"
    else:
        if value > high:
            return "高"
        if value > mid:
            return "中"
    return None
