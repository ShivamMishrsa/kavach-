# Step 4: Minimal Backend: OCR + Rules + Hindi Result (Roadmap Phases 6, 7, 8 minimal)

**Status:** Not started

## Goal
Asli detection ka patla slice: notice upload -> risk level + reasons in Hindi.

## Tasks
- [ ] FastAPI: `POST /scan`, `GET /scan/{id}`, `POST /scan/{id}/entities`, `/health`; Pydantic validation, OpenAPI
- [ ] Ingestion: type/size checks, SHA-256 of original, ephemeral store
- [ ] PII: context-aware Aadhaar (Verhoeff + context), PAN; **UTR/UPI/phone redact nahi** (alag extraction)
- [ ] OCR: Tesseract (hin+eng) ya PaddleOCR on CPU
- [ ] Signals/rules engine: money demand, "digital arrest", video-call custody, secrecy, urgency, "safe/verification account"
- [ ] Statutory checker: IPC/BNS/BNSS mapping, outdated sections
- [ ] Entity extraction: UTR, UPI ID, phone, amount, date-time
- [ ] Link check: punycode, homoglyph, lookalike domains
- [ ] Risk levels (5) + reviewed Hindi templates + "cannot verify"
- [ ] LLM, agar use ho, sirf explanation ke liye (prompt-injection safe); risk rules decide karein
- [ ] Frontend ko mock se real API par switch
- [ ] Unit tests: rules, PII (UTR bug case), entity extraction

## Exit criteria
Frontend + backend end-to-end: notice upload -> Hindi result with reasons.
