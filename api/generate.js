import { getSystemPrompt } from '../src/system-prompt.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { model, engine, history = [], userMessage, mode = 'mini' } = req.body;

  if (!model || !engine || !userMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isOpenAI = model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3');
  
  const apiKey = isOpenAI ? process.env.OPENAI_API_KEY : process.env.GROK_API_KEY;
  if (!apiKey) {
    const keyName = isOpenAI ? 'OPENAI_API_KEY' : 'GROK_API_KEY';
    return res.status(500).json({ error: `${keyName} is not configured in Vercel ENV.` });
  }

  try {
    const endpoint = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.x.ai/v1/responses';
    
    const messages = [{ role: 'system', content: getSystemPrompt(engine, userMessage, mode) }];
    history.forEach(msg => {
      messages.push({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.content });
    });
    messages.push({ role: 'user', content: userMessage });

    let requestBody;
    
    if (isOpenAI) {
      requestBody = {
        model: model,
        messages: messages,
      };
      if (model === 'o3-mini') {
        requestBody.max_completion_tokens = 32000;
      } else if (model.startsWith('gpt-5')) {
        // GPT-5.x Sol series: higher token limit for advanced reasoning
        requestBody.temperature = 0.4;
        requestBody.max_completion_tokens = 32000;
      } else {
        requestBody.temperature = 0.4;
        requestBody.max_tokens = 4096;
      }
    } else {
      requestBody = {
        model: model,
        input: messages,
        temperature: 0.4,
        max_output_tokens: 32768
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Failed to communicate with ${isOpenAI ? 'OpenAI' : 'Grok'} API`;
      try {
        const errData = JSON.parse(errText);
        errMsg = errData.error?.message || errMsg;
      } catch (e) {
        errMsg = `API Error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    
    if (isOpenAI) {
      if (data.choices && data.choices.length > 0) {
        res.status(200).json({ text: data.choices[0].message.content });
      } else {
        throw new Error('No response generated from OpenAI.');
      }
    } else {
      const msgOutput = data.output?.find(o => o.type === 'message');
      if (msgOutput?.content?.length > 0) {
        res.status(200).json({ text: msgOutput.content[0].text });
      } else {
        throw new Error('No response generated from Grok.');
      }
    }
  } catch (error) {
    console.error('API Route Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
