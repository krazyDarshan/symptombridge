import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

let settings = { language: 'auto', consent: false };
let teamAccessCode = '';
export function setTeamAccessCode(value) { teamAccessCode = value; }
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function setInputSettings(patch) { settings = { ...settings, ...patch }; listeners.forEach(fn => fn()); }
export function useInputSettings() { return useSyncExternalStore(subscribe, () => settings); }
export function requestAiConsent() {
  if (settings.consent) return true;
  const agreed = window.confirm('Enable AI input for this session?\n\nSymptom text and recordings will be sent to Groq for transcription and translation. Obtain patient consent and omit names or identifiers. API usage uses the owner’s quota. English, Hindi and Marathi input is available. Review the resulting wording before selecting a remedy.');
  if (agreed) setInputSettings({ consent: true });
  return agreed;
}
export async function aiRequest(path, options = {}) {
  const response = await fetch(`/api/ai/${path}`, { ...options, headers: { ...(options.headers || {}), 'X-Symptom-Consent': 'yes', ...(teamAccessCode ? { 'X-Team-Access-Code': teamAccessCode } : {}) } });
  let result;
  try { result = await response.json(); } catch { throw new Error('AI server is unavailable. Start the app with npm run dev in frontend.'); }
  if (!response.ok) throw new Error(result.error || 'AI input failed. Please retry.');
  return result;
}
export function presentConcepts(symptoms) {
  return [...new Set(symptoms.filter(item => item.status === 'present').map(item => item.english))];
}

export function useSymptomInterpretation(segments) {
  const { language, consent } = useInputSettings();
  const text = segments.join('\n').trim();
  const key = JSON.stringify([text, language, consent]);
  const [state, setState] = useState({ key: '', status: 'idle', symptoms: [], error: '', clarification: '' });
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map());
  useEffect(() => {
    if (!consent) cache.current.clear();
    if (!consent || !text) return;
    const cached = cache.current.get(key);
    if (cached) { setState(cached); return; }
    const controller = new AbortController();
    setState({ key, status: 'interpreting', symptoms: [], error: '', clarification: '' });
    const timer = setTimeout(async () => {
      try {
        const value = await aiRequest('interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }), signal: controller.signal });
        if (controller.signal.aborted) return;
        const result = { ...value, key, status: 'ready', error: '' };
        if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value);
        cache.current.set(key, result); setState(result);
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, status: 'error', symptoms: [], clarification: '', error: error.message });
      }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, attempt]);
  const retry = () => { cache.current.delete(key); setAttempt(value => value + 1); };
  if (!text) return { status: 'idle', segments: [], symptoms: [], preinterpreted: false, retry };
  if (!consent) {
    const needsTranslation = /[\u0900-\u097f]/u.test(text);
    return { status: needsTranslation ? 'disabled' : 'offline', segments: needsTranslation ? [] : segments, symptoms: [], preinterpreted: false, retry };
  }
  const current = state.key === key ? state : { status: 'interpreting', symptoms: [] };
  return { ...current, segments: current.status === 'ready' ? presentConcepts(current.symptoms) : [], preinterpreted: true, retry };
}
