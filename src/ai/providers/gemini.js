import { GoogleGenAI } from '@google/genai';

// 静态标志位，确保只打印一次
let hasListedModels = false;

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

  // 临时逻辑：获取并打印可用模型列表
  if (!hasListedModels) {
    hasListedModels = true;
    try {
      console.log('[AI] Checking available models...');
      const modelsResponse = await ai.models.list();
      console.log('[AI] Available models:', modelsResponse);
      modelsResponse.forEach(m => {
        console.log(` - ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
      });
    } catch (listError) {
      console.warn('[AI] Could not list models:', listError.message);
    }
  }

  // 调用生成接口
  const response = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
  });

  return response.text;
}
