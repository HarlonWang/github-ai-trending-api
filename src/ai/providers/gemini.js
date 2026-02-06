import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini 总结生成器
 * @param {string} prompt 
 * @param {object} config 
 */
export async function generateSummary(prompt, config) {
  if (!config.apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}
