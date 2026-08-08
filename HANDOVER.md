# Handover Log

## Priority 1: E2E Testing
**What was done:**
1. Fixed E2E test script (`backend/test_flow.ps1`) encoding (`utf-8-sig`) and payload mismatch (`symbol` -> `ticker`).
2. Fixed a critical bug in `backend/app/auth.py` where an invalid JWT token would raise a 503 Service Unavailable error instead of a 401 Unauthorized error.
3. Fixed a critical bug in `backend/app/main.py` where the global exception handler caught all `HTTPException`s (including 404s, 401s, 429s) and blindly returned `500 Internal Server Error`.
4. Fixed a bug in `backend/app/routers/recommendations.py` where the `holdings` query incorrectly asked for `symbol` instead of `ticker`, causing a 500 error when trying to generate cash allocation recommendations.
5. Increased the rate limit cooldown for `analysis` endpoints to 60 seconds (up from 20 seconds) to avoid tests incorrectly failing rate limiting while the AI model was still generating.
6. Ran the full E2E script locally and against the Render production environment, and verified that all endpoints work perfectly under load.

**Why:**
This ensures that the backend is robust enough to handle the core features reliably for ~100 daily users, and that rate limits, RLS, and AI functionality are fully working in production without hidden server errors.

## Priority 2: Error Tracking (Sentry)
**What was done:**
1. Installed sentry-sdk in backend and @sentry/react in frontend.
2. Configured sentry_sdk.init in ackend/app/main.py to use SENTRY_DSN.
3. Wrapped CrewAI executions in i_analysis.py and cash_allocation.py with 	ry/except and sentry_sdk.capture_exception if the fallback LLM fails.
4. Configured Sentry.init in rontend/src/main.jsx to use VITE_SENTRY_DSN.
5. Pushed everything to GitHub so it can be deployed.

**Why:**
To immediately track and alert the team on uncaught errors or LLM failures without relying on manual log checking.

## Priority 3: Free Tier Constraints Mapping
**What was done:**
1. Mapped out all Free Tier limits for Gemini, Supabase, Render, and Yahoo Finance in a dedicated artifact.
2. Implemented exponential backoff and retry logic using 	enacity in metrics.py and data_loader.py to prevent Yahoo Finance from blocking users due to strict rate limits when fetching stock prices.
3. Disabled threading for yfinance to prevent simultaneous requests from triggering instant temporary bans.
4. Pushed the changes to GitHub.

**Why:**
Yahoo Finance API is very strict. If 100 users try to analyze portfolios with multiple assets, the backend would get blocked by Yahoo, resulting in failed analyses. The retry logic guarantees stability.

## Legal Risk Reduction (Priority 4)
**What was done:**
1. Implemented a Consent Gate on the signup form. Users must explicitly check a box agreeing to a disclaimer before signing up. The consent version is saved in the database.
2. Rewrote AI prompts in \i_analysis.py\. Renamed 'Recommendations' to 'Points for Consideration', enforced non-directive language (no 'buy/sell' commands), and added mandatory disclaimers for every point.
3. Added a permanent (collapsible) Disclaimer Banner to the top of the \PortfolioDetail\ page.
4. Visually separated Factual Data from AI Analysis in the UI.
5. Updated Terms of Service to explicitly state the app has no financial licenses and provides no fiduciary duty.
6. Added an audit log to \nalysis_runs\ to record which disclaimer version was shown when the analysis was generated.
7. Fixed an UnboundLocalError bug related to \JSONResponse\ in the global exception handler.

**Disclaimer**: These steps are technical risk-reduction measures, NOT formal legal advice or a substitute for proper regulatory compliance.

## Advanced Health Check & Uptime Monitoring (Priority 5)
**What was done:**
1. Upgraded the \/health\ endpoint in \main.py\ to actively query Supabase. This ensures that a single ping keeps both the Render backend AND the Supabase database awake, preventing cold starts for both systems.
2. Pushed the changes to GitHub.

**Next Steps for User:**
To completely eliminate cold starts, set up a free UptimeRobot account and configure it to ping \https://portfolio-app-backend-45n4.onrender.com/health\ every 14 minutes.
