
import { GoogleGenAI, Type } from "@google/genai";

const apiSecret = import.meta.env.VITE_API_KEY;
const ai = apiSecret ? new GoogleGenAI(apiSecret) : null;

export const analyzeLoanObservation = async (observation: string) => {
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise a seguinte observação de empréstimo de armário escolar: "${observation}". 
      Extraia pontos chave e forneça uma versão resumida e profissional para o sistema. 
      Responda apenas em JSON com os campos "keywords" (array) e "summary" (string).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING }
          },
          required: ["keywords", "summary"]
        }
      }
    });

    // Safely extract and trim the text property before parsing as recommended
    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
