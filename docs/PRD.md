# PRD — Totem Backend

> Documento vivo: actualizar cuando cambien alcance, integraciones o flujos.

## 1. Resumen

API Node (Express) para un **tótem / experiencia física**: recibe una foto, la procesa con **IA** (servicio interno tipo “Nano Banana” / Imagen), persiste originales y resultados en **Google Cloud Storage** (bucket `GCS_BUCKET_NAME` obligatorio) y devuelve URLs para **foto** y **código QR** consumibles por **Unity** u otros clientes. El QR codifica en lo posible un enlace **corto** (`{PUBLIC_BASE_URL|http://HOST_IP:PORT}/d/{uuid}`) que redirige a la **URL firmada** del objeto en GCS; si no hay base pública, el QR usa la URL firmada (muy larga).

## 2. Problema y objetivo

- **Problema:** El cliente (Unity/móvil) necesita subir una imagen y obtener enlaces estables para mostrar el resultado y un QR.
- **Objetivo:** Un único endpoint de carga confiable, con manejo de errores claro y archivos accesibles vía **URL firmada** de GCS; acceso vía enlace corto con **redirección** a esa URL.

## 3. Usuarios y contexto

| Actor | Necesidad |
|--------|-----------|
| Cliente Unity / app | `POST /upload` (multipart), recibir JSON con `fotoUrl` y `qrUrl` |
| Operador / dev | Verificar servicio con `GET /health` |
| IA (servicio externo/SDK) | Credenciales vía entorno; no documentar secretos en este archivo |

## 4. Alcance (MVP)

- Subida de **una** imagen por request (`multipart`, campo `image`).
- Procesamiento asíncrono vía servicio en `src/services/aiService.js`.
- Con `GCS_BUCKET_NAME` obligatorio: subida del original a prefijo `uploads/`, resultado a `outputs/`, respuesta con URL firmada de lectura del JPG y QR acortable vía `GET /d/{uuid}` hacia GCS.
- Respuesta JSON con éxito, URLs y timestamp; errores 4xx/5xx con mensaje legible.

## 5. Fuera de alcance (por ahora)

- Autenticación de clientes.
- Colas, workers o persistencia en base de datos.
- CDN u optimización avanzada de imágenes (más allá del pipeline actual de IA).

## 6. Requisitos funcionales

1. **RF-01** — Si no hay archivo en el request, responder **400** con mensaje claro.
2. **RF-02** — Tras procesar, la imagen final es accesible vía **URL firmada** de GCS; `GET /d/{uuid}` (mismo `uuid` que en `outputs/{uuid}.jpg`) responde **302** a esa URL. **RF-2b** — Con `PUBLIC_BASE_URL` o `HOST_IP` definido, el QR apunta a la **URL corta** (`/d/...`); en caso contrario, el QR codifica la URL firmada.
3. **RF-03** — La respuesta incluye `qrUrl` hacia un bitmap de QR (servicio externo) que en lo posible codifica el enlace corto.
4. **RF-04** — `GET /health` indica que el proceso está vivo (y puede exponer metadatos no sensibles de configuración).

## 7. Requisitos no funcionales

- **Configuración:** Puerto y URLs base preferiblemente vía variables de entorno (evitar IPs fijas en código a medio plazo).
- **Archivos:** Sólo GCS, objetos bajo `uploads/` y `outputs/`.
- **Limpieza en GCP:** Configurar en el bucket una regla de **ciclo de vida** que elimine objetos con prefijo `uploads/` tras N días (p. ej. 1–7); los `outputs/` no deben usar la misma regla de borrado corto salvo que se quiera política explícita de retención.
- **Variables:** `GCS_BUCKET_NAME` (obligatorio), `SIGNED_URL_TTL_SECONDS` (opcional; por defecto 7 días; **máximo 604800 s**), `PUBLIC_BASE_URL` o `HOST_IP` para enlace y QR acortado, credenciales GCP (`GOOGLE_APPLICATION_CREDENTIALS` o entorno del PaaS).
- **CORS:** Habilitado para consumo desde clientes en desarrollo/LAN según necesidad del despliegue.

## 8. Contrato de API (referencia)

- `POST /upload` — `multipart/form-data`, campo archivo: `image`.
- Respuesta exitosa (ejemplo conceptual): `exito`, `fotoUrl`, `qrUrl`, `timestamp`.
- `GET /d/:id` — redirección a la imagen en GCS (URL firmada).
- `GET /health` — estado del servicio.

*(Ajustar campos exactos cuando el código sea la fuente de verdad; mantener este apartado sincronizado.)*

## 9. Métricas de éxito

- Tasa de error 5xx baja en pruebas con imágenes válidas.
- Tiempo aceptable de respuesta en hardware objetivo del tótem.
- Cliente Unity puede reproducir flujo end-to-end en la red configurada.

## 10. Riesgos y dependencias

- Dependencia de APIs/credenciales de Google / Vertex u otros según `aiService`.
- Conectividad LAN y firewall para que clientes alcancen `baseUrl`.
- Cuotas o límites del proveedor de QR externo.

## 11. Historial de cambios

| Fecha | Cambio |
|--------|--------|
| 22/04/2026 | Creación del documento |
| 23/04/2026 | Almacenamiento en GCS, URLs firmadas, lifecycle documentado para `uploads/` |
| 23/04/2026 | Sólo GCS (sin almacenamiento local); QR/redirect acortado vía `PUBLIC_BASE_URL` o `HOST_IP` |
