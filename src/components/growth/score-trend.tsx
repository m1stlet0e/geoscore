import Link from "next/link";

export type ScoreTrendPoint = {
  scanId: string;
  score: number;
  completedAt: string;
};

type ScoreTrendProps = {
  mode: "REAL" | "SIMULATED";
  points: ScoreTrendPoint[];
};

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function ScoreTrend({ mode, points }: ScoreTrendProps) {
  const modeLabel = modeLabels[mode];
  const latestDelta = points.length >= 2
    ? points[points.length - 1].score - points[points.length - 2].score
    : null;
  const values = points.map((point) => point.score);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 100);
  const range = Math.max(1, maximum - minimum);
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 300 : 30 + index / (points.length - 1) * 540,
    y: 150 - (point.score - minimum) / range * 120,
  }));

  return (
    <section className={`score-trend score-trend-${mode.toLowerCase()}`}>
      <header className="score-trend-heading">
        <div>
          <span className="section-index">TREND / {mode === "REAL" ? "R" : "S"}</span>
          <h3>GeoScore 趋势</h3>
        </div>
        <div className="trend-heading-metrics">
          <b className={`mode-stamp mode-${mode.toLowerCase()}`}>{modeLabel}</b>
          {latestDelta !== null && (
            <span className="trend-delta">
              较上次 {latestDelta > 0 ? "+" : ""}{latestDelta.toFixed(1)}
            </span>
          )}
        </div>
      </header>

      {points.length === 0 ? (
        <div className="trend-empty">
          <strong>还没有{modeLabel}趋势</strong>
          <p>完成同一模式的扫描后，这里会显示可追溯的评分变化。</p>
          {mode === "SIMULATED" && (
            <small>仅用于体验闭环，不代表真实 AI 表现</small>
          )}
        </div>
      ) : (
        <>
          <svg
            className="trend-chart"
            viewBox="0 0 600 180"
            role="img"
            aria-label={`${modeLabel} GeoScore 趋势图`}
          >
            <line x1="30" x2="570" y1="150" y2="150" className="trend-axis" />
            <line x1="30" x2="570" y1="90" y2="90" className="trend-grid-line" />
            <line x1="30" x2="570" y1="30" y2="30" className="trend-grid-line" />
            <polyline
              points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
              className="trend-line"
            />
            {coordinates.map(({ x, y }, index) => (
              <g key={points[index].scanId}>
                <circle cx={x} cy={y} r="6" className="trend-dot" />
                <text x={x} y={Math.max(18, y - 13)} textAnchor="middle">
                  {points[index].score.toFixed(0)}
                </text>
              </g>
            ))}
          </svg>
          <ol className="trend-data-list" aria-label={`${modeLabel}趋势数据`}>
            {points.map((point) => (
              <li key={point.scanId}>
                <Link href={`/dashboard/scans/${point.scanId}`}>
                  <span>{formatDate(point.completedAt)}</span>
                  <strong>{point.score.toFixed(0)} 分</strong>
                  <small>查看报告</small>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
