"""
PDF report generator – language-aware.
- language="he": RTL layout, bidi reordering, Hebrew font (existing behaviour)
- language="en": LTR layout, standard Helvetica, no bidi (simpler path)
"""

import io
import os
import re
from datetime import datetime
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Image as RLImage, PageBreak, Table, TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

LOGO_PATH = os.environ.get("LOGO_PATH", "")

# ---------------------------------------------------------------------------
# Hebrew font registration (lazy, cached)
# ---------------------------------------------------------------------------
_FONT_CANDIDATES = [
    os.environ.get("HEBREW_FONT_PATH", ""),
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\david.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
_registered_hebrew_font = None


def _register_hebrew_font() -> str:
    global _registered_hebrew_font
    if _registered_hebrew_font:
        return _registered_hebrew_font
    for path in _FONT_CANDIDATES:
        if path and os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("HebrewFont", path))
                _registered_hebrew_font = "HebrewFont"
                return _registered_hebrew_font
            except Exception:
                continue
    _registered_hebrew_font = "Helvetica"
    return _registered_hebrew_font


def _rtl(text: str) -> str:
    """Apply Unicode bidi algorithm for Hebrew RTL display in PDF."""
    from bidi.algorithm import get_display
    return "\n".join(get_display(line) for line in text.split("\n"))


# ---------------------------------------------------------------------------
# Disclaimer footers
# ---------------------------------------------------------------------------
_DISCLAIMER = {
    "en": (
        "\n\n---\n"
        "**Disclaimer:** This is an automated AI-based analysis for personal research purposes only. "
        "It does not constitute investment advice, tax advice, or any form of licensed financial advice. "
        "Consult a licensed professional before making any investment decisions."
    ),
    "he": (
        "\n\n---\n"
        "**הבהרה:** זהו ניתוח אוטומטי המבוסס על בינה מלאכותית, לצרכי מחקר אישי בלבד. "
        "אין לראות בתוכן ייעוץ השקעות, ייעוץ מס, או ייעוץ פיננסי מוסמך. "
        "מומלץ להתייעץ עם בעל רישיון מתאים לפני קבלת החלטות השקעה."
    ),
}

_REPORT_TITLE = {
    "en": "Portfolio Analysis Report",
    "he": "דוח ניתוח תיק השקעות",
}
_GENERATED_AT = {
    "en": lambda dt: f"Auto-generated – {dt}",
    "he": lambda dt: f"הופק אוטומטית - {dt}",
}
_METRIC_LABELS = {
    "en": ["Total Portfolio Value", "Historical Annual Return", "Annual Volatility", "Sharpe Ratio"],
    "he": ["שווי תיק כולל", "תשואה שנתית היסטורית", "תנודתיות שנתית", "Sharpe Ratio"],
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_pdf_report(
    report_text: str,
    summary_df,
    charts: dict,
    total_value,
    ann_return,
    ann_vol,
    sharpe,
    language: str = "en",
) -> bytes:
    """
    Generate a PDF report.
    language="en" → LTR, Helvetica, no bidi.
    language="he" → RTL, Hebrew font, bidi reordering.
    """
    is_rtl = language == "he"

    if is_rtl:
        font_name  = _register_hebrew_font()
        alignment  = TA_RIGHT
        h_align    = "RIGHT"
        process    = _rtl
    else:
        font_name  = "Helvetica"
        alignment  = TA_LEFT
        h_align    = "LEFT"
        process    = lambda t: t  # no bidi for English

    style_title = ParagraphStyle("Title",   fontName=font_name, fontSize=20, alignment=alignment, spaceAfter=6)
    style_h2    = ParagraphStyle("H2",      fontName=font_name, fontSize=14, alignment=alignment, spaceBefore=14, spaceAfter=6)
    style_body  = ParagraphStyle("Body",    fontName=font_name, fontSize=10.5, alignment=alignment, leading=16)
    style_small = ParagraphStyle("Small",   fontName=font_name, fontSize=8.5, alignment=alignment, textColor="#666666")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm,
    )
    story = []

    if LOGO_PATH and os.path.exists(LOGO_PATH):
        story.append(RLImage(LOGO_PATH, width=35 * mm, height=35 * mm, kind="proportional"))
        story.append(Spacer(1, 6))

    dt_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    story.append(Paragraph(process(_REPORT_TITLE[language]),        style_title))
    story.append(Paragraph(process(_GENERATED_AT[language](dt_str)), style_small))
    story.append(Spacer(1, 12))

    # Summary metrics table
    labels = _METRIC_LABELS[language]
    summary_rows = [
        [f"{total_value:,.0f}",                                             process(labels[0])],
        [f"{ann_return * 100:.1f}%" if pd.notna(ann_return) else "-",      process(labels[1])],
        [f"{ann_vol * 100:.1f}%"   if pd.notna(ann_vol)    else "-",       process(labels[2])],
        [f"{sharpe:.2f}"           if pd.notna(sharpe)     else "-",       process(labels[3])],
    ]
    # For RTL the value column is on the left, label on the right (natural reading)
    # For LTR: label left, value right
    if is_rtl:
        col_widths = [40 * mm, 80 * mm]
        bg_start, bg_end = (1, 0), (1, -1)
    else:
        col_widths = [80 * mm, 40 * mm]
        summary_rows = [[label, value] for value, label in summary_rows]
        bg_start, bg_end = (0, 0), (0, -1)

    table = Table(summary_rows, colWidths=col_widths, hAlign=h_align)
    table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), font_name),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("ALIGN",         (0, 0), (-1, -1), h_align),
        ("GRID",          (0, 0), (-1, -1), 0.5, "#dddddd"),
        ("BACKGROUND",    bg_start, bg_end, "#f5f5f5"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    # Report body text
    disclaimer = _DISCLAIMER.get(language, _DISCLAIMER["en"])
    full_text  = report_text.rstrip() + disclaimer

    for line in full_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 4))
            continue
        if stripped.startswith("## ") or stripped.startswith("### "):
            title = stripped.lstrip("#").strip()
            story.append(Paragraph(process(title), style_h2))
        elif re.match(r"^\d+\.\s", stripped):
            story.append(Paragraph(process(stripped), style_body))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            story.append(Paragraph(process("\u2022 " + stripped[2:]), style_body))
        elif stripped == "---":
            story.append(Spacer(1, 8))
        else:
            clean = stripped.replace("**", "")
            story.append(Paragraph(process(clean), style_body))

    # Charts (one per page)
    for _name, img_bytes in charts.items():
        story.append(PageBreak())
        story.append(RLImage(io.BytesIO(img_bytes), width=170 * mm, height=170 * mm * 0.72, kind="proportional"))

    doc.build(story)
    return buf.getvalue()