CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON identity.users(email);

CREATE INDEX IF NOT EXISTS idx_salary_submissions_status
    ON salary.submissions(status);

CREATE INDEX IF NOT EXISTS idx_salary_submissions_country
    ON salary.submissions(country);

CREATE INDEX IF NOT EXISTS idx_salary_submissions_role
    ON salary.submissions(role);

CREATE INDEX IF NOT EXISTS idx_salary_submissions_experience_level
    ON salary.submissions(experience_level);

CREATE INDEX IF NOT EXISTS idx_salary_submissions_search
    ON salary.submissions(country, role, experience_level);

CREATE INDEX IF NOT EXISTS idx_votes_submission_id
    ON community.votes(submission_id);

CREATE INDEX IF NOT EXISTS idx_votes_user_id
    ON community.votes(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_submission_id
    ON community.reports(submission_id);

CREATE INDEX IF NOT EXISTS idx_reports_user_id
    ON community.reports(user_id);