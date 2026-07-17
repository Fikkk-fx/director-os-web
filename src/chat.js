// src/chat.js

export function renderMessage(container, role, content) {
  const isUser = role === 'user';
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
  
  let displayContent = content;
  if (!isUser) {
    // Detect production output by looking for Director O.S. markers
    const isProduction = /\[PROSE\]|\[GLOBAL LOCK\]|\[RENDER & ACTING LOCK\]|\[CAMERA & PHYSICS LOCK\]|PHASE [012]|CharSheet|EnvSheet|PropSheet/i.test(content);

    if (isProduction) {
      // Extract the brief explanation block if it exists
      const briefMatch = content.match(/(?:BRIEF EXPLANATION BLOCK:?|implementation_plan)/i);
      
      // Try to extract a short summary before the first production marker
      const firstMarker = content.search(/\[PROSE\]|#{1,3}\s|PHASE\s[012]|\*{3}/);
      let summary = '';
      
      if (firstMarker > 0) {
        summary = content.substring(0, firstMarker).trim();
        // Clean up: remove markdown artifacts
        summary = summary.replace(/```(?:markdown|text)?\s*/g, '').replace(/```/g, '').trim();
      }
      
      if (!summary || summary.length < 10) {
        summary = '✅ Produksi selesai! Prompt sinematik telah di-compile.';
      }
      
      // Truncate summary if too long (keep only first ~500 chars)
      if (summary.length > 500) {
        summary = summary.substring(0, 500).trim() + '...';
      }
      
      displayContent = summary + '\n\n*(Full production output displayed in right panel →)*';
    } else {
      // Non-production response: also check for old code-block pattern
      const promptMatch = content.match(/```([\s\S]*?)```/);
      if (promptMatch) {
        displayContent = content.replace(promptMatch[0], '*(Prompt generated in right panel)*');
      }
    }
  }

  // Basic markdown bold
  displayContent = displayContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Handle newlines
  const paragraphs = displayContent.split('\n').filter(p => p.trim() !== '');
  const paragraphsHtml = paragraphs.map(p => `<p>${p}</p>`).join('');

  messageDiv.innerHTML = `
    <div class="message-avatar">${isUser ? '👤' : '🎬'}</div>
    <div class="message-content">
      <div class="message-bubble ${isUser ? '' : 'glass-bubble'}">
        ${paragraphsHtml}
      </div>
    </div>
  `;
  
  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

export function renderTypingIndicator(container) {
  const indicator = document.createElement('div');
  indicator.className = 'message ai-message typing-indicator-container';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `
    <div class="message-avatar">🎬</div>
    <div class="message-content">
      <div class="message-bubble glass-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

export function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}
