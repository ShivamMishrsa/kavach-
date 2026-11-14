# Security

Kavach handles photos of notices and messages that may hold personal and financial details, so a
vulnerability matters.

**Report it privately**, not in a public issue: use GitHub's "Report a vulnerability" (private
vulnerability reporting) on this repository. Say what you found, how to reproduce it, and what you
think the impact is. You will get an answer; this is a student project without a team on call, so
please be patient.

What is already covered (and tested in `microservices/backend/tests/test_abuse.py`): hostile and
damaged files, decompression bombs, disguised wording, very long text, request forgery between
people's checks, and rate limits. What is not: the project has had no outside security review and
no penetration test. See `docs/decisions/` for how the system is built and `docs/deploy.md` for what
must be set before it is exposed to real people.

Do not put real people's messages, photos or details in a report.
