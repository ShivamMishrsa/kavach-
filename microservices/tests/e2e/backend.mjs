// End-to-end test against the REAL backend: a photo of a fake notice is uploaded in the browser,
// read by Tesseract, judged by the rules, and the result is shown in Hindi.
// Usage: node backend.mjs <outDir> <noticeImage>   (normally started by run.ps1)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { connect } from './cdp.mjs';

const [out, noticeImage] = process.argv.slice(2);
const api = 'http://localhost:8001';
const hi = JSON.parse(
  readFileSync(new URL('../../frontend/src/i18n/locales/hi.json', import.meta.url), 'utf8'),
);
const { send, sleep, ev, waitFor, hasText, waitText, clickText, setValue, chooseFile, pathname, go, shot, check, finish } =
  await connect({ out, base: 'http://localhost:4174', prefix: 'backend' });

const lastEnabledButton = (scope) =>
  `[...document.querySelectorAll('${scope} button')].filter((b) => !b.disabled).pop().click()`;
const resultShown = (ms = 25000) =>
  waitFor(`!!document.querySelector('section[aria-labelledby=risk-title]')`, ms);
const apiScan = async (id) => fetch(`${api}/v1/scans/${id}`);

// A guest who chose Hindi. Consent is given on screen below, so the backend records it.
await go('/');
await ev(`localStorage.clear();
  localStorage.setItem('kavach.session', '{"kind":"guest"}');
  localStorage.setItem('kavach.onboarded', '1');
  localStorage.setItem('kavach.lang', 'hi');`);
await go('/app');
check('Real mode: no "demo mode" banner', !(await ev(hasText(hi.common.demoBanner))));

// ---------- photo of a notice ----------
await go('/app/scan/notice');
await clickText('button', hi.consent.agree);
const consentLog = path.join(out, 'backend-data', 'consent.jsonl');
for (let i = 0; i < 30 && !existsSync(consentLog); i++) await sleep(200);
const consentText = existsSync(consentLog) ? readFileSync(consentLog, 'utf8') : '';
const record = consentText ? JSON.parse(consentText.trim().split('\n')[0]) : {};
check('Agreeing to the consent is recorded by the backend', record.version === '2026-11-v1' && record.granted === true && /^[0-9a-f]{64}$/.test(record.person));
check('The consent record holds no IP address', consentText !== '' && !/127\.0\.0\.1|::1/.test(consentText));
await chooseFile('input[type=file]:not([capture])', noticeImage);
check('The chosen photo is previewed', await waitFor(`!!document.querySelector('img[alt]')`, 4000));
await ev(lastEnabledButton('main fieldset'));
check('Checking opens the scan page', await waitFor(`/^\\/app\\/scan\\/(?!notice$|link$)[\\w-]+$/.test(location.pathname)`));
const scanId = (await pathname()).split('/').pop();
check('The real result appears (Tesseract + rules)', await resultShown());
await shot('1-result');

check('Result is shown in Hindi: very high risk', await ev(hasText(hi.risk.title.very_high)));
for (const code of [
  'digital_arrest',
  'safe_account',
  'payment_demand',
  'secrecy',
  'urgency',
  'outdated_section',
]) {
  check(`Reason shown in Hindi: ${code}`, await ev(hasText(hi.reasons[code])));
}
const statute = hi.statutes.line.replace('{{cited}}', 'IPC 420').replace('{{current}}', 'BNS 318(4)');
check('The old law section and its replacement are shown', await ev(hasText(statute)));
check('No "demo result" notice on a real result', !(await ev(hasText(hi.scan.simulatedNote))));

const sent = readFileSync(noticeImage);
const fingerprint = createHash('sha256').update(sent).digest('hex');
const scan = await (await apiScan(scanId)).json();
check('The backend says the result is real (not simulated)', scan.simulated === false && scan.status === 'done');
check('The backend recorded the real SHA-256 of the file', scan.evidence[0].sha256 === fingerprint);

// ---------- details and evidence summary ----------
await clickText('a', hi.scan.reviewDetails);
check('Details page lists what was read from the photo', (await waitFor(`location.pathname.endsWith('/details')`)) && (await waitText('safe.verification@upi')));
check('UTR, phone and amount were read too', (await ev(hasText('400000000001'))) && (await ev(hasText('90000 00000'))) && (await ev(hasText('50,000'))));
await ev(`document.querySelector('main input[type=checkbox]').click()`);
await sleep(200);
await ev(lastEnabledButton('main'));
check('Evidence summary opens', await waitFor(`location.pathname.endsWith('/dossier')`));
await sleep(500);
check('Summary script has the UPI id and UTR', await ev(`(() => { const t = document.querySelector('blockquote')?.innerText ?? ''; return t.includes('safe.verification@upi') && t.includes('400000000001'); })()`));
check('Summary shows the fingerprint of the photo', await ev(hasText(fingerprint.slice(0, 10))));
await shot('2-dossier');

// ---------- the PDF ----------
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
const pdfFile = path.join(out, 'kavach-evidence-summary.pdf');
rmSync(pdfFile, { force: true }); // a file left by an earlier run would be saved under another name
await clickText('button', hi.dossier.pdfDownload);
const shownHash = await waitFor(`document.querySelector('[data-testid=pdf-sha256]')?.textContent`, 20000);
check('The PDF fingerprint is shown after the PDF is made', /^[0-9a-f]{64}$/.test(shownHash || ''));
for (let i = 0; i < 40 && !existsSync(pdfFile); i++) await sleep(250);
const pdf = existsSync(pdfFile) ? readFileSync(pdfFile) : Buffer.alloc(0);
check('A PDF was downloaded', pdf.subarray(0, 5).toString() === '%PDF-');
check('The shown fingerprint is the SHA-256 of the downloaded file', createHash('sha256').update(pdf).digest('hex') === shownHash);
await shot('2b-dossier-pdf');
check('The backend kept the details the person confirmed', (await (await apiScan(scanId)).json()).confirmedEntities?.length > 0);

// ---------- delete now ----------
await go(`/app/scan/${scanId}`);
await waitText(hi.scan.deleteNow);
await clickText('button', hi.scan.deleteNow);
check('"Delete now" returns home', await waitFor(`location.pathname === '/app'`));
check('The backend no longer has the scan', (await apiScan(scanId)).status === 404);
await go(`/app/scan/${scanId}`);
check('Opening the deleted check shows "could not find" (it is gone everywhere)', await waitText(hi.scan.notFoundTitle));

// ---------- pasted text and a link ----------
await go('/app/scan/notice');
await clickText('[role=radio]', hi.notice.modeText);
await setValue(
  'textarea',
  'Rs 1,200 debited from your account on 12/11/2026. If this was not you, contact your bank branch. Do not share your OTP with anyone.',
);
await sleep(200);
await ev(lastEnabledButton('main fieldset'));
check('An ordinary bank alert is judged low risk', (await resultShown(12000)) && (await ev(hasText(hi.risk.title.low))));

await go('/app/scan/link');
await setValue('input[type=url]', 'http://sbi-kyc-update.example/verify');
await sleep(200);
await clickText('button[type=submit]', '');
check('A look-alike bank link is judged high risk', (await resultShown(12000)) && (await ev(hasText(hi.risk.title.high))));
check('Link reasons are shown in Hindi', (await ev(hasText(hi.reasons.lookalike_domain))) && (await ev(hasText(hi.reasons.insecure_link))));
await shot('3-link');

// ---------- history ----------
await go('/app/history');
check('History lists the checks with their risk levels', (await waitText(hi.risk.label.low)) && (await ev(hasText(hi.risk.label.high))));
check('History holds no details of the deleted check', !(await ev(hasText('safe.verification@upi'))));

finish();
