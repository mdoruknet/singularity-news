# syntax=docker/dockerfile:1

# ---------- 1) Build aşaması: Vite React üretim derlemesi ----------
FROM node:20-alpine AS build
WORKDIR /app

# Bağımlılıkları önce kur (katman önbelleği için)
COPY package*.json ./
RUN npm ci

# Kaynakları kopyala ve derle
COPY . .
# API adresi derleme anında gömülür (Vite env). Compose/CI build-arg ile ezer.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- 2) Servis aşaması: Nginx ile statik sunum ----------
FROM nginx:alpine AS serve
# SPA yönlendirmeleri için özel nginx ayarı
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
