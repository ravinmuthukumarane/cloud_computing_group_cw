export default function Navbar({ activeTab, onTabChange, isAuthenticated, onOpenLogin, onOpenSignup, onLogout }) {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-mark">CS</div>
        <div>
          <h1>Cloud Salary Transparency</h1>
          <p>Sri Lanka community salary insights</p>
        </div>
      </div>

      <nav className="nav-links">
        <button className={activeTab === 'approved' ? 'tab active' : 'tab'} onClick={() => onTabChange('approved')}>
          Home / Approved Posts
        </button>
        <button className={activeTab === 'submit' ? 'tab active' : 'tab'} onClick={() => onTabChange('submit')}>
          Submit Salary
        </button>
        <button className={activeTab === 'search' ? 'tab active' : 'tab'} onClick={() => onTabChange('search')}>
          Search
        </button>
        <button className={activeTab === 'stats' ? 'tab active' : 'tab'} onClick={() => onTabChange('stats')}>
          Stats
        </button>
      </nav>

      <div className="auth-area">
        <span className={isAuthenticated ? 'auth-state on' : 'auth-state'}>
          {isAuthenticated ? 'Logged in' : 'Not logged in'}
        </span>
        {isAuthenticated ? (
          <button className="auth-btn logout" onClick={onLogout}>
            Logout
          </button>
        ) : (
          <>
            <button className="auth-btn" onClick={onOpenSignup}>
              Sign Up
            </button>
            <button className="auth-btn primary" onClick={onOpenLogin}>
              Login
            </button>
          </>
        )}
      </div>
    </header>
  );
}
