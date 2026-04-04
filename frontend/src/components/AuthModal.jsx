import { useState } from 'react';

export default function AuthModal({ mode, isOpen, onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const title = mode === 'login' ? 'Login' : 'Sign Up';

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({ email, password });
    setPassword('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            required
            type="email"
          />

          <label>Password</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="StrongPassword123"
            required
            type="password"
            minLength={8}
          />

          <button type="submit" className="primary-submit">
            {title}
          </button>
        </form>
      </div>
    </div>
  );
}
