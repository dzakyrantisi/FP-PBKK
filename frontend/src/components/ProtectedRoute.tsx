import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/shared';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const unauthorized = !!user && Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (unauthorized) {
      router.replace('/');
    }
  }, [user, loading, unauthorized, router]);

  if (loading || (!user && !router.isReady)) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="alert alert-warning">
        <h4>Authentication required</h4>
        <p>Please sign in to continue.</p>
        <a className="btn btn-success" href="/auth/login">
          Go to login
        </a>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="alert alert-danger">
        <h4>Access denied</h4>
        <p>This page is restricted to specific roles. Contact support if you believe this is an error.</p>
      </div>
    );
  }

  return <>{children}</>;
}