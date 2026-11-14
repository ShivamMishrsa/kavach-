# Demo samples

**Everything here is made up.** The agencies, cases, numbers and addresses do not exist (phone
numbers start 9000000, web addresses end in `.example`), and each picture carries a red strip
"DEMO SAMPLE: FAKE, NOT A REAL NOTICE". No real person's message is in this folder. Use them to
try Kavach's photo and PDF checks without using anything real.

| File | What Kavach says (risk level) | Because |
|---|---|---|
| `fake-arrest-notice-en.png` | very high | digital_arrest, safe_account, payment_demand, secrecy, urgency |
| `fake-arrest-notice-hi.png` | very high | digital_arrest, safe_account, payment_demand, urgency |
| `courier-sms-link.png` | medium | insecure_link |
| `bank-alert-ordinary.png` | low | no signs found |
| `unclear-photo-hi.png` | cannot verify | no signs found |
| `fake-court-summons-en.pdf` | very high | payment_demand, secrecy, urgency, outdated_section |

How to use: in the app choose "Notice, message or screenshot", then "Photo or file", and pick one.
On the demo website (no backend) the same buttons work, but the result is simulated, not read from
the file.

The table above is **measured**: it is the output of the real reading step (Tesseract) and the
rules, written by `python -m evaluation.samples` (run it again after changing the rules). One
sample per kind says little about how well Kavach works: see
[`docs/benchmarks.md`](../docs/benchmarks.md).
The blurred photo is there to show the honest "could not read this well" case.
