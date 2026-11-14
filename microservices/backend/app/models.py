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
