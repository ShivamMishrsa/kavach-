import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { signInAvailable } from '@/api/mode';
import { useDeleteAllScans } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { AccountPanel } from '@/components/AccountPanel';
import { InstallPanel } from '@/components/InstallPanel';
import { PageHeader } from '@/components/PageHeader';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { useConsent } from '@/consent/ConsentProvider';
import { formatDateTime } from '@/lib/format';
import { usePending } from '@/offline/PendingProvider';
import pkg from '../../package.json';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { consent, granted, grant, withdraw } = useConsent();
  const deleteAll = useDeleteAllScans();
  const pending = usePending();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title={t('settings.title')} />

      <Section id="appearance" title={t('settings.appearance')}>
        <SettingsPanel />
      </Section>

      <Section id="install" title={t('install.title')}>
        <InstallPanel />
      </Section>

      <Section id="privacy" title={t('settings.privacy')}>
        <p className="text-muted">
          {granted && consent
            ? t('settings.consentGiven', { date: formatDateTime(consent.grantedAt, i18n.language) })
            : t('settings.consentNone')}
        </p>
        <div>
          {granted ? (
            <Button variant="outline" onClick={withdraw}>
              {t('settings.withdraw')}
            </Button>
          ) : (
            <Button onClick={grant}>{t('consent.agree')}</Button>
          )}
        </div>
        <div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t('history.deleteAll')}</Button>
            </DialogTrigger>
            <DialogContent title={t('history.confirmTitle')} description={t('history.confirmBody')}>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await deleteAll.mutateAsync();
                      await pending.clear(); // checks waiting for a connection go too
                      toast.success(t('history.deleted'));
                    }}
                  >
                    {t('history.deleteAll')}
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="ghost">{t('common.cancel')}</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      {signInAvailable && (
        <Section id="account" title={t('settings.account')}>
          {session?.kind === 'user' ? (
            <AccountPanel email={session.email} />
          ) : (
            <>
              <p className="text-muted">{t('settings.guestInfo')}</p>
              <div>
                <Button onClick={() => navigate('/login')}>{t('settings.loginOrSignup')}</Button>
              </div>
            </>
          )}
        </Section>
      )}

      <p className="text-xs text-muted">{t('settings.about', { version: pkg.version })}</p>
    </div>
  );
}
