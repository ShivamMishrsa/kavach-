# The Kavach API on a free Hugging Face Docker Space. Same as ../Dockerfile except for the user and
# the data folder: Spaces run the container as user 1000 and only let it write in its own home.
# That folder is erased whenever the Space restarts, so accounts and synced history do not last
# (guest checks never needed the disk). Not built on the machine this was written on (no Docker
# there): the Space's own build log is the first thing to read if something is wrong.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    KAVACH_ENV=prod \
    KAVACH_DATA_DIR=/home/user/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 user \
    && mkdir /home/user/data \
    && chown user /home/user/data
USER user
WORKDIR /home/user/srv

COPY --chown=user requirements.txt .
RUN pip install --user -r requirements.txt
ENV PATH="/home/user/.local/bin:${PATH}"

COPY --chown=user app ./app

EXPOSE 8000

# One worker: scans and rate limits live in this process's memory (docs/decisions/ADR-0004).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", \
     "--no-proxy-headers", "--no-access-log"]
