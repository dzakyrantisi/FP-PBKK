import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types/shared';
import styles from '../../styles/AuthPage.module.css';

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'CUSTOMER', label: 'Customer', description: 'Shop and place orders for tea products.' },
  { value: 'SELLER', label: 'Seller', description: 'Publish and manage your tea catalog.' },
];

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, user, loading } = useAuth();
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

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const roleQuery = router.query.role;
    if (typeof roleQuery === 'string') {
      const upper = roleQuery.toUpperCase();
      if (upper === 'SELLER' || upper === 'CUSTOMER') {
        setRole(upper as Role);
      }
    }
  }, [router.isReady, router.query.role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      setSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      setSubmitting(false);
      return;
    }

    try {
      const registeredUser = await register(fullName.trim(), email.trim(), password, role);
      const target =
        registeredUser.role === 'CUSTOMER'
          ? '/customer'
          : registeredUser.role === 'SELLER'
            ? '/seller/products'
            : '/';
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create an account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.intro}>
          <span className="tea-badge">Join the community</span>
          <h1>Create your Tea Haven account</h1>
          <p>Discover curated blends, manage your storefront, and connect with tea lovers around you.</p>
          <ul className={styles.introList}>
            <li>One account for ordering, selling, and collaborating.</li>
            <li>Secure checkout and real-time order tracking.</li>
            <li>Personalised recommendations for your taste profile.</li>
          </ul>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <p className={`tea-error ${styles.error}`}>{error}</p>}

          <div>
            <label className="tea-label" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              className="tea-input"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Siti Nurhaliza"
              required
            />
          </div>

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

          <div className={styles.formRow}>
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
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="tea-label" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                className="tea-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          <div>
            <span className="tea-label">Account type</span>
            <div className={styles.radioGroup}>
              {ROLES.map((option) => (
                <label
                  key={option.value}
                  className={`${styles.radioOption} ${role === option.value ? styles.radioActive : ''}`}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </span>
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className="tea-button-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
            <p className={styles.switchLink}>
              Already registered?
              <Link href="/auth/login">Sign in instead</Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}