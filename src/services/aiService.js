const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;
const { helpers } = require('@google-cloud/aiplatform');

// Configuración del cliente
const clientOptions = {
    // IMPORTANTE: Si cambias la región en el .env, cámbiala acá también
    apiEndpoint: 'us-east1-aiplatform.googleapis.com',
};
const predictionClient = new PredictionServiceClient(clientOptions);

const promptsMundiales = [
    {
        accion: "jugando",
        descripcion: "Foto de prensa profesional deportiva de acción, fotorrealista. La persona de referencia está corriendo con la pelota en los pies, vistiendo la camiseta de la selección argentina (Adidas, 3 estrellas, parches oficiales de la FIFA). Textura de piel detallada con gotas de sudor, hiperrealista, 8k. Cabello y vello facial IDÉNTICOS a la persona de referencia. Estadio Lusail lleno de gente borrosa, iluminación dramática de estadio nocturno. Cinematic, 35mm."
    },
    {
        accion: "copa",
        descripcion: "Fotografía de estudio profesional, primer plano fotorrealista y cinematográfico de la persona de referencia. Cabello y vello facial IDÉNTICOS a la referencia. Expresión de euforia, vistiendo la camiseta argentina con parches y 3 estrellas. Está levantando la Copa del Mundo original con ambas manos, lluvia de papelitos picados dorados y celestes. Textura metálica de la copa detallada, flashes de cámaras de fondo, iluminación dramática. Alta resolución."
    },
    {
        accion: "gol",
        descripcion: "Foto de acción deportiva fotorrealista de primer plano extremo de la persona de referencia gritando un gol. Cabello y vello facial IDÉNTICOS a la referencia, venas del cuello marcadas, textura de piel real con sudor, hiperrealista. Camiseta argentina oficial Adidas. Estadio Lusail de fondo con hinchada saltando desenfocada, iluminación de estadio nocturno dramática. Alta resolución, detalle fotográfico extremo."
    }
];

/**
 * @param {Buffer} imageBuffer - imagen de referencia (JPEG u otro soportado por el modelo)
 * @returns {Promise<Buffer>} JPG generado
 */
async function processImageWithNanoBanana(imageBuffer) {
    const project = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION;

    const endpoint = `projects/${project}/locations/${location}/publishers/google/models/imagen-3.0-capability-001`;

    const imageData = imageBuffer.toString('base64');
    const selectedPrompt = promptsMundiales[Math.floor(Math.random() * promptsMundiales.length)];

    const instance = helpers.toValue({
        prompt: selectedPrompt.descripcion,
        referenceImages: [
            {
                referenceType: "REFERENCE_TYPE_SUBJECT",
                referenceId: 1,
                referenceImage: {
                    bytesBase64Encoded: imageData
                },
                subjectImageConfig: {
                    subjectType: "SUBJECT_TYPE_PERSON"
                }
            }
        ]
    });

    const parameters = helpers.toValue({
        sampleCount: 1,
        aspectRatio: "9:16",
        safetySetting: "BLOCK_MEDIUM_AND_ABOVE",
        personGeneration: "allow_all"
    });

    const request = {
        endpoint,
        instances: [instance],
        parameters
    };

    try {
        console.log(`🚀 Enviando request a ${location} con referenceImages...`);
        const [response] = await predictionClient.predict(request);

        const predictions = response.predictions;
        const predictionObj = helpers.fromValue(predictions[0]);
        const generatedImageB64 = predictionObj.bytesBase64Encoded;

        return Buffer.from(generatedImageB64, 'base64');
    } catch (error) {
        console.error("❌ Error final:", error.message);
        throw error;
    }
}

module.exports = { processImageWithNanoBanana };
