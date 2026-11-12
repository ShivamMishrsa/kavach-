"""Kavach backend entry point (Step 1: hello/health only)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title="Kavach API",
    version="0.1.0",
    description="Risk-assessment API for scam triage. Not a legal verdict.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "kavach-backend", "version": app.version}
