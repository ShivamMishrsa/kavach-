# Demo: the 2-minute script

For a hackathon judge, an interviewer, or anyone who has two minutes. Says what to click, what to
say, and what to do when something goes wrong. Everything shown is real except where it says
"simulated". Do not claim more than is on screen.

**Before you start (5 minutes, once):**

- Real demo (photo, PDF): start the API and the website as in the root README, with Tesseract
  installed. Open `http://localhost:5173` on a phone-sized window (or a real phone on the same
  Wi-Fi). Check `GET /health` says `"ocr": "ready"`.
- Offline demo (no setup, no internet): open the demo website once, then use "Install the app" in
  Settings (or "Add to Home screen"). From then on it opens with no connection. Results in this
  version are **simulated** and a yellow "Demo mode" banner says so; say it out loud.
- Have `samples/fake-arrest-notice-en.png` ready (a made-up notice, marked as a demo sample).
- Have the backup video ready: `docs/demo/kavach-demo.webm`, about 45 seconds (see "If it fails").

## The script

| Time | Do | Say |
|---|---|---|
| 0:00 | Landing page | "People in India are losing lakhs to calls that say *you are under digital arrest, pay now*. Kavach lets you check the notice first. It gives a risk level and the reasons. It never says 'this is a scam'." |
| 0:15 | **Check now** → **Continue without account** → **Continue** | "No sign-up. Seven languages: English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati. The non-English text still needs a native speaker's review." |
| 0:30 | **Notice, message or screenshot** → read the consent card → **I agree** | "Consent in plain words, before anything is sent. The photo is deleted after 15 minutes." |
| 0:40 | Choose the sample photo → **Check now** | "A photo of a notice. This one is made up and marked as a demo sample." |
| 0:50 | The result appears (about 1 to 4 seconds) | "Very high risk, and the reasons shown, not hidden: a video-call arrest threat, a 'safe account' demand, a money demand, secrecy, urgency. It also reads the account and phone number." |
| 1:05 | Scroll to **What to do now** | "It tells you not to pay and to call 1930, the national cyber helpline. It never claims to be legal advice." |
| 1:10 | **Review details and create report** → tick the box → **Create evidence summary** | "You correct what it read, and it builds a one-page summary to read out to the helpline, with fingerprints of the evidence." |
| 1:30 | Switch the phone to airplane mode; open the notice screen; paste a message; **Check now** | "No internet? The app still opens, and 1930 works by phone. The check is kept on this phone, listed on the home screen, and sent by itself when the connection returns. It is deleted at once after sending, and after an hour at the latest." |
| 1:45 | Turn the connection on; wait for the toast | "Sent, and gone from the phone." |
| 1:50 | Open **Limitations** (footer) | "What it cannot do is written down. I measured it only on messages the team wrote: on a fresh set it warned about 73% of the scams it is written for, before I fixed what that showed. I do not claim an accuracy percentage for real messages. That is in `docs/benchmarks.md`." |
| 2:00 | Stop | "Check before you pay." |

## Questions you will get, and honest answers

- **"How accurate is it?"** Rules, not a model. On a fresh set of 80 messages written without looking
  at the rules, 73% of the scams the rules are written for were warned about (19 of 26); after fixing
  what that showed, 92% on the same set, which is no longer a fair test. No real person's messages
  were used. See `docs/benchmarks.md`.
- **"Why not an LLM?"** The reasons shown to the person must be the reasons the system used, and a
  message must never leave the server's memory. Rules give both. A model can be added later behind the
  same API (ADR-0002).
- **"Is it live?"** Not yet: it runs locally and in a container; it needs a domain, a host and a mail
  service (`docs/deploy.md`). Say so.
- **"Does it work on iPhone?"** The browser tests run in WebKit (Safari's engine). No real iPhone has
  been tried yet (`docs/phone-test.md` is the checklist for doing that).

## If it fails

1. **The API or Tesseract does not start:** use the installed demo build, which needs neither, and say
   "this one is simulated".
2. **No internet and no installed app:** `npm run preview` in `microservices/frontend` after
   `npm run build` serves the demo build from the laptop.
3. **Nothing works:** play `docs/demo/kavach-demo.webm`: a silent, captioned recording of the key
   moments of the script above, about 45 seconds (a longer one would not fit the 5 MB the repository
   allows). It was recorded against the real backend, so the result and the evidence summary are
   real; talk over it with the table above.
4. Screenshots of every screen are in the browser-test output (`microservices/tests/e2e/run.ps1`
   writes them to the folder it prints).

## Re-recording the video

```powershell
microservices\tests\e2e\run.ps1 -Only record      # real backend; writes kavach-demo.webm to the folder it prints
```

Copy the file to `docs/demo/kavach-demo.webm`. The video shows whichever version was recorded: record
it against the real backend and the result is real; against the demo build it says "Demo mode".
Keep it under 5 MB, and do not re-commit it often: every version stays in the repository's history.
