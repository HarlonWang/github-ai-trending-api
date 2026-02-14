import { GoogleGenAI } from '@google/genai';

/**
 * Gemini 总结生成器 (基于 @google/genai SDK)
 * @param {string} prompt
 * @param {object} config
 */
export async function generateSummary(prompt, config) {
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  // 初始化客户端
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  // 调用生成接口
  const response = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
  });

  return response.text;
}
