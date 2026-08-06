"""
יצירת 4 גרפים מקצועיים - זהה ללוגיקה שכבר נבדקה בסוכן המייל.
כותרות/תוויות באנגלית בכוונה: ל-matplotlib אין תמיכה טובה ב-RTL בעברית.
"""

import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

PALETTE = ["#2a78d6", "#1baf7a", "#e0a72e", "#d6534a", "#8b5fbf", "#3ba3c4", "#c47f3b", "#5c8a3a"]


def _style_axes(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="x", color="#e1e0d9", linewidth=0.6, zorder=0)
    ax.set_axisbelow(True)


def generate_allocation_charts(summary_df, target_weights, corr_matrix=None):
    """מייצר עד 4 גרפים מקצועיים, מוחזרים כ-{שם_קובץ: בייטים PNG}."""
    charts = {}
    plt.rcParams.update({"font.size": 11, "figure.dpi": 150})

    # --- גרף 1: הקצאה נוכחית (donut chart) ---
    df_sorted = summary_df.sort_values("weight", ascending=False).reset_index(drop=True)
    colors = [PALETTE[i % len(PALETTE)] for i in range(len(df_sorted))]

    fig1, ax1 = plt.subplots(figsize=(7, 7))
    wedges, _, autotexts = ax1.pie(
        df_sorted["weight"], labels=None, autopct="%1.1f%%", pctdistance=0.82,
        colors=colors, startangle=90, wedgeprops={"width": 0.4, "edgecolor": "white", "linewidth": 2},
    )
    for at in autotexts:
        at.set_fontsize(9)
        at.set_color("white")
    ax1.legend(wedges, df_sorted["ticker"], title="Ticker", loc="center left",
               bbox_to_anchor=(1.02, 0.5), frameon=False)
    ax1.set_title("Current Portfolio Allocation", fontsize=14, fontweight="bold", pad=16)
    buf1 = io.BytesIO()
    fig1.savefig(buf1, format="png", bbox_inches="tight")
    plt.close(fig1)
    charts["1_current_allocation.png"] = buf1.getvalue()

    # --- גרף 2: השוואה נוכחי מול מומלץ ---
    if target_weights:
        all_tickers = sorted(
            set(summary_df["ticker"]) | set(target_weights.keys()),
            key=lambda t: -summary_df.set_index("ticker")["weight"].get(t, 0),
        )
        current_pct = [summary_df.set_index("ticker")["weight"].get(t, 0) * 100 for t in all_tickers]
        target_pct = [target_weights.get(t, 0) * 100 for t in all_tickers]

        y_pos = list(range(len(all_tickers)))
        bar_h = 0.36

        fig2, ax2 = plt.subplots(figsize=(9, max(4, 0.55 * len(all_tickers))))
        ax2.barh([y + bar_h / 2 for y in y_pos], current_pct, height=bar_h, color=PALETTE[0], label="Current")
        ax2.barh([y - bar_h / 2 for y in y_pos], target_pct, height=bar_h, color=PALETTE[1], label="Recommended")

        for y, v in zip(y_pos, current_pct):
            ax2.text(v + 0.4, y + bar_h / 2, f"{v:.1f}%", va="center", fontsize=8.5, color="#333")
        for y, v in zip(y_pos, target_pct):
            ax2.text(v + 0.4, y - bar_h / 2, f"{v:.1f}%", va="center", fontsize=8.5, color="#333")

        ax2.set_yticks(y_pos)
        ax2.set_yticklabels(all_tickers)
        ax2.invert_yaxis()
        ax2.set_xlabel("Weight in portfolio (%)")
        ax2.set_title("Current vs. Recommended Allocation", fontsize=14, fontweight="bold", pad=16)
        ax2.legend(frameon=False, loc="lower right")
        _style_axes(ax2)

        buf2 = io.BytesIO()
        fig2.savefig(buf2, format="png", bbox_inches="tight")
        plt.close(fig2)
        charts["2_current_vs_recommended.png"] = buf2.getvalue()

    # --- גרף 3: סיכון מול תשואה לכל נכס ---
    scatter_df = summary_df.dropna(subset=["annual_vol_hist", "annual_return_hist"])
    if not scatter_df.empty:
        fig3, ax3 = plt.subplots(figsize=(8, 6))
        sizes = (scatter_df["weight"] * 4000).clip(lower=80)
        ax3.scatter(
            scatter_df["annual_vol_hist"] * 100, scatter_df["annual_return_hist"] * 100,
            s=sizes, c=[PALETTE[i % len(PALETTE)] for i in range(len(scatter_df))],
            alpha=0.75, edgecolors="white", linewidth=1.2, zorder=3,
        )
        for _, r in scatter_df.iterrows():
            ax3.annotate(r["ticker"], (r["annual_vol_hist"] * 100, r["annual_return_hist"] * 100),
                         xytext=(6, 6), textcoords="offset points", fontsize=9)

        ax3.axhline(0, color="#999", linewidth=0.8, zorder=1)
        ax3.set_xlabel("Annual Volatility (%)")
        ax3.set_ylabel("Annual Return (%)")
        ax3.set_title("Risk vs. Return by Position", fontsize=14, fontweight="bold", pad=16)
        ax3.text(0.98, 0.02, "Bubble size = weight in portfolio", transform=ax3.transAxes,
                 ha="right", va="bottom", fontsize=8.5, color="#777", style="italic")
        _style_axes(ax3)

        buf3 = io.BytesIO()
        fig3.savefig(buf3, format="png", bbox_inches="tight")
        plt.close(fig3)
        charts["3_risk_return.png"] = buf3.getvalue()

    # --- גרף 4: מטריצת קורלציות ---
    if corr_matrix is not None and len(corr_matrix) > 1:
        n = len(corr_matrix)
        fig4, ax4 = plt.subplots(figsize=(max(6, 0.65 * n), max(5, 0.6 * n)))
        im = ax4.imshow(corr_matrix.values, cmap="RdBu_r", vmin=-1, vmax=1)
        ax4.set_xticks(range(len(corr_matrix.columns)))
        ax4.set_xticklabels(corr_matrix.columns, rotation=45, ha="right")
        ax4.set_yticks(range(len(corr_matrix.index)))
        ax4.set_yticklabels(corr_matrix.index)
        for i in range(len(corr_matrix.index)):
            for j in range(len(corr_matrix.columns)):
                val = corr_matrix.values[i, j]
                ax4.text(j, i, f"{val:.2f}", ha="center", va="center",
                         color="white" if abs(val) > 0.6 else "black", fontsize=8.5)
        ax4.set_title("Asset Correlation Matrix", fontsize=14, fontweight="bold", pad=16)
        fig4.colorbar(im, ax=ax4, shrink=0.8, label="Correlation")
        buf4 = io.BytesIO()
        fig4.savefig(buf4, format="png", bbox_inches="tight")
        plt.close(fig4)
        charts["4_correlation_heatmap.png"] = buf4.getvalue()

    return charts
