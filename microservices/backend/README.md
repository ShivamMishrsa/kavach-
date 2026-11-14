# backend/

FastAPI service that checks a notice, message or link and returns a **risk level with reasons**
(never a verdict, never a percentage). Contract: [`docs/api-contract.md`](../../docs/api-contract.md).
Why it is built this way: [`ADR-0002`](../../docs/decisions/ADR-0002-detection-approach.md).

Status: Step 4 (notice photo/PDF/text and link checks). Dossier PDF, rate limits and the purge job
come in Step 5, accounts in Step 7.

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

Risk level = sum of signal weights: 5 or more `very_high`, 3-4 `high`, 1-2 `medium`. With no signals
the result is `low` only if there was enough clear text to judge, otherwise `cannot_verify`.

## Privacy

- The uploaded file is read once and dropped. It is never written to disk.
- The result, the details the person confirmed and the fingerprints stay in memory for 15 minutes,
  then are gone. An expired scan cannot be read: every use of the store removes expired ones first.
- Logs hold only the kind of error, never text, numbers or file names.
- The only thing written to disk is feedback (`data/feedback.jsonl`: choice, short note, scan id).

## Known limits

- **Rules, not a model.** It catches the common scripts and will miss new ones and flag some honest
  messages. The thresholds are not tuned on real data yet (Step 8 measures them).
- Hindi OCR (Tesseract) is average: clear screenshots work, blurry or handwritten photos come back
  as `cannot_verify`.
- No LLM is used (the explanation texts are fixed translations).
- No rate limits, security headers or purge job yet (Step 5). The 15-minute rule holds because
  expired scans are removed on use; memory is not swept while the service is idle.
- The IPC to BNS table covers ten sections and the official list must still be checked (verify).
- Scans are in memory, so a restart loses them; that is the intended behaviour for now.
