import json
from pathlib import Path

import pandas as pd
import pytest

from monthly_review.analysis import Analyzer
from monthly_review.loader import DataError, load
from monthly_review.report import write_all
from monthly_review.sample_data import generate

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config" / "thresholds.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def result(tmp_path_factory):
    d = generate(tmp_path_factory.mktemp("data"))
    return Analyzer(load(d), CFG).run()


def titles(r, area=None):
    return [f.title for f in r.findings if area is None or f.area == area]


def test_summary_has_three_sentences(result):
    assert len(result.summary) == 3
    assert "2026年10月" in result.summary[0]


def test_detects_planted_anomalies(result):
    # サンプルデータに埋め込んだ異常を検出できること
    assert any("S07" in t and "連続の店舗赤字" in t for t in titles(result, "店舗"))
    assert any(f.area == "店舗" and "S15" in f.targets and "在庫" in f.title for f in result.findings)
    assert any("ギター・ベース" in t and "前年割れ" in t for t in titles(result, "販売動向"))
    assert any("DTM・音響機器" in t and "粗利率" in t for t in titles(result, "販売動向"))
    assert any(f.area == "教室" and "S22" in f.targets for f in result.findings)


def test_findings_sorted_by_severity(result):
    order = {"高": 0, "中": 1, "低": 2, "情報": 3}
    sev = [order[f.severity] for f in result.findings]
    assert sev == sorted(sev)


def test_data_quality_passes_on_consistent_data(result):
    dq = [f for f in result.findings if f.area == "データ品質"]
    assert dq and dq[0].severity == "情報"


def test_profit_bridge_reconciles(result):
    b = result.tables["営業利益前年差_要因分解"]["金額"]
    assert b.iloc[0] + b.iloc[1:-1].sum() == pytest.approx(b.iloc[-1], rel=1e-9)


def test_gross_margin_decomposition_reconciles(result):
    t = result.tables["粗利率差異分解"]["pt"]
    assert t.iloc[0] + t.iloc[1] == pytest.approx(t.iloc[2])


def test_data_quality_detects_mismatch(tmp_path):
    d = generate(tmp_path / "d")
    st = pd.read_csv(d / "store_monthly.csv", encoding="utf-8-sig")
    st.loc[(st["年月"] == "2026-10") & (st["店舗コード"] == "S01"), "売上高"] += 50_000_000
    st.to_csv(d / "store_monthly.csv", index=False, encoding="utf-8-sig")
    r = Analyzer(load(d), CFG).run()
    dq = [f for f in r.findings if f.area == "データ品質"]
    assert dq[0].severity == "中"
    assert "不一致" in dq[0].title


def test_missing_column_raises(tmp_path):
    d = generate(tmp_path / "d")
    pl = pd.read_csv(d / "company_pl.csv", encoding="utf-8-sig").drop(columns="予算")
    pl.to_csv(d / "company_pl.csv", index=False, encoding="utf-8-sig")
    with pytest.raises(DataError):
        load(d)


def test_target_month_option(tmp_path):
    d = generate(tmp_path / "d")
    r = Analyzer(load(d), CFG, "2026-06").run()
    assert str(r.target) == "2026-06"


def test_reports_written(result, tmp_path):
    paths = write_all(result, tmp_path)
    for p in paths.values():
        assert p.exists() and p.stat().st_size > 0
    html = paths["html"].read_text(encoding="utf-8")
    assert "<svg" in html and "経営者に伝えるべき注意点" in html
    payload = json.loads(paths["json"].read_text(encoding="utf-8"))
    assert payload["findings"]
