# API contract (website <-> backend)

The website talks to the backend only through `microservices/frontend/src/api/client.ts`.
With `VITE_API_URL` set it is the real backend (`src/api/http.ts`); without it, an in-browser mock
(`src/api/mock/`) that follows exactly these shapes, so the screens do not change.
Source of truth for the shapes: `src/api/types.ts` (website) and `app/models.py` (backend).
The backend also serves interactive docs at `/docs`.

## Behaviour the backend keeps

- A scan has **stages** (`received`, `read`, `signals`, `report`) that advance while it runs. The result is hidden until all stages are done.
- A scan, its details, its evidence fingerprints and its PDF are **deleted 15 minutes after creation** (`expiresAt`), by a background sweep as well as on every use. After that `GET /v1/scans/{id}` returns `404`. The server does not remember that it ever existed (it keeps no history); the website, which remembers the id on the device, shows "expired" instead of "not found".
- **History is kept on the person's device**, only as metadata (`id`, `kind`, `riskLevel`, `createdAt`), never the file, the text or the extracted details. There is no history endpoint until accounts exist (Step 7).
- **Evidence fingerprints** are SHA-256 of the original bytes (file, pasted text or normalised link), recorded when the scan is created, with a UTC timestamp.
- Results are a **risk level with reason codes**, never a verdict, never a percentage. Levels: `very_high`, `high`, `medium`, `cannot_verify`, `low`.
- `simulated` is `true` only in the website's mock. The real backend always returns `false`.
- Messages shown to people come from the website's translation files, never from the server. The server sends codes only.
- JSON field names are camelCase. Times are ISO 8601 in UTC.
- Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; outside development also a `Content-Security-Policy` that allows nothing.

## Operations

| Client method | Endpoint | Notes |
|---|---|---|
| `createScan(input)` | `POST /v1/scans` | `multipart/form-data`. Fields: `kind` (`notice` or `link`) and exactly one of `file` (JPEG, PNG or PDF, up to 10 MB), `text` (up to 20,000 characters) or `url`. The type is judged by the file's first bytes. Returns `201` and a `Scan` with `status: "processing"` |
| `getScan(id)` | `GET /v1/scans/{id}` | polled about every 700 ms until `status` is `done` or `failed` |
| `confirmEntities(id, entities)` | `PUT /v1/scans/{id}/entities` | JSON `{"entities": [...]}`; trims values, drops empty ones; at most 30 |
| `deleteScan(id)` | `DELETE /v1/scans/{id}` | `204`, also when it is already gone |
| `deleteAllScans()` | (client) | `DELETE` for each id remembered on the device, then clears the device history |
| `listHistory()` | (client) | read from the device |
| `createDossier(id, text)` | `POST /v1/scans/{id}/dossier` | JSON with the words of the PDF (`DossierText`, all translated by the website). Only for a finished scan whose details the person has confirmed (`400` otherwise). The PDF contains the **confirmed** details and the server's own fingerprints, never anything else. Returns `201` `{url, sha256, generatedAt, linkExpiresAt}`; `sha256` is of the PDF exactly as downloaded |
| (the `url` above) | `GET /v1/scans/{id}/dossier.pdf?exp=&sig=` | Signed link, valid 5 minutes (never longer than the scan). Sent as an attachment. Any wrong, changed or expired link gives `404` |
| `recordConsent(version, granted)` | `POST /v1/consent` | JSON; `204`. Appends version, time and a keyed hash of the IP address to the consent log (deleted after 90 days). An unknown version is refused (`400`) |
| `sendFeedback(input)` | `POST /v1/feedback` | JSON; type + optional note (max 500 chars); `204`; no file content |
| | `GET /health` | `{"status": "ok", "ocr": "ready" \| "unavailable", ...}` |

## Errors

`400` `{"error": {"code": "invalid_input"}}` (anything unusable: wrong type, too big, empty, two inputs at once, a bad link).
`413` the same body, when the request is bigger than the limit (10 MB file plus 64 KB of form).
`404` `{"error": {"code": "not_found"}}` (unknown or expired scan, or a bad download link).
`429` `{"error": {"code": "rate_limited"}}` (more than 20 scans, PDFs, feedback or consent records in 10 minutes from one person; people are told apart by a keyed hash of their IP address). Reading is never limited.
A scan whose processing failed (for example Tesseract is missing) has `status: "failed"` and no result.

## Types

```
ScanKind    = 'notice' | 'link'                      (voice comes later)
RiskLevel   = 'very_high' | 'high' | 'medium' | 'cannot_verify' | 'low'
ReasonCode  = 'digital_arrest' | 'payment_demand' | 'safe_account' | 'secrecy'
            | 'urgency' | 'outdated_section' | 'lookalike_domain' | 'insecure_link'
EntityType  = 'utr' | 'upi' | 'phone' | 'amount' | 'datetime' | 'link'

Scan { id, kind, status, stages[{id,status}], result{riskLevel,reasonCodes,entities,statutes}|null,
       confirmedEntities|null, evidence[{name,sha256,capturedAt}], createdAt, expiresAt, simulated }
Statute { cited, current }    e.g. { "cited": "IPC 420", "current": "BNS 318(4)" }
DossierText { title, disclaimer, summaryTitle, summary, detailsTitle, detailLabels{type: text},
              evidenceTitle, evidenceHint, capturedAt ("... {time}"), keepOriginals, scriptTitle, script }
DossierFile { url, sha256, generatedAt, linkExpiresAt }
```

Each new reason code needs a translation in every language (`reasons.<code>`); the website's test suite checks this.
`statutes` are shown under the `outdated_section` reason with the `statutes.line` translation.
