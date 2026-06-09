const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export interface GeminiOcrResult {
  monto: number | null;
  proveedor: string | null;
  categoria: string | null;
}

export const GeminiService = {
  async scanTicket(base64Image: string, mimeType: string = 'image/jpeg'): Promise<GeminiOcrResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API Key is missing. Check your environment variables.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `Analiza la imagen de este ticket de compra de gastos. Extrae y devuelve un objeto JSON puro (sin formato markdown ni bloques de código, solo el texto del JSON) con las siguientes propiedades:
{
  "monto": number (monto total del ticket, si no es legible o no hay, usa null),
  "proveedor": string (nombre del establecimiento o proveedor, si no hay usa null),
  "categoria": string (una categoría sugerida de gasto como Alimentos, Transporte, Papelería, Peajes, Combustible, etc.)
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
      }

      const resData = await response.json();
      const textResult = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResult) {
        throw new Error('No se pudo extraer texto del ticket.');
      }

      // Intentar parsear la respuesta JSON del modelo de forma robusta
      let cleanJsonStr = textResult.trim();
      const markdownMatch = cleanJsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (markdownMatch) {
        cleanJsonStr = markdownMatch[1].trim();
      }

      const parsed: GeminiOcrResult = JSON.parse(cleanJsonStr);

      return {
        monto: parsed.monto ?? null,
        proveedor: parsed.proveedor ?? null,
        categoria: parsed.categoria ?? null,
      };
    } catch (err: any) {
      console.error('Error in scanTicket:', err);
      throw new Error(err.message || 'Error al procesar el ticket con Inteligencia Artificial.');
    }
  },
};
