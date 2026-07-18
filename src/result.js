// src/result.js

export function updateResultPanel(aiResponse) {
  const resultContainer = document.getElementById('result-content');
  const auditPanel = document.getElementById('audit-panel');
  const auditTable = document.getElementById('audit-table');
  
  // Enable buttons
  document.getElementById('btn-copy').disabled = false;
  document.getElementById('btn-download-md').disabled = false;
  document.getElementById('btn-download-pdf').disabled = false;

  // Detect if this is a Director O.S. production output
  const isProduction = /\[PROSE\]|\[GLOBAL LOCK\]|\[RENDER & ACTING LOCK\]|\[CAMERA & PHYSICS LOCK\]|PHASE [012]|CharSheet|EnvSheet|PropSheet/i.test(aiResponse);

  let promptText = '';

  if (isProduction) {
    // For production output, use the FULL response as the result
    // But strip any brief conversational preamble before the first production marker
    const firstMarker = aiResponse.search(/(?:#{1,3}\s|PHASE\s[012]|\*{3}\s*\n|\[SYS-LOG|\[PROSE\]|BRIEF EXPLANATION|implementation_plan|Total Runtime)/i);
    
    if (firstMarker > 0) {
      promptText = aiResponse.substring(firstMarker).trim();
    } else {
      promptText = aiResponse.trim();
    }
  } else {
    // Legacy: extract from code blocks
    const promptMatch = aiResponse.match(/```(?:text|markdown)?\n([\s\S]*?)```/);
    promptText = promptMatch ? promptMatch[1].trim() : aiResponse.trim();
  }

  // The user sees RNG in the chat panel, so we completely hide it from the Result panel!
  // Strip anything from [SYS-LOG] up to the start of the code block or [PROSE]
  promptText = promptText.replace(/\[SYS-LOG[\s\S]*?(?=\s*```|\[PROSE\])/gi, '').trim();

  // Split into sections/phases
  const sections = promptText.split(/(?=^(?:### |\*\*\[SYS-LOG|\*\*KLIP|\*\*CLIP|KLIP |CLIP |Phase |Fase ))/mi);
  
  let blocksHtml = '';

  sections.forEach((section) => {
    if (!section.trim()) return;
    
    // Determine title for the block header
    let title = '🎬 Director O.S. Block';
    const firstLine = section.trim().split('\n')[0].toUpperCase();
    if (firstLine.includes('SYS-LOG') || firstLine.includes('RNG')) title = '🎲 RNG Initiative Log';
    else if (firstLine.includes('PHASE 1') || firstLine.includes('ASSETS')) title = '📁 Phase 1: Assets & Lock';
    else if (firstLine.includes('CLIP') || firstLine.includes('KLIP')) title = '🎥 Video Clip Prompt';
    else if (firstLine.includes('PHASE')) title = '⚙️ Phase Setup';
    else title = '📝 Generated Text';

    // Convert markdown to basic HTML for display
    let displayHtml = section.trim()
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Horizontal rules
      .replace(/^\*{3,}$/gm, '<hr>')
      .replace(/^-{3,}$/gm, '<hr>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks with Copy Button
      .replace(/```(?:text|markdown|json|html)?\n([\s\S]*?)```/g, (match, code) => {
         const escapedCode = encodeURIComponent(code.trim());
         return `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-title">Terminal Output</span>
              <button class="btn-copy-code" data-code="${escapedCode}">📋 Copy Prompt</button>
            </div>
            <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          </div>
         `;
      })
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>');

    const isSysLog = firstLine.includes('SYS-LOG') || firstLine.includes('RNG');

    if (isSysLog) {
      // The user sees RNG in the chat panel, so we completely hide it from the Result panel!
      // We also strip it from the raw text so the Copy button only copies the prompt.
      promptText = promptText.replace(section, '').trim();
      return;
    } else {
      blocksHtml += `
        <div class="result-block">
          <div class="result-block-header">
            ${title}
          </div>
          <div class="result-block-body">
            <div class="result-prompt-text">${displayHtml}</div>
          </div>
        </div>
      `;
    }
  });

  // Render Result Block
  resultContainer.innerHTML = blocksHtml + `<div id="raw-prompt-text" data-raw="${encodeURIComponent(promptText)}" style="display:none;"></div>`;

  // Attach event listeners for dynamic copy buttons
  document.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = decodeURIComponent(e.target.dataset.code);
      navigator.clipboard.writeText(code).then(() => {
        const original = e.target.innerText;
        e.target.innerText = '✅ Copied!';
        e.target.classList.add('copied');
        setTimeout(() => {
          e.target.innerText = original;
          e.target.classList.remove('copied');
        }, 2000);
      });
    });
  });

  // Perform V19.1 compliance audit
  const textLower = aiResponse.toLowerCase();
  
  // Detect selected mode from UI to enforce limits
  const activeModeBtn = document.querySelector('.mode-btn[data-mode].active');
  const isMini = activeModeBtn ? activeModeBtn.dataset.mode === 'mini' : true;
  const maxLimit = isMini ? 2000 : 3000;
  
  // Extract Phase 2 clip prompts ONLY (from [SYS-LOG to next [SYS-LOG or end-of-string)
  const clipMatches = aiResponse.match(/\[SYS-LOG[\s\S]*?(?=\[SYS-LOG|$)/gi);
  
  let maxClipLength = 0;
  if (clipMatches && clipMatches.length > 0) {
    maxClipLength = Math.max(...clipMatches.map(sec => sec.trim().length));
  } else {
    maxClipLength = promptText.length; // Fallback to full text if no clips found
  }

  const rules = [
    { name: `Length Limit (Max ${maxLimit}) — Actual: ${maxClipLength} chars`, pass: maxClipLength <= maxLimit },
    { name: "SYS-LOG: RNG Initiative", pass: /sys.?log|rng.?initiative|rolled location|rolled wardrobe|rolled camera|rolled lighting/i.test(textLower) },
    { name: "Action-First Inversion", pass: /\[prose\]/.test(textLower) },
    { name: "Kinetic Syntax (3s Mandate)", pass: /hard.?cut|jump.?cut|smash.?cut|match.?cut|whip.?pan|fast.?tracking|dynamic.?swoop|rack.?focus|handheld.?reveal|crane|lateral.?track/i.test(textLower) },
    { name: "The Barrel-Stare Ban", pass: /zero barrel stare|eyeline|off.?screen|concealing eyes|never lens/i.test(textLower) },
    { name: "Triadic Color Law", pass: /color|triadic|red|blue|yellow|cyan|orange|crimson|amber|indigo|magenta/i.test(textLower) },
    { name: "The Anti-Wet-Floor Law", pass: /zero wet floor|dry|solid/i.test(textLower) },
    { name: "The Anti-Particle Law", pass: /zero artificial particles|no floating dust|zero glowing bokeh|clean frame/i.test(textLower) },
    { name: "The Anti-Concrete Law", pass: /zero concrete|no concrete|marble|mahogany|velvet|walnut|chrome|glass|cedar|lacquer/i.test(textLower) },
    { name: "Silent Camera Law", pass: /swiftly|smoothly|instantly|silent camera|zero hyperbolic|zero aggressive/i.test(textLower) },
    { name: "Dermatological Law", pass: /skin|pores|texture|healthy unpolished realism/i.test(textLower) },
    { name: "Full Wardrobe Lock", pass: /wardrobe|shoes|boots|heels|pants|shorts|trousers|skirt|barefoot|sneakers/i.test(textLower) },
    { name: "Spatial Depth & Optics", pass: /spatial depth|focus prerogative|anamorphic|swirly bokeh|helios|dirty foreground|split.?diopter|deep focus|shallow depth|tatami/i.test(textLower) },
    { name: "Anti-Slowmo Law", pass: /1\.0x|no slow|real.?time|zero slow.?motion/i.test(textLower) }
  ];

  // CONDITIONAL: Physics Vectors Compression (MULTI-CLIP ONLY)
  const isMultiClip = /clip\s*2|klip\s*2|phase\s*2|10-20|15-30|5-10/i.test(textLower);
  if (isMultiClip) {
    const pillarChecks = [
      { name: "⚙️ Physics Vectors Compressed", pass: /physics.?vectors/i.test(textLower) },
      { name: "↳ Relativity & Distance", pass: /relativity/i.test(textLower) && /prox/i.test(textLower) }
    ];
    rules.push(...pillarChecks);
  }

  auditTable.innerHTML = rules.map(rule => `
    <div class="audit-row ${rule.pass ? 'pass' : 'fail'}">
      <span>${rule.pass ? '✅' : '❌'}</span>
      <span>${rule.name}</span>
    </div>
  `).join('');

  auditPanel.classList.remove('hidden');
}

export function copyToClipboard() {
  const el = document.getElementById('raw-prompt-text');
  if (!el) return;
  
  // Use the raw text data attribute for clean copy
  const rawText = el.dataset.raw ? decodeURIComponent(el.dataset.raw) : el.innerText;
  
  navigator.clipboard.writeText(rawText).then(() => {
    const btn = document.getElementById('btn-copy');
    const original = btn.innerText;
    btn.innerText = '✅ Copied!';
    setTimeout(() => { btn.innerText = original; }, 2000);
  });
}

export function downloadMarkdown() {
  const el = document.getElementById('raw-prompt-text');
  if (!el) return;

  const rawText = el.dataset.raw ? decodeURIComponent(el.dataset.raw) : el.innerText;

  const blob = new Blob([rawText], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `director_os_prompt_${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPDF() {
  alert("PDF Export relies on external libraries like html2pdf.js. For this vanilla version, please use 'Print to PDF' from your browser.");
  window.print();
}
