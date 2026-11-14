"""Writes docs/benchmarks.md from the saved results, so every number in it can be reproduced.

    python -m evaluation.report

The numbers come from evaluation/results/*.json (made by `evaluation.run`, `evaluation.ocr` and
`evaluation.latency`); the wording is in this file.
"""

import json
from pathlib import Path

from evaluation.metrics import LEVELS, STRONG, Rate

RESULTS = Path(__file__).parent / "results"
REPRODUCE = r"""```powershell
cd microservices\backend
.\.venv\Scripts\python.exe -m evaluation.run      # the rules on the three sets (add --json file)
.\.venv\Scripts\python.exe -m evaluation.ocr      # photos (needs Tesseract)
.\.venv\Scripts\python.exe -m evaluation.latency  # time (needs Tesseract)
.\.venv\Scripts\python.exe -m evaluation.report   # rewrites this page from the saved results
```"""
OUTPUT = Path(__file__).resolve().parents[3] / "docs" / "benchmarks.md"


def load(name: str) -> dict | list:
    return json.loads((RESULTS / name).read_text("utf-8"))


def hits(rate: dict) -> dict:
    """A rate written with `correct` instead of `hits` (the old-law notes) in the usual form."""
    return {"hits": rate.get("hits", rate.get("correct")), "total": rate["total"]}


def shown(rate: dict) -> str:
    return Rate(rate["hits"], rate["total"]).show()


def short(rate: dict) -> str:
    value = Rate(rate["hits"], rate["total"]).value
    return "n/a" if value is None else f"{value:.0%} ({rate['hits']}/{rate['total']})"


def _strong(summary: dict, key: str) -> dict:
    """Older result files only kept counts per level; the strong rates follow from those."""
    counts = summary["levels"]["scam" if key == "strong_recall" else "benign"]
    hits = sum(counts[level] for level in STRONG)
    return {"hits": hits, "total": sum(counts.values())}


def normalise(result: dict) -> dict:
    """The same shape for results written before the strong-warning numbers existed."""
    result = dict(result)
    renames = {
        "scam_types_the_rules_are_written_for": "scams_the_rules_are_written_for",
        "scam_types_the_rules_are_not_written_for": "scams_the_rules_are_not_written_for",
        "hard_benign_messages_flagged": "hard_benign_warned",
    }
    for old, new in renames.items():
        if old in result:
            result[new] = result.pop(old)
    for part in ("text", "links"):
        summary = dict(result[part])
        summary.setdefault("strong_recall", _strong(summary, "strong_recall"))
        summary.setdefault("strong_false_alarm", _strong(summary, "strong_false_alarm"))
        result[part] = summary
    return result


def comparison(columns: dict[str, dict | None]) -> str:
    rows = [
        ("Messages: scams warned about (recall)", lambda r: r["text"]["recall"]),
        ("Messages: scams strongly warned about", lambda r: r["text"]["strong_recall"]),
        ("Messages: benign warned about (false alarms)", lambda r: r["text"]["false_alarm"]),
        ("Messages: benign strongly warned about", lambda r: r["text"]["strong_false_alarm"]),
        ('Messages: scams answered "low risk"', lambda r: r["text"]["missed_as_low"]),
        (
            "Scams the rules are written for: warned about",
            lambda r: r["scams_the_rules_are_written_for"],
        ),
        (
            "Scams the rules are not written for: warned about",
            lambda r: r["scams_the_rules_are_not_written_for"],
        ),
        ("Hard benign messages warned about", lambda r: r["hard_benign_warned"]),
        ("Links: scams warned about", lambda r: r["links"]["recall"]),
        ("Links: benign warned about", lambda r: r["links"]["false_alarm"]),
        ("Details read exactly: precision", lambda r: r["entities"]["precision"]),
        ("Details read exactly: recall", lambda r: r["entities"]["recall"]),
        ("Old-law notes (IPC to BNS) correct", lambda r: r["statutes"]),
    ]
    head = "| | " + " | ".join(columns) + " |\n|---|" + "---|" * len(columns)
    lines = [head]
    for label, pick in rows:
        cells = [short(hits(pick(result))) if result else "-" for result in columns.values()]
        lines.append(f"| {label} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def levels_table(result: dict) -> str:
    lines = ["| Message was | " + " | ".join(level.replace("_", " ") for level in LEVELS) + " |"]
    lines.append("|---|" + "---|" * len(LEVELS))
    for label in ("scam", "benign"):
        counts = result["text"]["levels"][label]
        lines.append(f"| {label} | " + " | ".join(str(counts[level]) for level in LEVELS) + " |")
    return "\n".join(lines)


def categories_table(result: dict) -> str:
    lines = ["| Kind | Handled as labelled |", "|---|---|"]
    for name, rate in result["categories"].items():
        lines.append(f"| {name.replace(':', ': ')} | {short(rate)} |")
    return "\n".join(lines)


def mistakes(result: dict) -> str:
    lines = ["| Id | Was | Kind | Kavach said | Because |", "|---|---|---|---|---|"]
    for row in result["wrong"]:
        reasons = ", ".join(row["reasons"]) or "no signs found"
        lines.append(
            f"| {row['id']} | {row['label']} | {row['category']} | "
            f"{row['level'].replace('_', ' ')} | {reasons} |"
        )
    return "\n".join(lines)


def photo_table(with_prep: dict, without: dict) -> str:
    lines = [
        "| Picture quality | Text read wrongly (without / with preparation) | "
        "Same risk level as typed text | Scams still warned about | OCR time p50 / p95 |",
        "|---|---|---|---|---|",
    ]
    for name, row in with_prep["variants"].items():
        before = without["variants"][name]
        lines.append(
            f"| {name.replace('_', ' ')} | {before['character_error_rate']:.1%} / "
            f"{row['character_error_rate']:.1%} | {short(row['same_risk_level_as_typed'])} | "
            f"{short(row['scams_still_warned_about'])} | "
            f"{row['ocr_seconds_p50']:.2f} s / {row['ocr_seconds_p95']:.2f} s |"
        )
    return "\n".join(lines)


def latency_table(result: dict) -> str:
    lines = ["| What | p50 | p95 | Runs |", "|---|---|---|---|"]
    for part in ("work", "request"):
        for name, row in result[part].items():
            lines.append(f"| {name} | {row['p50']:.2f} s | {row['p95']:.2f} s | {row['runs']} |")
    return "\n".join(lines)


def main() -> None:
    dev_final = normalise(load("dev_final.json")[0])
    dev_tuned = normalise(load("dev_before_test_fixes.json")[0])
    test_frozen = normalise(load("test_before_fixes.json")[0])
    test_final = normalise(load("test_final.json")[0])
    holdout_frozen = normalise(load("holdout_frozen.json")[0])
    holdout_final = normalise(load("holdout_final.json")[0])
    ocr, ocr_plain = load("ocr.json"), load("ocr_without_preparation.json")
    fast, one_core = load("latency.json")
    machine = fast["machine"]
    photo = fast["work"]["photo (screenshot, 1240 px wide)"]["p50"]

    text = f"""# Benchmarks

What Kavach's rules and reading step get right and wrong, measured. **Read "What these numbers are
not" first.** Everything here can be reproduced with the commands at the end; nothing is quoted
from memory.

## What these numbers are not

- **The messages are written by the project team, not collected from real people.** They imitate
  the scams and the honest messages the product meets (digital arrest, "safe account" demands,
  fake notices, look-alike links; bank alerts, OTPs, delivery notes, awareness posts). Real scams
  change, so these numbers are a regression check and a way to find bugs, not a promise of what
  Kavach will do on real notices. No real person's message or photo is in the sets.
- **They are small** ({test_final["counts"]["text"]} test messages and {
        test_final["counts"]["links"]
    } test
  links). Every rate shows how many items it is based on and a 95% confidence interval; the
  intervals are wide.
- **The same team wrote the rules and the sets.** Even the test set reflects what the authors
  expect to see. That is why the table below shows the test numbers *before* any change made after
  looking at it.
- **No accuracy figure is claimed for the product.** The website never shows a percentage, and
  this page is not a source for one.
- **A user study has not been done.** See `docs/usability-test.md`.

## How the sets were used

1. The *dev* set ({dev_final["counts"]["text"]} messages, {
        dev_final["counts"]["links"]
    } links) was written first. The rules were
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

{
        comparison(
            {
                "Dev, before changes": None,
                "Dev, after dev changes": dev_tuned,
                "Dev, final": dev_final,
                "Test, frozen": test_frozen,
                "Test, after fixes (no longer unseen)": test_final,
                "Holdout, frozen": holdout_frozen,
                "Holdout, after fixes (no longer unseen)": holdout_final,
            }
        )
    }

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

A third set, "holdout" ({holdout_final["counts"]["text"]} messages, {
        holdout_final["counts"]["links"]
    } links), was written after the test set had been used,
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

{levels_table(test_final)}

{categories_table(test_final)}

Mistakes on the test set (after fixes):

{mistakes(test_final)}

## Photos: the whole path

A photo is read by Tesseract (English and Hindi) and the text is judged by the same rules. To
measure this without real photos, each message was drawn as an image with shaped fonts, then spoiled
the way phone pictures are: blurred, shrunk and compressed, tilted by 3 degrees, noisy. "Text read
wrongly" is the share of characters that differ from the original. {
        ocr["messages"]
    } messages (scams the
rules are written for, and honest ones, in English and Hindi).

Two preparation steps were added after this measurement showed the problem: small photos are
enlarged and their contrast stretched, and tilted photos are straightened.

{photo_table(ocr, ocr_plain)}

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

Measured on: {machine["system"]}, {machine["logical_cpus"]} logical CPUs, {machine["tesseract"]}.
Python {machine["python"]}. Tesseract on one core gave the same times as unrestricted
(the engine is mostly single-threaded), so these are also the numbers for one core.

{latency_table(fast)}

- "work" is the checking itself. "request" is an upload to the API and waiting until the result is
  ready; the website then asks every 0.7 s, so a person can see it up to 0.7 s later.
- Typed text, links and PDFs with a text layer take well under 10 ms: nothing is read by OCR.
- The API runs two checks at once (`workers=2`). Four at once means the later ones wait.
- **Cost per check**: no third-party service is called, so there is no per-check fee. What remains
  is server time: about {photo:.2f} s of one core for a photo. One core therefore handles roughly
  {
        round(
            3600 / photo, -3
        ):,.0f} photo checks an hour at full load. Multiply by the monthly price of the
  server you choose (verify the price when you choose it) to get the cost; at a realistic load of
  a few percent the server price, not the checks, is the cost.
- The 12 MP picture in the table is a synthetic one (a notice pasted into a large picture); a real
  one with a busy background will take longer.

## Reproduce

{REPRODUCE}

`tests/test_evaluation.py` runs the rules on the three sets in every test run and fails if a scam
the rules are written for is called low risk (apart from the two known misses of the holdout set),
if they miss more than 5% of those scams (10% on the holdout set), if an ordinary link is warned
about, if details are read wrongly, or if false alarms on the test messages rise above 30%.
"""
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
