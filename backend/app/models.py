from typing import Optional, List, Dict, Literal
from pydantic import BaseModel


class HoldingIn(BaseModel):
    ticker: str
    quantity: float
    avg_price: float
    asset_type: Optional[str] = None
    value_override: Optional[float] = None
    annual_return_override: Optional[float] = None
    annual_vol_override: Optional[float] = None


class PortfolioCreate(BaseModel):
    name: str = "התיק שלי"
    holdings: List[HoldingIn] = []
    # פרופיל השקעות - כל השדות אופציונליים כדי לא לשבור תיקים קיימים
    investor_age: Optional[int] = None                                         # גיל המשקיע
    investment_horizon_years: Optional[int] = None                             # שנים עד שיידרש הכסף
    risk_tolerance: Optional[Literal["conservative", "balanced", "aggressive"]] = None  # נבחר ידנית ע"י המשתמש
    investment_goal: Optional[Literal["retirement", "home_purchase", "general_savings", "other"]] = None
    liquidity_needs: Optional[Literal["low", "medium", "high"]] = None        # low=רוב הכסף נעול לטווח ארוך


class PortfolioUpdate(BaseModel):
    """לעדכון פרופיל השקעות של תיק קיים - כל השדות אופציונליים."""
    name: Optional[str] = None
    investor_age: Optional[int] = None
    investment_horizon_years: Optional[int] = None
    risk_tolerance: Optional[Literal["conservative", "balanced", "aggressive"]] = None
    investment_goal: Optional[Literal["retirement", "home_purchase", "general_savings", "other"]] = None
    liquidity_needs: Optional[Literal["low", "medium", "high"]] = None


class AnalysisResponse(BaseModel):
    analysis_id: str
    report_text: str
    target_weights: Optional[Dict[str, float]] = None
    total_value: float
    annual_return: Optional[float] = None
    annual_vol: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    pdf_storage_path: Optional[str] = None