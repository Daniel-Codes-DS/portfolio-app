# ============================================================
# analysis.py - קובץ מלא, להחלפה מוחלטת
# ============================================================
import logging
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user
from app.db import get_supabase
from app.rate_limit import check_and_record
from app.engine.data_loader import holdings_records_to_df
from app.engine import metrics as metrics_engine
from app.engine import ai_analysis
from app.engine import charts as charts_engine
from app.engine import pdf_report as pdf_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolios/{portfolio_id}/analysis", tags=["analysis"])

_RATE_LIMIT_MAX_PER_HOUR = 5
_RATE_LIMIT_MIN_SECONDS  = 60
_RATE_LIMIT_KEY          = "analysis"


def _get_language(request: Request) -> str:
    """
    Read language from query parameter 'lang' (most reliable),
    falling back to X-App-Language header, then Accept-Language header.
    Defaults to 'en'.
    """
    lang = request.query_params.get("lang", "").strip().lower()
    if lang in ("en", "he"):
        logger.debug("Language resolved via query param: %s", lang)
        return lang
    
    lang = request.headers.get("x-app-language", "").strip().lower()
    if lang in ("en", "he"):
        return lang
    return "en"


def _get_owned_portfolio(supabase, portfolio_id, user_id):
    resp = (
        supabase.table("portfolios")
        .select("*")
        .eq("id", portfolio_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "Portfolio not found")
    return resp.data[0]


def _safe_float(value):
    return float(value) if pd.notna(value) else None


@router.post("")
def run_analysis(portfolio_id: str, request: Request, user=Depends(get_current_user)):
    language = _get_language(request)
    logger.info("=== LANGUAGE DETECTED: %s (query_params=%s, headers.x-app-language=%s) ===", language, request.query_params.get('lang', 'MISSING'), request.headers.get('x-app-language', 'MISSING'))

    check_and_record(
        user_id=user["id"],
        key=_RATE_LIMIT_KEY,
        max_per_hour=_RATE_LIMIT_MAX_PER_HOUR,
        min_seconds_between=_RATE_LIMIT_MIN_SECONDS,
    )

    supabase  = get_supabase()
    portfolio = _get_owned_portfolio(supabase, portfolio_id, user["id"])

    holdings_resp = (
        supabase.table("holdings").select("*").eq("portfolio_id", portfolio_id).execute()
    )
    if not holdings_resp.data:
        raise HTTPException(400, "No holdings found in this portfolio – upload a file or add holdings first")

    portfolio_df = holdings_records_to_df(holdings_resp.data)
    m            = metrics_engine.compute_metrics(portfolio_df)

    ai_result = ai_analysis.run_crew_analysis(
        m,
        investor_age             = portfolio.get("investor_age"),
        investment_horizon_years = portfolio.get("investment_horizon_years"),
        risk_tolerance           = portfolio.get("risk_tolerance"),
        investment_goal          = portfolio.get("investment_goal"),
        liquidity_needs          = portfolio.get("liquidity_needs"),
        language                 = language,
    )

    chart_bytes = charts_engine.generate_allocation_charts(
        m["summary_df"], ai_result["target_weights"], m["corr_matrix"]
    )
    pdf_bytes = pdf_engine.generate_pdf_report(
        ai_result["report_text"],
        m["summary_df"],
        chart_bytes,
        m["total_value"],
        m["annual_return"],
        m["annual_vol"],
        m["sharpe_ratio"],
        language=language,
    )

    pdf_path = f"{user['id']}/{portfolio_id}/{uuid.uuid4()}.pdf"
    supabase.storage.from_("reports").upload(
        pdf_path, pdf_bytes, {"content-type": "application/pdf"}
    )

    run_resp = supabase.table("analysis_runs").insert({
        "portfolio_id":    portfolio_id,
        "total_value":     _safe_float(m["total_value"]),
        "annual_return":   _safe_float(m["annual_return"]),
        "annual_vol":      _safe_float(m["annual_vol"]),
        "sharpe_ratio":    _safe_float(m["sharpe_ratio"]),
        "hhi_concentration": _safe_float(m["hhi_concentration"]),
        "portfolio_dividend_yield": _safe_float(m.get("portfolio_dividend_yield")),
        "portfolio_expense_ratio": _safe_float(m.get("portfolio_expense_ratio")),
        "report_text":     ai_result["report_text"],
        "target_weights":  ai_result["target_weights"],
        "pdf_storage_path": pdf_path,
        # Audit: record which disclaimer version was displayed when this analysis was shown.
        # If the disclaimer text changes in future, bump this version string.
        "disclaimer_version_shown": "v1.0",
    }).execute()

    analysis_id = run_resp.data[0]["id"]
    logger.info("Analysis %s completed for portfolio %s (lang=%s)", analysis_id, portfolio_id, language)

    return {
        "analysis_id":     analysis_id,
        "report_text":     ai_result["report_text"],
        "target_weights":  ai_result["target_weights"],
        "total_value":     _safe_float(m["total_value"]),
        "annual_return":   _safe_float(m["annual_return"]),
        "annual_vol":      _safe_float(m["annual_vol"]),
        "sharpe_ratio":    _safe_float(m["sharpe_ratio"]),
        "portfolio_dividend_yield": _safe_float(m.get("portfolio_dividend_yield")),
        "portfolio_expense_ratio": _safe_float(m.get("portfolio_expense_ratio")),
        "pdf_storage_path": pdf_path,
        "current_holdings": m["summary_df"].to_dict("records"),
        "performance_history": m.get("performance_history", []),
    }


@router.get("")
def list_analysis_history(portfolio_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs")
        .select("id, total_value, annual_return, annual_vol, sharpe_ratio, hhi_concentration, created_at")
        .eq("portfolio_id", portfolio_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


@router.get("/{analysis_id}")
def get_analysis(portfolio_id: str, analysis_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs").select("*")
        .eq("id", analysis_id).eq("portfolio_id", portfolio_id).execute()
    )
    if not resp.data:
        raise HTTPException(404, "Analysis not found")
    return resp.data[0]


@router.get("/{analysis_id}/pdf-url")
def get_pdf_download_url(portfolio_id: str, analysis_id: str, user=Depends(get_current_user)):
    """Generate a time-limited signed URL (valid 1 hour) for a specific analysis PDF."""
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs").select("pdf_storage_path")
        .eq("id", analysis_id).eq("portfolio_id", portfolio_id).execute()
    )
    if not resp.data:
        raise HTTPException(404, "Analysis not found")

    pdf_path = resp.data[0].get("pdf_storage_path")
    if not pdf_path:
        raise HTTPException(404, "No PDF found for this analysis")

    signed = supabase.storage.from_("reports").create_signed_url(pdf_path, 3600)
    return {"url": signed["signedURL"]}