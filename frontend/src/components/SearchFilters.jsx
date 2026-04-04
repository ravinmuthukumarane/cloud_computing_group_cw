export default function SearchFilters({ filters, onChange, onSearch, compact = false }) {
  return (
    <section className={compact ? 'filters compact' : 'filters'}>
      <h2>Search Approved Salaries</h2>
      <div className="filter-grid">
        <input
          placeholder="Country"
          value={filters.country}
          onChange={(event) => onChange('country', event.target.value)}
        />
        <input
          placeholder="Company"
          value={filters.company}
          onChange={(event) => onChange('company', event.target.value)}
        />
        <input
          placeholder="Role"
          value={filters.role}
          onChange={(event) => onChange('role', event.target.value)}
        />
        <input
          placeholder="Experience Level"
          value={filters.experienceLevel}
          onChange={(event) => onChange('experienceLevel', event.target.value)}
        />
      </div>
      <button onClick={onSearch} className="primary-submit">
        Search
      </button>
    </section>
  );
}
