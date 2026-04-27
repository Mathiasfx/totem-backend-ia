const { Storage } = require('@google-cloud/storage');

const bucketName = process.env.GCS_BUCKET_NAME;


const MAX_SIGNED_URL_TTL_SECONDS = 604800; // 7 días
const DEFAULT_SIGNED_URL_TTL_SECONDS = MAX_SIGNED_URL_TTL_SECONDS;

function getBucket() {
    if (!bucketName) {
        return null;
    }
    return new Storage().bucket(bucketName);
}

function isGcsEnabled() {
    return Boolean(bucketName);
}

/**
 * @param {string} objectPath - e.g. uploads/uuid.jpg
 * @param {Buffer} buffer
 * @param {string} [contentType]
 */
async function uploadBuffer(objectPath, buffer, contentType = 'image/jpeg') {
    const bucket = getBucket();
    if (!bucket) {
        throw new Error('GCS_BUCKET_NAME no está configurado.');
    }
    const file = bucket.file(objectPath);
    await file.save(buffer, { contentType, resumable: false });
    return objectPath;
}

/**
 * @param {string} objectPath
 * @param {number} [expiresInSeconds] 
 */
async function getSignedReadUrl(objectPath, expiresInSeconds) {
    const bucket = getBucket();
    if (!bucket) {
        throw new Error('GCS_BUCKET_NAME no está configurado.');
    }
    const fromEnv = Number(process.env.SIGNED_URL_TTL_SECONDS);
    let ttl =
        typeof expiresInSeconds === 'number' && expiresInSeconds > 0
            ? expiresInSeconds
            : (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_SIGNED_URL_TTL_SECONDS);

    if (ttl > MAX_SIGNED_URL_TTL_SECONDS) {
        console.warn(
            `SIGNED_URL_TTL_SECONDS (${ttl}s) supera el máximo de GCS v4 (${MAX_SIGNED_URL_TTL_SECONDS}s); se usa el máximo.`
        );
        ttl = MAX_SIGNED_URL_TTL_SECONDS;
    }

    const [url] = await bucket.file(objectPath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + ttl * 1000
    });
    return url;
}

module.exports = {
    uploadBuffer,
    getSignedReadUrl,
    isGcsEnabled
};
