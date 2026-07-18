// src/main.js

import { loadSettings, saveSettings, loadSessions, saveSessions, createSession, updateSession, defaultSettings } from './session.js';
import { renderMessage, renderTypingIndicator, removeTypingIndicator } from './chat.js';
import { updateResultPanel, copyToClipboard, downloadMarkdown, downloadPDF } from './result.js';

// Global State
let settings = defaultSettings;
let sessions = [];
let currentSessionId = null;
let currentMode = 'mini'; // 'mini' (under 2K) or 'standard' (under 3K)

// DOM Elements
const els = {
  // Settings Modal
  modal: document.getElementById('settings-modal'),
  btnSettings: document.getElementById('btn-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  modelSelect: document.getElementById('model-select'),
  langBtns: document.querySelectorAll('[data-lang]'),
  engineBtns: document.querySelectorAll('[data-engine]'),

  
  // Sidebar
  btnNewSession: document.getElementById('btn-new-session'),
  sessionList: document.getElementById('session-list'),

  
  // Chat
  chatInput: document.getElementById('chat-input'),
  btnSend: document.getElementById('btn-send'),
  chatMessages: document.getElementById('chat-messages'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  
  // Results
  btnCopy: document.getElementById('btn-copy'),
  btnDownloadMd: document.getElementById('btn-download-md'),
  btnDownloadPdf: document.getElementById('btn-download-pdf'),
  
  // Quick Actions
  quickBtns: document.querySelectorAll('.quick-btn'),
  
  // Mode Selector
  modeBtns: document.querySelectorAll('[data-mode]'),
  modeHint: document.getElementById('mode-hint'),
  
  // Mobile Tabs
  mobileTabBtns: document.querySelectorAll('.mobile-tab-btn'),
  chatPanel: document.getElementById('chat-panel'),
  resultPanel: document.getElementById('result-panel')
};

// Initialize
function init() {
  settings = loadSettings();
  sessions = loadSessions();
  
  // Apply settings
  els.modelSelect.value = settings.model;
  updateToggleUI(els.langBtns, settings.language, 'data-lang');
  updateToggleUI(els.engineBtns, settings.engine, 'data-engine');

  // Load last session or create new
  if (sessions.length > 0) {
    switchSession(sessions[0].id);
  } else {
    handleNewSession();
  }

  renderSessionList();
  bindEvents();
}

function bindEvents() {
  // Settings Modal
  els.btnSettings.addEventListener('click', () => els.modal.classList.remove('hidden'));
  els.btnCloseSettings.addEventListener('click', () => els.modal.classList.add('hidden'));
  els.btnSaveSettings.addEventListener('click', handleSaveSettings);

  // Toggles
  els.langBtns.forEach(btn => btn.addEventListener('click', (e) => {
    updateToggleUI(els.langBtns, e.target.dataset.lang, 'data-lang');
  }));
  els.engineBtns.forEach(btn => btn.addEventListener('click', (e) => {
    updateToggleUI(els.engineBtns, e.target.dataset.engine, 'data-engine');
    settings.engine = e.target.dataset.engine;
    saveSettings(settings);
  }));


  // Sidebar
  els.btnNewSession.addEventListener('click', handleNewSession);
  
  // Chat Input
  els.chatInput.addEventListener('input', () => {
    els.btnSend.disabled = els.chatInput.value.trim().length === 0;
    // Auto resize
    els.chatInput.style.height = 'auto';
    els.chatInput.style.height = (els.chatInput.scrollHeight) + 'px';
  });
  
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  els.btnSend.addEventListener('click', handleSendMessage);
  els.btnClearChat.addEventListener('click', handleClearChat);

  // Quick actions
  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.chatInput.value = btn.dataset.prompt;
      els.btnSend.disabled = false;
      handleSendMessage();
    });
  });

  // Mode toggle
  els.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      els.modeHint.textContent = currentMode === 'mini' ? '< 2K chars' : '< 3K chars';
    });
  });

  // Result actions
  els.btnCopy.addEventListener('click', copyToClipboard);
  els.btnDownloadMd.addEventListener('click', downloadMarkdown);
  els.btnDownloadPdf.addEventListener('click', downloadPDF);
  
  // Mobile Tabs
  els.mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchMobileTab(btn.dataset.tab);
    });
  });
}

function switchMobileTab(tabName) {
  els.mobileTabBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`.mobile-tab-btn[data-tab="${tabName}"]`).classList.add('active');
  
  if (tabName === 'chat') {
    els.chatPanel.classList.add('active-tab');
    els.resultPanel.classList.remove('active-tab');
  } else {
    els.resultPanel.classList.add('active-tab');
    els.chatPanel.classList.remove('active-tab');
  }
}

// UI Helpers
function updateToggleUI(buttons, activeValue, dataAttr) {
  buttons.forEach(btn => {
    if (btn.getAttribute(dataAttr) === activeValue) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}



// Actions
function handleSaveSettings() {
  const activeLang = document.querySelector('.toggle-btn[data-lang].active').dataset.lang;
  
  settings.language = activeLang;
  settings.model = els.modelSelect.value;
  
  saveSettings(settings);
  els.modal.classList.add('hidden');
}

function escapeHtml(unsafe) {
  return (unsafe || '').toString()
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

function renderSessionList() {
  els.sessionList.innerHTML = sessions.map(s => `
    <div class="session-item ${s.id === currentSessionId ? 'active' : ''}" data-id="${s.id}">
      <span class="session-title">${escapeHtml(s.title)}</span>
      <button class="session-delete" title="Delete">✕</button>
    </div>
  `).join('');

  document.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('session-delete')) {
        handleDeleteSession(item.dataset.id);
      } else {
        switchSession(item.dataset.id);
      }
    });
  });
}

function switchSession(id) {
  currentSessionId = id;
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  
  renderSessionList();
  
  // Clear chat except welcome
  const msgs = Array.from(els.chatMessages.children);
  msgs.forEach(msg => {
    if (!msg.classList.contains('welcome-message')) msg.remove();
  });

  // Render history
  let lastAiContent = null;
  session.history.forEach(msg => {
    renderMessage(els.chatMessages, msg.role, msg.content);
    if (msg.role === 'ai') lastAiContent = msg.content;
  });
  
  if (lastAiContent) updateResultPanel(lastAiContent);
}

function handleNewSession() {
  const newSess = createSession();
  sessions.unshift(newSess);
  saveSessions(sessions);
  switchSession(newSess.id);
}

function handleDeleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  if (sessions.length === 0) {
    handleNewSession();
  } else if (currentSessionId === id) {
    switchSession(sessions[0].id);
  } else {
    renderSessionList();
  }
  saveSessions(sessions);
}

function handleClearChat() {
  const session = sessions.find(s => s.id === currentSessionId);
  if (session) {
    session.history = [];
    updateSession(sessions, currentSessionId, session.history);
    switchSession(currentSessionId);
  }
}

async function handleSendMessage() {
  const text = els.chatInput.value.trim();
  if (!text) return;

  // Update UI
  els.chatInput.value = '';
  els.chatInput.style.height = 'auto';
  els.btnSend.disabled = true;
  renderMessage(els.chatMessages, 'user', text);
  
  // Update Session
  const session = sessions.find(s => s.id === currentSessionId);
  session.history.push({ role: 'user', content: text });
  updateSession(sessions, currentSessionId, session.history);
  renderSessionList();

  // Show typing
  renderTypingIndicator(els.chatMessages);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        engine: settings.engine,
        history: session.history.slice(0, -1),
        userMessage: text,
        mode: currentMode
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = "Failed to communicate with Serverless API";
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        errorMsg = `Vercel Error: ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const aiResponse = data.text;

    removeTypingIndicator();
    
    // Render AI message in chat
    renderMessage(els.chatMessages, 'ai', aiResponse);
    
    // Update Result Panel
    updateResultPanel(aiResponse);

    // Save to session
    session.history.push({ role: 'ai', content: aiResponse });
    updateSession(sessions, currentSessionId, session.history);

    // On mobile, auto switch to result tab
    if (window.innerWidth <= 700) {
      switchMobileTab('result');
    }

  } catch (error) {
    removeTypingIndicator();
    renderMessage(els.chatMessages, 'ai', `**Error:** ${error.message}`);
  }
}

// Start
init();
