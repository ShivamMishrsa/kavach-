import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { normalizeUrl } from '@/api/mock/analyze';
import { Spinner } from '@/components/StateMessage';

/**
 * Where "Share to Kavach" from another app (a messaging app, the browser) arrives, once Kavach is
 * installed (the address is in manifest.webmanifest). A shared link opens the link check; any other
 * text opens the notice check with the text filled in. Nothing is sent anywhere yet: the person
 * still presses the check button, after the consent they have already given.
 */
export default function Share() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const parts = ['title', 'text', 'url']
      .map((name) => params.get(name)?.trim())
      .filter((part): part is string => Boolean(part));
    const shared = [...new Set(parts)].join('\n');
    if (!shared) navigate('/app', { replace: true });
    else if (!/\s/.test(shared) && normalizeUrl(shared)) {
      navigate('/app/scan/link', { replace: true, state: { shared: { url: shared } } });
    } else {
      navigate('/app/scan/notice', { replace: true, state: { shared: { text: shared } } });
    }
  }, [navigate, params]);

  return <Spinner />;
}
