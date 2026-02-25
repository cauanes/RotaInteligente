# ══════════════════════════════════════════════════════════
# Backend — Multi-stage build para imagem leve
# ══════════════════════════════════════════════════════════
FROM python:3.12-slim AS base

WORKDIR /app

# Deps de sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
