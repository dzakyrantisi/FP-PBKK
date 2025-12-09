import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Landing.module.css';

const steps = [
  {
    title: 'Step 1',
    description: 'Create your Tea Haven account and tell us what flavours you love.',
    caption: 'Unlock recommendations from curated artisans.',
  },
  {
    title: 'Step 2',
    description: 'Browse seasonal collections and add your picks to the cart.',
    caption: 'Mix and match rare and classic blends.',
  },
  {
    title: 'Step 3',
    description: 'Complete your purchase and enjoy your tea!',
    caption: 'Relax while we handle the delivery.',
  },
];

const joins = [
  {
    title: 'As a seller',
    description: 'List your teas and reach tea lovers everywhere.',
    action: 'Join us',
    href: '/auth/register?role=SELLER',
  },
  {
    title: 'As a customer',
    description: 'Browse a wide selection of teas and make your purchase.',
    action: 'Shop now',
    href: '/catalog',
  },
];

const StepIllustration = ({ index }: { index: number }) => (
  <svg aria-hidden="true" className={styles.stepIllustration} viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg">
    <rect fill="#f5f0e7" height="120" rx="24" width="160" />
    <circle cx={50 + index * 15} cy={52} fill="#1d8f60" opacity="0.18" r={32 + index * 4} />
    <path d="M64 88c4-24 36-44 56-48-10 28-22 42-40 50" fill="#0b5d40" opacity="0.82" />
    <circle cx="64" cy="80" fill="#103526" r="14" />
    <rect fill="#134532" height="18" rx="9" width="62" x="36" y="24" />
    <rect fill="#103526" height="8" rx="4" width="38" x="50" y="50" opacity="0.45" />
  </svg>
);

const HeroDecoration = () => (
  null
);

function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const destination =
        user.role === 'CUSTOMER'
          ? '/customer'
          : user.role === 'SELLER'
            ? '/seller/products'
            : null;
      if (destination) {
        void router.replace(destination);
      }
    }
  }, [loading, user, router]);

  if (!loading && user) {
    if (user.role === 'CUSTOMER' || user.role === 'SELLER') {
      return null;
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Tea Haven | Discover your perfect tea blend</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className={styles.header}>
        <Link className={styles.logo} href="/">
          <span aria-hidden="true" className={styles.logoMark} />
          <span>TEA HAVEN</span>
        </Link>
        <nav className={styles.authActions} aria-label="Authentication">
          <Link className={styles.loginButton} href="/auth/login">
            Log in
          </Link>
          <Link className={styles.registerButton} href="/auth/register">
            Register
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>Discover your perfect tea blend</h1>
            <p>
              Curated collections from independent tea artisans delivered fresh to your door.
            </p>
            {/* Hero actions removed per updated landing layout */}
          </div>
        </section>

        <section aria-labelledby="how-it-works" className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 id="how-it-works">How it works</h2>
            <span aria-hidden="true" className={styles.sectionToggle}>﹀</span>
          </header>
          <div className={styles.sectionDivider} />
          <div className={styles.stepsGrid}>
            {steps.map((step, index) => (
              <article className={styles.stepCard} key={step.title}>
                <StepIllustration index={index} />
                <div className={styles.stepContent}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <span>{step.caption}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="join-teahaven" className={`${styles.section} ${styles.joinSection}`}>
          <header className={styles.sectionHeader}>
            <h2 id="join-teahaven">Join Tea Haven</h2>
            <span aria-hidden="true" className={styles.sectionToggle}>﹀</span>
          </header>
          <div className={styles.sectionDivider} />
          <div className={styles.joinGrid}>
            {joins.map((item, index) => (
              <article className={styles.joinCard} key={item.title}>
                <div className={styles.joinIllustrationWrapper}>
                  <StepIllustration index={index + 1} />
                </div>
                <div className={styles.joinContent}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <Link className={styles.joinButton} href={item.href}>
                  {item.action}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Tea Haven. Crafted with care for tea enthusiasts.</p>
        <div className={styles.footerLinks}>
          <a href="mailto:support@teahaven.dev">Support</a>
          <Link href="/about">About</Link>
        </div>
      </footer>
    </div>
  );
}

LandingPage.disableShell = true;

export default LandingPage;
