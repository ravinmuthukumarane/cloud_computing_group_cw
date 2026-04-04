export default function StatsPanel({ stats, onLoad }) {
  return (
    <section className="stats-panel">
      <div className="section-head">
        <h2>Salary Statistics</h2>
        <button className="primary-submit" onClick={onLoad}>
          Refresh Stats
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Approved</span>
          <strong>{stats?.count ?? '-'}</strong>
        </div>
        <div className="stat-card">
          <span>Average</span>
          <strong>{stats?.average ?? '-'}</strong>
        </div>
        <div className="stat-card">
          <span>Median</span>
          <strong>{stats?.median ?? '-'}</strong>
        </div>
        <div className="stat-card">
          <span>P90</span>
          <strong>{stats?.p90 ?? '-'}</strong>
        </div>
      </div>
      <p className="hint-text">Currency: {stats?.currency ?? 'N/A'}</p>
    </section>
  );
}
