import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';

/** First-run pages: people who are already set up go straight into the app. */
export function RedirectIfReady() {
  const { session, onboarded } = useAuth();
  if (session && onboarded) return <Navigate to="/app" replace />;
  if (session && !onboarded) return <Navigate to="/language" replace />;
  return <Outlet />;
}

/** Log in and sign up stay open to guests (they can upgrade), but not to signed-in accounts. */
export function RedirectIfUser() {
  const { session, onboarded } = useAuth();
  if (session?.kind === 'user') return <Navigate to={onboarded ? '/app' : '/language'} replace />;
  return <Outlet />;
}

/** The language screen needs a session (account or guest) but not onboarding yet. */
export function RequireSessionOnly() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** The app itself needs a session and a chosen language. */
export function RequireOnboarded() {
  const { session, onboarded } = useAuth();
  if (!session) return <Navigate to="/" replace />;
  if (!onboarded) return <Navigate to="/language" replace />;
  return <Outlet />;
}
