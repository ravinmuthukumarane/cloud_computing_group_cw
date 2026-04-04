import { useState } from 'react';

export default function SubmitSalaryForm({ onSubmit }) {
  const [form, setForm] = useState({
    country: 'Sri Lanka',
    company: '',
    role: '',
    experienceLevel: '',
    salaryAmount: '',
    currency: 'LKR',
    anonymize: true,
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      salaryAmount: Number(form.salaryAmount),
    });
    setForm((current) => ({ ...current, company: '', role: '', experienceLevel: '', salaryAmount: '' }));
  };

  return (
    <section className="submit-panel">
      <h2>Anonymous Salary Submission</h2>
      <form onSubmit={handleSubmit} className="submit-grid">
        <label>
          Country
          <input value={form.country} onChange={(event) => update('country', event.target.value)} required />
        </label>

        <label>
          Company
          <input value={form.company} onChange={(event) => update('company', event.target.value)} required />
        </label>

        <label>
          Role
          <input value={form.role} onChange={(event) => update('role', event.target.value)} required />
        </label>

        <label>
          Experience Level
          <input
            value={form.experienceLevel}
            onChange={(event) => update('experienceLevel', event.target.value)}
            required
          />
        </label>

        <label>
          Salary Amount
          <input
            value={form.salaryAmount}
            onChange={(event) => update('salaryAmount', event.target.value)}
            required
            type="number"
            min="1"
          />
        </label>

        <label>
          Currency
          <input value={form.currency} onChange={(event) => update('currency', event.target.value)} required />
        </label>

        <label className="checkline">
          <input
            checked={form.anonymize}
            onChange={(event) => update('anonymize', event.target.checked)}
            type="checkbox"
          />
          Hide company name publicly
        </label>

        <button type="submit" className="primary-submit">
          Submit Salary
        </button>
      </form>
    </section>
  );
}
