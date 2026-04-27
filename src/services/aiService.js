const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;
const { helpers } = require('@google-cloud/aiplatform');
const { VertexAI } = require('@google-cloud/vertexai');


// Configuración del cliente
const clientOptions = {
    apiEndpoint: 'us-east1-aiplatform.googleapis.com',
};
const predictionClient = new PredictionServiceClient(clientOptions);

//Para Analisis previo (Gemini solo disponible en us-central1)
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION
});

async function analyzeSubjectFeatures(imageBuffer) {
    // gemini-2.0-flash es más barato y rápido, suficiente para esto
    // si querés más precisión usá gemini-2.0-pro
    const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString('base64')
                    }
                },
                {
                    text: `Describe ONLY the physical appearance of this person in one short sentence for an AI image generation model.
Focus on: hair (color, length, or if bald/shaved head), facial hair (beard, mustache, or clean-shaven), skin tone, and approximate age range.
Format: "A [age range] [skin tone] person with [hair description] and [facial hair description]."
Example: "A 35-45 year old medium skin tone person with a shaved head and thick dark beard."
Be precise and literal. Do not add anything else.`
                }
            ]
        }]
    });

    const response = result.response;
    return response.candidates[0].content.parts[0].text.trim();
}

const promptsMundiales = [
  {
    accion: "jugando",
    // Solo escena + acción, SIN describir la cara/cabello
    prompt: `
      Ultra-realistic professional sports press photograph, 8K resolution, 35mm lens, 
      photojournalism quality, sharp focus.
      The subject is sprinting at full speed dribbling a classic black and white soccer ball, 
      low dynamic angle shot, slight motion blur on legs conveying speed.
      Wearing the official 2026 Argentina national team Adidas jersey: 
      light blue and white vertical stripes, three gold stars above the AFA golden crest 
      on chest, official FIFA World Cup gold patch on left sleeve, black shorts, 
      white socks with light blue stripes, Adidas cleats.
      Visible sweat droplets on skin and jersey fabric, intense focused expression.
      Background: Lusail Stadium packed with 80,000 fans, 
      extreme bokeh blur f/2.8, green pitch partially visible, 
      dramatic stadium floodlights creating strong rim lighting from above, night match.
      Cinematic color grading, high contrast, shallow depth of field focused on subject.
    `.trim().replace(/\s+/g, ' '),

    negativePrompt: `
      cartoon, anime, CGI, 3D render, illustration, painting, watercolor,
      distorted face, blurry face, deformed face, altered facial features, 
      different person, generic face, unrealistic skin, plastic skin, wax skin,
      wrong jersey color, red jersey, white jersey, missing stars on jersey,
      flat lighting, overexposed, underexposed, watermark, text, logo, signature,
      duplicate limbs, extra fingers, bad anatomy, deformed hands
    `.trim().replace(/\s+/g, ' '),

    subjectDescription: "A person, preserve exact face, skin tone, hair and facial hair"
  },

  {
    accion: "copa",
    prompt: `
      Ultra-realistic studio editorial sports portrait photograph, 8K, cinematic lighting.
      The subject is holding the FIFA World Cup trophy raised high above their head 
      with both hands, golden trophy with detailed metallic texture catching 
      a dramatic overhead key light.
      Expression of pure euphoria and victory celebration, mouth open in a joyful shout.
      Wearing the official 2026 Argentina national team Adidas jersey: 
      light blue and white vertical stripes, three gold stars above AFA golden crest, 
      FIFA World Cup gold patch on sleeve.
      Golden and light blue confetti and ticker tape raining down from above, 
      multiple camera flashes creating bright bokeh sparkles in the dark background, 
      dramatic single key light from upper-front casting cinematic shadows on face.
      Shallow depth of field, sharp focus on face and trophy, editorial quality.
    `.trim().replace(/\s+/g, ' '),

    negativePrompt: `
      cartoon, anime, CGI, 3D render, illustration, distorted face, blurry face,
      different person, generic face, wrong trophy, fake prop trophy, 
      wrong jersey, red jersey, no stars on jersey, missing AFA crest,
      plastic skin, flat lighting, watermark, text, bad anatomy, extra limbs,
      overexposed, underexposed
    `.trim().replace(/\s+/g, ' '),

    subjectDescription: "A person, preserve exact face, skin tone, hair and facial hair"
  },

  {
    accion: "gol",
    prompt: `
      Ultra-realistic extreme close-up sports action photograph, 8K, photojournalism.
      Tight framing from chest to top of head, slightly low angle looking up at subject.
      The subject is screaming in raw primal goal celebration, mouth wide open, 
      neck veins prominently visible, face contorted in intense ecstatic emotion, 
      eyes looking upward or shut, heavy sweat on face and neck, 
      wet hair, veins on temples.
      Wearing the official 2026 Argentina national team Adidas jersey: 
      light blue and white vertical stripes, three gold stars above AFA golden crest, 
      collar and upper chest visible.
      Background: Lusail Stadium, packed fans jumping in celebration heavily blurred, 
      green pitch barely visible at bottom, stadium floodlights as large bokeh orbs, 
      night match atmosphere with dramatic rim lighting on subject.
      35mm f/1.4, razor-sharp focus on face, extreme background bokeh, 
      high contrast cinematic color grade, stadium rim lighting.
    `.trim().replace(/\s+/g, ' '),

    negativePrompt: `
      cartoon, anime, CGI, 3D render, illustration, distorted face, blurry face,
      different person, generic face, wrong jersey, red jersey, no stars on jersey,
      plastic skin, wax face, flat lighting, calm expression, smiling gently,
      full body shot, wide angle, watermark, text, bad anatomy, 
      overexposed, underexposed
    `.trim().replace(/\s+/g, ' '),

    subjectDescription: "A person, preserve exact face, skin tone, hair and facial hair"
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

    console.log(`🎯 Acción seleccionada: ${selectedPrompt.accion}`);

    // 👇 Paso 1: analizar la imagen antes de generar
    let subjectDescription = "A person, preserve exact facial features, hair, and facial hair";
    try {
        subjectDescription = await analyzeSubjectFeatures(imageBuffer);
        console.log(`🔍 Descripción del sujeto: ${subjectDescription}`);
    } catch (err) {
        console.warn("⚠️ No se pudo analizar la imagen, usando descripción genérica:", err.message);
    }

    const finalPrompt = `${subjectDescription}. ${selectedPrompt.prompt}`;
    const finalNegative = selectedPrompt.negativePrompt;

    const instance = helpers.toValue({
        prompt: finalPrompt,
        referenceImages: [
            {
                referenceType: "REFERENCE_TYPE_SUBJECT",
                referenceId: 1,
                referenceImage: { bytesBase64Encoded: imageData },
                subjectImageConfig: {
                    subjectType: "SUBJECT_TYPE_PERSON",
                    subjectDescription: subjectDescription  // 👈 dinámico
                }
            }
        ]
    });

    const parameters = helpers.toValue({
        sampleCount: 1,
        aspectRatio: "9:16",
        safetySetting: "BLOCK_MEDIUM_AND_ABOVE",
        personGeneration: "allow_all",
        negativePrompt: finalNegative  // 👈 dinámico
    });

    try {
        console.log(`🚀 Enviando request a ${location}...`);
        const [response] = await predictionClient.predict({ endpoint, instances: [instance], parameters });

        const predictionObj = helpers.fromValue(response.predictions[0]);

        if (!predictionObj.bytesBase64Encoded) {
            const reason = predictionObj.raiFilteredReason || 'unknown';
            throw new Error(`Imagen bloqueada: ${reason}`);
        }

        return Buffer.from(predictionObj.bytesBase64Encoded, 'base64');
    } catch (error) {
        console.error("❌ Error final:", error.message);
        throw error;
    }
}

module.exports = { processImageWithNanoBanana };


