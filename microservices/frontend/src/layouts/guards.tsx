import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/StateMessage';

/**
 * With the real backend, whether someone is signed in is only known after the first answer from
 * the server. Until then the guards wait, so nobody is sent to the wrong page for a moment.
 */
const waiting = <Spinner />;

/**
 * First-run pages: people who are already set up go straight into the app. These pages are shown
 * while the answer is still coming, because they are also the ones written out in advance for
 * search engines and slow phones; a signed-in person is moved on a moment later.
 */
export function RedirectIfReady() {
  const { session, onboarded, ready } = useAuth();
  if (!ready) return <Outlet />;
  if (session && onboarded) return <Navigate to="/app" replace />;
  if (session && !onboarded) return <Navigate to="/language" replace />;
  return <Outlet />;
}

/** Log in and sign up stay open to guests (they can upgrade), but not to signed-in accounts. */
export function RedirectIfUser() {
  const { session, onboarded, ready } = useAuth();
  if (!ready) return waiting;
  if (session?.kind === 'user') return <Navigate to={onboarded ? '/app' : '/language'} replace />;
  return <Outlet />;
}

/** The language screen needs a session (account or guest) but not onboarding yet. */
export function RequireSessionOnly() {
  const { session, ready } = useAuth();
  if (!ready) return waiting;
  if (!session) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** The app itself needs a session and a chosen language. */
export function RequireOnboarded() {
  const { session, onboarded, ready } = useAuth();
  if (!ready) return waiting;
  if (!session) return <Navigate to="/" replace />;
  if (!onboarded) return <Navigate to="/language" replace />;
  return <Outlet />;
}
