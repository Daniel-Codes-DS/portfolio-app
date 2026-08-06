# Dockerfile for portfolio-app/backend
# Place this file at: portfolio-app/backend/Dockerfile
#
# Roadmap item: 13.1 #3 (Containerization)

FROM python:3.12-slim

# System dependencies:
# - fonts-noto-core: provides Hebrew-capable fonts (Noto Sans Hebrew). This replaces the
#   Windows-specific Arial/Tahoma font registration used by engine/pdf_report.py
#   (_register_hebrew_font), which will NOT exist inside this Linux container.
# - build-essential: a few Python packages (matplotlib, pandas, etc.) sometimes need to
#   compile native extensions if a prebuilt wheel isn't available for this exact platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-noto-core \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies in their own layer first, so `docker build` reuses this
# cached layer whenever only application code changes (not requirements.txt).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the backend application code.
COPY . .

EXPOSE 8000

# Render (and most PaaS providers) inject the port to bind to via the $PORT env var.
# Default to 8000 for local `docker run` usage where $PORT isn't set.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

# ==============================================================================
# !!! ACTION REQUIRED BEFORE THIS IS PRODUCTION-READY !!!
# ==============================================================================
# engine/pdf_report.py registers a Hebrew-capable font by pointing at a Windows font
# path (Arial/Tahoma - see HANDOVER section 2ब / "reportlab + python-bidi"). That path
# does not exist inside this Linux container, so Hebrew PDF generation WILL likely break
# or silently fall back to a font without Hebrew glyphs (garbled/boxes instead of text).
#
# Fix needed in engine/pdf_report.py's _register_hebrew_font() function:
#   1. Add a Linux-compatible font path as a fallback, e.g.
#      /usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf
#      (installed above via the fonts-noto-core apt package - confirm the exact
#      installed filename with: `fc-list | grep -i hebrew` inside the container)
#   2. Try the Windows path first (keeps local Windows dev working unchanged), then
#      fall back to the Linux path if the Windows path doesn't exist, then raise a
#      clear error if neither is found (do not fail silently - a wrong font produces
#      unreadable Hebrew PDFs, which is worse than a startup error).
#
# This file (Dockerfile) does not touch engine/pdf_report.py - that change needs the
# actual file content to edit safely. Generate a real PDF with Hebrew report_text
# inside the built container and visually confirm the Hebrew renders correctly
# before relying on this in production.
# ==============================================================================
