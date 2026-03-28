"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const RATES = {
  CR: { rate: 421, label: "CR (X-ray)", color: "#3b82f6" },
  CT: { rate: 5222, label: "CT", color: "#f59e0b" },
  MR: { rate: 40710, label: "MR", color: "#10b981" },
  BMD: { rate: 1210, label: "BMD", color: "#8b5cf6" },
};

const BASE_SALARY = 14207200;

export default function Home() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [counts, setCounts] = useState({ CR: "", CT: "", MR: "", BMD: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ocrNote, setOcrNote] = useState(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [periodInfo, setPeriodInfo] = useState(null);
  const [projectedCounts, setProjectedCounts] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setError(null);
    setOcrNote(null);
    setAnalyzed(false);
    setPeriodInfo(null);
    setProjectedCounts(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImage(e.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleFile(file);
          return;
        }
      }
    },
    [handleFile]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropRef.current?.classList.remove("drag-over");
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.add("drag-over");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
  }, []);

  const calcProjection = (raw, days) => {
    if (!days || days <= 0 || days >= 28) return null;
    const r = 30 / days;
    const p = {};
    for (const k of Object.keys(RATES))
      p[k] = Math.round((parseInt(raw[k]) || 0) * r);
    return p;
  };

  const analyzeImage = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setOcrNote(null);
    setPeriodInfo(null);
    setProjectedCounts(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `서버 오류 (${res.status})`);
      }

      const nc = {
        CR: data.CR ?? "",
        CT: data.CT ?? "",
        MR: data.MR ?? "",
        BMD: data.BMD ?? "",
      };
      setCounts(nc);
      setOcrNote(data.note || null);
      setAnalyzed(true);

      if (data.period_days || (data.period_start && data.period_end)) {
        let days = data.period_days;
        if (!days && data.period_start && data.period_end) {
          days =
            Math.round(
              (new Date(data.period_end) - new Date(data.period_start)) /
                86400000
            ) + 1;
        }
        const info = { start: data.period_start, end: data.period_end, days };
        setPeriodInfo(info);
        if (days && days < 28) setProjectedCounts(calcProjection(nc, days));
      }
    } catch (err) {
      setError("분석 중 오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInc = (mod, co) =>
    (parseInt((co || counts)[mod]) || 0) * RATES[mod].rate;
  const totalInc = (co) =>
    Object.keys(RATES).reduce((s, k) => s + getInc(k, co), 0);
  const actualTotal = totalInc();
  const projTotal = projectedCounts ? totalInc(projectedCounts) : null;
  const actualPay = BASE_SALARY + actualTotal;
  const projPay = projTotal !== null ? BASE_SALARY + projTotal : null;
  const fmt = (n) =>
    n.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";
  const fmtS = (n) =>
    n >= 1e8
      ? (n / 1e8).toFixed(1) + "억"
      : n >= 1e4
        ? (n / 1e4).toFixed(0) + "만"
        : n.toLocaleString();
  const showProj = projectedCounts && periodInfo && periodInfo.days < 28;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.hIcon}>📊</div>
        <div>
          <h1 style={S.title}>판독 인센티브 계산기</h1>
          <p style={S.sub}>
            EMR 스크린샷 → AI 분석 → 이로운 판독량 자동 추출
          </p>
        </div>
      </div>

      <div style={S.grid}>
        {/* LEFT */}
        <div style={S.left}>
          <div
            ref={dropRef}
            className="drop-zone"
            style={S.dz}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {imagePreview ? (
              <div style={S.pvW}>
                <img src={imagePreview} alt="Screenshot" style={S.pvI} />
                <div style={S.pvO}>클릭하여 다른 이미지 선택</div>
              </div>
            ) : (
              <div style={S.dzC}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                <p style={S.dzT}>
                  EMR 스크린샷을 <b>드래그</b>, <b>클릭</b>, 또는{" "}
                  <b>Ctrl+V</b> 붙여넣기
                </p>
                <p style={S.dzH}>PNG, JPG 지원 · 클립보드 붙여넣기 가능</p>
              </div>
            )}
          </div>

          {imagePreview && (
            <button
              className="btn-analyze"
              style={S.aBtn}
              onClick={analyzeImage}
              disabled={loading}
            >
              {loading ? (
                <span style={{ animation: "pulse 1.5s infinite" }}>
                  🔍 AI 분석 중...
                </span>
              ) : (
                "🔍 AI로 이로운 판독 건수 추출"
              )}
            </button>
          )}

          {error && <div style={S.err}>{error}</div>}
          {ocrNote && <div style={S.note}>💡 {ocrNote}</div>}

          {periodInfo && (
            <div style={S.pBox}>
              <div style={S.pTitle}>📅 조회 기간</div>
              <div style={S.pDates}>
                {periodInfo.start} ~ {periodInfo.end}
                <span style={S.pDays}>{periodInfo.days}일</span>
              </div>
              {showProj && (
                <div style={S.pWarn}>
                  ⚠️ {periodInfo.days}일 데이터 → 30일 기준 월간 예상치도 함께
                  표시
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex" }}>
            <button
              style={{ ...S.tog, ...(manualMode ? S.togA : {}) }}
              onClick={() => setManualMode(!manualMode)}
            >
              {manualMode ? "✏️ 수동 입력 모드 (ON)" : "✏️ 수동 입력 / 수정"}
            </button>
          </div>

          {(analyzed || manualMode) && (
            <div style={S.iGrid}>
              {Object.entries(RATES).map(([k, { label, color }]) => (
                <div
                  key={k}
                  className="card"
                  style={{ ...S.iCard, borderLeft: `4px solid ${color}` }}
                >
                  <label style={S.iLab}>{label}</label>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={counts[k]}
                      onChange={(e) => {
                        const nc = { ...counts, [k]: e.target.value };
                        setCounts(nc);
                        if (periodInfo?.days < 28)
                          setProjectedCounts(
                            calcProjection(nc, periodInfo.days)
                          );
                      }}
                      style={S.inp}
                    />
                    <span style={{ fontSize: 13, color: "#64748b" }}>건</span>
                  </div>
                  <div style={S.iRate}>
                    @{RATES[k].rate.toLocaleString()}원/건
                  </div>
                  {showProj && projectedCounts && (
                    <div style={S.iProj}>
                      월 예상: ~{(projectedCounts[k] || 0).toLocaleString()}건
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={S.right}>
          <h2 style={S.secT}>💰 인센티브 내역</h2>
          {showProj && (
            <div style={S.projB}>
              📈 {periodInfo.days}일 실적 기반 · 30일 월간 예상 포함
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {Object.entries(RATES).map(([k, { label, color }]) => {
              const c = parseInt(counts[k]) || 0,
                inc = getInc(k);
              const pc = projectedCounts
                ? parseInt(projectedCounts[k]) || 0
                : null;
              const pi = pc !== null ? pc * RATES[k].rate : null;
              return (
                <div key={k} className="anim-in card" style={S.bCard}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#e2e8f0",
                        }}
                      >
                        {label}
                      </div>
                      <div style={S.bCnt}>
                        {c.toLocaleString()}건 ×{" "}
                        {RATES[k].rate.toLocaleString()}원
                      </div>
                      {showProj && pc !== null && (
                        <div style={S.bProj}>
                          월 예상: {pc.toLocaleString()}건 ×{" "}
                          {RATES[k].rate.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono',monospace",
                        color,
                      }}
                    >
                      {fmt(inc)}
                    </div>
                    {showProj && pi !== null && (
                      <div style={S.bProjA}>~{fmt(pi)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              height: 1,
              background: "rgba(148,163,184,0.12)",
              margin: "4px 0",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "0 4px",
            }}
          >
            <div style={S.sRow}>
              <span style={S.sLab}>월본봉 (세후)</span>
              <span style={S.sVal}>{fmt(BASE_SALARY)}</span>
            </div>
            <div style={S.sRow}>
              <span style={S.sLab}>
                인센티브 합계{showProj ? " (현재)" : ""}
              </span>
              <span
                style={{
                  ...S.sVal,
                  color: "#10b981",
                  fontWeight: 700,
                }}
              >
                +{fmt(actualTotal)}
              </span>
            </div>
            {showProj && projTotal !== null && (
              <div style={S.sRow}>
                <span style={{ ...S.sLab, color: "#f59e0b" }}>
                  인센티브 월 예상
                </span>
                <span
                  style={{
                    ...S.sVal,
                    color: "#f59e0b",
                    fontWeight: 700,
                  }}
                >
                  ~+{fmt(projTotal)}
                </span>
              </div>
            )}
            <div style={{ ...S.sRow, marginTop: 4 }}>
              <span
                style={{ ...S.sLab, fontSize: 12, color: "#94a3b8" }}
              >
                본봉 대비 인센티브 비율
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "#94a3b8",
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {((actualTotal / BASE_SALARY) * 100).toFixed(1)}%
                {showProj && projTotal !== null && (
                  <span style={{ color: "#f59e0b" }}>
                    {" "}
                    → ~{((projTotal / BASE_SALARY) * 100).toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Actual Total */}
          <div style={S.tCard}>
            <div style={S.tLab}>
              {showProj ? "현재 실적 기준 급여" : "월 총 급여 (예상)"}
            </div>
            <div style={S.tAmt}>{fmt(actualPay)}</div>
            <div style={S.tBar}>
              <div
                style={{
                  ...S.tBarB,
                  width: `${(BASE_SALARY / actualPay) * 100}%`,
                }}
              />
              <div
                style={{
                  ...S.tBarI,
                  width: `${(actualTotal / actualPay) * 100}%`,
                }}
              />
            </div>
            <div style={S.tBarL}>
              <span>본봉 {fmtS(BASE_SALARY)}원</span>
              <span>인센티브 {fmtS(actualTotal)}원</span>
            </div>
          </div>

          {/* Projected Total */}
          {showProj && projPay !== null && (
            <div
              style={{
                ...S.tCard,
                border: "1px solid rgba(245,158,11,0.3)",
                background:
                  "linear-gradient(135deg,rgba(245,158,11,0.1),rgba(59,130,246,0.06))",
              }}
            >
              <div style={{ ...S.tLab, color: "#f59e0b" }}>
                📈 월간 예상 급여 (30일 환산)
              </div>
              <div style={{ ...S.tAmt, color: "#fbbf24" }}>
                {fmt(projPay)}
              </div>
              <div style={S.tBar}>
                <div
                  style={{
                    ...S.tBarB,
                    width: `${(BASE_SALARY / projPay) * 100}%`,
                  }}
                />
                <div
                  style={{
                    ...S.tBarI,
                    width: `${(projTotal / projPay) * 100}%`,
                    background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                  }}
                />
              </div>
              <div style={S.tBarL}>
                <span>본봉 {fmtS(BASE_SALARY)}원</span>
                <span>예상 인센티브 {fmtS(projTotal)}원</span>
              </div>
            </div>
          )}

          <div style={S.rTab}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 10,
              }}
            >
              📋 단가표
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {Object.entries(RATES).map(([k, { label, rate, color }]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, color }}>{label}</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      color: "#94a3b8",
                    }}
                  >
                    {rate.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  container: { padding: 24, maxWidth: 1100, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid rgba(148,163,184,0.15)",
  },
  hIcon: {
    fontSize: 36,
    width: 56,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(16,185,129,0.1)",
    borderRadius: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
    margin: 0,
  },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  left: { display: "flex", flexDirection: "column", gap: 14 },
  right: { display: "flex", flexDirection: "column", gap: 12 },
  dz: {
    border: "2px dashed rgba(148,163,184,0.3)",
    borderRadius: 16,
    cursor: "pointer",
    background: "rgba(30,41,59,0.6)",
    overflow: "hidden",
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dzC: { textAlign: "center", padding: 32 },
  dzT: { fontSize: 14, fontWeight: 500, color: "#94a3b8" },
  dzH: { fontSize: 12, color: "#475569", marginTop: 6 },
  pvW: { position: "relative", width: "100%" },
  pvI: {
    width: "100%",
    maxHeight: 280,
    objectFit: "contain",
    display: "block",
  },
  pvO: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "8px 0",
    background: "rgba(0,0,0,0.6)",
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
  },
  aBtn: {
    width: "100%",
    padding: "14px 0",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "'Noto Sans KR',sans-serif",
    color: "#fff",
    background: "linear-gradient(135deg,#10b981,#059669)",
    boxShadow: "0 4px 14px rgba(16,185,129,0.25)",
  },
  err: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    fontSize: 13,
  },
  note: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.2)",
    color: "#93c5fd",
    fontSize: 13,
  },
  pBox: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(30,41,59,0.8)",
    border: "1px solid rgba(148,163,184,0.15)",
  },
  pTitle: { fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 },
  pDates: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono',monospace",
    color: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pDays: {
    background: "rgba(59,130,246,0.2)",
    color: "#93c5fd",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  pWarn: { marginTop: 8, fontSize: 12, color: "#f59e0b", lineHeight: 1.5 },
  tog: {
    padding: "8px 16px",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    background: "transparent",
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Noto Sans KR',sans-serif",
    transition: "all .2s ease",
  },
  togA: {
    background: "rgba(59,130,246,0.15)",
    borderColor: "rgba(59,130,246,0.4)",
    color: "#93c5fd",
  },
  iGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  iCard: {
    background: "rgba(30,41,59,0.8)",
    borderRadius: 12,
    padding: "12px 14px",
  },
  iLab: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
    display: "block",
    marginBottom: 6,
  },
  inp: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    background: "rgba(15,23,42,0.8)",
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono',monospace",
    outline: "none",
    textAlign: "right",
  },
  iRate: {
    fontSize: 11,
    color: "#475569",
    marginTop: 4,
    fontFamily: "'JetBrains Mono',monospace",
  },
  iProj: {
    fontSize: 11,
    color: "#f59e0b",
    marginTop: 2,
    fontFamily: "'JetBrains Mono',monospace",
  },
  secT: {
    fontSize: 17,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: 0,
    marginBottom: 4,
  },
  projB: {
    fontSize: 12,
    color: "#f59e0b",
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.2)",
    padding: "6px 12px",
    borderRadius: 8,
  },
  bCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(30,41,59,0.7)",
  },
  bCnt: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "'JetBrains Mono',monospace",
    marginTop: 1,
  },
  bProj: {
    fontSize: 11,
    color: "#f59e0b",
    fontFamily: "'JetBrains Mono',monospace",
    marginTop: 2,
  },
  bProjA: {
    fontSize: 12,
    color: "#f59e0b",
    fontFamily: "'JetBrains Mono',monospace",
    marginTop: 2,
  },
  sRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sLab: { fontSize: 14, color: "#94a3b8" },
  sVal: {
    fontSize: 15,
    fontFamily: "'JetBrains Mono',monospace",
    color: "#e2e8f0",
  },
  tCard: {
    background:
      "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.08))",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 16,
    padding: "18px 20px",
    marginTop: 4,
  },
  tLab: { fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 4 },
  tAmt: {
    fontSize: 28,
    fontWeight: 900,
    color: "#f1f5f9",
    fontFamily: "'JetBrains Mono',monospace",
    letterSpacing: "-1px",
  },
  tBar: {
    display: "flex",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 12,
    background: "rgba(15,23,42,0.4)",
  },
  tBarB: {
    background: "#334155",
    borderRadius: "4px 0 0 4px",
    transition: "width .4s ease",
  },
  tBarI: {
    background: "linear-gradient(90deg,#10b981,#3b82f6)",
    borderRadius: "0 4px 4px 0",
    transition: "width .4s ease",
  },
  tBarL: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#64748b",
    marginTop: 6,
    fontFamily: "'JetBrains Mono',monospace",
  },
  rTab: {
    background: "rgba(30,41,59,0.5)",
    borderRadius: 12,
    padding: "14px 16px",
    marginTop: 4,
  },
};
