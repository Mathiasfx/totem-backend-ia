# Referencia de API — Totem Backend

Base URL: `http://{HOST}:{PORT}` (por defecto `http://localhost:3000`)

---

## POST /upload

Recibe la foto de un visitante, la procesa con IA, compone el marco corporativo y sube el resultado a GCS.

### Request

- **Content-Type:** `multipart/form-data`
- **Campo:** `image` — archivo de imagen (JPEG recomendado, máx. 15 MB)

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@foto.jpg"
```

**Ejemplo con Unity (UnityWebRequest):**
```csharp
var form = new WWWForm();
form.AddBinaryData("image", imageBytes, "foto.jpg", "image/jpeg");
var request = UnityWebRequest.Post(baseUrl + "/upload", form);
```

### Respuesta exitosa — 200

```json
{
  "exito": true,
  "fotoUrl": "https://storage.googleapis.com/bucket/outputs/uuid.jpg?X-Goog-...",
  "qrUrl": "https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=...",
  "timestamp": "2026-04-27T18:30:00.000Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `exito` | `boolean` | Siempre `true` en respuestas 200 |
| `fotoUrl` | `string` | URL firmada de GCS al JPEG resultado (válida por `SIGNED_URL_TTL_SECONDS`, máx. 7 días) |
| `qrUrl` | `string` | URL a imagen PNG del código QR (800×800 px, servicio api.qrserver.com). El QR codifica el enlace corto `/d/{uuid}` si hay `PUBLIC_BASE_URL` o `HOST_IP`, o la URL firmada en caso contrario |
| `timestamp` | `string` | ISO 8601, momento de respuesta del servidor |

### Respuestas de error

| Código | Causa | Body |
|--------|-------|------|
| `400` | No se adjuntó campo `image` | `{ "error": "No llegó ninguna imagen." }` |
| `500` | Error en IA, GCS u otro fallo interno | `{ "error": "Error procesando la imagen", "mensaje": "..." }` |

---

## GET /d/:id

Redirección al resultado final almacenado en GCS. Diseñado para ser el destino del código QR: URL corta y memorable.

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | `string` | UUID v4 del procesamiento (mismo que en `outputs/{id}.jpg`) |

**Ejemplo:**
```
GET /d/550e8400-e29b-41d4-a716-446655440000
```

### Respuesta exitosa — 302

Redirige (Location header) a la URL firmada de GCS del objeto `outputs/{id}.jpg`.

### Respuestas de error

| Código | Causa |
|--------|-------|
| `400` | El parámetro `id` no tiene formato UUID v4 |
| `404` | El objeto no existe en GCS o la URL firmada no pudo generarse |

---

## GET /health

Verifica que el proceso esté vivo y expone metadatos de configuración no sensibles.

### Respuesta — 200

```json
{
  "status": "OK",
  "host_ip": "192.168.0.83",
  "public_base_url": null,
  "short_qr_url": true,
  "gcs_bucket": "totemphotos"
}
```

| Campo | Descripción |
|-------|-------------|
| `status` | Siempre `"OK"` si el proceso responde |
| `host_ip` | Valor de `HOST_IP` o `null` |
| `public_base_url` | Valor de `PUBLIC_BASE_URL` o `null` |
| `short_qr_url` | `true` si el QR usará URL corta (`/d/...`); `false` si usará URL firmada larga |
| `gcs_bucket` | Nombre del bucket GCS configurado |

---

## Notas generales

- **CORS:** Habilitado para todos los orígenes (configuración de desarrollo/LAN).
- **Límite de subida:** 15 MB por request.
- **Formato de respuesta:** `application/json` en todos los endpoints salvo `GET /d/:id` (redirección).
- **URLs firmadas GCS:** Válidas por `SIGNED_URL_TTL_SECONDS` segundos (máximo 604 800 s = 7 días). Pasado ese tiempo, `fotoUrl` deja de ser accesible; `GET /d/:id` genera una nueva URL firmada en cada solicitud.
