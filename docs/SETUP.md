# Guía de configuración — Totem Backend

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto. Todas las variables son opcionales salvo las marcadas como **obligatorias**.

| Variable | Obligatoria | Ejemplo | Descripción |
|----------|:-----------:|---------|-------------|
| `GCS_BUCKET_NAME` | **Sí** | `totemphotos` | Nombre del bucket de Google Cloud Storage. Sin este valor el servidor no arranca. |
| `GOOGLE_PROJECT_ID` | **Sí** | `mi-proyecto-123` | ID del proyecto GCP donde está habilitado Vertex AI. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local | `./google-creds.json` | Ruta al archivo JSON de credenciales. Usar en local. En PaaS usar la variable de abajo. |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | PaaS | *(contenido del JSON)* | Contenido completo del JSON de la service account como string. El servidor lo escribe en un archivo temporal al arrancar. Usar en Render u otros PaaS donde no se pueden montar archivos. |
| `PORT` | No | `3000` | Puerto en que escucha el servidor. Por defecto `3000`. Render lo inyecta automáticamente. |
| `HOST_IP` | No | `192.168.0.83` | IP de la máquina en la LAN. Si se define, los QR usarán `http://{HOST_IP}:{PORT}/d/{uuid}` como enlace corto. |
| `PUBLIC_BASE_URL` | No | `https://totem.midominio.com` | URL pública base (tiene precedencia sobre `HOST_IP`). Si se define, los QR usarán `{PUBLIC_BASE_URL}/d/{uuid}`. |
| `SIGNED_URL_TTL_SECONDS` | No | `86400` | Tiempo de validez en segundos de las URLs firmadas de GCS. Por defecto 604 800 (7 días). **Máximo permitido por GCS v4: 604 800.** |

> Si ni `PUBLIC_BASE_URL` ni `HOST_IP` están definidos, el campo `qrUrl` en la respuesta de `/upload` y el QR generado codificarán directamente la URL firmada de GCS (muy larga).

### Ejemplo de archivo `.env`

```dotenv
GOOGLE_PROJECT_ID=totem-ia-494202
GOOGLE_APPLICATION_CREDENTIALS=./google-creds.json
GCS_BUCKET_NAME=totemphotos
PORT=3000
HOST_IP=192.168.0.83
# PUBLIC_BASE_URL=https://totem.midominio.com
# SIGNED_URL_TTL_SECONDS=86400
```

---

## Credenciales de Google Cloud

1. En Google Cloud Console, ir a **IAM y administración → Cuentas de servicio**.
2. Crear una cuenta de servicio (o usar una existente) con los roles:
   - `roles/storage.objectAdmin` — para subir/leer objetos en GCS.
   - `roles/aiplatform.user` — para llamar a Vertex AI (Gemini).
3. Generar una clave JSON y guardarla como `google-creds.json` en la raíz del proyecto.
4. Asegurarse de que `google-creds.json` esté en `.gitignore`.

---

## Configuración del bucket GCS

### Permisos

El bucket debe ser privado (sin acceso público). Las imágenes se sirven vía URLs firmadas.

### Regla de ciclo de vida recomendada

Para evitar acumulación de originales, configurar en el bucket una regla que elimine objetos con prefijo `uploads/` tras 1–7 días:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": {
          "age": 7,
          "matchesPrefix": ["uploads/"]
        }
      }
    ]
  }
}
```

Los objetos bajo `outputs/` no se eliminan automáticamente salvo que se agregue una regla explícita.

---

## Estructura de objetos en GCS

```
{GCS_BUCKET_NAME}/
├── uploads/{uuid}.jpg   ← foto original subida por el visitante
└── outputs/{uuid}.jpg   ← resultado final (IA + marco corporativo, JPEG calidad 90)
```

---

## Despliegue

### Local / LAN (tótem físico)

```bash
npm install
node src/index.js
```

Definir `HOST_IP` con la IP de la máquina para que los clientes Unity y los QR funcionen en la red local.

### Render / PaaS

El repositorio incluye `render.yaml` (Blueprint) con la configuración del servicio.

1. Hacer push del código a GitHub/GitLab.
2. En el Dashboard de Render: **New → Blueprint** y conectar el repositorio.
3. Completar las variables marcadas como secretas (`sync: false`):
   - `GCS_BUCKET_NAME`
   - `GOOGLE_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` — pegar el contenido completo del JSON de la service account.
   - `PUBLIC_BASE_URL` — la URL que Render asigna al servicio (ej. `https://totem-backend.onrender.com`). Necesaria para que los QR generen enlaces cortos.
4. Hacer clic en **Apply** y esperar el deploy.

> `PORT` no se configura manualmente; Render lo inyecta automáticamente.

### Assets requeridos

El archivo `src/assets/marco.png` debe estar presente al arrancar el servidor. Debe ser:
- Formato PNG con canal **alpha** (transparencia en la zona donde aparecerá la foto IA).
- Las dimensiones del marco determinan el tamaño final de la imagen de salida.

---

## Verificación del servicio

```bash
curl http://localhost:3000/health
```

Respuesta esperada:
```json
{
  "status": "OK",
  "host_ip": "192.168.0.83",
  "public_base_url": null,
  "short_qr_url": true,
  "gcs_bucket": "totemphotos"
}
```
