"""
יצירת דוח PDF מעוצב - זהה ללוגיקה שכבר נבדקה בסוכן המייל.
"""

import io
import os
import re
from datetime import datetime
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, PageBreak, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display

DISCLAIMER_FOOTER = (
    "\n\n---\n"
    "**הבהרה:** זהו ניתוח אוטומטי המבוסס על בינה מלאכותית, לצרכי מחקר אישי בלבד. "
    "אין לראות בתוכן ייעוץ השקעות, ייעוץ מס, או ייעוץ פיננסי מוסמך. "
    "מומלץ להתייעץ עם בעל רישיון מתאים לפני קבלת החלטות השקעה."
)

LOGO_PATH = os.environ.get("LOGO_PATH", "")

# שינוי היחיד בקובץ הזה לעומת המקור: הוספת NotoSansHebrew-Regular.ttf לרשימה,
# *לפני* ה-DejaVu הקיים. DejaVuSans.ttf (הבא ברשימה אחריו) אינו תומך בגליפים
# עבריים בכלל - הוא נשאר רק כרשת ביטחון אחרונה (עדיף רינדור שגוי-אך-לא-קורס
# על פני קריסה מוחלטת), אבל בפועל, בתוך ה-container (שמתקין fonts-noto-core -
# ראו backend/Dockerfile), הנתיב של Noto Sans Hebrew יימצא ראשון ברשימה
# ויירשם בהצלחה - כך שהעברית תוצג נכון גם בלינוקס, לא רק ב-Windows המקומי.
_FONT_CANDIDATES = [
    os.environ.get("HEBREW_FONT_PATH", ""),
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\david.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",  # לינוקס/Docker - תומך עברית באמת
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # רשת ביטחון אחרונה - לא תומך עברית, רק מונע קריסה
]

_registered_font_name = None


def _register_hebrew_font():
    global _registered_font_name
    if _registered_font_name:
        return _registered_font_name
    for path in _FONT_CANDIDATES:
        if path and os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("HebrewFont", path))
                _registered_font_name = "HebrewFont"
                return _registered_font_name
            except Exception:
                continue
    _registered_font_name = "Helvetica"
    return _registered_font_name


def _rtl(text):
    return "\n".join(get_display(line) for line in text.split("\n"))


def generate_pdf_report(report_text, summary_df, charts, total_value, ann_return, ann_vol, sharpe):
    font_name = _register_hebrew_font()

    style_title = ParagraphStyle("TitleRTL", fontName=font_name, fontSize=20, alignment=TA_RIGHT, spaceAfter=6)
    style_h2 = ParagraphStyle("H2RTL", fontName=font_name, fontSize=14, alignment=TA_RIGHT, spaceBefore=14, spaceAfter=6)
    style_body = ParagraphStyle("BodyRTL", fontName=font_name, fontSize=10.5, alignment=TA_RIGHT, leading=16)
    style_small = ParagraphStyle("SmallRTL", fontName=font_name, fontSize=8.5, alignment=TA_RIGHT, textColor="#666666")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm,
                             leftMargin=18 * mm, rightMargin=18 * mm)
    story = []

    if LOGO_PATH and os.path.exists(LOGO_PATH):
        story.append(RLImage(LOGO_PATH, width=35 * mm, height=35 * mm, kind="proportional"))
        story.append(Spacer(1, 6))

    story.append(Paragraph(_rtl("דוח ניתוח תיק השקעות"), style_title))
    story.append(Paragraph(_rtl(f"הופק אוטומטית - {datetime.now().strftime('%d/%m/%Y %H:%M')}"), style_small))
    story.append(Spacer(1, 12))

    summary_rows = [
        [f"{total_value:,.0f}", _rtl("שווי תיק כולל")],
        [f"{ann_return * 100:.1f}%" if pd.notna(ann_return) else "-", _rtl("תשואה שנתית היסטורית")],
        [f"{ann_vol * 100:.1f}%" if pd.notna(ann_vol) else "-", _rtl("תנודתיות שנתית")],
        [f"{sharpe:.2f}" if pd.notna(sharpe) else "-", _rtl("Sharpe Ratio")],
    ]
    table = Table(summary_rows, colWidths=[40 * mm, 80 * mm], hAlign="RIGHT")
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, "#dddddd"),
        ("BACKGROUND", (1, 0), (1, -1), "#f5f5f5"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    full_text = report_text.rstrip() + DISCLAIMER_FOOTER
    for line in full_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 4))
            continue
        if stripped.startswith("## ") or stripped.startswith("### "):
            title = stripped.lstrip("#").strip()
            story.append(Paragraph(_rtl(title), style_h2))
        elif re.match(r"^\d+\.\s", stripped):
            story.append(Paragraph(_rtl(stripped), style_body))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            story.append(Paragraph(_rtl("\u2022 " + stripped[2:]), style_body))
        elif stripped == "---":
            story.append(Spacer(1, 8))
        else:
            clean = stripped.replace("**", "")
            story.append(Paragraph(_rtl(clean), style_body))

    for _name, img_bytes in charts.items():
        story.append(PageBreak())
        story.append(RLImage(io.BytesIO(img_bytes), width=170 * mm, height=170 * mm * 0.72, kind="proportional"))

    doc.build(story)
    return buf.getvalue()