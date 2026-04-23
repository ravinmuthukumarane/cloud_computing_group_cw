function formatMoney(amount, currency) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

export default function SalaryPostCard({ post, canVote, onVote, onRequireAuth, voteDisabledLabel = 'Login to vote' }) {
  const status = post.status || 'APPROVED';
  const submissionId = post.id || post.submissionId;

  return (
    <article className="post-card">
      <div className="post-header">
        <div>
          <h3>{post.role}</h3>
          <p>
            {post.company} · {post.country}
          </p>
        </div>
        <span className={`post-badge ${status === 'PENDING' ? 'pending' : 'approved'}`}>{status}</span>
      </div>

      <div className="post-meta">
        <span>Experience: {post.experienceLevel}</span>
        <strong>{formatMoney(post.salaryAmount, post.currency)}</strong>
      </div>

      <div className="post-actions">
        <button
          disabled={!canVote}
          onClick={() => (canVote ? onVote(submissionId, 'UPVOTE') : onRequireAuth())}
          title={canVote ? 'Upvote this salary post' : 'Login required to vote'}
        >
          {canVote ? 'Upvote' : voteDisabledLabel}
        </button>
        <button
          disabled={!canVote}
          onClick={() => (canVote ? onVote(submissionId, 'DOWNVOTE') : onRequireAuth())}
          title={canVote ? 'Downvote this salary post' : 'Login required to vote'}
        >
          Downvote
        </button>
      </div>
    </article>
  );
}
