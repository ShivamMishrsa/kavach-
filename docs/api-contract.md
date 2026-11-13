# API contract (website <-> backend)

The website talks to the backend only through `microservices/frontend/src/api/client.ts`.
Until Step 4 the client is an in-browser mock (`src/api/mock/`) that follows exactly these shapes,
so switching to the real API should not change any screen. Source of truth: `src/api/types.ts`.

## Behaviour the backend must keep (the mock already does)

- A scan has **stages** (`received`, `read`, `signals`, `report`) that advance over time. The result is hidden until all stages are done.
- A scan, its details and its evidence fingerprints are **deleted 15 minutes after creation** (`expiresAt`). After that `GET /scans/{id}` returns `expired`; an id that never existed returns `not_found`.
- **History keeps only metadata** (`id`, `kind`, `riskLevel`, `createdAt`), never the file, the text or the extracted details.
- **Evidence fingerprints** are SHA-256 of the original bytes (file, pasted text or link), recorded before deletion, with a UTC timestamp.
- Results are a **risk level with reason codes**, never a verdict, never a percentage. Levels: `very_high`, `high`, `medium`, `cannot_verify`, `low`.
- `simulated: true` while results are produced by a stand-in; the UI then shows a demo notice. The real backend returns `false`.
- Errors use codes `not_found`, `expired`, `invalid_input`, `network`. Messages shown to people come from the translation files, never from the server.

## Operations

| Client method | Suggested endpoint | Notes |
|---|---|---|
| `createScan(input)` | `POST /v1/scans` | multipart for files; JSON for text and link; returns a `Scan` (status `processing`) |
| `getScan(id)` | `GET /v1/scans/{id}` | polled about every 700 ms until `status = done` |
| `confirmEntities(id, entities)` | `PUT /v1/scans/{id}/entities` | trims values, drops empty ones; only while the scan exists |
| `listHistory()` | `GET /v1/history` | newest first |
| `deleteScan(id)` | `DELETE /v1/scans/{id}` | removes the scan and its history entry |
| `deleteAllScans()` | `DELETE /v1/history` | |
| `sendFeedback(input)` | `POST /v1/feedback` | type + optional note (max 500 chars); no file content |

## Types

```
ScanKind    = 'notice' | 'link' | 'voice'
RiskLevel   = 'very_high' | 'high' | 'medium' | 'cannot_verify' | 'low'
ReasonCode  = 'digital_arrest' | 'payment_demand' | 'safe_account' | 'secrecy'
            | 'urgency' | 'outdated_section' | 'lookalike_domain' | 'insecure_link'
EntityType  = 'utr' | 'upi' | 'phone' | 'amount' | 'datetime' | 'link'

Scan { id, kind, status, stages[{id,status}], result{riskLevel,reasonCodes,entities}|null,
       confirmedEntities|null, evidence[{name,sha256,capturedAt}], createdAt, expiresAt, simulated }
ScanSummary { id, kind, riskLevel, createdAt }
```

Each new reason code needs a translation in every language (`reasons.<code>`); the test suite checks this.
