import axios from 'axios';

/**
 * ChatGPT 总结生成器 (OpenAI 接口)
 * @param {string} prompt
 * @param {object} config
 */
export async function generateSummary(prompt, config) {
  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const response = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}
