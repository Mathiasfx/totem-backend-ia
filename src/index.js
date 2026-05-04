const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config();

// Si existe GOOGLE_APPLICATION_CREDENTIALS_JSON (PaaS como Render),
// escribimos el JSON en un archivo temporal y apuntamos la variable al path.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const tmpPath = path.join(os.tmpdir(), 'google-creds.json');
    fs.writeFileSync(tmpPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const { processImageWithNanoBanana } = require('./services/aiService');
const { composeWithMarco, loadMarcoCache } = require('./services/frameService');
const { uploadBuffer, getSignedReadUrl, isGcsEnabled } = require('./services/storageService');

const PORT = Number(process.env.PORT) || 3000;
const HOST_IP = process.env.HOST_IP;

const app = express();
app.use(cors());
app.use(express.json());

if (!isGcsEnabled()) {
    console.error('Falta GCS_BUCKET_NAME. Este servicio sólo almacena en Google Cloud Storage.');
    process.exit(1);
}

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});
const upload = memoryUpload;

const UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QR_IMAGE_PX = 800;

function stripTrailingSlash(s) {
    return s.replace(/\/+$/, '');
}


function getShortDownloadBaseUrl() {
    const fromEnv = process.env.PUBLIC_BASE_URL?.trim();
    if (fromEnv) {
        return stripTrailingSlash(fromEnv);
    }
    if (HOST_IP) {
        return `http://${HOST_IP}:${PORT}`;
    }
    return null;
}

/**
 * @param {string} photoId
 * @param {string} longFallback
 */
function buildQrDataUrl(photoId, longFallback) {
    const base = getShortDownloadBaseUrl();
    if (base) {
        return `${base}/d/${photoId}`;
    }
    return longFallback;
}

function buildQrServerImageUrl(data) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_IMAGE_PX}x${QR_IMAGE_PX}&ecc=L&data=${encodeURIComponent(
        data
    )}`;
}

app.get('/d/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_V4_RE.test(id)) {
        return res.status(400).send('ID no válido.');
    }
    try {
        const signed = await getSignedReadUrl(`outputs/${id}.jpg`);
        return res.redirect(302, signed);
    } catch (err) {
        console.error('GET /d:', err.message);
        return res.status(404).send('Foto no encontrada.');
    }
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No llegó ninguna imagen.' });
        }

        const id = crypto.randomUUID();
        const uploadObjectPath = `uploads/${id}.jpg`;
        const outputObjectPath = `outputs/${id}.jpg`;

        console.log(`Foto recibida (GCS): ${uploadObjectPath}`);
        console.log('Procesando con Nano Banana (Imagen 3)...');

        await uploadBuffer(uploadObjectPath, req.file.buffer, req.file.mimetype || 'image/jpeg');

        const team = (req.body.seleccion || 'argentina').toLowerCase().trim();
        const rawOutputBuffer = await processImageWithNanoBanana(req.file.buffer, team);
        const outputBuffer = await composeWithMarco(rawOutputBuffer);
        await uploadBuffer(outputObjectPath, outputBuffer, 'image/jpeg');

        const fotoUrl = await getSignedReadUrl(outputObjectPath);
        const qrData = buildQrDataUrl(id, fotoUrl);
        const qrUrl = buildQrServerImageUrl(qrData);

        console.log('Procesamiento completado con éxito (GCS)');

        return res.json({
            exito: true,
            fotoUrl,
            qrUrl,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en el servidor:', error.message);
        res.status(500).json({
            error: 'Error procesando la imagen',
            mensaje: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        host_ip: HOST_IP ?? null,
        public_base_url: process.env.PUBLIC_BASE_URL?.trim() || null,
        short_qr_url: Boolean(getShortDownloadBaseUrl()),
        gcs_bucket: process.env.GCS_BUCKET_NAME ?? null
    });
});

(async function start() {
    try {
        const marco = await loadMarcoCache();
        if (!marco.hasAlpha) {
            console.warn(
                'marco.png no reporta canal alpha; el centro puede tapar la foto. Reexportá el PNG con transparencia en el recorte.'
            );
        } else {
            console.log(` Marco corporativo cargado (${marco.width}x${marco.height}, alpha).`);
        }
    } catch (err) {
        console.error('No se pudo cargar el marco:', err.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(` Servidor del Tótem corriendo en http://localhost:${PORT}`);
     
    
    });
})();
