import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api, isMockApi } from '@/api/client';
import { queryKeys, useDeleteAllScans } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { errorKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** Saves a downloaded file under a name, the way a link with a "download" attribute does. */
function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

/** Runs an action and tells the person in plain words when it fails. */
function useRun() {
  const { t } = useTranslation();
  return async (action: () => Promise<void>, done?: string) => {
    try {
      await action();
      if (done) toast.success(done);
    } catch (failure) {
      toast.error(t(errorKey(failure)));
    }
  };
}

/** Asks for a link to the new address. The address changes when the person opens it. */
function ChangeEmail() {
  const { t } = useTranslation();
  const { requestEmailChange } = useAuth();
  const run = useRun();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateEmail(email)) return setError(t('auth.emailError'));
    setError(undefined);
    await run(() => requestEmailChange(email), t('settings.confirmSent'));
    setOpen(false);
    setEmail('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t('settings.changeEmail')}</Button>
      </DialogTrigger>
      <DialogContent title={t('settings.changeEmail')} description={t('settings.changeEmailBody')}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Input
            label={t('auth.emailLabel')}
            error={error}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
          />
          <Button type="submit">{t('settings.sendConfirm')}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Where the account is signed in, with a way to end each one. */
function SignIns() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const run = useRun();
  const { data = [] } = useQuery({ queryKey: queryKeys.signIns, queryFn: () => api.listSignIns() });

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h3 className="font-bold">{t('settings.devicesTitle')}</h3>
      <ul className="flex flex-col gap-1">
        {data.map((signIn) => (
          <li key={signIn.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
            <span>
              {t('settings.deviceSince', { date: formatDateTime(signIn.createdAt, i18n.language) })}
            </span>
            {signIn.current ? (
              <span className="rounded-full bg-chip px-3 py-0.5 font-bold text-primary">
                {t('settings.deviceThis')}
              </span>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  run(async () => {
                    await api.endSignIn(signIn.id);
                    await client.invalidateQueries({ queryKey: queryKeys.signIns });
                  })
                }
              >
                {t('settings.signOut')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a signed-in person can do with their account. The server-side parts need the real backend. */
export function AccountPanel({ email }: { email: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { account, signOut, deleteAccount, updateAccount } = useAuth();
  const deleteAll = useDeleteAllScans();
  const run = useRun();
  const [uploadExisting, setUploadExisting] = useState(true);
  /** The signed-in account on the real backend. The demo has no server account to manage. */
  const live = isMockApi ? null : account;

  const leave = (everywhere: boolean) =>
    run(async () => {
      await signOut(everywhere);
      navigate('/');
    });

  const turnSyncOn = () =>
    run(async () => {
      await updateAccount({ syncHistory: true });
      if (uploadExisting) await api.uploadHistory();
      await client.invalidateQueries({ queryKey: queryKeys.history });
    }, t('settings.syncOnDone'));

  const turnSyncOff = () =>
    run(async () => {
      await updateAccount({ syncHistory: false });
      await client.invalidateQueries({ queryKey: queryKeys.history });
    }, t('settings.syncOffDone'));

  const exportData = () =>
    run(async () => saveFile(await api.exportAccount(), 'kavach-account.json'));

  const remove = () =>
    run(async () => {
      await deleteAll.mutateAsync();
      await deleteAccount();
      navigate('/');
    });

  return (
    <>
      <p>{t('settings.signedInAs', { email })}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => leave(false)}>
          {t('settings.signOut')}
        </Button>
        {live && (
          <>
            <Button variant="outline" onClick={() => leave(true)}>
              {t('settings.signOutEverywhere')}
            </Button>
            <ChangeEmail />
            <Button variant="outline" onClick={exportData}>
              {t('settings.exportData')}
            </Button>
          </>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('settings.deleteAccount')}</Button>
          </DialogTrigger>
          <DialogContent
            title={t('settings.deleteAccountTitle')}
            description={t('settings.deleteAccountBody')}
          >
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="danger" onClick={remove}>
                  {t('settings.deleteAccount')}
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="ghost">{t('common.cancel')}</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {live && <SignIns />}

      {live && (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h3 className="font-bold">{t('settings.syncTitle')}</h3>
          <p className="text-sm text-muted">{t('settings.syncBody')}</p>
          {live.syncHistory ? (
            <div>
              <Button variant="outline" onClick={turnSyncOff}>
                {t('settings.syncOff')}
              </Button>
            </div>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="self-start">{t('settings.syncOn')}</Button>
              </DialogTrigger>
              <DialogContent title={t('settings.syncTitle')} description={t('settings.syncBody')}>
                <label className="mb-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={uploadExisting}
                    onChange={(event) => setUploadExisting(event.target.checked)}
                    className="mt-1 size-5 flex-none accent-primary"
                  />
                  <span>{t('settings.syncUpload')}</span>
                </label>
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button onClick={turnSyncOn}>{t('settings.syncOn')}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="ghost">{t('common.cancel')}</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </>
  );
}
