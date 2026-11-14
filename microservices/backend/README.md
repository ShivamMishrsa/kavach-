# backend/

FastAPI service that checks a notice, message or link and returns a **risk level with reasons**
(never a verdict, never a percentage). Contract: [`docs/api-contract.md`](../../docs/api-contract.md).
Why it is built this way: [`ADR-0002`](../../docs/decisions/ADR-0002-detection-approach.md) (detection) and
[`ADR-0003`](../../docs/decisions/ADR-0003-pdf-and-abuse-limits.md) (PDF, consent, limits).

Status: Step 5 (notice photo/PDF/text and link checks, evidence summary PDF, consent record, 15-minute
deletion, abuse limits). Accounts come in Step 7.

## Set up (Windows, PowerShell)

```powershell
cd microservices\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# OCR: Tesseract plus English and Hindi language files
winget install UB-Mannheim.TesseractOCR
mkdir tessdata
curl.exe -L -o tessdata\eng.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
curl.exe -L -o tessdata\hin.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/hin.traineddata

copy .env.example .env   # then set KAVACH_TESSERACT_CMD / KAVACH_TESSDATA_DIR as the file explains
```

The PDF needs nothing extra: the fonts are in `app/dossier/fonts/`.

On Linux/macOS install `tesseract-ocr` and the `eng` and `hin` language packs with the package
manager; no `.env` change is needed when `tesseract` is on `PATH`.

## Run and test

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000   # API docs: /docs
.\.venv\Scripts\python.exe -m pytest                                      # tests
.\.venv\Scripts\python.exe -m ruff check app tests                        # lint
```

`GET /health` shows `"ocr": "ready"` when Tesseract and both languages are found. Tests that need the
real Tesseract are skipped when it is not installed; everything else runs without it.

Run **one** worker. Scans live in the process's memory (see below), so several workers would not
see each other's scans.

## How a scan works

```
upload / text / link
  -> check type by its first bytes, size limit, SHA-256 of the original      (scans/ingest.py)
  -> kept in memory for 15 minutes, id is random and unguessable             (scans/store.py)
  -> background job (scans/pipeline.py):
       read    photo/PDF -> Tesseract (English + Hindi); PDFs with text skip OCR   (scans/ocr.py)
       signs   remove Aadhaar/PAN -> details -> wording signals -> old-law names
               -> link check                                                       (detection/*)
       report  risk level from the signals                                         (detection/risk.py)
```

| Module | Job |
|---|---|
| `detection/pii.py` | Removes Aadhaar (label or Verhoeff check) and PAN. A UTR is never taken for an Aadhaar number. |
| `detection/entities.py` | UTR, UPI id, phone, amount, date/time, link. |
| `detection/signals.py` | Wording signals in English, Hinglish and Hindi. Hindi is matched without vowel signs, because OCR often gets those wrong (`detection/text.py`). |
| `detection/statutes.py` | IPC / CrPC named in a notice, and the BNS / BNSS section that replaced it. |
| `detection/links.py` | Look-alike names, typos, digits for letters, homoglyphs, punycode, `@` decoys, `http`. |
| `detection/risk.py` | Signal weights -> `very_high` / `high` / `medium` / `low` / `cannot_verify`. |
| `dossier/render.py` | Draws the evidence summary PDF (fpdf2 + HarfBuzz, Noto Sans fonts for all seven website languages; only the fonts a document needs are loaded). |
| `core/` | Settings, error codes, signed links, rate limiter, size cap and security headers, the little that is written to disk. |

Risk level = sum of signal weights: 5 or more `very_high`, 3-4 `high`, 1-2 `medium`. With no signals
the result is `low` only if there was enough clear text to judge, otherwise `cannot_verify`.

## Privacy

- The uploaded file is read once and dropped. It is never written to disk (a test checks that the
  temporary copy made while receiving it is removed too).
- The result, the details the person confirmed, the fingerprints and the PDF stay in memory for 15
  minutes, then are gone: removed by a sweep every minute and on every use, so an expired scan can never
  be read.
- Logs hold only the kind of error, never text, numbers or file names (a test checks a whole flow).
- Only two things are written to disk, in `data/`: feedback (choice, short note with personal details
  taken out: Aadhaar, PAN, email, phone, UPI id, UTR; and the scan id) and consent
  records (version, time, keyed hash of the IP address; never the address).

## Abuse limits

Body size cap (also for streamed bodies), 20 tries per 10 minutes per person and action (scan, PDF,
feedback, consent), security headers, short signed PDF links. Set `KAVACH_SECRET` in production.
Behind a reverse proxy the client address must come from a trusted header; that is done at deploy (Step 8).

## Known limits

- **Rules, not a model.** It catches the common scripts and will miss new ones and flag some honest
  messages. The thresholds are not tuned on real data yet (Step 8 measures them).
- Hindi OCR (Tesseract) is average: clear screenshots work, blurry or handwritten photos come back
  as `cannot_verify`.
- No LLM is used (the explanation texts are fixed translations).
- Limits and scans live in one process's memory, so run one worker; more need Redis (Step 8).
- Text copied out of a Bengali PDF can contain a few control characters (an fpdf2 quirk); the page itself is right.
- No CAPTCHA: added only if the logs show abuse.
- The IPC to BNS table covers ten sections and the official list must still be checked (verify).
- Scans are in memory, so a restart loses them; that is the intended behaviour for now.
