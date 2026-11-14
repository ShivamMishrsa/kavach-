# ml/

OCR, rules engine experiments, evaluation scripts aur dataset metadata.

- Detection code `backend/` me rehta hai; ZARURAT par yahan se alag service banegi (workers, voice, model serving).
- Evaluation code aur labelled sets ab `microservices/backend/evaluation/` me hain (backend ke code ko import karte hain): `python -m evaluation.run` / `.ocr` / `.latency` / `.report`. Natije: `docs/benchmarks.md`.
- Labeled samples: sirf dummy/synthetic/consented; live user uploads yahan nahi aate.
- Steps: 4, 8
- Status: evaluation ho gaya (synthetic sets); koi model abhi nahi.
