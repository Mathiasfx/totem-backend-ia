const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MARCO_PATH = path.join(__dirname, '..', 'assets', 'marco.png');

/** @type {{ buffer: Buffer; width: number; height: number; hasAlpha: boolean } | null} */
let cached = null;

/**
 * Carga y cachea el PNG del marco. Útil para validar al arranque.
 * @returns {Promise<{ buffer: Buffer; width: number; height: number; hasAlpha: boolean }>}
 */
async function loadMarcoCache() {
    if (cached) {
        return cached;
    }
    if (!fs.existsSync(MARCO_PATH)) {
        throw new Error(`No se encontró el marco en ${MARCO_PATH}`);
    }
    const buffer = fs.readFileSync(MARCO_PATH);
    const meta = await sharp(buffer).metadata();
    const { width, height } = meta;
    if (!width || !height) {
        throw new Error('marco.png sin dimensiones válidas');
    }
    cached = {
        buffer,
        width,
        height,
        hasAlpha: Boolean(meta.hasAlpha)
    };
    return cached;
}

/**
 * Escala la foto IA al tamaño del marco y superpone el PNG (agujero con alpha).
 * @param {Buffer} aiImageBuffer
 * @returns {Promise<Buffer>} JPEG
 */
async function composeWithMarco(aiImageBuffer) {
    const { buffer: frameBuffer, width, height } = await loadMarcoCache();

    const base = await sharp(aiImageBuffer)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .toBuffer();

    return sharp(base)
        .composite([{ input: frameBuffer, blend: 'over' }])
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
}

module.exports = { composeWithMarco, loadMarcoCache, MARCO_PATH };
