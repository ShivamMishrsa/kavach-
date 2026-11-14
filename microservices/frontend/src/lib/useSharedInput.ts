import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export interface SharedInput {
  text?: string;
  url?: string;
}

/**
 * What another app handed to Kavach through "Share" (see src/pages/Share.tsx). It arrives in the
 * navigation state, is read once, and is then removed from the history entry, so a shared message
 * is not left sitting in the browser's history.
 */
export function useSharedInput(): SharedInput {
  const location = useLocation();
  const navigate = useNavigate();
  const [shared] = useState<SharedInput>(
    () => (location.state as { shared?: SharedInput } | null)?.shared ?? {},
  );
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
    // Only once, for what was there when the screen opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return shared;
}
