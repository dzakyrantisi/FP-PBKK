import type { AppProps } from 'next/app';
import type { NextPage } from 'next';
import Head from 'next/head';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/theme.css';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider } from '../contexts/cart/CartContext';
import { ProductsProvider } from '../contexts/products/ProductsContext';
import { TeaShell } from '../components/TeaShell';

type NextPageWithShell = NextPage & {
  disableShell?: boolean;
};

type AppPropsWithShell = AppProps & {
  Component: NextPageWithShell;
};

function AppContent({ Component, pageProps }: AppPropsWithShell) {
  if (Component.disableShell) {
    return <Component {...pageProps} />;
  }

  return (
    <TeaShell>
      <Component {...pageProps} />
    </TeaShell>
  );
}

export default function App(props: AppPropsWithShell) {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <title>Tea Haven Platform</title>
      </Head>
      <AuthProvider>
        <ProductsProvider>
          <CartProvider>
            <AppContent {...props} />
          </CartProvider>
        </ProductsProvider>
      </AuthProvider>
    </>
  );
}
