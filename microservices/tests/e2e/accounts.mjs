// Accounts against the REAL backend: sign up with an emailed link, language kept in the account,
// history sync, data export, sign out everywhere and account deletion.
// The backend is started by run.ps1 without a mail service, so it writes each email to
// <data dir>/outbox.jsonl, which this script reads like an inbox.
// Usage: node accounts.mjs <outDir>   (normally started by run.ps1)
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { connect } from './cdp.mjs';

const [out] = process.argv.slice(2);
const api = 'http://localhost:8001';
const locale = (code) =>
  JSON.parse(readFileSync(new URL(`../../frontend/src/i18n/locales/${code}.json`, import.meta.url), 'utf8'));
const en = locale('en');
const hi = locale('hi');
const { send, sleep, ev, waitFor, hasText, waitText, clickText, setValue, pathname, go, shot, check, finish } =
  await connect({ out, base: 'http://localhost:4174', prefix: 'accounts' });

const EMAIL = 'ravi.kumar@example.com';
const outbox = path.join(out, 'backend-data', 'outbox.jsonl');
const mails = () =>
  existsSync(outbox) ? readFileSync(outbox, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];

/** Asks for a link on the log in screen and returns the link from the "inbox". */
async function requestLink(email, language = en) {
  const before = mails().length;
  await go('/login');
  await setValue('input[type=email]', email);
  await clickText('button', language.auth.sendLink);
  await waitText(language.auth.checkTitle);
  for (let i = 0; i < 40 && mails().length === before; i++) await sleep(150);
  return mails().at(-1)?.body.match(/(http\S+#token=\S+)/)?.[1];
}

const openLink = async (link) => {
  await send('Page.navigate', { url: link });
  await sleep(1500);
};
const fromPage = (path, init = '{}') =>
  ev(`fetch('${api}${path}', { credentials: 'include', ...${init} }).then(async (r) => ({ status: r.status, body: await r.text() }))`);
const me = async () => {
  const answer = await fromPage('/v1/auth/me');
  return { status: answer.status, account: answer.status === 200 ? JSON.parse(answer.body) : null };
};

// ---------- asking for a link ----------
await go('/');
await ev('localStorage.clear()');
const link = await requestLink(EMAIL);
check('The sign-in screen says "check your email" and has no demo button', !(await ev(hasText(en.auth.continueDemo))));
check('The email was sent to that address with a link to the website', mails().at(-1)?.to === EMAIL && /^http:\/\/localhost:4174\/auth\/verify#token=[\w-]{40,}$/.test(link ?? ''));
await shot('1-check-email');

const asked = async (email) => {
  const reply = await fetch(`${api}/v1/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return [reply.status, await reply.text()];
};
check('A known and an unknown address get exactly the same answer (nobody can find out who has an account)', JSON.stringify(await asked(EMAIL)) === JSON.stringify(await asked('nobody.here@example.com')));
const evil = await fetch(`${api}/v1/auth/logout`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
check('A request that changes an account from another website is refused', evil.status === 403);

// ---------- opening the link ----------
await openLink(link);
check('The link signs a new person in and asks for a language', await waitFor(`location.pathname === '/language'`));
check('The address bar no longer shows the secret', await ev(`!location.href.includes('token')`));
check('Scripts on the page cannot read the session cookie', await ev(`!document.cookie.includes('kavach_session')`));
await clickText('[role=radio]', 'हिन्दी');
await sleep(500);
await clickText('button', hi.common.continue, true);
check('Choosing Hindi opens the app in Hindi', (await waitFor(`location.pathname === '/app'`)) && (await ev('document.documentElement.lang')) === 'hi');
check('The language is saved in the account on the server', await waitFor(`fetch('${api}/v1/auth/me', { credentials: 'include' }).then((r) => r.json()).then((a) => a.language === 'hi')`));

await openLink(link);
check('The same link cannot be used twice', await waitText(hi.auth.verifyFailedTitle));
await shot('2-link-used');

// ---------- another device: the language comes from the account ----------
await go('/');
await ev('localStorage.clear()');
await go('/');
check('A new browser with the same session opens the app straight away, in Hindi', (await waitFor(`location.pathname === '/app'`)) && (await ev('document.documentElement.lang')) === 'hi');

// ---------- settings: sync, export ----------
await go('/app/settings');
check('Settings shows the account and its options', (await waitText(EMAIL)) && (await ev(hasText(hi.settings.signOutEverywhere))) && (await ev(hasText(hi.settings.exportData))));
check('History sync starts off', (await me()).account?.syncHistory === false);
await clickText('main button', hi.settings.syncOn);
await waitFor(`!!document.querySelector('[role=dialog]')`);
await shot('3-sync-dialog');
await clickText('[role=dialog] button', hi.settings.syncOn);
check('Turning on sync is saved in the account', await waitFor(`fetch('${api}/v1/auth/me', { credentials: 'include' }).then((r) => r.json()).then((a) => a.syncHistory === true)`));

// ---------- a check while signed in ----------
await go('/app/scan/notice');
await sleep(500);
await clickText('button', hi.consent.agree);
await ev(`document.querySelector('section[aria-labelledby=samples-title] button').click()`);
const shown = await waitFor(`!!document.querySelector('section[aria-labelledby=risk-title]')`, 25000);
const scanId = (await pathname()).split('/').pop();
check('A signed-in person gets a result', shown);
check('The check reaches the history in the account (kind, risk and time only)', await waitFor(`fetch('${api}/v1/history', { credentials: 'include' }).then((r) => r.json()).then((rows) => rows.length === 1 && rows[0].id === '${scanId}' && rows[0].riskLevel === 'very_high' && Object.keys(rows[0]).sort().join() === 'createdAt,id,kind,riskLevel')`));
check('Someone without the session cannot open that check', (await fetch(`${api}/v1/scans/${scanId}`)).status === 404);
await go('/app/history');
check('The history screen lists it', await waitText(hi.risk.label.very_high));

// ---------- export ----------
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
const exported = path.join(out, 'kavach-account.json');
rmSync(exported, { force: true });
await go('/app/settings');
await waitText(hi.settings.exportData);
await clickText('main button', hi.settings.exportData);
for (let i = 0; i < 40 && !existsSync(exported); i++) await sleep(250);
const data = existsSync(exported) ? JSON.parse(readFileSync(exported, 'utf8')) : {};
check('The downloaded data has the account, the language and the history', data.account?.email === EMAIL && data.account?.language === 'hi' && data.history?.length === 1);
check('The downloaded data holds no secrets and no check content', !/token|kavach_session|utr|upi/i.test(JSON.stringify(data)));

// ---------- where the account is signed in, and a new email address ----------
const NEW_EMAIL = 'ravi.kumar.new@example.com';
check('Settings lists where the account is signed in and marks this device', (await waitText(hi.settings.devicesTitle)) && (await ev(hasText(hi.settings.deviceThis))));
await clickText('main button', hi.settings.changeEmail);
await waitFor(`!!document.querySelector('[role=dialog]')`);
const mailsBefore = mails().length;
await setValue('[role=dialog] input[type=email]', NEW_EMAIL);
await clickText('[role=dialog] button', hi.settings.sendConfirm);
for (let i = 0; i < 40 && mails().length === mailsBefore; i++) await sleep(150);
const confirmLink = mails().at(-1)?.body.match(/(http\S+#token=\S+)/)?.[1];
check('The confirmation link goes to the NEW address and the account still has the old one', mails().at(-1)?.to === NEW_EMAIL && /\/auth\/confirm-email#token=/.test(confirmLink ?? '') && (await me()).account?.email === EMAIL);
await openLink(confirmLink);
check('Opening the link changes the address and returns to Settings', (await waitFor(`location.pathname === '/app/settings'`)) && (await waitText(NEW_EMAIL)) && (await me()).account?.email === NEW_EMAIL);
await openLink(confirmLink);
check('The confirmation link works once', await waitText(hi.auth.verifyFailedTitle));
await shot('3b-email-changed');

// ---------- sign out everywhere, then back in ----------
await go('/app/settings');
await waitText(hi.settings.signOutEverywhere);
await clickText('main button', hi.settings.signOutEverywhere);
check('Signing out everywhere returns to the start page', await waitFor(`location.pathname === '/'`));
check('The server no longer knows this browser', (await me()).status === 401);
await go('/app');
check('The app is closed again after signing out', await waitFor(`location.pathname === '/'`));

const second = await requestLink(NEW_EMAIL, hi);
await openLink(second);
check('Signing in again goes straight to the app (the language is remembered)', (await waitFor(`location.pathname === '/app'`)) && (await ev('document.documentElement.lang')) === 'hi');
await go('/app/history');
check('The synced history is still there after signing in again', await waitText(hi.risk.label.very_high));

// ---------- deleting the account ----------
await go('/app/settings');
await waitText(hi.settings.deleteAccount);
await clickText('main button', hi.settings.deleteAccount);
await waitFor(`!!document.querySelector('[role=dialog]')`);
await shot('4-delete-dialog');
await clickText('[role=dialog] button', hi.settings.deleteAccount);
check('Deleting the account returns to the start page', await waitFor(`location.pathname === '/'`));
check('The server no longer knows the session', (await me()).status === 401);

const third = await requestLink(NEW_EMAIL, hi);
await openLink(third);
check('The same address now starts from nothing and is asked for a language', await waitFor(`location.pathname === '/language'`));
const fresh = await me();
check('The new account has no language, no sync and no history', fresh.account?.language === null && fresh.account?.syncHistory === false && (await fromPage('/v1/history')).body === '[]');

finish();
