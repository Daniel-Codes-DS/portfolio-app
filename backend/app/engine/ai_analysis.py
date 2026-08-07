"""
Portfolio analysis crew using CrewAI agents.
All agent/task definitions are in English for clarity and AI quality.
The output language (report_text) is controlled by the `language` parameter:
  "en" → report written in English (default)
  "he" → report written in Hebrew
Returns dict (not tuple) to avoid positional-unpacking bugs.
"""

import json
import logging
import pandas as pd
from typing import Optional
from crewai import Agent, Task, Crew, Process, LLM
from app.config import PRIMARY_MODEL, FALLBACK_MODEL, FEE_CONFIG

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Investor profile label maps (English internal representation)
# ---------------------------------------------------------------------------
_RISK_LABEL = {
    "conservative": "Conservative (prefers stability over return, avoids high volatility)",
    "balanced":     "Balanced (accepts moderate volatility for reasonable returns)",
    "aggressive":   "Aggressive (accepts high volatility for maximum returns)",
}
_GOAL_LABEL = {
    "retirement":      "Retirement",
    "home_purchase":   "Real estate / home purchase",
    "general_savings": "General savings",
    "other":           "Other",
}
_LIQUIDITY_LABEL = {
    "low":    "Low (most funds locked, unlikely to be needed short-term)",
    "medium": "Medium (portion of portfolio may be needed within a few years)",
    "high":   "High (significant portion may be needed relatively soon)",
}

# ---------------------------------------------------------------------------
# Output-language instructions injected into the final task
# ---------------------------------------------------------------------------
_LANG_INSTRUCTION = {
    "en": (
        "CRITICAL INSTRUCTION: You MUST write the ENTIRE final report in ENGLISH. "
        "Do NOT output Hebrew. Use professional financial English, clear section headings, and concise bullet points."
    ),
    "he": (
        "CRITICAL INSTRUCTION: You MUST write the ENTIRE final report in HEBREW. "
        "Do NOT output English. Use professional financial Hebrew, clear section headings, and concise bullet points."
    ),
}


def _build_llm(model_name):
    return LLM(model=model_name, temperature=0.3)


def _build_investor_profile_block(
    investor_age: Optional[int],
    investment_horizon_years: Optional[int],
    risk_tolerance: Optional[str],
    investment_goal: Optional[str],
    liquidity_needs: Optional[str],
) -> str:
    """
    Builds a concise investor profile block for injection into prompts.
    Returns empty string if no parameters were supplied (backwards-compatible).
    Always in English (internal representation).
    """
    lines = []
    if investor_age is not None:
        lines.append(f"- Investor age: {investor_age}")
    if investment_horizon_years is not None:
        lines.append(f"- Investment horizon: {investment_horizon_years} years")
    if risk_tolerance is not None:
        lines.append(f"- Risk tolerance: {_RISK_LABEL.get(risk_tolerance, risk_tolerance)}")
    if investment_goal is not None:
        lines.append(f"- Investment goal: {_GOAL_LABEL.get(investment_goal, investment_goal)}")
    if liquidity_needs is not None:
        lines.append(f"- Liquidity needs: {_LIQUIDITY_LABEL.get(liquidity_needs, liquidity_needs)}")

    if not lines:
        return ""

    return (
        "\n\n## Investor Profile (MUST explicitly tailor recommendations to these data points!)\n"
        "The following details describe the investor. They carry significant weight in the analysis "
        "and recommendations. Explicitly adjust risk level, asset allocation, and recommendations "
        "to match this profile:\n"
        + "\n".join(lines)
    )


def parse_target_weights(raw_text):
    """Parse target-weight JSON from LLM output. Returns None on failure."""
    if not raw_text:
        return None
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        weights = json.loads(text)
        weights = {str(k).upper(): float(v) for k, v in weights.items()}
        total = sum(weights.values())
        if total > 0:
            weights = {k: v / total for k, v in weights.items()}
        return weights
    except Exception:
        return None


def run_crew_analysis(
    metrics: dict,
    investor_age=None,
    investment_horizon_years=None,
    risk_tolerance=None,
    investment_goal=None,
    liquidity_needs=None,
    language: str = "en",
) -> dict:
    """
    metrics: result of engine.metrics.compute_metrics (dict).
    Investor profile params: all optional.
    language: "en" (default) or "he" – controls the language of report_text.
    Returns dict: {"report_text": str, "target_weights": dict|None}
    """
    summary_df       = metrics["summary_df"]
    total_value      = metrics["total_value"]
    ann_return_port  = metrics["annual_return"]
    ann_vol_port     = metrics["annual_vol"]
    sharpe_port      = metrics["sharpe_ratio"]
    hhi              = metrics["hhi_concentration"]

    portfolio_context_json = summary_df.round(4).to_json(orient="records", force_ascii=False, indent=2)
    risk_metrics_json = json.dumps({
        "hhi_concentration":           round(float(hhi), 4),
        "annual_volatility_portfolio": round(float(ann_vol_port), 4) if pd.notna(ann_vol_port) else None,
        "sharpe_ratio_portfolio":      round(float(sharpe_port), 4) if pd.notna(sharpe_port) else None,
    }, ensure_ascii=False, indent=2)
    return_metrics_json = json.dumps({
        "total_value":                   round(float(total_value), 2),
        "total_unrealized_pnl":          round(float(summary_df["unrealized_pnl"].sum()), 2),
        "annual_return_portfolio_hist":  round(float(ann_return_port), 4) if pd.notna(ann_return_port) else None,
    }, ensure_ascii=False, indent=2)
    fee_config_json = json.dumps(FEE_CONFIG, ensure_ascii=False, indent=2)

    investor_profile_block = _build_investor_profile_block(
        investor_age, investment_horizon_years, risk_tolerance, investment_goal, liquidity_needs
    )
    lang_instruction = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["en"])

    llm = _build_llm(PRIMARY_MODEL)

    # ------------------------------------------------------------------
    # Agents – all defined in English for best LLM quality
    # ------------------------------------------------------------------
    professional_tone = (
        "CRITICAL: You MUST write your analysis entirely in ENGLISH. "
        "Write in a professional tone like an analyst report section for a private client: "
        "concise, factual, third person. Do not open with a personal greeting."
    )

    portfolio_analyst = Agent(
        role="Portfolio Analyst",
        goal="Describe and summarise portfolio composition professionally and accurately",
        backstory=f"Senior portfolio analyst with extensive experience writing client reports. {professional_tone}",
        llm=llm,
    )
    risk_analyst = Agent(
        role="Risk Analyst",
        goal="Identify and explain risks professionally",
        backstory=f"Senior risk analyst, expert in VaR, Sharpe ratio and risk diversification. {professional_tone}",
        llm=llm,
    )
    return_analyst = Agent(
        role="Performance Analyst",
        goal="Analyse performance and P&L professionally",
        backstory=f"Senior performance analyst specialising in risk-adjusted returns. {professional_tone}",
        llm=llm,
    )
    cost_benefit_analyst = Agent(
        role="Cost-Benefit Analyst",
        goal="Determine whether portfolio changes are worthwhile given fees and effort",
        backstory=f"Expert in efficient trading and transaction costs. {professional_tone}",
        llm=llm,
    )
    chief_strategist = Agent(
        role="Chief Investment Strategist",
        goal="Write a professional, structured, cautious summary report for the client",
        backstory=(
            "Senior investment analyst with extensive experience writing professional summary reports "
            f"for private clients. {professional_tone} Always clarifies that the analysis is automated "
            "and does not constitute licensed investment advice."
        ),
        llm=llm,
    )

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------
    task_portfolio = Task(
        description=(
            f"Analyse the portfolio composition. {professional_tone}\n"
            f"Portfolio data (JSON):\n{portfolio_context_json}"
        ),
        expected_output="Professional portfolio composition summary",
        agent=portfolio_analyst,
    )
    task_risk = Task(
        description=(
            f"Analyse portfolio risk. {professional_tone}\n"
            f"Risk metrics (JSON):\n{risk_metrics_json}"
            f"{investor_profile_block}"
        ),
        expected_output="Professional risk analysis that accounts for the investor profile if provided",
        agent=risk_analyst,
    )
    task_return = Task(
        description=(
            f"Analyse portfolio performance. {professional_tone}\n"
            f"Performance metrics (JSON):\n{return_metrics_json}"
        ),
        expected_output="Professional performance analysis",
        agent=return_analyst,
    )
    task_cost_benefit = Task(
        description=(
            f"Given the fee configuration: {fee_config_json}\n"
            f"Is it worthwhile to consider portfolio changes? {professional_tone}"
        ),
        expected_output="Professional cost-benefit conclusion",
        agent=cost_benefit_analyst,
    )
    task_final = Task(
        description=(
            f"{lang_instruction}\n\n"
            f"{investor_profile_block}\n\n"
            "Combine the previous analyses (portfolio composition, risks, performance, cost-benefit) "
            "into a single professional summary report.\n"
            "Mandatory writing rules:\n"
            "- Do NOT open with a personal greeting ('Hello', 'I am the strategist...') – go straight to content\n"
            "- Use clear section headings (## Heading) for each section: Executive Summary, "
            "Portfolio Composition, Risk Analysis, Performance Analysis, Points for Consideration, Key Risks\n"
            "  (IMPORTANT: the section must be titled 'Points for Consideration' in English, "
            "or 'נקודות למחשבה' in Hebrew — NEVER 'Recommendations' or 'המלצות')\n"
            "- LANGUAGE OF ANALYSIS: use ONLY descriptive-analytical language. "
            "NEVER use imperative verbs ('buy', 'sell', 'you should', 'קנה', 'מכור', 'כדאי לך'). "
            "Instead use: 'Historical data suggests...', 'A scenario like X may suit an investor with Y risk profile...', "
            "'נתונים היסטוריים מראים ש...', 'תרחיש X עשוי להתאים למי שמאפיין סיכון Y...'\n"
            "- AVOID specific numeric action targets for immediate action "
            "(e.g. 'increase holding Y by 15% this week'). "
            "Use directional language only: 'increasing exposure to X could align with the stated risk tolerance, "
            "subject to the investor\\'s own judgment and further research'\n"
            "- Each point under 'Points for Consideration' / 'נקודות למחשבה' MUST end with a sentence "
            "reminding the reader that this is a starting point for personal research or consultation "
            "with a licensed professional, not a final conclusion\n"
            "- Professional tone, concise, third person – like an analyst research note, not a chat message\n"
            "- Always end the entire report with a disclaimer that this is automated AI analysis "
            "for educational/research purposes only and does not constitute licensed investment advice"
        ),
        expected_output=(
            f"Professional summary report in {'English' if language == 'en' else 'Hebrew'}, "
            "structured with section headings, no personal greetings. "
            "Section titled 'Points for Consideration' (not 'Recommendations'). "
            "No imperative buy/sell language. Each point ends with a research/consultation reminder."
        ),
        agent=chief_strategist,
        context=[task_portfolio, task_risk, task_return, task_cost_benefit],
    )
    task_target_allocation = Task(
        description=(
            f"{investor_profile_block}\n\n"
            "Based on all previous analyses and the investor profile (if provided), "
            "propose an updated numerical target allocation for the portfolio.\n"
            "Use only the tickers already in the portfolio "
            "(if recommending full sale of an asset, assign it weight 0).\n"
            "Weights must be numbers between 0 and 1 that sum to approximately 1 (100%).\n"
            f"Current tickers and weights: {portfolio_context_json}\n"
            "Return ONLY a valid JSON object, no additional text, no markdown fences, "
            'in this exact format: {"TICKER1": 0.30, "TICKER2": 0.15}'
        ),
        expected_output="JSON object only with recommended target weights per ticker",
        agent=cost_benefit_analyst,
        context=[task_portfolio, task_risk, task_return, task_cost_benefit],
    )

    logger.info("=== TASK FINAL DESCRIPTION START ===")
    logger.info(task_final.description)
    logger.info("=== TASK FINAL DESCRIPTION END ===")

    crew = Crew(
        agents=[portfolio_analyst, risk_analyst, return_analyst, cost_benefit_analyst, chief_strategist],
        tasks=[task_portfolio, task_risk, task_return, task_cost_benefit, task_final, task_target_allocation],
        process=Process.sequential,
        verbose=False,
    )

    try:
        crew.kickoff()
    except Exception as primary_e:
        logger.warning(f"Primary model failed, retrying with fallback: {primary_e}")
        fallback_llm = _build_llm(FALLBACK_MODEL)
        for agent in crew.agents:
            agent.llm = fallback_llm
        try:
            crew.kickoff()
        except Exception as fallback_e:
            import sentry_sdk
            sentry_sdk.capture_exception(fallback_e)
            logger.error(f"Fallback model also failed: {fallback_e}")
            raise

    report_text    = task_final.output.raw            if task_final.output            is not None else ""
    target_weights = parse_target_weights(task_target_allocation.output.raw) \
                     if task_target_allocation.output is not None else None

    return {"report_text": report_text, "target_weights": target_weights}