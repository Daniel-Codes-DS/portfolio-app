# =============================================================================
# test_flow.ps1 - בדיקת E2E מלאה מול Backend בפועל
# =============================================================================
#
# מריץ את הזרימה המלאה:
#   signup -> login -> create portfolio -> upload holdings -> run analysis
#   -> get PDF URL -> list history
#
# שימוש:
#   powershell -ExecutionPolicy Bypass -File backend\test_flow.ps1
#
# ברירת מחדל: production. לבדיקה מול localhost:
#   powershell -ExecutionPolicy Bypass -File backend\test_flow.ps1 -BaseUrl http://localhost:8000 -SupabaseUrl https://YOUR_PROJECT.supabase.co -SupabaseAnonKey YOUR_ANON_KEY
# =============================================================================

param(
    [string]$BaseUrl       = "https://portfolio-app-backend-45n4.onrender.com",
    [string]$SupabaseUrl   = "",   # חובה רק אם SupabaseAnonKey מסופק ידנית
    [string]$SupabaseAnonKey = ""  # אם לא מסופק, ינסה לקרוא מ-backend\.env
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"  # מהיר יותר - מסתיר progress bars של Invoke-WebRequest

# ---------------------------------------------------------------------------
# פונקציות עזר
# ---------------------------------------------------------------------------

function Write-Step {
    param([string]$msg)
    Write-Host "`n>>> $msg" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$msg)
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Fail {
    param([string]$msg)
    Write-Host "    FAIL: $msg" -ForegroundColor Red
    exit 1
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body       = $null,
        [string]$Token      = "",
        [string]$ContentType = "application/json"
    )
    $url = "$BaseUrl$Path"
    $headers = @{ "Content-Type" = $ContentType }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    $params = @{ Method = $Method; Uri = $url; Headers = $headers }
    if ($Body -ne $null) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    try {
        $resp = Invoke-WebRequest @params -UseBasicParsing
        return $resp.Content | ConvertFrom-Json
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $detail = ""
        try { $detail = $_.ErrorDetails.Message } catch {}
        Write-Fail "HTTP $statusCode on $Method $Path - $detail"
    }
}

function Invoke-SupabaseAuth {
    param([string]$Endpoint, [object]$Body)
    if (-not $SupabaseUrl) { Write-Fail "SupabaseUrl לא הוגדר (נדרש לשלב auth)" }
    $url = "$SupabaseUrl/auth/v1/$Endpoint"
    $headers = @{
        "Content-Type" = "application/json"
        "apikey"       = $SupabaseAnonKey
    }
    $bodyJson = ($Body | ConvertTo-Json -Compress)
    try {
        $resp = Invoke-WebRequest -Method POST -Uri $url -Headers $headers -Body $bodyJson -UseBasicParsing
        return $resp.Content | ConvertFrom-Json
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $detail = ""
        try { $detail = $_.ErrorDetails.Message } catch {}
        Write-Fail "Supabase auth $Endpoint failed: HTTP $statusCode - $detail"
    }
}

# ---------------------------------------------------------------------------
# קריאת פרטי Supabase מ-.env אם לא סופקו ידנית
# ---------------------------------------------------------------------------
if (-not $SupabaseUrl -or -not $SupabaseAnonKey) {
    $envFile = Join-Path $PSScriptRoot ".env"
    if (Test-Path $envFile) {
        Write-Host "קורא Supabase credentials מ-$envFile" -ForegroundColor DarkGray
        Get-Content $envFile | ForEach-Object {
            if ($_ -match "^\s*([^#][^=]*)=(.*)$") {
                $k = $Matches[1].Trim()
                $v = $Matches[2].Trim()
                if ($k -eq "SUPABASE_URL"      -and -not $SupabaseUrl)      { $script:SupabaseUrl = $v }
                # anon key - בד"כ לא נמצא ב-.env של ה-backend (שם SERVICE_KEY).
                # אם קיים ב-.env - קרא אותו. אחרת - המשתמש יצטרך להזין ידנית.
                if ($k -eq "SUPABASE_ANON_KEY"  -and -not $SupabaseAnonKey) { $script:SupabaseAnonKey = $v }
            }
        }
    }
}

if (-not $SupabaseAnonKey) {
    Write-Host @"

[!] לא נמצא SUPABASE_ANON_KEY אוטומטית.
    ה-anon key נמצא ב-Supabase Dashboard -> Settings -> API -> anon public.
    הדבק אותו כאן (Enter לאישור):
"@ -ForegroundColor Yellow
    $SupabaseAnonKey = Read-Host "SUPABASE_ANON_KEY"
}

if (-not $SupabaseUrl) {
    Write-Host "[!] לא נמצא SUPABASE_URL. הדבק (Enter לאישור):" -ForegroundColor Yellow
    $SupabaseUrl = Read-Host "SUPABASE_URL"
}

# ---------------------------------------------------------------------------
# יצירת פרטי בדיקה זמניים
# ---------------------------------------------------------------------------
$timestamp  = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail  = "testuser_$timestamp@example-test.com"
$testPass   = "TestPass123!_$timestamp"

Write-Host "`n==============================" -ForegroundColor White
Write-Host " E2E Test - $BaseUrl" -ForegroundColor White
Write-Host "==============================" -ForegroundColor White
Write-Host " משתמש בדיקה: $testEmail" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# שלב 0: /health
# ---------------------------------------------------------------------------
Write-Step "0. בדיקת /health"
$h = Invoke-Api -Method GET -Path "/health"
if ($h.status -ne "ok") { Write-Fail "health לא תקין: $($h | ConvertTo-Json)" }
Write-OK "status = ok"

# ---------------------------------------------------------------------------
# שלב 1: Signup
# ---------------------------------------------------------------------------
Write-Step "1. Signup"
$signupResp = Invoke-SupabaseAuth -Endpoint "signup" -Body @{
    email    = $testEmail
    password = $testPass
}
$accessToken = $signupResp.access_token
if (-not $accessToken) {
    # ייתכן שהמייל "קיים" (אם הסקריפט רץ פעמיים באותה שנייה) - ננסה login
    Write-Host "    signup לא החזיר access_token - מנסה login..." -ForegroundColor Yellow
    $loginResp   = Invoke-SupabaseAuth -Endpoint "token?grant_type=password" -Body @{
        email    = $testEmail
        password = $testPass
    }
    $accessToken = $loginResp.access_token
}
if (-not $accessToken) { Write-Fail "לא התקבל access_token" }
Write-OK "access_token התקבל (${($accessToken.Substring(0,20))}...)"

# ---------------------------------------------------------------------------
# שלב 2: יצירת תיק
# ---------------------------------------------------------------------------
Write-Step "2. יצירת תיק (POST /portfolios)"
$portfolio = Invoke-Api -Method POST -Path "/portfolios" -Token $accessToken -Body @{
    name                     = "תיק בדיקה E2E"
    investor_age             = 35
    investment_horizon_years = 10
    risk_tolerance           = "balanced"
    investment_goal          = "general_savings"
    liquidity_needs          = "medium"
}
$portfolioId = $portfolio.id
if (-not $portfolioId) { Write-Fail "לא התקבל portfolio id" }
Write-OK "portfolio_id = $portfolioId"

# ---------------------------------------------------------------------------
# שלב 3: הוספת אחזקות (PUT /portfolios/{id}/holdings)
# ---------------------------------------------------------------------------
Write-Step "3. הוספת אחזקות (PUT /{portfolio_id}/holdings)"
$holdingsResult = Invoke-Api -Method PUT -Path "/portfolios/$portfolioId/holdings" -Token $accessToken -Body @(
    @{ symbol = "AAPL"; quantity = 10; avg_price = 150.0 }
    @{ symbol = "MSFT"; quantity = 5;  avg_price = 300.0 }
    @{ symbol = "GOOGL"; quantity = 2; avg_price = 2800.0 }
)
Write-OK "count = $($holdingsResult.count)"

# ---------------------------------------------------------------------------
# שלב 4: קריאת התיק (GET /portfolios/{id})
# ---------------------------------------------------------------------------
Write-Step "4. קריאת התיק (GET /{portfolio_id})"
$portfolioData = Invoke-Api -Method GET -Path "/portfolios/$portfolioId" -Token $accessToken
if ($portfolioData.holdings.Count -lt 1) { Write-Fail "אחזקות לא נמצאו בתיק" }
Write-OK "$($portfolioData.holdings.Count) אחזקות נמצאו"

# ---------------------------------------------------------------------------
# שלב 5: ניסיון גישה של "משתמש זר" (בדיקת RLS)
# ---------------------------------------------------------------------------
Write-Step "5. בדיקת RLS - גישה עם טוקן שגוי לתיק קיים"
$bogusToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6ImZha2VAZmFrZS5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.bogus"
try {
    $badResp = Invoke-WebRequest -Method GET `
        -Uri "$BaseUrl/portfolios/$portfolioId" `
        -Headers @{ Authorization = "Bearer $bogusToken" } `
        -UseBasicParsing
    # אם הגענו לכאן - זו בעיה (לא אמור לחזור 200)
    Write-Fail "RLS כשל! גישה זרה החזירה 200 במקום 401/403/404"
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -in @(401, 403, 404)) {
        Write-OK "גישה זרה החזירה $sc כצפוי (RLS תקין)"
    } else {
        Write-Fail "RLS - קוד לא צפוי: $sc"
    }
}

# ---------------------------------------------------------------------------
# שלב 6: הרצת ניתוח (POST /portfolios/{id}/analysis)
# הערה: זה לוקח זמן (yfinance + LLM) - עד 2-3 דקות. אל תעצור!
# ---------------------------------------------------------------------------
Write-Step "6. הרצת ניתוח (POST /{portfolio_id}/analysis) - עלול לקחת 2-3 דקות..."
$analysis = Invoke-Api -Method POST -Path "/portfolios/$portfolioId/analysis" -Token $accessToken
$analysisId = $analysis.analysis_id
if (-not $analysisId) { Write-Fail "לא התקבל analysis_id" }
Write-OK "analysis_id = $analysisId"
if ($analysis.total_value) { Write-OK "total_value = $($analysis.total_value)" }
if ($analysis.sharpe_ratio) { Write-OK "sharpe_ratio = $($analysis.sharpe_ratio)" }

# ---------------------------------------------------------------------------
# שלב 7: קישור PDF
# ---------------------------------------------------------------------------
Write-Step "7. קישור PDF (GET /{portfolio_id}/analysis/{analysis_id}/pdf-url)"
$pdfResp = Invoke-Api -Method GET -Path "/portfolios/$portfolioId/analysis/$analysisId/pdf-url" -Token $accessToken
$pdfUrl = $pdfResp.url
if (-not $pdfUrl) { Write-Fail "לא התקבל PDF URL" }
Write-OK "PDF URL: $($pdfUrl.Substring(0, [Math]::Min(80, $pdfUrl.Length)))..."

# ---------------------------------------------------------------------------
# שלב 8: היסטוריה
# ---------------------------------------------------------------------------
Write-Step "8. היסטוריית ניתוחים (GET /{portfolio_id}/analysis)"
$history = Invoke-Api -Method GET -Path "/portfolios/$portfolioId/analysis" -Token $accessToken
if ($history.Count -lt 1) { Write-Fail "היסטוריה ריקה - הניתוח לא נשמר" }
Write-OK "$($history.Count) ניתוחים בהיסטוריה"

# ---------------------------------------------------------------------------
# שלב 9: rate limit (cooldown)
# ---------------------------------------------------------------------------
Write-Step "9. בדיקת rate limit - ניסיון ניתוח מיידי שני (אמור לקבל 429)"
try {
    $rl = Invoke-WebRequest -Method POST `
        -Uri "$BaseUrl/portfolios/$portfolioId/analysis" `
        -Headers @{ Authorization = "Bearer $accessToken"; "Content-Type" = "application/json" } `
        -UseBasicParsing
    Write-Fail "rate limit לא עבד - בקשה שנייה החזירה 200"
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 429) {
        Write-OK "rate limit תקין - קיבלנו 429"
    } else {
        Write-Fail "rate limit - קוד לא צפוי: $sc"
    }
}

# ---------------------------------------------------------------------------
# שלב 10: Cash Recommendation
# ---------------------------------------------------------------------------
Write-Step "10. המלצת פיזור מזומן (POST /recommendations/cash-allocation)"
$cashResp = Invoke-Api -Method POST -Path "/recommendations/cash-allocation" -Token $accessToken -Body @{
    cash_amount              = 50000
    investor_age             = 35
    investment_horizon_years = 10
    risk_tolerance           = "balanced"
    investment_goal          = "general_savings"
    liquidity_needs          = "medium"
    portfolio_id             = $portfolioId
}
if (-not $cashResp) { Write-Fail "לא התקבלה תשובה מ-cash-allocation" }
Write-OK "המלצת פיזור מזומן התקבלה"

# ---------------------------------------------------------------------------
# סיכום
# ---------------------------------------------------------------------------
Write-Host "`n==============================" -ForegroundColor White
Write-Host " כל הבדיקות עברו בהצלחה! " -ForegroundColor Green
Write-Host "==============================`n" -ForegroundColor White
Write-Host "portfolio_id  = $portfolioId" -ForegroundColor DarkGray
Write-Host "analysis_id   = $analysisId" -ForegroundColor DarkGray
Write-Host "PDF URL       = $($pdfUrl.Substring(0, [Math]::Min(60, $pdfUrl.Length)))..." -ForegroundColor DarkGray
Write-Host ""
Write-Host "הערה: משתמש הבדיקה ($testEmail) נשאר ב-Supabase." -ForegroundColor DarkGray
Write-Host "למחיקה: Supabase Dashboard -> Authentication -> Users -> מחק ידנית." -ForegroundColor DarkGray
