# Build context is the repo root — the image needs /packages too.
FROM python:3.12-slim

WORKDIR /app

COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY packages /app/packages
COPY apps/api /app/apps/api

ENV PYTHONPATH=/app/packages:/app/apps/api
ENV PYTHONUNBUFFERED=1
ENV MIGRATIONS_DIR=/app/apps/api/migrations

WORKDIR /app/apps/api
RUN chmod +x entrypoint.sh migrate.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
