// End-to-end browser test of the whole demo flow (in-browser mock, no backend), headless Edge.
// Usage: node flow.mjs <outDir>   (normally started by run.ps1)
import { connect } from './cdp.mjs';

const { sleep, ev, send, waitFor, hasText, waitText, clickText, setValue, pathname, go, shot, check, finish } =
  await connect({ out: process.argv[2], base: 'http://localhost:4173', prefix: 'flow' });

await go('/');
await ev('localStorage.clear()');
await go('/');

// ---------- first run ----------
check('Welcome shows guest, log in and sign up', (await waitText('Continue without account')) && (await ev(hasText('Log in'))) && (await ev(hasText('Sign up'))));
check('Default language is English', (await ev('document.documentElement.lang')) === 'en');
check('Demo mode banner is visible', await ev(hasText('Demo mode')));
check('1930 helpline strip is visible on welcome', await ev('!!document.querySelector("a[href=\\"tel:1930\\"]")'));
await shot('01-welcome');

await go('/app');
check('The app is protected: /app redirects to welcome without a session', (await pathname()) === '/');

await clickText('button', 'Continue without account');
check('Guest goes to the language screen', (await waitFor(`location.pathname === '/language'`)) && (await ev(hasText('Choose your language'))));
check('English is selected on the language screen', await ev(`document.querySelector('[role=radio][aria-checked=true]').textContent.includes('English')`));
await shot('02-language');
await clickText('button', 'Continue', true);
check('Continue opens the app home', (await waitFor(`location.pathname === '/app'`)) && (await waitText('What would you like to check?')));
check('Home shows the four main actions', (await ev(hasText('Notice, message or screenshot'))) && (await ev(hasText('Link'))) && (await ev(hasText('Voice note'))) && (await ev(hasText('Already sent money?'))));
check('Voice note is marked as coming soon', await ev(hasText('Coming soon')));
check('Phone layout shows the bottom navigation', await ev(`getComputedStyle(document.querySelector('nav[aria-label="Main menu"]:last-of-type')).display !== 'none'`));
await shot('03-home');

// ---------- consent + notice (pasted text) ----------
await clickText('a', 'Notice, message or screenshot');
check('Notice screen opens', await waitText('Check a notice or message'));
check('Consent card is shown before the first upload', await ev(hasText('Your consent')));
check('Check now is locked until consent is given', await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Check now').disabled`));
await shot('04-consent');
await clickText('button', 'I agree');
await sleep(300);
check('Consent card disappears after agreeing', !(await ev(hasText('Your consent'))));
check('Consent is saved with a version and time', await ev(`(() => { const c = JSON.parse(localStorage.getItem('kavach.consent')||'null'); return !!c && !!c.version && !!c.grantedAt; })()`));

await clickText('[role=radio]', 'Paste text');
const arrestText = 'This is CBI. You are under digital arrest. Transfer Rs. 50000 to the safe account immediately. Do not tell anyone. Pay to scam@okaxis, call 9876543210';
await setValue('textarea', arrestText);
await sleep(200);
check('Check now becomes enabled once text is entered', await ev(`![...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Check now').disabled`));
await clickText('button', 'Check now');
check('Checking starts and opens the scan page', await waitFor(`/^\\/app\\/scan\\/scn_/.test(location.pathname)`));
check('Progress shows real stage names', await waitText('Checking for scam signs', 6000) || await waitText('File received securely', 6000));
await shot('05-progress');
check('Result appears after the stages finish', await waitText('Result', 9000) && await waitText('Very high risk', 9000));
check('Result shows reasons', (await ev(hasText('Demands a money transfer'))) && (await ev(hasText('digital arrest'))));
check('Result is clearly marked as a demo/simulated result', await ev(hasText('simulated for testing')));
check('Result never shows an accuracy percentage or "100%"', !(await ev(`/\\d+\\s?%/.test(document.querySelector('main').innerText)`)));
check('Result shows what to do now and the disclaimer', (await ev(hasText('What to do now'))) && (await ev(hasText('not a final verdict'))));
check('Deletion time is shown', await ev(hasText('will be deleted at')));
await shot('06-result');
const scanUrl = await pathname();

// feedback dialog
await clickText('button', 'Result looks wrong?');
check('Feedback dialog opens', await waitFor(`!!document.querySelector('[role=dialog]')`));
check('Send is disabled until a choice is made', await ev(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim()==='Send').disabled`));
await ev(`document.querySelector('[role=dialog] input[type=radio]').click()`);
await sleep(150);
await clickText('[role=dialog] button', 'Send');
check('Feedback is sent and the dialog closes', (await waitFor(`!document.querySelector('[role=dialog]')`)) && (await waitText('Thank you')));
check('Feedback stored no file content (only type and scan id)', await ev(`(() => { const f = JSON.parse(localStorage.getItem('kavach.mock.feedback')||'[]'); return f.length===1 && Object.keys(f[0]).every(k => ['scanId','type','note'].includes(k)); })()`));

// ---------- details ----------
await clickText('a', 'Review details and create report');
check('Details page opens with extracted details', (await waitFor(`location.pathname.endsWith('/details')`)) && (await waitText('Check the details')));
check('Amount was extracted from the text', await ev(hasText('Rs. 50000')));
check('UPI id and phone were extracted', (await ev(hasText('scam@okaxis'))) && (await ev(hasText('9876543210'))));
check('Create evidence summary is locked until the details are confirmed', await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Create evidence summary').disabled`));
await setValue('#add-detail', 'utr');
await sleep(150);
await clickText('button', 'Add');
await sleep(250);
check('A missing detail can be added and starts in edit mode', await ev(`!!document.querySelector('main input.font-mono')`));
await setValue('main input.font-mono', '412345678901');
await clickText('button', 'Save');
await sleep(250);
check('The added UTR is shown', await ev(hasText('412345678901')));
await shot('07-details');
await ev(`document.querySelector('main input[type=checkbox]').click()`);
await sleep(150);
await clickText('button', 'Create evidence summary');

// ---------- dossier ----------
check('Dossier opens', (await waitFor(`location.pathname.endsWith('/dossier')`)) && (await waitText('Evidence summary')));
check('Dossier says it is not an FIR', await ev(hasText('not an FIR')));
check('Dossier includes the confirmed UTR', await ev(hasText('412345678901')));
const expectedHash = await ev(`(async () => { const b = new TextEncoder().encode(${JSON.stringify(arrestText)}); const d = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2,'0')).join(''); })()`);
check('Evidence fingerprint is the real SHA-256 of the pasted text', expectedHash && (await ev(hasText(expectedHash.slice(0, 10)))) && (await ev(hasText(expectedHash.slice(-8)))));
check('Script for the helpline contains the UTR and UPI id', await ev(`(() => { const q = document.querySelector('blockquote').innerText; return q.includes('412345678901') && q.includes('scam@okaxis'); })()`));
check('Tells the user to keep original files', await ev(hasText('Keep your original photos')));
check('PDF button is disabled and honest ("coming next")', await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('PDF download')).disabled`));
await shot('08-dossier');

// ---------- history ----------
await go('/app/history');
check('History lists the check with its risk level', (await waitText('Notice or message')) && (await ev(hasText('Very high risk'))));
check('History explains that only metadata is kept', await ev(hasText('We keep only the type, risk level and time')));
await clickText('button[aria-label="Delete this check"]', '');
check('A single history item can be deleted', await waitText('No checks yet'));

// ---------- link ----------
await go('/app/scan/link');
check('Link screen opens', await waitText('Check a link'));
await setValue('input[type=url]', 'not a link');
await clickText('button', 'Check link');
check('An invalid link shows an inline error', await waitText('does not look like a web address'));
await clickText('button', 'Look-alike bank link');
await sleep(200);
check('Demo link fills the input', (await ev(`document.querySelector('input[type=url]').value`)).includes('sbi-kyc-update'));
await clickText('button', 'Check link');
check('Look-alike link is very high risk with the right reasons', (await waitText('Very high risk', 9000)) && (await ev(hasText('imitates a known bank'))) && (await ev(hasText('secure connection'))));
await shot('09-link-result');

// ---------- sample + cannot verify ----------
await go('/app/scan/notice');
await clickText('button', 'Unclear photo');
check('Unclear photo sample gives "Could not verify"', await waitText('Could not verify', 9000));
check('Could not verify never says it is safe', !(await ev(hasText('safe to'))));

// ---------- expiry ----------
const expiredId = (await pathname()).split('/').pop();
await ev(`(() => { const s = JSON.parse(localStorage.getItem('kavach.mock.scans')); for (const k in s) s[k].expiresAt = new Date(Date.now()-1000).toISOString(); localStorage.setItem('kavach.mock.scans', JSON.stringify(s)); })()`);
await go('/app/scan/' + expiredId);
check('An expired check shows the "deleted" screen', await waitText('This check was deleted'));
check('Expired check holds no details any more', await ev(`localStorage.getItem('kavach.mock.scans') === '{}'`));
await go('/app/scan/scn_doesnotexist');
check('An unknown check id shows "could not find"', await waitText('We could not find this check'));

// ---------- checklist ----------
await go('/app/sent-money');
check('Checklist opens with a 1930 button', (await waitText('First-hour checklist')) && (await ev('!!document.querySelector("a[href=\\"tel:1930\\"]")')));
const boxes = await ev(`document.querySelectorAll('main input[type=checkbox]').length`);
check('Checklist has 6 steps', boxes === 6);
await ev(`document.querySelectorAll('main input[type=checkbox]')[0].click()`);
await ev(`document.querySelectorAll('main input[type=checkbox]')[2].click()`);
await sleep(200);
check('Progress shows 2 of 6', await ev(hasText('2 of 6 done')));
await go('/app/sent-money');
check('Ticks are remembered after reload', await waitText('2 of 6 done'));
check('Cybercrime portal link opens safely in a new tab', await ev(`(() => { const a = document.querySelector('a[href="https://cybercrime.gov.in"]'); return !!a && a.rel.includes('noopener') && a.target === '_blank'; })()`));
await shot('10-sent-money');

// ---------- help ----------
await go('/app/help');
check('Help shows official contacts and FAQ', (await waitText('Official contacts')) && (await ev(hasText('Common questions'))));
await clickText('summary', 'Do police arrest people over a video call?');
await sleep(200);
check('FAQ answer opens', await ev(`document.querySelector('details[open]') !== null`));
check('FAQ never promises a guarantee', !(await ev(hasText('guaranteed to'))));

// ---------- settings ----------
await go('/app/settings');
check('Settings opens with language, theme, privacy and account', (await waitText('Language and display')) && (await ev(hasText('Privacy'))) && (await ev(hasText('Account'))));
check('Guest account section is shown', await ev(hasText('without an account')));
await clickText('button', 'Withdraw consent');
await sleep(300);
check('Consent can be withdrawn', (await ev(hasText('You have not agreed yet'))) && (await ev(`localStorage.getItem('kavach.consent') === null`)));
await go('/app/scan/link');
check('After withdrawing, the consent card comes back', await waitText('Your consent'));

// ---------- login flow ----------
await go('/app/settings');
await clickText('button', 'Log in or sign up');
check('Log in or sign up from settings opens the login page', (await waitFor(`location.pathname === '/login'`)) && (await waitText('Log in')));
await setValue('input[type=email]', 'abc');
await clickText('button', 'Send sign-in link');
check('A bad email shows an error', await waitText('Enter a valid email address.'));
await setValue('input[type=email]', 'Ravi@Example.com');
await clickText('button', 'Send sign-in link');
check('Check-your-email screen is clearly a demo', (await waitText('Check your email')) && (await ev(hasText('no email is really sent'))));
await clickText('button', 'Continue (demo)');
check('A guest who signs up keeps their language and goes straight to the app', (await waitFor(`location.pathname === '/app'`)) && (await waitText('Signed in as ravi@example.com')));
check('The account profile stores the language the guest had chosen', await ev(`JSON.parse(localStorage.getItem('kavach.profile.ravi@example.com')||'null')?.language === 'en'`));
await go('/app/settings');
check('Settings shows the signed-in account', await waitText('Signed in as ravi@example.com.'));
await clickText('button', 'Delete account');
check('Delete account asks for confirmation', await waitFor(`!!document.querySelector('[role=dialog]')`));
await shot('11-delete-dialog');
await clickText('[role=dialog] button', 'Delete account');
check('Deleting the account returns to the welcome screen', (await waitFor(`location.pathname === '/'`)) && (await waitText('Continue without account')));
check('The account profile was removed', await ev(`localStorage.getItem('kavach.session') === null && !Object.keys(localStorage).some(k => k.startsWith('kavach.profile.'))`));

// ---------- fresh login (new person) goes through the language screen ----------
await clickText('a', 'Log in');
await waitFor(`location.pathname === '/login'`);
await setValue('input[type=email]', 'new.person@example.com');
await clickText('button', 'Send sign-in link');
await waitText('Check your email');
await clickText('button', 'Continue (demo)');
check('A new account is asked to choose a language first', await waitFor(`location.pathname === '/language'`));
await setValue('select', 'en');
await clickText('[role=radio]', 'தமிழ்');
await sleep(800);
check('Choosing Tamil switches the language screen', (await ev('document.documentElement.lang')) === 'ta');
await clickText('[role=radio]', 'English');
await sleep(400);
await clickText('button', 'Continue', true);
check('The account then enters the app', await waitFor(`location.pathname === '/app'`));
check('The chosen language is saved in the account profile', await ev(`!!JSON.parse(localStorage.getItem('kavach.profile.new.person@example.com')||'null')?.language`));
await ev(`(() => { localStorage.removeItem('kavach.session'); localStorage.removeItem('kavach.onboarded'); })()`);
await go('/login');
await setValue('input[type=email]', 'new.person@example.com');
await clickText('button', 'Send sign-in link');
await waitText('Check your email');
await clickText('button', 'Continue (demo)');
check('Signing in again goes straight to the app (language remembered)', await waitFor(`location.pathname === '/app'`));
await go('/app/settings');
await clickText('button', 'Sign out');
check('Sign out returns to the welcome screen', await waitFor(`location.pathname === '/'`));

// ---------- 404 ----------
await go('/nothing-here');
check('Unknown address shows the not-found page', await waitText('We could not find that page'));

// ---------- desktop layout ----------
await go('/');
await clickText('button', 'Continue without account');
await waitFor(`location.pathname === '/language'`);
await clickText('button', 'Continue', true);
await waitFor(`location.pathname === '/app'`);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(500);
check('Desktop shows the side navigation', await ev(`(() => { const navs = [...document.querySelectorAll('nav[aria-label="Main menu"]')]; const shown = navs.filter(n => getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0); return shown.length === 1 && shown[0].getBoundingClientRect().left < 100 && shown[0].getBoundingClientRect().top < 300; })()`));
await shot('12-desktop-home');

finish();
