"""
חישוב מדדי סיכון/תשואה ברמת פוזיציה וברמת תיק כולל, כולל משיכת נתוני שוק מ-yfinance.
זהה ללוגיקה שכבר נבדקה בסוכן המייל.
"""

import pandas as pd
import numpy as np
import yfinance as yf
from app.config import LOOKBACK_PERIOD


def fetch_price_history(tickers, period=LOOKBACK_PERIOD):
    if not tickers:
        return pd.DataFrame()
    data = yf.download(tickers, period=period, auto_adjust=True, progress=False)["Close"]
    if isinstance(data, pd.Series):
        data = data.to_frame(name=tickers[0])
    return data


def compute_metrics(portfolio_df):
    manual_mask = portfolio_df["value_override"].notna()
    auto_tickers = portfolio_df.loc[~manual_mask, "ticker"].unique().tolist()

    price_history = fetch_price_history(auto_tickers)
    current_prices = price_history.iloc[-1] if not price_history.empty else pd.Series(dtype=float)
    daily_returns = price_history.pct_change(fill_method=None).dropna()

    rows = []
    for _, r in portfolio_df.iterrows():
        ticker, qty = r["ticker"], r["quantity"]
        if pd.notna(r["value_override"]):
            value = r["value_override"]
            ann_return = r["annual_return_override"] if pd.notna(r["annual_return_override"]) else np.nan
            ann_vol = r["annual_vol_override"] if pd.notna(r["annual_vol_override"]) else np.nan
        else:
            price = current_prices.get(ticker, np.nan)
            value = price * qty if pd.notna(price) else np.nan
            if ticker in daily_returns.columns:
                ann_return = daily_returns[ticker].mean() * 252
                ann_vol = daily_returns[ticker].std() * np.sqrt(252)
            else:
                ann_return, ann_vol = np.nan, np.nan
        cost_basis = qty * r["avg_price"]
        rows.append({
            "ticker": ticker, "quantity": qty, "current_value": value, "cost_basis": cost_basis,
            "unrealized_pnl": (value - cost_basis) if pd.notna(value) else np.nan,
            "annual_return_hist": ann_return, "annual_vol_hist": ann_vol,
            "asset_type": r["asset_type"],
        })

    summary_df = pd.DataFrame(rows)

    unresolved = summary_df[summary_df["current_value"].isna()]
    if not unresolved.empty:
        summary_df = summary_df.dropna(subset=["current_value"]).reset_index(drop=True)

    if summary_df.empty:
        raise ValueError("לאחר סינון, לא נותרו שורות תקינות בתיק - לא ניתן לבצע ניתוח.")

    total_value = summary_df["current_value"].sum()
    summary_df["weight"] = summary_df["current_value"] / total_value

    valid_tickers = [t for t in summary_df["ticker"] if t in daily_returns.columns]
    weights_series = summary_df.set_index("ticker").loc[valid_tickers, "weight"]
    weights_series = weights_series / weights_series.sum() if weights_series.sum() else weights_series

    port_returns = (daily_returns[valid_tickers] * weights_series).sum(axis=1) if valid_tickers else pd.Series(dtype=float)
    ann_return_port = port_returns.mean() * 252 if not port_returns.empty else np.nan
    ann_vol_port = port_returns.std() * np.sqrt(252) if not port_returns.empty else np.nan
    sharpe_port = ann_return_port / ann_vol_port if pd.notna(ann_vol_port) and ann_vol_port > 0 else np.nan

    hhi = (summary_df["weight"] ** 2).sum()
    corr_matrix = daily_returns[valid_tickers].corr() if len(valid_tickers) > 1 else None

    return {
        "summary_df": summary_df,
        "total_value": total_value,
        "annual_return": ann_return_port,
        "annual_vol": ann_vol_port,
        "sharpe_ratio": sharpe_port,
        "hhi_concentration": hhi,
        "corr_matrix": corr_matrix,
        "unresolved_tickers": list(unresolved["ticker"]) if not unresolved.empty else [],
    }
