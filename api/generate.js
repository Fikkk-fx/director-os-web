import { getSystemPrompt } from '../src/system-prompt.js';

// --- Provider Helpers ---

function isOpenAIModel(model) {
  return model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4') || model.startsWith('chatgpt-');
}

function isSolModel(model) {
  return model === 'gpt-5.6-sol';
}

function isReasoningModel(model) {
  return model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
}

function mapGrokModelToOpenAI(grokModel) {
  // Map Grok models to price-comparable OpenAI models for fallback
  const mapping = {
    'grok-4.5': 'gpt-5.6-sol',    // Top-tier → GPT-5.6 Sol
    'grok-3': 'gpt-4.1',          // Mid-tier → GPT-4.1 ($2/$8)
    'grok-3-fast': 'gpt-4.1-mini', // Fast/cheap → GPT-4.1 Mini ($0.4/$1.6)
  };
  return mapping[grokModel] || 'gpt-4.1-mini';
}

function downgradeModel(model) {
  // When TPM limit is hit, try a smaller/cheaper model with higher limits
  const downgrades = {
    'gpt-5.6-sol': 'gpt-4.1',
    'gpt-4.1': 'gpt-4.1-mini',
    'gpt-4.1-mini': 'gpt-4.1-nano',
    'gpt-4o': 'gpt-4o-mini',
    'o3': 'o4-mini',
    'o4-mini': 'o3-mini',
  };
  return downgrades[model] || null;
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

async function callOpenAIAPI(apiKey, model, messages, maxOutputTokens = 16384) {
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

  if (isReasoningModel(model) || isSolModel(model)) {
    // Reasoning models and GPT-5.6 Sol use max_completion_tokens instead of max_tokens
    requestBody.max_completion_tokens = maxOutputTokens;
  } else {
    requestBody.temperature = 0.4;
    requestBody.max_tokens = maxOutputTokens;
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
    const errMsg = errorData.error?.message || '';
    const error = new Error(errMsg || `OpenAI API error (${response.status})`);
    error.status = response.status;
    error.isTPMError = /tokens per min|TPM|too large/i.test(errMsg);
    throw error;
  }

  const data = await response.json();
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error('No response generated from OpenAI.');
}

// Wrapper: try OpenAI call, auto-downgrade model on TPM/rate errors
async function callOpenAIWithRetry(apiKey, model, messages) {
  try {
    return { text: await callOpenAIAPI(apiKey, model, messages, 16384), model };
  } catch (err) {
    if (err.isTPMError || err.status === 429) {
      // Strategy 1: retry same model with smaller output
      try {
        console.warn(`TPM limit hit for ${model}. Retrying with reduced max_tokens (8192)...`);
        return { text: await callOpenAIAPI(apiKey, model, messages, 8192), model };
      } catch (retryErr) {
        // Strategy 2: downgrade to a smaller model
        const smallerModel = downgradeModel(model);
        if (smallerModel && (retryErr.isTPMError || retryErr.status === 429)) {
          console.warn(`Still over limit. Downgrading ${model} → ${smallerModel}...`);
          return { text: await callOpenAIAPI(apiKey, smallerModel, messages, 16384), model: smallerModel };
        }
        throw retryErr;
      }
    }
    throw err;
  }
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
      const result = await callOpenAIWithRetry(openaiApiKey, model, messages);
      const usedModel = result.model !== model ? ` (downgraded to ${result.model})` : '';
      return res.status(200).json({ text: result.text, provider: 'openai', note: usedModel || undefined });
    }

    // --- Route 2: Grok model (with auto-fallback to OpenAI on rate limit) ---
    if (!grokApiKey) {
      // If no Grok key but OpenAI key exists, fallback directly
      if (openaiApiKey) {
        const fallbackModel = mapGrokModelToOpenAI(model);
        console.warn(`No Grok API key. Falling back to OpenAI (${fallbackModel}).`);
        const result = await callOpenAIWithRetry(openaiApiKey, fallbackModel, messages);
        return res.status(200).json({ text: result.text, provider: 'openai-fallback' });
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
        const result = await callOpenAIWithRetry(openaiApiKey, fallbackModel, messages);
        return res.status(200).json({ text: result.text, provider: 'openai-fallback' });
      }

      // No fallback available or non-rate-limit error — throw original
      throw grokError;
    }

  } catch (error) {
    console.error('API Route Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
