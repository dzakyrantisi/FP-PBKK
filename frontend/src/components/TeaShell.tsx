import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/cart/CartContext';
import styles from './TeaShell.module.css';

interface TeaShellProps {
  children: React.ReactNode;
}

const NAVIGATION_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
];

const SearchIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.searchIcon}
    viewBox="0 0 24 24"
    width="20"
    height="20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="m20.61 19-4.8-4.8a6.5 6.5 0 1 0-1.41 1.41l4.8 4.8a1 1 0 0 0 1.41-1.41ZM6.5 10a3.5 3.5 0 1 1 3.5 3.5A3.5 3.5 0 0 1 6.5 10Z"
      fill="currentColor"
    />
  </svg>
);

export function TeaShell({ children }: TeaShellProps) {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const cartCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const isAuthRoute = router.pathname.startsWith('/auth/');

  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);

  const handleLogout = async () => {
    await logout();
    void router.push('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.branding}>
          <button
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            className={styles.menuToggle}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link className={styles.logo} href="/">
            <span aria-hidden="true" className={styles.logoMark} />
            TEA HAVEN
          </Link>
        </div>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} aria-label="Main navigation">
          <ul>
            {NAVIGATION_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={closeMenu}>
                  {link.label}
                </Link>
              </li>
            ))}
            {user?.role === 'SELLER' && (
              <li>
                <Link href="/seller/products" onClick={closeMenu}>
                  Seller Dashboard
                </Link>
              </li>
            )}
            {user?.role === 'CUSTOMER' && (
              <li>
                <Link href="/orders" onClick={closeMenu}>
                  My Orders
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link
            aria-label="Explore catalog"
            className={styles.searchLink}
            href="/catalog"
            onClick={closeMenu}
          >
            <SearchIcon />
            <span className={styles.srOnly}>Catalog</span>
          </Link>
          {user?.role !== 'SELLER' && !isAuthRoute && (
            <Link className={styles.cart} href="/cart" onClick={closeMenu}>
              Cart
              {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
            </Link>
          )}
          {user ? (
            <div className={styles.account}>
              <span className={styles.userName}>{user.fullName}</span>
              <button className="tea-button-secondary" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className={styles.guestActions}>
              <Link className="tea-button-secondary" href="/auth/login" onClick={closeMenu}>
                Log in
              </Link>
              <Link className={styles.registerButton} href="/auth/register" onClick={closeMenu}>
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className={`${styles.main} tea-main`}>
        <div className={styles.content}>{children}</div>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Tea Haven. Sharing mindful tea moments.</p>
        <div className={styles.footerLinks}>
          <a href="mailto:support@teahaven.dev">Support</a>
          <Link href="/catalog">Catalog</Link>
          <Link href="/about">About</Link>
        </div>
      </footer>
    </div>
  );
}
