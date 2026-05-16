import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const SECTORS = ["EV", "Energy", "Power", "Diversified", "Others"];
const SECTOR_COLORS = { EV: "#22c55e", Energy: "#f59e0b", Power: "#3b82f6", Diversified: "#a78bfa", Others: "#6b7280" };
const fmt = n => n != null ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
const fmtVol = n => n >= 10000000 ? `${(n/10000000).toFixed(2)}Cr` : n >= 100000 ? `${(n/100000).toFixed(2)}L` : n?.toLocaleString("en-IN") ?? "—";

const bg = "#0f172a", card = "#1e293b", card2 = "#162032", border = "#2d3f55", text = "#e2e8f0", muted = "#7a90a8", accent = "#3b82f6";

const Inp = ({ value, onChange, placeholder, type = "text" }) => (
  <input value={value} onChange={onChange} type={type} placeholder={placeholder}
    style={{ width: "100%", background: "#0d1829", border: `1px solid ${border}`, color: text, borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
);

const Sel = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange}
    style={{ width: "100%", background: "#0d1829", border: `1px solid ${border}`, color: text, borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box" }}>
    {children}
  </select>
);

const Btn = ({ onClick, children, variant = "primary", style: s = {}, disabled = false }) => {
  const base = { border: "none", borderRadius: 8, padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: disabled ? 0.6 : 1, ...s };
  const variants = {
    primary: { background: accent, color: "#fff" },
    ghost: { background: "transparent", border: `1px solid ${border}`, color: muted },
    danger: { background: "transparent", border: "none", color: "#ef4444", padding: "4px 6px" }
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
};

const Tag = ({ label, color }) => (
  <span style={{ background: color + "22", color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{label}</span>
);

const PnLText = ({ val, pct, size = 13 }) => {
  const pos = val >= 0;
  return (
    <span style={{ color: pos ? "#22c55e" : "#ef4444", fontWeight: 600, fontSize: size }}>
      {pos ? "+" : "−"}₹{fmt(Math.abs(val))} ({pos ? "+" : ""}{pct != null ? pct.toFixed(2) : "0.00"}%)
    </span>
  );
};

const MetricBox = ({ label, val, color }) => (
  <div style={{ background: "#0d1829", borderRadius: 8, padding: "8px 10px", minWidth: 0 }}>
    <div style={{ fontSize: 10, color: muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: color || text, wordBreak: "break-word" }}>{val}</div>
  </div>
);

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [holdings, setHoldings] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [prices, setPrices] = useState({});
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [priceErr, setPriceErr] = useState(false);
  const [showAddH, setShowAddH] = useState(false);
  const [showAddW, setShowAddW] = useState(false);
  const [hForm, setHForm] = useState({ symbol: "", name: "", sector: "EV", qty: "", avgPrice: "" });
  const [wForm, setWForm] = useState({ symbol: "", name: "", sector: "EV" });
  const [query, setQuery] = useState("");
  const [insight, setInsight] = useState("");
  const [iLoad, setILoad] = useState(false);

  const holdingsRef = useRef([]);
  const watchlistRef = useRef([]);

  useEffect(() => { holdingsRef.current = holdings; }, [holdings]);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  useEffect(() => {
    (async () => {
      try {
        const h = await window.storage.get("ph_v1");
        const w = await window.storage.get("pw_v1");
        const lh = h ? JSON.parse(h.value) : [];
        const lw = w ? JSON.parse(w.value) : [];
        setHoldings(lh);
        setWatchlist(lw);
        if (lh.length || lw.length) fetchPrices(lh, lw);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(doRefresh, 60000);
    return () => clearInterval(t);
  }, []);

  const doRefresh = () => fetchPrices(holdingsRef.current, watchlistRef.current);

  const fetchPrices = async (h, w) => {
    const syms = [...new Set([...h.map(x => x.symbol + ".NS"), ...w.map(x => x.symbol + ".NS")])];
    if (!syms.length) return;
    setFetching(true);
    setPriceErr(false);
    try {
      const encoded = encodeURIComponent(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow`
      );
      const res = await fetch(`https://corsproxy.io/?${encoded}`);
      const data = await res.json();
      const map = {};
      (data?.quoteResponse?.result || []).forEach(q => {
        map[q.symbol.replace(".NS", "")] = {
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          high52: q.fiftyTwoWeekHigh,
          low52: q.fiftyTwoWeekLow
        };
      });
      setPrices(map);
      setLastUpdated(new Date());
    } catch {
      setPriceErr(true);
    }
    setFetching(false);
  };

  const saveH = async data => { setHoldings(data); await window.storage.set("ph_v1", JSON.stringify(data)); };
  const saveW = async data => { setWatchlist(data); await window.storage.set("pw_v1", JSON.stringify(data)); };

  const addH = async () => {
    if (!hForm.symbol || !hForm.qty || !hForm.avgPrice) return;
    const next = [...holdings, { ...hForm, symbol: hForm.symbol.toUpperCase().trim(), qty: +hForm.qty, avgPrice: +hForm.avgPrice, id: Date.now() }];
    await saveH(next);
    fetchPrices(next, watchlist);
    setHForm({ symbol: "", name: "", sector: "EV", qty: "", avgPrice: "" });
    setShowAddH(false);
  };

  const addW = async () => {
    if (!wForm.symbol) return;
    const next = [...watchlist, { ...wForm, symbol: wForm.symbol.toUpperCase().trim(), id: Date.now() }];
    await saveW(next);
    fetchPrices(holdings, next);
    setWForm({ symbol: "", name: "", sector: "EV" });
    setShowAddW(false);
  };

  const delH = async id => saveH(holdings.filter(h => h.id !== id));
  const delW = async id => saveW(watchlist.filter(w => w.id !== id));

  const totalInvested = holdings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.qty * (prices[h.symbol]?.price ?? h.avgPrice), 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const dayPnL = holdings.reduce((s, h) => s + h.qty * (prices[h.symbol]?.change ?? 0), 0);
  const dayPct = totalCurrent > 0 ? (dayPnL / totalCurrent) * 100 : 0;

  const sectorData = SECTORS.map(s => ({
    name: s,
    value: holdings.filter(h => h.sector === s).reduce((sum, h) => sum + h.qty * (prices[h.symbol]?.price ?? h.avgPrice), 0)
  })).filter(s => s.value > 0);

  const getInsight = async () => {
    if (!query.trim() || iLoad) return;
    setILoad(true);
    setInsight("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a sharp Indian equity analyst. The user is a long-term investor (5–8 year horizon) focused on EV and Energy/Power sectors on NSE/BSE. Be concise and structured. Use these section headers exactly: OUTLOOK, KEY RISKS, KEY CATALYSTS, VERDICT. Bold important figures or names. Use ₹ for prices. Be direct and actionable. Respond in plain text with the headers in ALL CAPS on their own line.`,
          messages: [{ role: "user", content: query }],
          tools: [{ type: "web_search_20250305", name: "web_search" }]
        })
      });
      const data = await res.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      setInsight(txt || "No response received.");
    } catch {
      setInsight("Failed to fetch insights. Please check your connection and try again.");
    }
    setILoad(false);
  };

  const renderInsight = txt => {
    if (!txt) return null;
    return txt.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
      const isHeader = ["OUTLOOK", "KEY RISKS", "KEY CATALYSTS", "VERDICT"].some(h => line.trim().startsWith(h));
      if (isHeader) {
        return (
          <div key={i} style={{ color: accent, fontWeight: 700, fontSize: 12, letterSpacing: "0.8px", marginTop: 14, marginBottom: 4, borderLeft: `3px solid ${accent}`, paddingLeft: 8 }}>
            {line.trim()}
          </div>
        );
      }
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} style={{ margin: "3px 0", fontSize: 13, lineHeight: 1.65, color: "#c8d8e8" }}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: text }}>{p}</strong> : p)}
        </p>
      );
    });
  };

  const tabs = [
    { id: "dashboard", icon: "⬛", label: "Dashboard" },
    { id: "holdings", icon: "📈", label: "Holdings" },
    { id: "watchlist", icon: "👁", label: "Watchlist" },
    { id: "insights", icon: "💡", label: "Insights" }
  ];

  const QUICK = ["Tata Power long-term outlook", "EV sector India 2025 outlook", "Olectra vs PMI Electro comparison", "Best energy stocks NSE 2025"];

  return (
    <div style={{ background: bg, minHeight: "100vh", color: text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#60a5fa", letterSpacing: "-0.3px" }}>Portfolio Tracker</div>
          <div style={{ fontSize: 11, color: muted }}>NSE · Indian Equity</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {priceErr && <span style={{ fontSize: 11, color: "#f87171", background: "#f8717122", padding: "3px 8px", borderRadius: 20 }}>Price fetch failed</span>}
          {lastUpdated && !priceErr && <span style={{ fontSize: 11, color: muted }}>Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={doRefresh}
            style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", animation: fetching ? "spin 1s linear infinite" : "none" }}>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: card, borderBottom: `1px solid ${border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "11px 4px", border: "none", background: "transparent", cursor: "pointer",
            color: tab === t.id ? accent : muted,
            borderBottom: `2px solid ${tab === t.id ? accent : "transparent"}`,
            fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px", maxWidth: 700, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Total Invested", val: `₹${fmt(totalInvested)}` },
                { label: "Current Value", val: `₹${fmt(totalCurrent)}` },
              ].map((m, i) => (
                <div key={i} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{m.val}</div>
                </div>
              ))}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total P&L</div>
                <PnLText val={totalPnL} pct={totalPct} size={17} />
              </div>
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>Day P&L</div>
                <PnLText val={dayPnL} pct={dayPct} size={17} />
              </div>
            </div>

            {sectorData.length > 0 && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "16px", marginBottom: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Sector Allocation</div>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={40}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {sectorData.map((s, i) => <Cell key={i} fill={SECTOR_COLORS[s.name] || "#6b7280"} />)}
                    </Pie>
                    <Tooltip formatter={v => [`₹${fmt(v)}`, "Value"]} contentStyle={{ background: card2, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {sectorData.map(s => (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: muted }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: SECTOR_COLORS[s.name], display: "inline-block" }} />
                      {s.name} — ₹{fmt(s.value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {holdings.length > 0 && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Positions</div>
                {holdings.map(h => {
                  const p = prices[h.symbol];
                  const cmp = p?.price ?? h.avgPrice;
                  const pnl = (cmp - h.avgPrice) * h.qty;
                  const pct = ((cmp - h.avgPrice) / h.avgPrice) * 100;
                  return (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{h.symbol}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                          <Tag label={h.sector} color={SECTOR_COLORS[h.sector] || "#6b7280"} />
                          <span style={{ fontSize: 11, color: muted }}>{h.qty} shares</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>₹{fmt(cmp)}</div>
                        <span style={{ color: pct >= 0 ? "#22c55e" : "#ef4444", fontSize: 12 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {holdings.length === 0 && (
              <div style={{ textAlign: "center", color: muted, padding: "48px 20px", background: card, borderRadius: 12, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No holdings yet</div>
                <div style={{ fontSize: 13 }}>Go to the Holdings tab to add your first stock</div>
              </div>
            )}
          </div>
        )}

        {/* HOLDINGS */}
        {tab === "holdings" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>My Holdings <span style={{ color: muted, fontWeight: 400 }}>({holdings.length})</span></div>
              <Btn onClick={() => setShowAddH(true)}>＋ Add Stock</Btn>
            </div>

            {showAddH && (
              <div style={{ background: card, border: `1px solid ${accent}55`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Add Holding</div>
                  <button onClick={() => setShowAddH(false)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "NSE Symbol *", key: "symbol", ph: "e.g. TATAPOWER" },
                    { label: "Display Name", key: "name", ph: "e.g. Tata Power" },
                    { label: "Quantity *", key: "qty", ph: "e.g. 100", type: "number" },
                    { label: "Avg Buy Price ₹ *", key: "avgPrice", ph: "e.g. 420.50", type: "number" },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>{f.label}</div>
                      <Inp value={hForm[f.key]} onChange={e => setHForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} type={f.type} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Sector</div>
                    <Sel value={hForm.sector} onChange={e => setHForm(p => ({ ...p, sector: e.target.value }))}>
                      {SECTORS.map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </div>
                </div>
                <Btn onClick={addH}>Add to Portfolio</Btn>
              </div>
            )}

            {holdings.length === 0 && !showAddH && (
              <div style={{ textAlign: "center", color: muted, padding: "48px 20px", background: card, borderRadius: 12, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No holdings yet</div>
                <div style={{ fontSize: 13 }}>Click "Add Stock" to get started</div>
              </div>
            )}

            {holdings.map(h => {
              const p = prices[h.symbol];
              const cmp = p?.price ?? h.avgPrice;
              const invested = h.qty * h.avgPrice;
              const current = h.qty * cmp;
              const pnl = current - invested;
              const pct = ((cmp - h.avgPrice) / h.avgPrice) * 100;
              const dayChgPct = p?.changePct ?? null;
              return (
                <div key={h.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 17 }}>{h.symbol}</span>
                        <Tag label={h.sector} color={SECTOR_COLORS[h.sector] || "#6b7280"} />
                      </div>
                      {h.name && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{h.name}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{p ? `₹${fmt(cmp)}` : "—"}</div>
                        {dayChgPct != null && <div style={{ fontSize: 12, color: dayChgPct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{dayChgPct >= 0 ? "+" : ""}{dayChgPct.toFixed(2)}% today</div>}
                      </div>
                      <Btn onClick={() => delH(h.id)} variant="danger">🗑</Btn>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    <MetricBox label="Qty" val={h.qty} />
                    <MetricBox label="Avg Price" val={`₹${fmt(h.avgPrice)}`} />
                    <MetricBox label="Invested" val={`₹${fmt(invested)}`} />
                    <MetricBox label="Current" val={p ? `₹${fmt(current)}` : "—"} />
                    <MetricBox label="P&L" val={p ? `${pnl >= 0 ? "+" : "−"}₹${fmt(Math.abs(pnl))}` : "—"} color={p ? (pnl >= 0 ? "#22c55e" : "#ef4444") : muted} />
                    <MetricBox label="Return" val={p ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"} color={p ? (pct >= 0 ? "#22c55e" : "#ef4444") : muted} />
                  </div>
                  {p && (
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#0d1829", borderRadius: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: muted }}>52W Low: <strong style={{ color: "#f87171" }}>₹{fmt(p.low52)}</strong></span>
                      <span style={{ fontSize: 11, color: muted }}>52W High: <strong style={{ color: "#22c55e" }}>₹{fmt(p.high52)}</strong></span>
                      <span style={{ fontSize: 11, color: muted }}>Volume: <strong style={{ color: text }}>{fmtVol(p.volume)}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* WATCHLIST */}
        {tab === "watchlist" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Watchlist <span style={{ color: muted, fontWeight: 400 }}>({watchlist.length})</span></div>
              <Btn onClick={() => setShowAddW(true)}>＋ Add Stock</Btn>
            </div>

            {showAddW && (
              <div style={{ background: card, border: `1px solid ${accent}55`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Add to Watchlist</div>
                  <button onClick={() => setShowAddW(false)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "NSE Symbol *", key: "symbol", ph: "e.g. OLECTRA" },
                    { label: "Display Name", key: "name", ph: "e.g. Olectra Greentech" },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>{f.label}</div>
                      <Inp value={wForm[f.key]} onChange={e => setWForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Sector</div>
                    <Sel value={wForm.sector} onChange={e => setWForm(p => ({ ...p, sector: e.target.value }))}>
                      {SECTORS.map(s => <option key={s}>{s}</option>)}
                    </Sel>
                  </div>
                </div>
                <Btn onClick={addW}>Add to Watchlist</Btn>
              </div>
            )}

            {watchlist.length === 0 && !showAddW && (
              <div style={{ textAlign: "center", color: muted, padding: "48px 20px", background: card, borderRadius: 12, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👁</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Watchlist is empty</div>
                <div style={{ fontSize: 13 }}>Add stocks you're tracking or researching</div>
              </div>
            )}

            {watchlist.map(w => {
              const p = prices[w.symbol];
              return (
                <div key={w.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 16 }}>{w.symbol}</span>
                        <Tag label={w.sector} color={SECTOR_COLORS[w.sector] || "#6b7280"} />
                      </div>
                      {w.name && <div style={{ fontSize: 12, color: muted }}>{w.name}</div>}
                      {p && <div style={{ fontSize: 11, color: muted, marginTop: 5 }}>52W: ₹{fmt(p.low52)} — ₹{fmt(p.high52)} · Vol: {fmtVol(p.volume)}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{p ? `₹${fmt(p.price)}` : "—"}</div>
                        {p?.changePct != null && <div style={{ fontSize: 12, color: p.changePct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{p.changePct >= 0 ? "+" : ""}{p.changePct.toFixed(2)}%</div>}
                      </div>
                      <Btn onClick={() => delW(w.id)} variant="danger">🗑</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* INSIGHTS */}
        {tab === "insights" && (
          <div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>💡 AI Market Insights</div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>Ask about any stock or sector — powered by Claude + live web search.</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && getInsight()}
                  placeholder="e.g. What's the long-term outlook for Tata Power?"
                  style={{ flex: 1, background: "#0d1829", border: `1px solid ${border}`, color: text, borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }} />
                <Btn onClick={getInsight} disabled={iLoad} s={{ minWidth: 70, justifyContent: "center" }}>
                  {iLoad ? "..." : "Ask"}
                </Btn>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK.map(q => (
                  <button key={q} onClick={() => setQuery(q)}
                    style={{ background: "#0d1829", border: `1px solid ${border}`, color: muted, borderRadius: 20, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {iLoad && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 32, textAlign: "center", color: muted }}>
                <div style={{ fontSize: 24, marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }}>🔍</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Searching the web and analyzing...</div>
                <div style={{ fontSize: 12 }}>This usually takes 5–10 seconds</div>
              </div>
            )}

            {insight && !iLoad && (
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>Research Summary</div>
                {renderInsight(insight)}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}`, fontSize: 11, color: muted }}>
                  ⚠️ For informational purposes only. Not financial advice. Always do your own due diligence.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input:focus, select:focus { border-color: ${accent} !important; }
        input::placeholder { color: ${muted}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 4px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
