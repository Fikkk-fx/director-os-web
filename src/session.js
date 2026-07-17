// src/session.js

const STORAGE_KEY = 'director_os_sessions';
const SETTINGS_KEY = 'director_os_settings';

export const defaultSettings = {
  language: 'id', // 'id' or 'en'
  engine: 'live-action',
  model: 'grok-4.5'
};

export function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initialSession = createSession();
    saveSessions([initialSession]);
    return [initialSession];
  }
  return JSON.parse(saved);
}

export function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function createSession() {
  return {
    id: Date.now().toString(),
    title: 'New Session',
    history: [],
    updatedAt: Date.now()
  };
}

export function updateSession(sessions, sessionId, newHistory) {
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index].history = newHistory;
    // Auto-generate title based on first user message if title is default
    if (sessions[index].title === 'New Session' && newHistory.length > 0) {
      const firstUserMsg = newHistory.find(m => m.role === 'user');
      if (firstUserMsg) {
        sessions[index].title = firstUserMsg.content.substring(0, 30) + '...';
      }
    }
    sessions[index].updatedAt = Date.now();
    saveSessions(sessions);
  }
  return sessions;
}
