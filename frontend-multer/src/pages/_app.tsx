import type { AppProps } from "next/app";
import "bootstrap/dist/css/bootstrap.min.css";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function Navigation() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <a className="navbar-brand" href="/">
          Posts App
        </a>
        <div className="navbar-nav me-auto">
          <a className="nav-link" href="/">
            All Posts
          </a>
          {user && (
            <a className="nav-link" href="/posts/new">
              New Post
            </a>
          )}
        </div>
        <div className="navbar-nav">
          {user ? (
            <>
              <span className="navbar-text me-3">
                Welcome, {user.username}!
              </span>
              <button
                className="btn btn-outline-light btn-sm"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a className="nav-link" href="/auth/login">
                Login
              </a>
              <a className="nav-link" href="/auth/register">
                Register
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function AppContent({ Component, pageProps }: AppProps) {
  return (
    <>
      <Navigation />
      <div className="container mt-4">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default function App(props: AppProps) {
  return (
    <AuthProvider>
      <AppContent {...props} />
    </AuthProvider>
  );
}
