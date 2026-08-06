"""
Cash allocation recommendation engine.
All internal prompts are in English for AI quality.
Output language (summary_text, reasoning) is controlled by the `language` parameter.
"""

import json
import logging
import re
from typing import Optional, List, Dict
from crewai import Agent, Task, Crew, Process, LLM
from app.config import PRIMARY_MODEL, FALLBACK_MODEL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Asset category definitions (internal key → display label per language)
# ---------------------------------------------------------------------------
VALID_CATEGORIES = {
    "equity_index":      {"en": "Equity Index Funds",    "he": "מדדי מניות"},
    "individual_stocks": {"en": "Individual Stocks",     "he": "מניות בודדות"},
    "bonds_government":  {"en": "Government Bonds",      "he": "אג'ח ממשלתי"},
    "bonds_corporate":   {"en": "Corporate Bonds",       "he": "אג'ח קונצרני"},
    "reit":              {"en": "Real Estate / REITs",   "he": "נדל\"ן / REIT"},
    "cash_deposit":      {"en": "Cash / Deposits",       "he": "מזומן / פיקדון"},
}

_LANG_INSTRUCTION = {
    "en": "CRITICAL INSTRUCTION: You MUST write ALL text fields (summary_text and reasoning) entirely in ENGLISH. Do NOT output Hebrew.",
    "he": "CRITICAL INSTRUCTION: You MUST write ALL text fields (summary_text and reasoning) entirely in HEBREW. Do NOT output English.",
}


def _build_llm(model_name: str) -> LLM:
    return LLM(model=model_name, temperature=0.3)


def recommend_cash_allocation(
    cash_amount: float,
    investor_age: Optional[int] = None,
    investment_horizon_years: Optional[int] = None,
    risk_tolerance: Optional[str] = None,
    investment_goal: Optional[str] = None,
    liquidity_needs: Optional[str] = None,
    existing_holdings: Optional[List[Dict]] = None,
    language: str = "en",
) -> dict:
    if cash_amount <= 0:
        raise ValueError("cash_amount must be greater than 0")

    lang_instruction = _LANG_INSTRUCTION.get(language, _LANG_INSTRUCTION["en"])

    # Build investor profile context (English)
    profile_lines = []
    if investor_age             is not None: profile_lines.append(f"- Age: {investor_age}")
    if investment_horizon_years is not None: profile_lines.append(f"- Investment horizon: {investment_horizon_years} years")
    if risk_tolerance:                        profile_lines.append(f"- Risk tolerance: {risk_tolerance}")
    if investment_goal:                       profile_lines.append(f"- Investment goal: {investment_goal}")
    if liquidity_needs:                       profile_lines.append(f"- Liquidity needs: {liquidity_needs}")

    profile_context = "\n".join(profile_lines) if profile_lines else "No investor profile provided."

    holdings_context = (
        f"Existing portfolio holdings (avoid over-concentration):\n"
        + json.dumps(existing_holdings, ensure_ascii=False, indent=2)
        if existing_holdings
        else "No existing portfolio (recommendation in isolation)."
    )

    # Show category keys + English label in the prompt (AI understands English best)
    categories_list_str = "\n".join(
        [f"- `{k}` ({v['en']})" for k, v in VALID_CATEGORIES.items()]
    )

    llm = _build_llm(PRIMARY_MODEL)

    asset_allocator = Agent(
        role="Asset Allocation Specialist",
        goal="Recommend an optimal allocation of new cash across asset categories",
        backstory=(
            "Senior analyst specialising in asset allocation and building personalised portfolios. "
            "Expert in balancing risk, return, and liquidity based on investor profiles."
        ),
        llm=llm,
    )

    prompt_description = f"""
You must recommend how to allocate a new cash amount of {cash_amount:,.2f} across asset categories.

### Allowed categories only:
{categories_list_str}

### Investor profile:
{profile_context}

### Existing portfolio context:
{holdings_context}

### Language instruction:
{lang_instruction}

### Critical rules:
1. Return ONLY a valid JSON object – no markdown fences (no ```json).
2. Do NOT use double-quotes (") inside text values – use a single-quote (') for abbreviations to avoid breaking JSON.
3. Assign a percentage (0–100) to each recommended category.
4. All percentages must sum to exactly 100.
5. Write a short reasoning (2-3 sentences) for each category using the language instruction above.
6. Include a `summary_text` field: a 3-4 sentence strategic overview.

Required JSON format:
{{
  "summary_text": "Strategic overview...",
  "allocation": [
    {{"category": "equity_index",    "percentage": 40.0, "reasoning": "..."}},
    {{"category": "bonds_government","percentage": 60.0, "reasoning": "..."}}
  ]
}}
"""

    task = Task(
        description=prompt_description,
        expected_output="JSON object only in the required format",
        agent=asset_allocator,
    )

    crew = Crew(agents=[asset_allocator], tasks=[task], process=Process.sequential, verbose=False)

    try:
        crew.kickoff()
        raw_output = task.output.raw
    except Exception as e:
        logger.warning(f"Primary model failed, retrying with fallback: {e}")
        asset_allocator.llm = _build_llm(FALLBACK_MODEL)
        crew.kickoff()
        raw_output = task.output.raw

    return _parse_and_calculate_allocation(raw_output, cash_amount, language)


def _parse_and_calculate_allocation(raw_text: str, cash_amount: float, language: str = "en") -> dict:
    text = raw_text.strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Extract outermost JSON object
    start_idx = text.find("{")
    end_idx   = text.rfind("}")
    if start_idx != -1 and end_idx != -1:
        text = text[start_idx : end_idx + 1]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            # Auto-fix internal double-quotes inside Hebrew/Latin words
            fixed_text = re.sub(r'(?<=[^\s{[:,\[])\"(?=[^\s}:,\]])', "'", text)
            data = json.loads(fixed_text)
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse LLM JSON. Raw output:\n{raw_text}")
            raise ValueError(f"Invalid JSON format received from AI: {err}")

    raw_allocation = data.get("allocation", [])
    default_summary = "Personalised cash allocation recommendation." if language == "en" \
                      else "המלצת פיזור מזומן מותאמת אישית."
    summary_text   = data.get("summary_text", default_summary)

    if not raw_allocation:
        raise ValueError("LLM returned no allocation categories")

    valid_items = [
        {"category": item["category"], "percentage": float(item.get("percentage", 0)),
         "reasoning": item.get("reasoning", "")}
        for item in raw_allocation
        if item.get("category") in VALID_CATEGORIES and float(item.get("percentage", 0)) > 0
    ]

    if not valid_items:
        raise ValueError("No valid allocation categories remain after filtering")

    total_pct = sum(i["percentage"] for i in valid_items)
    if abs(total_pct - 100.0) > 15.0:
        raise ValueError(f"LLM allocation percentages deviate too much from 100%: {total_pct}%")

    processed_allocation = [
        {
            "category":       item["category"],
            # category_label in the requested display language
            "category_label": VALID_CATEGORIES[item["category"]].get(language, VALID_CATEGORIES[item["category"]]["en"]),
            "percentage":     round((item["percentage"] / total_pct) * 100, 2),
            "amount":         round(((item["percentage"] / total_pct) * cash_amount), 2),
            "reasoning":      item["reasoning"],
        }
        for item in valid_items
    ]

    return {
        "cash_amount":  cash_amount,
        "summary_text": summary_text,
        "allocation":   processed_allocation,
    }