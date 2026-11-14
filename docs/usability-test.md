# Usability test: kit for 5 people

**Status:** not run. This page is the kit. The test needs real people, so it cannot be done from
code. Fill in the results table at the bottom when it has been done.

## Why five

Five people are enough to find most serious usability problems (about 8 in 10 of the ones that
affect many people). They are **not** enough to measure anything: report "3 of 5 finished task 2",
never a percentage.

## Who

| # | Who | Phone | Language of the test |
|---|---|---|---|
| 1 | Person over 60 who uses WhatsApp, not banking apps | their own | Hindi |
| 2 | Person over 60 who uses UPI | their own | their regional language, if it is one of the seven |
| 3 | Adult who is the family's "tech helper" (30-50) | their own | English or Hindi |
| 4 | Someone who has been scammed or nearly scammed (only if they offer; never ask) | their own | their choice |
| 5 | Person who reads slowly or has low vision | their own | their choice |

At least two tests in Hindi or another Indian language, and at least two on a low-end phone. Do not
use friends who built the product.

## Before you start

- Use the live site or a build with the real backend (not the demo: its results are simulated).
- Use only the **fake** notices from `microservices/backend/tests/fixtures/` (`notice_en.png`,
  `notice_hi.png`, `bank_alert_en.png`) and the sample link `http://sbi-kyc-update.example/verify`.
  **Never ask a participant to bring a real notice or a real payment screenshot.**
- Say this aloud: "We are testing the website, not you. If something is confusing, that is our
  fault. You can stop at any time. I will not record your face or voice unless you agree. I will
  write down what you do, not who you are." Get a clear yes before starting.
- Note down: phone model, browser, language, network (Wi-Fi / mobile data).
- Put the fake notice photos on their phone, or show the notice on a second phone.

## Tasks

Read each task aloud in the participant's language. Do not explain the screens. If they are stuck
for 2 minutes, write "stuck" and give one hint; mark the task "finished with help".

| # | Task (what you say) | Finished when | Critical? |
|---|---|---|---|
| T1 | "You got this message on your phone (give the fake notice). Find out if it is safe." | They upload it and say in their own words what the result means | Yes |
| T2 | "A friend sent you this link. Check it." | They paste the link and say whether to open it | Yes |
| T3 | "You already sent money to this person. What should you do now?" | They open the checklist and name the first step (call 1930) | Yes |
| T4 | "Make the summary you would read to the helpline." | They reach the summary and find the phone number to call | No |
| T5 | "The text is too small for you. Change it." | Text size is changed | No |
| T6 | "You do not want the app to keep anything. Delete what it has." | History or account is deleted | No |

## Questions to ask while they work (neutral)

- "What are you looking at?" / "What do you expect to happen if you press that?"
- Never: "Do you see the button at the top?" or "Try pressing..."
- After the result in T1: "What would you do now?" and "Did the result sound certain or careful?"
  (The product must never sound like a verdict.)

## After the tasks

1. "What was the hardest part?" "What would you tell a friend about it?"
2. Ask the 10 standard SUS statements (1 = strongly disagree ... 5 = strongly agree). Read them
   aloud for people who prefer that. Hindi wording is a draft: have a native speaker check it.
   1. I think I would like to use this often. 2. I found it unnecessarily complex. 3. I thought it
   was easy to use. 4. I would need help from a technical person to use it. 5. The parts of it
   worked well together. 6. There was too much inconsistency. 7. Most people would learn it very
   quickly. 8. It was very awkward to use. 9. I felt very confident using it. 10. I needed to learn a
   lot before I could use it.
3. "Do you trust it? Why or why not?" "Would you give it a photo of a real notice?"

## Observation sheet (one per person)

| Task | Finished? (yes / with help / no) | Time (seconds) | Wrong turns | What they said or did |
|---|---|---|---|---|
| T1 | | | | |
| T2 | | | | |
| T3 | | | | |
| T4 | | | | |
| T5 | | | | |
| T6 | | | | |

Also note: any word they did not understand (write it exactly), any time they hesitated over the
language screen, the consent card or the 1930 button.

## What to do with the results

- A **critical** task (T1-T3) that 2 or more of 5 could not finish alone, or where the result was
  understood as "this is definitely a scam / definitely safe": fix before launch.
- Any word two people did not understand: change the translation.
- Report counts ("4 of 5 finished T1 alone"), the SUS scores as a list, and three quotes. Do not
  average the five SUS scores into a headline.
- Keep no photos, names or phone numbers. Keep the sheets without names (P1...P5).

## Results

| Date | Participants | T1 | T2 | T3 | T4 | T5 | T6 | SUS scores | Main problems found | Fixed? |
|---|---|---|---|---|---|---|---|---|---|---|
| (not run) | | | | | | | | | | |
