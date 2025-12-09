import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/AuthPage.module.css';

const tips = [
  'Track your orders and delivery updates in one place.',
  'Access exclusive blends curated for loyal members.',
  'Save your favourite shops for quicker checkout.',
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const target =
        user.role === 'CUSTOMER'
          ? '/customer'
          : user.role === 'SELLER'
            ? '/seller/products'
            : '/';
      router.replace(target);
    }
  }, [user, loading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const authenticatedUser = await login(email.trim(), password);
      const target =
        authenticatedUser.role === 'CUSTOMER'
          ? '/customer'
          : authenticatedUser.role === 'SELLER'
            ? '/seller/products'
            : '/';
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.intro}>
          <span className="tea-badge">Welcome back</span>
          <h1>Sign in to Tea Haven</h1>
          <p>Access your personalised recommendations, manage past orders, and stay up to date with new arrivals.</p>
          <ul className={styles.introList}>
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <p className={`tea-error ${styles.error}`}>{error}</p>}

          <div>
            <label className="tea-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="tea-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="tea-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="tea-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>

          <div className={styles.actions}>
            <button
              className="tea-button-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <p className={styles.switchLink}>
              New to Tea Haven?
              <Link href="/auth/register">Create an account</Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}