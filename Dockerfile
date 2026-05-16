# Stage 1: Build Next.js static export
FROM node:20-slim AS frontend-build

WORKDIR /build

COPY frontend/ /build/frontend/

RUN npm ci --prefix frontend
RUN npm run build --prefix frontend

# Stage 2: Python runtime serving static files and API
FROM python:3.12-slim

RUN pip install uv --no-cache-dir

WORKDIR /app

COPY backend/ /app/backend/

RUN cd /app/backend && uv sync --no-dev

COPY --from=frontend-build /build/frontend/out /app/static

RUN mkdir -p /app/db

EXPOSE 8000

WORKDIR /app/backend

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
