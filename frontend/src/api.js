const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function request(path, { method = "GET", token, body, isFormData = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  listPortfolios: (token) => request("/portfolios", { token }),

  // payload = { name, holdings?, investor_age?, investment_horizon_years?,
  //             risk_tolerance?, investment_goal?, liquidity_needs? }
  // Dashboard.jsx כבר מכין את ה-payload הנכון - כאן פשוט מעבירים הלאה
  createPortfolio: (token, payload) =>
    request("/portfolios", { method: "POST", token, body: { holdings: [], ...payload } }),

  // עדכון פרופיל תיק קיים (PATCH - partial update, רק שדות שסופקו)
  updatePortfolio: (token, id, payload) =>
    request(`/portfolios/${id}`, { method: "PATCH", token, body: payload }),

  getPortfolio: (token, id) => request(`/portfolios/${id}`, { token }),

  uploadFile: (token, id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/portfolios/${id}/upload`, {
      method: "POST",
      token,
      body: formData,
      isFormData: true,
    });
  },

  runAnalysis: (token, id) => request(`/portfolios/${id}/analysis`, { method: "POST", token }),
  getHistory: (token, id) => request(`/portfolios/${id}/analysis`, { token }),
  getAnalysis: (token, portfolioId, analysisId) =>
    request(`/portfolios/${portfolioId}/analysis/${analysisId}`, { token }),
  getPdfUrl: (token, portfolioId, analysisId) =>
    request(`/portfolios/${portfolioId}/analysis/${analysisId}/pdf-url`, { token }),
};