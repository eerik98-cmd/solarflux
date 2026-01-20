
// import { GoogleGenAI } from "@google/genai";
import { InventoryItem } from "../types";

export const analyzeInventoryWithGemini = async (
  inventory: InventoryItem[],
  query: string
): Promise<string> => {
  // const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const inventoryContext = JSON.stringify(inventory.map(item => ({
    name: item.name,
    sku: item.sku,
    barcode: item.barcode,
    category: item.category,
    qty: item.quantity,
    min: item.minThreshold,
    buyPrice: item.buyPrice,
    sellPrice: item.sellPrice,
    location: item.location,
    specs: item.specs
  })));

  const systemInstruction = `
    You are an expert Inventory Manager for a Solar Energy Installation company named SolarFlux.
    You have access to the current inventory data in JSON format.
    The currency is RON (Romanian Leu).
    
    Your goals:
    1. Answer questions about stock levels, value (buy cost vs sell price), and location.
    2. Identify items that are below their minimum threshold (Low Stock).
    3. Suggest restocks based on quantities vs min thresholds.
    4. Provide technical advice on compatibility if asked.
    
    Current Inventory Data:
    ${inventoryContext}
    
    Keep responses concise, professional, and actionable. 
    If listing items, use bullet points.
  `;

  try {
    // Mock response since GoogleGenAI package is not available
    return `Analysis for query: "${query}"\n\nBased on current inventory, here are the key insights:\n- Total items in stock\n- Items below minimum threshold\n- Recommendations for restock\n\nNote: AI analysis requires proper Gemini API configuration.`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error communicating with the AI service.";
  }
};

export const extractBarcodeFromImage = async (base64Image: string): Promise<string> => {
  // const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    // Mock response - barcode extraction requires proper image processing
    return "1234567890";
  } catch (error) {
    console.error("Barcode scanning error:", error);
    throw error;
  }
};
