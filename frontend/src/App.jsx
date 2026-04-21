import { useEffect, useMemo, useState } from 'react';
import { callApi } from './api';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
import SalaryPostCard from './components/SalaryPostCard';
import SearchFilters from './components/SearchFilters';
import StatsPanel from './components/StatsPanel';
import SubmitSalaryForm from './components/SubmitSalaryForm';

const AUTH_TOKEN_KEY = 'cloud_salary_token';

export default function App() {
  const [activeTab, setActiveTab] = useState('approved');
  const [token, setToken] = useState(localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [modalMode, setModalMode] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Welcome. Browse approved salary posts.');
  const [errorMessage, setErrorMessage] = useState('');

  const [filters, setFilters] = useState({
    country: '',
    company: '',
    role: '',
    experienceLevel: '',
  });

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    loadApprovedPosts();
  }, []);

  const safelyRun = async (action) => {
    setErrorMessage('');
    try {
      await action();
    } catch (error) {
      if (error.message === 'Unauthorized') {
        setToken('');
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setModalMode('login');
        setStatusMessage('Your login session is invalid or expired. Please log in again to vote.');
      }
      setErrorMessage(error.message);
    }
  };

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const buildSearchQuery = () => {
    const params = new URLSearchParams();
    if (filters.country) params.set('country', filters.country);
    if (filters.company) params.set('company', filters.company);
    if (filters.role) params.set('role', filters.role);
    if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel);
    return params.toString();
  };

  const loadApprovedPosts = async () => {
    const query = buildSearchQuery();
    const data = await callApi(`/search${query ? `?${query}` : ''}`);
    setPosts(data.results || []);
    setStatusMessage(`Loaded ${data.results.length} approved salary post(s).`);
  };

  const loadPendingPosts = async () => {
    const query = buildSearchQuery();
    const statusPrefix = 'status=PENDING';
    const fullQuery = query ? `${statusPrefix}&${query}` : statusPrefix;
    const data = await callApi(`/submissions?${fullQuery}`);
    setPosts(data.results || []);
    setStatusMessage(`Loaded ${data.results.length} pending salary submission(s) for review.`);
  };

  const loadStats = async () => {
    const query = buildSearchQuery();
    const data = await callApi(`/stats${query ? `?${query}` : ''}`);
    setStats(data);
    setStatusMessage('Stats loaded for current filters.');
  };

  const handleAuthSubmit = async ({ email, password }) => {
    await safelyRun(async () => {
      if (modalMode === 'signup') {
        await callApi('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setStatusMessage('Account created successfully. You can now log in.');
        setModalMode('login');
        return;
      }

      const data = await callApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(data.token);
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      setModalMode(null);
      setStatusMessage('You are now logged in. Voting is enabled.');
    });
  };

  const logout = () => {
    setToken('');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setStatusMessage('You have logged out.');
  };

  const submitSalary = async (payload) => {
    await safelyRun(async () => {
      const data = await callApi('/salaries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStatusMessage(
        `Salary submitted successfully and stored as ${data.status}. It is now waiting for community votes.`
      );
      setActiveTab('review');
      await loadPendingPosts();
    });
  };

  const voteOnPost = async (submissionId, voteType) => {
    await safelyRun(async () => {
      const data = await callApi('/votes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submissionId, voteType }),
      });

      setStatusMessage(
        `Vote recorded. Submission is ${data.submissionStatus}. Community score is ${data.currentScore}.`
      );

      if (activeTab === 'review') {
        await loadPendingPosts();
      }

      if (activeTab === 'approved' || activeTab === 'search') {
        await loadApprovedPosts();
      }
    });
  };

  const promptLoginForVoting = () => {
    setStatusMessage('Please log in to vote on salary submissions.');
    setModalMode('login');
  };

  const renderFeed = () => (
    <>
      <SearchFilters
        filters={filters}
        onChange={setFilter}
        onSearch={() => safelyRun(loadApprovedPosts)}
        title="Browse Approved Salaries"
        buttonLabel="Load Approved"
      />

      <section className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-state">No approved salary posts found for these filters.</div>
        ) : (
          posts.map((post) => (
            <SalaryPostCard
              key={post.id}
              post={post}
              canVote={isAuthenticated}
              onVote={voteOnPost}
              onRequireAuth={promptLoginForVoting}
            />
          ))
        )}
      </section>
    </>
  );

  const renderReviewFeed = () => (
    <>
      <SearchFilters
        filters={filters}
        onChange={setFilter}
        onSearch={() => safelyRun(loadPendingPosts)}
        title="Review Pending Submissions"
        buttonLabel="Load Pending"
      />

      <section className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-state">
            No pending salary submissions found for these filters. New submissions stay here until the community
            votes them to approval.
          </div>
        ) : (
          posts.map((post) => (
            <SalaryPostCard
              key={post.id}
              post={post}
              canVote={isAuthenticated}
              onVote={voteOnPost}
              onRequireAuth={promptLoginForVoting}
            />
          ))
        )}
      </section>
    </>
  );

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAuthenticated={isAuthenticated}
        onOpenLogin={() => setModalMode('login')}
        onOpenSignup={() => setModalMode('signup')}
        onLogout={logout}
      />

      <main className="content-wrap">
        {activeTab === 'approved' ? renderFeed() : null}

        {activeTab === 'submit' ? <SubmitSalaryForm onSubmit={submitSalary} /> : null}

        {activeTab === 'review' ? renderReviewFeed() : null}

        {activeTab === 'search' ? (
          <section className="search-page">
            <SearchFilters
              compact
              filters={filters}
              onChange={setFilter}
              onSearch={() => safelyRun(loadApprovedPosts)}
              title="Search Approved Salaries"
              buttonLabel="Search Approved"
            />
            <section className="posts-feed">
              {posts.length === 0 ? (
                <div className="empty-state">No results yet. Try different filters.</div>
              ) : (
                posts.map((post) => (
                  <SalaryPostCard
                    key={post.id}
                    post={post}
                    canVote={isAuthenticated}
                    onVote={voteOnPost}
                    onRequireAuth={promptLoginForVoting}
                  />
                ))
              )}
            </section>
          </section>
        ) : null}

        {activeTab === 'stats' ? <StatsPanel stats={stats} onLoad={() => safelyRun(loadStats)} /> : null}
      </main>

      <footer className="status-strip">
        <span>{statusMessage}</span>
        {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
      </footer>

      <AuthModal
        mode={modalMode}
        isOpen={Boolean(modalMode)}
        onClose={() => setModalMode(null)}
        onSubmit={handleAuthSubmit}
      />
    </div>
  );
}
