# Arquitectura — Totem Backend

## Visión general

```
Cliente (Unity / app)
        │  POST /upload  multipart/form-data (campo: image)
        ▼
┌─────────────────────────────────────────────────────┐
│                   src/index.js                      │
│  Express 5  ·  Multer (memoryStorage, máx 15 MB)   │
└──────┬──────────────────────────────────────────────┘
       │
       ├─ uploadBuffer(uploads/{uuid}.jpg)  ──────────────────► GCS
       │
       ├─ aiService.processImageWithNanoBanana(buffer)
       │         │
       │         └─ Gemini 2.5 Flash Image (Vertex AI, us-central1)
       │                    prompts aleatorios de prompts.json
       │
       ├─ frameService.composeWithMarco(aiBuffer)
       │         │
       │         ├─ loadMarcoCache()  →  src/assets/marco.png  (cacheado)
       │         └─ sharp: resize → cover · composite over · JPEG q90 mozjpeg
       │
       ├─ uploadBuffer(outputs/{uuid}.jpg)  ───────────────────► GCS
       │
       └─ getSignedReadUrl(outputs/{uuid}.jpg)
                 │
                 └─ { fotoUrl, qrUrl, timestamp }  ──────────► Cliente
```

---

## Módulos

### `src/index.js`

Punto de entrada. Configura Express, Multer y define los tres endpoints públicos.

Responsabilidades:
- Validar que `GCS_BUCKET_NAME` esté presente (si no, `process.exit(1)`).
- Pre-cargar el marco PNG al arranque (`loadMarcoCache`) para detectar errores antes de recibir tráfico.
- Orquestar el pipeline completo en `POST /upload`.
- Construir la URL del QR según la configuración de base URL.

### `src/services/aiService.js`

Llama a **Gemini 2.5 Flash Image** vía `@google/genai` (modo Vertex AI).

- Selecciona aleatoriamente uno de los prompts de `src/assets/prompts.json`.
- Envía la foto como `inlineData` (base64) junto al prompt de texto.
- Extrae el `inlineData` de la respuesta y lo devuelve como `Buffer`.
- Requiere `GOOGLE_PROJECT_ID`; la región está fijada a `us-central1` (único endpoint disponible para generación de imágenes con Gemini).

### `src/services/frameService.js`

Compone la imagen generada por IA con el marco corporativo PNG.

Pipeline interno:
1. `loadMarcoCache()` — Lee `src/assets/marco.png`, extrae dimensiones (`width × height`) y cachea el buffer en memoria. En llamadas sucesivas devuelve el caché. Lanza error si el archivo no existe o no tiene dimensiones válidas.
2. `composeWithMarco(aiBuffer)`:
   - Redimensiona la imagen IA al tamaño exacto del marco (`fit: cover`, `position: centre`).
   - Superpone el PNG del marco con `blend: 'over'` (el canal alpha del marco actúa como máscara).
   - Serializa como JPEG calidad 90 con mozjpeg.

### `src/services/storageService.js`

Abstrae las operaciones con Google Cloud Storage.

| Función | Descripción |
|---------|-------------|
| `isGcsEnabled()` | `true` si `GCS_BUCKET_NAME` está definido |
| `uploadBuffer(path, buffer, contentType)` | Sube un `Buffer` a GCS en la ruta indicada |
| `getSignedReadUrl(path, [ttlSeconds])` | Genera una URL firmada v4 de lectura. TTL por defecto: 604 800 s (7 días). Nunca supera el máximo de GCS (604 800 s). |

---

## Prompts de IA

`src/assets/prompts.json` contiene un array de escenas del Mundial FIFA 2026. En cada request se selecciona una aleatoriamente:

| `accion` | Escena |
|----------|--------|
| `copa` | Hard Rock Stadium (Miami) — campeón levantando la copa |
| `gol` | MetLife Stadium (New Jersey) — celebración de gol |
| `compañeros` | SoFi Stadium (Los Ángeles) — festejo con el equipo |

Todos los prompts preservan el parecido facial, género, edad y pose de la persona en la foto original.

---

## Flujo de URLs

```
POST /upload devuelve:
  fotoUrl  →  URL firmada GCS  (válida SIGNED_URL_TTL_SECONDS segundos)
  qrUrl    →  https://api.qrserver.com/...?data={qrData}

qrData según configuración:
  PUBLIC_BASE_URL definido  →  {PUBLIC_BASE_URL}/d/{uuid}
  HOST_IP definido          →  http://{HOST_IP}:{PORT}/d/{uuid}
  ninguno                   →  URL firmada GCS (larga)

GET /d/{uuid}
  →  302 Redirect  →  URL firmada GCS (nueva, generada en el momento)
```

---

## Dependencias clave

| Paquete | Uso |
|---------|-----|
| `express` ^5 | Servidor HTTP |
| `multer` ^2 | Parsing multipart, almacenamiento en memoria |
| `@google/genai` | Cliente Gemini / Vertex AI |
| `@google-cloud/storage` | Cliente GCS (subida, URLs firmadas) |
| `sharp` | Redimensionado, composición y serialización de imágenes |
| `cors` | Cabeceras CORS para clientes Unity/web |
| `dotenv` | Carga de variables de entorno desde `.env` |

---

## Consideraciones operativas

- **Estado en memoria:** Solo el caché del marco PNG. La aplicación es stateless entre requests.
- **Concurrencia:** Sin límite explícito de concurrencia en el servidor. El cuello de botella esperado es el tiempo de inferencia de Gemini (~10–30 s por imagen).
- **Errores de IA:** Si Gemini no devuelve una imagen (por política de contenido u otro motivo), la respuesta incluye el texto de rechazo y se devuelve un `500` al cliente.
- **Archivos temporales:** Ninguno. Todo el pipeline opera en memoria (Buffer).
