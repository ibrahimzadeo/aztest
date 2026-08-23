# Build context is the repo root — the image needs /packages too.
FROM python:3.12-slim

WORKDIR /app

COPY apps/worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY packages /app/packages
COPY apps/worker /app/apps/worker

ENV PYTHONPATH=/app/packages:/app/apps/worker
ENV PYTHONUNBUFFERED=1

WORKDIR /app/apps/worker
CMD ["python", "-m", "worker.main"]
