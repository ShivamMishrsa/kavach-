# The Kavach API with Tesseract (English and Hindi). Build from this folder:
#   docker build -t kavach-backend microservices/backend
#   docker run -p 8000:8000 -v kavach-data:/data --env-file .env kavach-backend
# Not built on the machine this was written on (no Docker there): the CI job "docker" builds it
# and checks /health, which is what to look at first if something is wrong.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    KAVACH_ENV=prod \
    KAVACH_DATA_DIR=/data

# Tesseract and the two language packs the OCR needs (English first, then Hindi).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# The service does not run as root. /data holds the account database and the consent and feedback
# logs: mount a persistent disk there, and never bake data into the image.
RUN useradd --system --uid 10001 --no-create-home kavach \
    && mkdir /data \
    && chown kavach /data
USER kavach
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if b'\"ocr\":\"ready\"' in urllib.request.urlopen('http://127.0.0.1:8000/health').read() else 1)"

# One worker: scans and rate limits live in this process's memory (see docs/decisions/ADR-0004).
# --no-proxy-headers: the address behind a proxy is read by the app itself (KAVACH_PROXY_HOPS),
# so a caller cannot choose it. The access log is off because it would print every address.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", \
     "--no-proxy-headers", "--no-access-log"]
