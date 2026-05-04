const { GoogleGenAI } = require('@google/genai');

const promptsMundiales = require('../assets/prompts.json');
const teamsConfig = require('../assets/teams.json');

const DEFAULT_TEAM = 'argentina';

/**
 * Genera una imagen del Mundial usando Gemini con generación de imágenes.
 * Gemini entiende la foto de referencia y crea una escena completamente nueva
 * preservando la identidad facial, sin arrastrar el fondo original.
 *
 * @param {Buffer} imageBuffer - foto de la persona (JPEG)
 * @param {string} [team='argentina'] - clave de selección en teams.json
 * @returns {Promise<Buffer>} imagen generada
 */
async function processImageWithNanoBanana(imageBuffer, team = DEFAULT_TEAM) {
    const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_PROJECT_ID,
        location: 'us-central1'  // Gemini solo disponible en us-central1
    });

    const teamKey = (team || DEFAULT_TEAM).toLowerCase().trim();
    const teamData = teamsConfig[teamKey] || teamsConfig[DEFAULT_TEAM];

    if (!teamsConfig[teamKey]) {
        console.warn(`⚠️  Selección "${teamKey}" no encontrada en teams.json, usando "${DEFAULT_TEAM}".`);
    }

    const selectedPrompt = promptsMundiales[Math.floor(Math.random() * promptsMundiales.length)];
    const resolvedPrompt = selectedPrompt.prompt.replace(/\{\{jersey\}\}/g, teamData.jersey);

    console.log(`🎯 Acción seleccionada: ${selectedPrompt.accion} | Selección: ${teamData.nombre}`);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString('base64')
                    }
                },
                { text: resolvedPrompt }
            ]
        }],
        config: {
            responseModalities: ['IMAGE']
        }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.data);

    if (!imagePart) {
        const textPart = parts.find(p => p.text);
        const reason = textPart?.text || 'sin imagen en la respuesta';
        throw new Error(`Gemini no generó imagen: ${reason}`);
    }

    console.log(`✅ Imagen generada (${imagePart.inlineData.mimeType})`);
    return Buffer.from(imagePart.inlineData.data, 'base64');
}

module.exports = { processImageWithNanoBanana };
