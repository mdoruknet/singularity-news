# syntax=docker/dockerfile:1

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SINGULARITY_DB=/data/singularity.db

# Bağımlılıkları önce kur (katman önbelleği). lxml için manylinux wheel kullanılır.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodu
COPY . .

# Veritabanı için kalıcı dizin (compose'ta named volume bağlanır)
RUN mkdir -p /data

EXPOSE 8000

# Worker sayısı WEB_CONCURRENCY ile ayarlanır; Render free (512MB RAM) için
# varsayılan 1'dir (4 worker OOM'a yol açar). Daha güçlü planda artırılabilir.
ENV WEB_CONCURRENCY=1
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-1}"]
