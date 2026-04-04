function formatMoney(amount, currency) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

export default function SalaryPostCard({ post, canVote, onVote, onRequireAuth }) {
  return (
    <article className="post-card">
      <div className="post-header">
        <div>
          <h3>{post.role}</h3>
          <p>
            {post.company} · {post.country}
          </p>
        </div>
        <span className="post-badge">APPROVED</span>
      </div>

      <div className="post-meta">
        <span>Experience: {post.experienceLevel}</span>
        <strong>{formatMoney(post.salaryAmount, post.currency)}</strong>
      </div>

      <div className="post-actions">
        <button
          disabled={!canVote}
          onClick={() => (canVote ? onVote(post.id, 'UPVOTE') : onRequireAuth())}
          title={canVote ? 'Upvote this salary post' : 'Login required to vote'}
        >
          {canVote ? 'Upvote' : 'Login to vote'}
        </button>
        <button
          disabled={!canVote}
          onClick={() => (canVote ? onVote(post.id, 'DOWNVOTE') : onRequireAuth())}
          title={canVote ? 'Downvote this salary post' : 'Login required to vote'}
        >
          Downvote
        </button>
      </div>
    </article>
  );
}
