import { getSystemPrompt } from '../src/system-prompt.js';

// --- Provider Helpers ---

function isOpenAIModel(model) {
  return model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4') || model.startsWith('chatgpt-');
}

function isReasoningModel(model) {
  return model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
}

function mapGrokModelToOpenAI(grokModel) {
  // Map Grok models to price-comparable OpenAI models for fallback
  const mapping = {
    'grok-4.5': 'gpt-4.1',       // Top-tier → GPT-4.1 ($2/$8)
    'grok-3': 'gpt-4.1',          // Mid-tier → GPT-4.1 ($2/$8)
    'grok-3-fast': 'gpt-4.1-mini', // Fast/cheap → GPT-4.1 Mini ($0.4/$1.6)
  };
  return mapping[grokModel] || 'gpt-4.1-mini';
}

async function callGrokAPI(apiKey, model, messages) {
  const endpoint = 'https://api.x.ai/v1/responses';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      input: messages,
      temperature: 0.4,
      max_output_tokens: 32768
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error?.message || `Grok API error (${response.status})`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const msgOutput = data.output?.find(o => o.type === 'message');
  if (msgOutput?.content?.length > 0) {
    return msgOutput.content[0].text;
  }
  throw new Error('No response generated from Grok.');
}

async function callOpenAIAPI(apiKey, model, messages) {
  // Convert xAI-style "input" messages to OpenAI chat format
  const openaiMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const endpoint = 'https://api.openai.com/v1/chat/completions';

  // Build request body — o-series reasoning models don't support temperature
  const requestBody = {
    model: model,
    messages: openaiMessages,
  };

  if (isReasoningModel(model)) {
    // Reasoning models use max_completion_tokens instead of max_tokens
    requestBody.max_completion_tokens = 32768;
  } else {
    requestBody.temperature = 0.4;
    requestBody.max_tokens = 32768;
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error (${response.status})`);
  }

  const data = await response.json();
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error('No response generated from OpenAI.');
}

// --- Main Handler ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { model, engine, history, userMessage, mode = 'mini' } = req.body;

  if (!model || !engine || !userMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const grokApiKey = process.env.GROK_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Build messages array (shared format)
  const messages = [];
  messages.push({
    role: 'system',
    content: getSystemPrompt(engine, userMessage, mode)
  });
  history.forEach(msg => {
    messages.push({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content
    });
  });
  messages.push({
    role: 'user',
    content: userMessage
  });

  try {
    let resultText = '';

    // --- Route 1: User explicitly selected an OpenAI model ---
    if (isOpenAIModel(model)) {
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API Key is not configured in Vercel ENV.' });
      }
      resultText = await callOpenAIAPI(openaiApiKey, model, messages);
      return res.status(200).json({ text: resultText, provider: 'openai' });
    }

    // --- Route 2: Grok model (with auto-fallback to OpenAI on rate limit) ---
    if (!grokApiKey) {
      // If no Grok key but OpenAI key exists, fallback directly
      if (openaiApiKey) {
        const fallbackModel = mapGrokModelToOpenAI(model);
        console.warn(`No Grok API key. Falling back to OpenAI (${fallbackModel}).`);
        resultText = await callOpenAIAPI(openaiApiKey, fallbackModel, messages);
        return res.status(200).json({ text: resultText, provider: 'openai-fallback' });
      }
      return res.status(500).json({ error: 'API Key for Grok is not configured in Vercel ENV.' });
    }

    try {
      resultText = await callGrokAPI(grokApiKey, model, messages);
      return res.status(200).json({ text: resultText, provider: 'grok' });
    } catch (grokError) {
      // Auto-fallback to OpenAI on rate limit (429) or overloaded (529)
      const isRateLimited = grokError.status === 429 || grokError.status === 529;

      if (isRateLimited && openaiApiKey) {
        const fallbackModel = mapGrokModelToOpenAI(model);
        console.warn(`Grok rate-limited (${grokError.status}). Falling back to OpenAI (${fallbackModel}).`);
        resultText = await callOpenAIAPI(openaiApiKey, fallbackModel, messages);
        return res.status(200).json({ text: resultText, provider: 'openai-fallback' });
      }

      // No fallback available or non-rate-limit error — throw original
      throw grokError;
    }

  } catch (error) {
    console.error('API Route Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
