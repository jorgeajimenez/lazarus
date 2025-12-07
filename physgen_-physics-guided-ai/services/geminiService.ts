
import { GoogleGenAI } from "@google/genai";
import { PhysicsAnalysis, ScientificMaterial, BodyType, SpawnMode, SimStats } from "../types";

const MODEL_NAME = 'gemini-3-pro-image-preview';
const ANALYSIS_MODEL = 'gemini-2.5-flash';

const CAMERA_INSTRUCTION = "High-angle isometric view, looking down at the composition. Perfect lighting.";

export const analyzePhysicsFromPrompt = async (prompt: string): Promise<PhysicsAnalysis> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API Key not found");
        const ai = new GoogleGenAI({ apiKey });

        const analysisPrompt = `
        You are a Universal Physics Director. 
        Analyze the user prompt to configure a Material Point Method (MPM) simulation.
        The user might describe anything: Food, Industrial parts, Sci-Fi concepts, Fashion fabrics, or Abstract Art.

        User Prompt: "${prompt}"

        Tasks:
        1. Determine the dominant material.
        2. Estimate scientific properties (0.0 - 100.0 scale normalized for simulation).
        3. Map geometric primitives to objects in the prompt.
        4. Determine the SPAWN MODE based on action verbs.

        Return JSON:
        {
            "materialName": "string",
            "youngsModulus": number (1-100),
            "viscosity": number (0.0-1.0),
            "yieldStress": number (0.0-1.0),
            "density": number,
            "defaultColor": "hex string",
            "spawnMode": "PILE" | "BLAST" | "JET" | "FLOAT",
            "boxMapping": "string",
            "sphereMapping": "string",
            "cylinderMapping": "string",
            "coneMapping": "string",
            "reasoning": "Brief explanation of physics choices.",
            "counts": { "BOX": number, "SPHERE": number ... }
        }
        `;

        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: { parts: [{ text: analysisPrompt }] },
            config: { responseMimeType: "application/json" }
        });

        const text = response.text || "{}";
        const json = JSON.parse(text);

        const material: ScientificMaterial = {
            id: 'CUSTOM',
            name: json.materialName || 'Unknown Material',
            youngsModulus: json.youngsModulus || 50,
            viscosity: json.viscosity || 0.5,
            yieldStress: json.yieldStress || 0.5,
            density: json.density || 1000,
            color: json.defaultColor || '#3b82f6'
        };

        const objectMapping: any = {};
        if (json.boxMapping) objectMapping[BodyType.BOX] = json.boxMapping;
        if (json.sphereMapping) objectMapping[BodyType.SPHERE] = json.sphereMapping;
        if (json.cylinderMapping) objectMapping[BodyType.CYLINDER] = json.cylinderMapping;
        if (json.coneMapping) objectMapping[BodyType.CONE] = json.coneMapping;
        
        // Default to PILE if undefined or invalid
        let spawnMode = SpawnMode.PILE;
        if (json.spawnMode && Object.values(SpawnMode).includes(json.spawnMode)) {
            spawnMode = json.spawnMode;
        }

        return {
            material,
            objectMapping,
            reasoning: json.reasoning || 'Standard simulation parameters applied.',
            estimatedCounts: json.counts || {},
            spawnMode
        };

    } catch (error) {
        console.error("Physics Analysis Error:", error);
        throw error;
    }
}

export const generateImageFromPhysics = async (
  prompt: string,
  physicsSnapshotBase64: string,
  analysis: PhysicsAnalysis,
  stats: SimStats,
  userStyle: string
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });
    
    const cleanBase64 = physicsSnapshotBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, '');

    const styleInstruction = userStyle ? `ART STYLE / VIBE: ${userStyle}` : "Style: Photorealistic, high fidelity.";

    const augmentedPrompt = `
      Task: Generate a high-fidelity image utilizing a Physics Geometry Map.
      
      INPUT CONTEXT:
      1. Scene Description: "${prompt}"
      2. Material: ${analysis.material.name}
      3. Target Material Color: ${analysis.material.color} (The geometry MUST be this color).
      4. ${styleInstruction}
      
      INPUT IMAGE (SEMANTIC MAP):
      The attached image contains a Semantic Density Map of the simulation.
      - Colored blobs represent the EXACT physical volume and position of the objects.
      - Cyan = Boxes / Cubes
      - Pink = Spheres
      - Purple = Cylinders
      - Orange = Cones
      
      INSTRUCTIONS:
      1. **Volume Lock**: You must paint the material INSIDE the contours provided by the input image. Do not change the shape.
      2. **Color Compliance**: The input map uses semantic colors (Pink/Cyan) for ID. You must paint them with the TARGET MATERIAL COLOR (${analysis.material.color}).
      3. **Context**: Generate the surrounding environment (table, floor, hands, tools) to match the prompt and style.
      4. **Physics**: The simulation had a Snap/Jerk of ${stats.systemSnap.toFixed(1)}. If this is high (>100), add motion blur or impact debris.
      
      Camera: ${CAMERA_INSTRUCTION}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: augmentedPrompt },
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
        ],
      },
      config: { imageConfig: { imageSize: "1K", aspectRatio: "1:1" } }
    });

    return extractImageFromResponse(response);
  } catch (error) {
    console.error("Gemini Gen Error:", error);
    throw error;
  }
};

export const generateBasicImage = async (prompt: string, analysis: PhysicsAnalysis, userStyle: string): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });

    const styleInstruction = userStyle ? `ART STYLE: ${userStyle}` : "Style: Photorealistic.";

    const comparisonPrompt = `
      Task: Generate an image based on this text prompt.
      
      User Prompt: "${prompt}"
      Objects: ${Object.values(analysis.objectMapping).join(', ')}.
      Material Color: ${analysis.material.color}.
      ${styleInstruction}
      
      NOTE: This is the "Standard AI" baseline. 
      - Generate the scene based *only* on the text. 
      - Do not worry about volume conservation or physics accuracy.
      
      Camera: ${CAMERA_INSTRUCTION}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: comparisonPrompt }] },
      config: { imageConfig: { imageSize: "1K", aspectRatio: "1:1" } }
    });

    return extractImageFromResponse(response);
  } catch (error) {
    console.error("Gemini Basic Error:", error);
    throw error;
  }
};

const extractImageFromResponse = (response: any): string => {
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No content generated. The model may have blocked the request due to safety settings.");
    for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image data found in response");
}
