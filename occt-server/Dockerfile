FROM python:3.11-slim

# ── Proxy (build-time + runtime) ──────────────────────────────────────────────
ARG http_proxy="http://proxy.intra:80"
ARG https_proxy="http://proxy.intra:80"
ARG no_proxy="localhost,127.0.0.1"

ENV http_proxy=${http_proxy} \
    https_proxy=${https_proxy} \
    HTTP_PROXY=${http_proxy} \
    HTTPS_PROXY=${https_proxy} \
    no_proxy=${no_proxy} \
    NO_PROXY=${no_proxy}

# ── apt proxy config ──────────────────────────────────────────────────────────
RUN printf 'Acquire::http::Proxy "%s";\nAcquire::https::Proxy "%s";\n' \
      "${http_proxy}" "${https_proxy}" \
      > /etc/apt/apt.conf.d/99proxy

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libxrender1 \
    libxext6 \
    libx11-6 \
    libsm6 \
    libice6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8200

HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8200/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8200", "--workers", "2"]
