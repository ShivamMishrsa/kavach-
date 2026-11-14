# Benchmarks

What Kavach's rules and reading step get right and wrong, measured. **Read "What these numbers are
not" first.** Everything here can be reproduced with the commands at the end; nothing is quoted
from memory.

## What these numbers are not

- **The messages are written by the project team, not collected from real people.** They imitate
  the scams and the honest messages the product meets (digital arrest, "safe account" demands,
  fake notices, look-alike links; bank alerts, OTPs, delivery notes, awareness posts). Real scams
  change, so these numbers are a regression check and a way to find bugs, not a promise of what
  Kavach will do on real notices. No real person's message or photo is in the sets.
- **They are small** (100 test messages and 30 test
  links). Every rate shows how many items it is based on and a 95% confidence interval; the
  intervals are wide.
- **The same team wrote the rules and the sets.** Even the test set reflects what the authors
  expect to see. That is why the table below shows the test numbers *before* any change made after
  looking at it.
- **No accuracy figure is claimed for the product.** The website never shows a percentage, and
  this page is not a source for one.
- **A user study has not been done.** See `docs/usability-test.md`.

## How the sets were used

1. The *dev* set (60 messages, 20 links) was written first. The rules were
   changed after looking at its mistakes. Before the changes: scams warned about 27/30, benign
   warned about 13/30.
2. The *test* set was written after the rules were frozen, with different wording, and run once.
   Those are the "test, frozen" numbers: the only ones that were not tuned on.
3. The test run found real bugs (for example "warranty" was read as "warrant", "fixed deposit" as
   a demand to deposit, addresses without `http` were not checked, lists of law sections such as
   "420, 406 and 120B" were not read). They were fixed. **After that the test set is no longer
   unseen**, so its new numbers are shown separately and should be read as "after fixing what it
   found", not as a fresh measurement. A new set is needed for a clean measurement.

## Rules: results

"Warned about" means Kavach said *medium*, *high* or *very high*. "Strongly warned about" means
*high* or *very high*. "Hard benign" messages are honest messages that use scam-like words on
purpose (awareness posts, friends asking for money, delivery notes with a deadline).

| | Dev, before changes | Dev, after dev changes | Dev, final | Test, frozen | Test, after fixes (no longer unseen) | Holdout, frozen | Holdout, after fixes (no longer unseen) |
|---|---|---|---|---|---|---|---|
| Messages: scams warned about (recall) | - | 93% (28/30) | 93% (28/30) | 78% (39/50) | 84% (42/50) | 71% (27/38) | 84% (32/38) |
| Messages: scams strongly warned about | - | 70% (21/30) | 70% (21/30) | 50% (25/50) | 56% (28/50) | 37% (14/38) | 47% (18/38) |
| Messages: benign warned about (false alarms) | - | 40% (12/30) | 43% (13/30) | 26% (13/50) | 24% (12/50) | 31% (13/42) | 26% (11/42) |
| Messages: benign strongly warned about | - | 17% (5/30) | 17% (5/30) | 12% (6/50) | 12% (6/50) | 14% (6/42) | 14% (6/42) |
| Messages: scams answered "low risk" | - | 7% (2/30) | 7% (2/30) | 22% (11/50) | 16% (8/50) | 29% (11/38) | 16% (6/38) |
| Scams the rules are written for: warned about | - | 100% (20/20) | 100% (20/20) | 90% (27/30) | 100% (30/30) | 73% (19/26) | 92% (24/26) |
| Scams the rules are not written for: warned about | - | 80% (8/10) | 80% (8/10) | 60% (12/20) | 60% (12/20) | 67% (8/12) | 67% (8/12) |
| Hard benign messages warned about | - | 85% (11/13) | 92% (12/13) | 75% (12/16) | 75% (12/16) | 71% (10/14) | 71% (10/14) |
| Links: scams warned about | - | 100% (9/9) | 100% (9/9) | 81% (13/16) | 81% (13/16) | 50% (8/16) | 62% (10/16) |
| Links: benign warned about | - | 0% (0/11) | 0% (0/11) | 0% (0/14) | 0% (0/14) | 0% (0/14) | 0% (0/14) |
| Details read exactly: precision | - | 100% (22/22) | 100% (22/22) | 96% (24/25) | 100% (24/24) | 86% (6/7) | 100% (7/7) |
| Details read exactly: recall | - | 100% (22/22) | 100% (22/22) | 100% (24/24) | 100% (24/24) | 100% (6/6) | 100% (7/7) |
| Old-law notes (IPC to BNS) correct | - | n/a | n/a | 80% (4/5) | 100% (5/5) | 100% (2/2) | 100% (2/2) |

The "Dev, before changes" column was recorded before the changes and not kept as a file: messages
warned about 90% (27/30), benign warned about 43% (13/30), scams answered "low risk" 10% (3/30),
scams the rules are written for 95% (19/20).

### What the rules do not handle (known, and not hidden)

- **Messages that warn about scams are warned about.** "Beware of digital arrest" contains the same
  words as the scam. A rule that lowers the level when words like "scam" or "beware" appear would
  let a scammer write them to avoid detection, so it was not added. The result is a false alarm
  (a high level on an awareness post). The reasons shown make the cause clear.
- **A friend asking for money, or a bill reminder, is warned about** (medium): a demand to pay
  looks the same whoever sends it. Medium means "be careful and verify", not "scam".
- **A deadline alone is enough for medium** ("your rider arrives within 5 minutes"). Making a single
  weak sign count as low risk would reduce false alarms but would also call more scams low risk.
  Calling a scam "low risk" is the worse mistake, so the rules prefer the false alarm.
- **Scams the rules were not written for are mostly missed or only weakly flagged**: prize and
  lottery, job and investment offers, QR "refund", remote-access support, sextortion. They are
  caught only when they also ask for money or carry a link.
- **Links**: look-alike names, hidden "@" addresses and `http` are caught. A brand name split by a
  hyphen ("income-tax-refund"), a dropped letter ("icicbank") and a plain punycode address are not
  recognised.
- **Law sections**: only 10 IPC and 3 CrPC sections have a replacement in the table, and the table
  still has to be checked against the gazette (verify).

### The holdout set, written after all of the above

A third set, "holdout" (80 messages, 30 links), was written after the test set had been used,
with new wording, without looking at the rules' patterns, and run **once** before anything was
changed: the "Holdout, frozen" column. It is the fairest number on this page, and it is much worse
than the dev and test numbers: scams the rules are written for 73% (19/26) against 100% on the other
two sets, and 7 of those 26 were answered "low risk". The earlier sets overstated how well the
rules generalise.

What it found, and what was done (only gaps in coverage that are clear in themselves; nothing that
a scammer could use to hide):

- Hindi had no counterpart for "stay on the video call" ("वीडियो कॉल चालू रखिए"), and the
  "come on the video call, otherwise ..." threat (Hinglish and Hindi) was not recognised.
- "A warrant will be issued" was not read as urgency (only "has been" and "is" were).
- "निगरानी खाता" (supervision account) was missing next to the English "supervision account".
- A Hindi bank credit alert ("₹12,000 जमा हुए हैं", money arrived) was read as a demand to deposit.
- "Your OTP is 3382. Kisi ko mat batayein" (the bank's own warning) was read as secrecy pressure.
- Links imitating Aadhaar, PM-Kisan and DGFT were not known names. Amazon and Flipkart were **not**
  added: their real sites use many country domains, so the rules would call real links look-alikes.

After these changes the dev and test numbers did not move (the changes only add coverage) and the
holdout numbers are in the "after fixes" column. **That column is no longer unseen**, for the same
reason as the test set. What is still missed on the holdout, on purpose or for lack of a rule: a
"your number will be disconnected" threat from a fake TRAI officer, a Hinglish demand that says only
"UPI kar dijiye", a brand typo with letters swapped ("hdfcbnak") and a plain punycode link. One
annotation was also wrong when the set was first run (an amount in a message was not written down as
a detail); it was corrected afterwards, so the frozen column's details precision (6/7) is the
author's mistake, not the rules'.

A fresh set is needed again for the next clean measurement. The honest reading of this page is
the frozen column: on wording the authors had not seen, about a quarter of the scams the rules are
written for (7 of 26) were answered "low risk". The "after fixes" column is what that becomes once
the gaps are known, and the next unseen variant will find new ones. Real messages will be harder.

### The final test set in detail

| Message was | very high | high | medium | cannot verify | low |
|---|---|---|---|---|---|
| scam | 5 | 23 | 14 | 0 | 8 |
| benign | 0 | 6 | 6 | 1 | 37 |

| Kind | Handled as labelled |
|---|---|
| benign: awareness | 38% (3/8) |
| benign: bank_alert | 100% (7/7) |
| benign: delivery | 71% (5/7) |
| benign: ecommerce | 100% (1/1) |
| benign: govt_reminder | 100% (4/4) |
| benign: official | 100% (8/8) |
| benign: otp | 100% (5/5) |
| benign: personal | 58% (7/12) |
| benign: telecom | 100% (3/3) |
| benign: travel | 100% (2/2) |
| benign: unknown | 100% (6/6) |
| benign: utility_bill | 100% (1/1) |
| scam: brand_word | 100% (8/8) |
| scam: charity | 0% (0/1) |
| scam: crypto | 0% (0/1) |
| scam: decoy | 100% (1/1) |
| scam: digital_arrest | 100% (8/8) |
| scam: fake_helpline | 0% (0/1) |
| scam: fake_notice | 100% (8/8) |
| scam: gift_parcel | 100% (1/1) |
| scam: insurance | 100% (1/1) |
| scam: investment | 100% (1/1) |
| scam: job_offer | 100% (2/2) |
| scam: kyc_link | 100% (7/7) |
| scam: loan_threat | 100% (1/1) |
| scam: lottery | 100% (2/2) |
| scam: parcel_fee | 100% (1/1) |
| scam: prize_link | 100% (1/1) |
| scam: punycode | 0% (0/1) |
| scam: qr_refund | 0% (0/1) |
| scam: safe_account | 100% (7/7) |
| scam: sextortion | 100% (1/1) |
| scam: sim_upgrade | 0% (0/1) |
| scam: spaced_brand | 0% (0/1) |
| scam: subdomain_trick | 100% (3/3) |
| scam: subsidy | 0% (0/1) |
| scam: tech_support | 0% (0/1) |
| scam: typo | 50% (1/2) |
| scam: utility_threat | 50% (1/2) |

Mistakes on the test set (after fixes):

| Id | Was | Kind | Kavach said | Because |
|---|---|---|---|---|
| t035 | scam | tech_support | low | no signs found |
| t036 | scam | qr_refund | low | no signs found |
| t037 | scam | utility_threat | low | no signs found |
| t040 | scam | subsidy | low | no signs found |
| t042 | scam | charity | low | no signs found |
| t043 | scam | crypto | low | no signs found |
| t045 | scam | sim_upgrade | low | no signs found |
| t046 | scam | fake_helpline | low | no signs found |
| t065 | benign | delivery | medium | urgency |
| t075 | benign | awareness | high | digital_arrest |
| t076 | benign | awareness | high | digital_arrest |
| t077 | benign | awareness | high | digital_arrest, urgency |
| t078 | benign | awareness | high | safe_account |
| t082 | benign | awareness | high | digital_arrest |
| t083 | benign | personal | medium | payment_demand |
| t084 | benign | personal | medium | payment_demand |
| t085 | benign | personal | medium | payment_demand |
| t086 | benign | personal | medium | urgency |
| t095 | benign | delivery | medium | payment_demand |
| t096 | benign | personal | high | digital_arrest |
| m028 | scam | spaced_brand | cannot verify | no signs found |
| m029 | scam | punycode | cannot verify | no signs found |
| m030 | scam | typo | cannot verify | no signs found |

## Photos: the whole path

A photo is read by Tesseract (English and Hindi) and the text is judged by the same rules. To
measure this without real photos, each message was drawn as an image with shaped fonts, then spoiled
the way phone pictures are: blurred, shrunk and compressed, tilted by 3 degrees, noisy. "Text read
wrongly" is the share of characters that differ from the original. 32 messages (scams the
rules are written for, and honest ones, in English and Hindi).

Two preparation steps were added after this measurement showed the problem: small photos are
enlarged and their contrast stretched, and tilted photos are straightened.

| Picture quality | Text read wrongly (without / with preparation) | Same risk level as typed text | Scams still warned about | OCR time p50 / p95 |
|---|---|---|---|---|
| clean | 0.8% / 0.8% | 97% (31/32) | 94% (17/18) | 0.29 s / 0.35 s |
| blurred | 1.4% / 1.4% | 97% (31/32) | 94% (17/18) | 0.30 s / 0.37 s |
| small and compressed | 14.2% / 3.7% | 94% (30/32) | 89% (16/18) | 0.31 s / 0.37 s |
| tilted | 41.2% / 6.8% | 94% (30/32) | 89% (16/18) | 0.31 s / 0.37 s |
| noisy | 1.1% / 1.0% | 97% (31/32) | 94% (17/18) | 0.31 s / 0.39 s |

A photo counts as unclear (the answer is then "cannot verify", never "low risk") when Tesseract's
average word confidence is below 60 out of 100. It was 50 until a blurred demo sample sat just above
the line and was answered "low risk" about a message full of scam words. Raising it to 60 changed
nothing on the degraded photos measured above (50, 60 and 65 gave the same counts), so it was not
tuned on them; the blurred sample now says "cannot verify". A drawn-text average can still be high
while the body is garbled if a clean heading dominates it, which real photos rarely have.

What this does and does not show: drawn text is easier than a real photograph (shadows, folds,
glare, a stamp over a line, a screen photographed at an angle). A photo that is read badly gets the
answer "we could not check this" only when Tesseract itself reports low confidence; text that is
read wrongly with high confidence can still be judged on the wrong words. A real set of photos is
needed before this part can be trusted.

## Time and cost

Measured on: Windows-11-10.0.26300-SP0, 12 logical CPUs, tesseract v5.4.0.20240606.
Python 3.13.2. Tesseract on one core gave the same times as unrestricted
(the engine is mostly single-threaded), so these are also the numbers for one core.

| What | p50 | p95 | Runs |
|---|---|---|---|
| typed text | 0.00 s | 0.00 s | 20 |
| link | 0.00 s | 0.00 s | 20 |
| photo (screenshot, 1240 px wide) | 0.33 s | 0.35 s | 20 |
| photo (12 MP phone picture) | 0.71 s | 0.73 s | 20 |
| PDF with text | 0.00 s | 0.00 s | 20 |
| scanned PDF (3 pages) | 0.95 s | 0.97 s | 5 |
| photo, one at a time | 0.34 s | 0.35 s | 10 |
| photo, four at once (2 workers) | 0.73 s | 0.77 s | 8 |

- "work" is the checking itself. "request" is an upload to the API and waiting until the result is
  ready; the website then asks every 0.7 s, so a person can see it up to 0.7 s later.
- Typed text, links and PDFs with a text layer take well under 10 ms: nothing is read by OCR.
- The API runs two checks at once (`workers=2`). Four at once means the later ones wait.
- **Cost per check**: no third-party service is called, so there is no per-check fee. What remains
  is server time: about 0.33 s of one core for a photo. One core therefore handles roughly
  11,000 photo checks an hour at full load. Multiply by the monthly price of the
  server you choose (verify the price when you choose it) to get the cost; at a realistic load of
  a few percent the server price, not the checks, is the cost.
- The 12 MP picture in the table is a synthetic one (a notice pasted into a large picture); a real
  one with a busy background will take longer.

## Reproduce

```powershell
cd microservices\backend
.\.venv\Scripts\python.exe -m evaluation.run      # the rules on the three sets (add --json file)
.\.venv\Scripts\python.exe -m evaluation.ocr      # photos (needs Tesseract)
.\.venv\Scripts\python.exe -m evaluation.latency  # time (needs Tesseract)
.\.venv\Scripts\python.exe -m evaluation.report   # rewrites this page from the saved results
```

`tests/test_evaluation.py` runs the rules on the three sets in every test run and fails if a scam
the rules are written for is called low risk (apart from the two known misses of the holdout set),
if they miss more than 5% of those scams (10% on the holdout set), if an ordinary link is warned
about, if details are read wrongly, or if false alarms on the test messages rise above 30%.
