# Totem Backend

API Node.js (Express) para un tótem fotográfico: recibe la foto de un visitante, la transforma con IA (Gemini 2.5 Flash Image via Vertex AI), la compone con un marco corporativo y persiste el resultado en Google Cloud Storage, devolviendo URLs de foto y código QR.

## Requisitos previos

- Node.js 18+
- Cuenta de Google Cloud con Vertex AI y Cloud Storage habilitados
- Credenciales de servicio GCP (`google-creds.json`) con permisos sobre el bucket

## Instalación

```bash
npm install
```

## Configuración

Copiar `.env.example` a `.env` y completar los valores. Ver [`docs/SETUP.md`](docs/SETUP.md) para la referencia completa de variables de entorno.

```bash
cp .env.example .env
```

Variables mínimas requeridas:

```
GCS_BUCKET_NAME=nombre-del-bucket
GOOGLE_PROJECT_ID=mi-proyecto-gcp
GOOGLE_APPLICATION_CREDENTIALS=./google-creds.json
```

## Ejecución

```bash
node src/index.js
```

El servidor arranca en `http://localhost:3000` (o el puerto definido en `PORT`).

Al iniciar, el servidor valida que el marco PNG esté presente y sea válido antes de aceptar tráfico.

## API

Ver [`docs/API.md`](docs/API.md) para la referencia completa de endpoints.

| Endpoint | Descripción |
|----------|-------------|
| `POST /upload` | Sube una imagen, la procesa con IA y devuelve `fotoUrl` y `qrUrl` |
| `GET /d/:id` | Redirección 302 a la URL firmada del resultado en GCS |
| `GET /health` | Estado del servicio y configuración activa |

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [`docs/PRD.md`](docs/PRD.md) | Producto: requisitos funcionales, alcance, contrato de API |
| [`docs/API.md`](docs/API.md) | Referencia técnica de endpoints |
| [`docs/SETUP.md`](docs/SETUP.md) | Variables de entorno y guía de despliegue |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, servicios y pipeline interno |
