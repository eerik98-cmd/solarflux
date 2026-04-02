// import { GoogleGenAI } from "@google/genai";
// import { InventoryItem } from "../types";

// const apiKey = process.env.API_KEY || '';
// const ai = new GoogleGenAI({ apiKey });

// export const analyzeInventoryWithGemini = async (
//   inventory: InventoryItem[],
//   query: string
// ): Promise<string> => {
//   if (!apiKey) {
//     return "API Key is missing. Please configure the environment variable.";
//   }

//   const inventoryContext = JSON.stringify(inventory.map(item => ({
//     name: item.name,
//     sku: item.sku,
//     barcode: item.barcode,
//     category: item.category,
//     qty: item.quantity,
//     min: item.minThreshold,
//     buyPrice: item.buyPrice,
//     sellPrice: item.sellPrice,
//     location: item.location,
//     specs: item.specs
//   })));

//   const systemInstruction = `
//     You are an expert Inventory Manager for a Solar Energy Installation company named SolarFlux.
//     You have access to the current inventory data in JSON format.
//     The currency is RON (Romanian Leu).
    
//     Your goals:
//     1. Answer questions about stock levels, value (buy cost vs sell price), and location.
//     2. Identify items that are below their minimum threshold (Low Stock).
//     3. Suggest restocks based on quantities vs min thresholds.
//     4. Provide technical advice on compatibility if asked.
    
//     Current Inventory Data:
//     ${inventoryContext}
    
//     Keep responses concise, professional, and actionable. 
//     If listing items, use bullet points.
//     If the user asks about "my other project", politely inform them that you only have access to the current SolarFlux inventory context.
//   `;

//   try {
//     const response = await ai.models.generateContent({
//       model: 'gemini-2.5-flash',
//       contents: query,
//       config: {
//         systemInstruction: systemInstruction,
//         temperature: 0.2, // Low temperature for factual data
//       }
//     });

//     return response.text || "I couldn't analyze the data at this moment.";
//   } catch (error) {
//     console.error("Gemini API Error:", error);
//     return "Sorry, I encountered an error communicating with the AI service.";
//   }
// };

// export const extractBarcodeFromImage = async (base64Image: string): Promise<string> => {
//   if (!apiKey) throw new Error("API Key missing");

//   try {
//     // Remove data URL prefix if present for the API call
//     const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

//     const response = await ai.models.generateContent({
//       model: 'gemini-2.5-flash',
//       contents: {
//         parts: [
//           {
//             inlineData: {
//               mimeType: 'image/jpeg',
//               data: cleanBase64
//             }
//           },
//           {
//             text: "Identify the barcode number in this image. Return ONLY the number digits/characters. Do not include any other text. If no barcode is visible, return 'NOT_FOUND'."
//           }
//         ]
//       }
//     });

//     const text = response.text?.trim();
//     if (!text || text.includes('NOT_FOUND')) {
//       throw new Error("No barcode detected");
//     }
//     return text;
//   } catch (error) {
//     console.error("Barcode scanning error:", error);
//     throw error;
//   }
// };