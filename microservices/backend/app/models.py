"""Shared data shapes. They mirror `docs/api-contract.md` and the website's `src/api/types.ts`."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

ScanKind = Literal["notice", "link"]
ScanStatus = Literal["processing", "done", "failed"]
StageId = Literal["received", "read", "signals", "report"]
StageStatus = Literal["done", "current", "waiting"]
RiskLevel = Literal["very_high", "high", "medium", "cannot_verify", "low"]
ReasonCode = Literal[
    "digital_arrest",
    "payment_demand",
    "safe_account",
    "secrecy",
    "urgency",
    "outdated_section",
    "lookalike_domain",
    "insecure_link",
]
EntityType = Literal["utr", "upi", "phone", "amount", "datetime", "link"]
FeedbackType = Literal["false_alarm", "missed_scam", "wrong_wording", "other"]

STAGES: tuple[StageId, ...] = ("received", "read", "signals", "report")


class CamelModel(BaseModel):
    """JSON uses camelCase (as the website does); Python code uses snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Entity(CamelModel):
    type: EntityType
    value: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class Statute(CamelModel):
    """An old law section named in the notice and the section that replaced it."""

    cited: str
    current: str


class ScanResult(CamelModel):
    risk_level: RiskLevel
    reason_codes: list[ReasonCode]
    entities: list[Entity]
    statutes: list[Statute]


class StageProgress(CamelModel):
    id: StageId
    status: StageStatus


class EvidenceHash(CamelModel):
    name: str
    sha256: str
    captured_at: datetime


class Scan(CamelModel):
    id: str
    kind: ScanKind
    status: ScanStatus
    stages: list[StageProgress]
    result: ScanResult | None
    confirmed_entities: list[Entity] | None
    evidence: list[EvidenceHash]
    created_at: datetime
    expires_at: datetime
    simulated: bool = False


class ConfirmEntitiesRequest(CamelModel):
    entities: Annotated[list[Entity], Field(max_length=30)]

    @field_validator("entities")
    @classmethod
    def drop_empty(cls, entities: list[Entity]) -> list[Entity]:
        return [entity for entity in entities if entity.value]


class FeedbackRequest(CamelModel):
    scan_id: Annotated[str, StringConstraints(max_length=64)]
    type: FeedbackType
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


_Heading = Annotated[str, StringConstraints(max_length=200)]
_Paragraph = Annotated[str, StringConstraints(max_length=2000)]


class DossierText(CamelModel):
    """The words of the evidence summary, in the person's language. The website supplies them
    (all the translations live there); the details and fingerprints come from the server's own
    record of the scan, never from here."""

    title: _Heading
    disclaimer: _Paragraph
    summary_title: _Heading
    summary: _Paragraph
    details_title: _Heading
    detail_labels: dict[EntityType, _Heading]
    evidence_title: _Heading
    evidence_hint: _Paragraph
    captured_at: _Heading  # contains "{time}", replaced by the recorded time
    keep_originals: _Paragraph
    script_title: _Heading
    script: _Paragraph


class DossierFile(CamelModel):
    url: str  # signed, short-lived, relative to the API address
    sha256: str  # of the PDF exactly as it will be downloaded
    generated_at: datetime
    link_expires_at: datetime


class ConsentRequest(CamelModel):
    version: Annotated[str, StringConstraints(max_length=32)]
    granted: bool


Language = Literal["en", "hi", "bn", "mr", "ta", "te", "gu"]


_EmailAddress = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$",
    ),
]


class MagicLinkRequest(CamelModel):
    email: _EmailAddress
    language: Language | None = None


class VerifyRequest(CamelModel):
    token: Annotated[str, StringConstraints(min_length=20, max_length=100)]


class Account(CamelModel):
    id: str
    email: str
    language: Language | None
    sync_history: bool


class EmailChangeRequest(CamelModel):
    email: _EmailAddress
    language: Language | None = None


class SignIn(CamelModel):
    """One place the account is signed in. The id is not the secret."""

    id: str
    created_at: datetime
    expires_at: datetime
    current: bool


class ProfileUpdate(CamelModel):
    language: Language | None = None
    sync_history: bool | None = None


class HistoryItem(CamelModel):
    """What stays of a check: no file, no text, no details."""

    id: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{8,64}$")]
    kind: ScanKind
    risk_level: RiskLevel | None
    created_at: datetime


class HistoryUpload(CamelModel):
    items: Annotated[list[HistoryItem], Field(max_length=200)]
