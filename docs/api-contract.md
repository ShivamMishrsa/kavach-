# API contract (website <-> backend)

The website talks to the backend only through `microservices/frontend/src/api/client.ts`.
With `VITE_API_URL` set it is the real backend (`src/api/http.ts`); without it, an in-browser mock
(`src/api/mock/`) that follows exactly these shapes, so the screens do not change.
Source of truth for the shapes: `src/api/types.ts` (website) and `app/models.py` (backend).
The backend also serves interactive docs at `/docs`.

## Behaviour the backend keeps

- A scan has **stages** (`received`, `read`, `signals`, `report`) that advance while it runs. The result is hidden until all stages are done.
- A scan, its details and its evidence fingerprints are **deleted 15 minutes after creation** (`expiresAt`). After that `GET /v1/scans/{id}` returns `404`. The server does not remember that it ever existed (it keeps no history); the website, which remembers the id on the device, shows "expired" instead of "not found".
- **History is kept on the person's device**, only as metadata (`id`, `kind`, `riskLevel`, `createdAt`), never the file, the text or the extracted details. There is no history endpoint until accounts exist (Step 7).
- **Evidence fingerprints** are SHA-256 of the original bytes (file, pasted text or normalised link), recorded when the scan is created, with a UTC timestamp.
- Results are a **risk level with reason codes**, never a verdict, never a percentage. Levels: `very_high`, `high`, `medium`, `cannot_verify`, `low`.
- `simulated` is `true` only in the website's mock. The real backend always returns `false`.
- Messages shown to people come from the website's translation files, never from the server. The server sends codes only.
- JSON field names are camelCase. Times are ISO 8601 in UTC.

## Operations

| Client method | Endpoint | Notes |
|---|---|---|
| `createScan(input)` | `POST /v1/scans` | `multipart/form-data`. Fields: `kind` (`notice` or `link`) and exactly one of `file` (JPEG, PNG or PDF, up to 10 MB), `text` (up to 20,000 characters) or `url`. The type is judged by the file's first bytes. Returns `201` and a `Scan` with `status: "processing"` |
| `getScan(id)` | `GET /v1/scans/{id}` | polled about every 700 ms until `status` is `done` or `failed` |
| `confirmEntities(id, entities)` | `PUT /v1/scans/{id}/entities` | JSON `{"entities": [...]}`; trims values, drops empty ones; at most 30 |
| `deleteScan(id)` | `DELETE /v1/scans/{id}` | `204`, also when it is already gone |
| `deleteAllScans()` | (client) | `DELETE` for each id remembered on the device, then clears the device history |
| `listHistory()` | (client) | read from the device |
| `sendFeedback(input)` | `POST /v1/feedback` | JSON; type + optional note (max 500 chars); `204`; no file content |
| | `GET /health` | `{"status": "ok", "ocr": "ready" \| "unavailable", ...}` |

## Errors

`400` `{"error": {"code": "invalid_input"}}` (anything unusable: wrong type, too big, empty, two inputs at once, a bad link).
`404` `{"error": {"code": "not_found"}}` (unknown or expired scan).
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
```

Each new reason code needs a translation in every language (`reasons.<code>`); the website's test suite checks this.
`statutes` are shown under the `outdated_section` reason with the `statutes.line` translation.
