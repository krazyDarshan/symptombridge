import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, LoaderCircle, X } from 'lucide-react';
import { aiRequest, requestAiConsent, setInputSettings, setTeamAccessCode, useInputSettings } from './ai-input';

export function LanguageControls() {
  const { language, consent } = useInputSettings();
  return <div className="language-controls">
    <select aria-label="Symptom input language" value={language} onChange={event => setInputSettings({ language: event.target.value })}>
      <option value="auto">Auto · EN / हिंदी / मराठी</option><option value="en">English</option><option value="hi">हिंदी</option><option value="mr">मराठी</option>
    </select>
    <button type="button" className="text-btn" onClick={() => consent ? setInputSettings({ consent: false }) : requestAiConsent()}>{consent ? 'AI input on · turn off' : 'Enable AI languages'}</button>
    <small>Voice & text: English / हिंदी / मराठी. Check the interpretation.</small>
    <input type="password" aria-label="Team AI access code" placeholder="Team AI code (hosted app)" autoComplete="off" onChange={event => setTeamAccessCode(event.target.value)} />
  </div>;
}

export function InterpretationStatus({ ai }) {
  if (!ai) return null;
  return <div className="ai-interpretation" aria-live="polite">
    {ai.status === 'interpreting' && <span>Understanding symptoms…</span>}
    {['offline', 'disabled'].includes(ai.status) && <span>Offline English search. Enable AI for Hindi, Marathi and mixed-language input.</span>}
    {ai.error && <span role="alert">{ai.error} <button type="button" className="text-btn" onClick={ai.retry}>Retry</button></span>}
    {ai.status === 'ready' && <><span>Search interpretation: {ai.segments.join(' · ') || 'No definite present symptoms.'}</span>
      {ai.symptoms.some(item => item.status !== 'present') && <span>Not searched: {ai.symptoms.filter(item => item.status !== 'present').map(item => item.english + ' (' + item.status + ')').join(' · ')}</span>}
      {ai.clarification && <span>{ai.clarification}</span>}
      <small>Check the wording; edit the input if needed. Source passages remain in English.</small></>}
  </div>;
}

// Records locally, then transcribes once on Stop. No browser speech-recognition dependency.
export function SymptomCapture({ onAccept }) {
  const { language, consent } = useInputSettings();
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const session = useRef(null);
  const accept = useRef(onAccept); accept.current = onAccept;
  const cancel = () => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    clearTimeout(current.timer); current.controller.abort();
    if (current.recorder?.state === 'recording') { current.recorder.onstop = null; current.recorder.stop(); }
    current.stream?.getTracks().forEach(track => track.stop());
  };
  useEffect(() => () => cancel(), []);
  useEffect(() => { if (!consent) { cancel(); setPhase('idle'); } }, [consent]);
  const stop = () => {
    const current = session.current;
    if (!current?.recorder || current.recorder.state !== 'recording') return;
    clearTimeout(current.timer); setPhase('transcribing'); current.recorder.stop();
    current.stream.getTracks().forEach(track => track.stop());
  };
  const start = async () => {
    if (session.current) return;
    if (!requestAiConsent()) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Microphone recording requires HTTPS or localhost and a supported browser. Try Chrome or Edge.'); return; }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { setError('This browser cannot record a supported format. Try Chrome or Edge, or type symptoms.'); return; }
    const current = { controller: new AbortController(), language }; session.current = current; setPhase('starting');
    try {
      const status = await aiRequest('status', { signal: current.controller.signal });
      if (session.current !== current) return;
      if (status.configurationError) throw new Error(status.configurationError);
      if (!status.configured) throw new Error('The owner must configure Groq and hosted AI access before using the microphone.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (session.current !== current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType }); current.recorder = recorder;
      const chunks = []; let size = 0;
      recorder.ondataavailable = event => { if (event.data.size) { size += event.data.size; chunks.push(event.data); if (size > 4 * 1024 * 1024) { cancel(); setPhase('idle'); setError('Recording is too large. Try a shorter description.'); } } };
      recorder.onerror = () => { cancel(); setPhase('idle'); setError('Recording failed. Check microphone access and retry.'); };
      recorder.onstop = async () => {
        clearTimeout(current.timer); stream.getTracks().forEach(track => track.stop());
        if (session.current !== current) return;
        setPhase('transcribing');
        try {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 100) throw new Error('No audio captured. Speak and try again.');
          const result = await aiRequest('transcribe', { method: 'POST', headers: { 'Content-Type': mimeType, 'X-Symptom-Language': current.language }, body: blob, signal: current.controller.signal });
          if (session.current === current) accept.current(result.text, { original: result.text, language: current.language });
        } catch (err) { if (session.current === current) setError(err.message); }
        finally { if (session.current === current) { session.current = null; setPhase('idle'); } }
      };
      recorder.start(1000); setPhase('recording'); current.timer = setTimeout(stop, 60000);
    } catch (err) {
      if (session.current !== current) return;
      cancel(); setPhase('idle');
      setError(err.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow microphone access in browser settings, then retry.' : err.name === 'NotFoundError' ? 'No microphone found. Connect one or type your symptoms.' : err.name === 'NotReadableError' ? 'Microphone is busy or unavailable. Close other recording apps and retry.' : err.message);
    }
  };
  const label = phase === 'recording' ? 'Stop recording and search' : phase === 'transcribing' ? 'Transcribing…' : phase === 'starting' ? 'Opening microphone…' : 'Speak symptoms';
  return <span className="mic-control">
    <button type="button" className={'mic-button ' + (phase === 'recording' ? 'is-recording' : '')} aria-label={label} title={phase === 'recording' ? 'Listening · click to stop (60-second limit)' : label} aria-pressed={phase === 'recording'} disabled={['starting', 'transcribing'].includes(phase)} onClick={phase === 'recording' ? stop : start}>
      {phase === 'recording' ? <Square size={18} /> : ['starting', 'transcribing'].includes(phase) ? <LoaderCircle size={19} className="mic-spinner" /> : <Mic size={20} />}
    </button>
    {phase !== 'idle' && <button type="button" className="mic-cancel" aria-label="Cancel recording or transcription" onClick={() => { cancel(); setPhase('idle'); }}><X size={14} /></button>}
    <span className="sr-only" role="status">{phase !== 'idle' ? label : ''}</span>
    {error && <span className="mic-error" role="alert">{error}<button type="button" aria-label="Dismiss microphone error" onClick={() => setError('')}><X size={14} /></button></span>}
  </span>;
}
