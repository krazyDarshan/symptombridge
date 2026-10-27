// Opt-in integration test: sends supplied recordings to Groq through the server API.
// Browser media devices and Worker transport are simulated; React hooks, pause
// detection, server validation, live Groq calls and dataset search are real.
// Usage: npx tsx scripts/test-recorded-voice.jsx <en.m4a> <hi.m4a> <mr.m4a>
import React, { useState } from 'react';
import { create, act } from 'react-test-renderer';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { SymptomCapture } from '../src/SymptomCapture.jsx';
import { setInputSettings } from '../src/ai-input.js';
import { useRemedySearch } from '../src/useRemedySearch.js';
import { createRemedySearchEngine } from '../src/remedy-search-core.js';
import { createAiMiddleware } from '../server/ai-api.mjs';

assert.equal(process.argv.slice(2).length, 3, 'Supply English, Hindi and Marathi recordings, in that order.');
const engine = createRemedySearchEngine(JSON.parse(readFileSync(new URL('../public/data/materia-medica-index.json', import.meta.url), 'utf8')));
const middleware = createAiMiddleware({ env: loadEnv('development', process.cwd(), '') });
const server = http.createServer((req, res) => middleware(req, res, () => res.end()));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const realFetch = globalThis.fetch;
let recording, transcriptCalls = 0, stoppedTracks = 0, latest, contextClosed = false;
globalThis.fetch = (url, options) => {
  if (url === '/api/ai/transcribe') transcriptCalls++;
  return realFetch(typeof url === 'string' && url.startsWith('/api/') ? base + url : url, options);
};
globalThis.window = { confirm: () => true, setTimeout, clearTimeout };
class TestAudioContext {
  state = 'running'; started = Date.now();
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; contextClosed = true; return Promise.resolve(); }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createAnalyser() { return { fftSize: 2048, disconnect() {}, getFloatTimeDomainData: samples => samples.fill(Date.now() - this.started < 1500 ? 0.06 : 0) }; }
}
window.AudioContext = TestAudioContext;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stoppedTracks++ }] }) } } });
class TestRecorder {
  static isTypeSupported(type) { return type === 'audio/mp4'; }
  state = 'inactive';
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([recording], { type: 'audio/mp4' }) });
    this.onstop?.();
  }
}
globalThis.MediaRecorder = window.MediaRecorder = TestRecorder;
globalThis.Worker = class {
  postMessage(message) {
    queueMicrotask(() => {
      if (this.closed) return;
      if (message.type === 'init') this.onmessage?.({ data: { type: 'ready', preparationCount: 77, symptomCount: 32031 } });
      else this.onmessage?.({ data: { type: 'results', requestId: message.requestId, searchKey: message.searchKey, ...engine.search(message.segments, message.limit, { preinterpreted: message.preinterpreted }) } });
    });
  }
  terminate() { this.closed = true; }
};
function Harness() {
  const [text, setText] = useState('');
  const search = useRemedySearch(text ? [text] : []);
  latest = { text, search };
  return <><SymptomCapture onAccept={setText} /><output>{search.results.map(item => item.name).join(', ')}</output></>;
}
try {
  for (const [index, language] of ['en', 'hi', 'mr'].entries()) {
    recording = readFileSync(process.argv[index + 2]);
    transcriptCalls = stoppedTracks = 0; contextClosed = false;
    setInputSettings({ language, consent: true });
    let renderer;
    try {
      await act(async () => { renderer = create(<Harness />); });
      // Only click Start. Never call Stop or edit the transcript in this test.
      await act(async () => { await renderer.root.findByProps({ 'aria-label': 'Speak symptoms' }).props.onClick(); });
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline && latest.search.results.length === 0 && !latest.search.ai.error) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
      }
      const micErrors = renderer.root.findAll(node => node.props.role === 'alert');
      assert.equal(micErrors.length, 0, 'Microphone flow reported an error');
      assert.equal(transcriptCalls, 1, 'Pause must trigger exactly one transcription');
      assert.ok(contextClosed && stoppedTracks > 0, 'Audio resources must be released');
      assert.ok(latest.search.results.length > 0, latest.search.ai.error || 'No automatic remedy results');
      assert.ok(latest.search.ai.symptoms.some(item => item.english.includes('fever') && item.status === 'absent'), 'Denied fever must stay absent');
      assert.ok(!latest.search.ai.segments.some(item => /dry cough/i.test(item)), 'Do not invent dry cough');
      assert.ok(renderer.root.findByType('output').children.join('').length > 0, 'Results must render');
      console.log(JSON.stringify({ language, transcript: latest.text, concepts: latest.search.ai.segments, renderedResults: latest.search.results.length, automaticStop: true }));
    } finally { if (renderer) await act(async () => renderer.unmount()); }
  }
} finally { globalThis.fetch = realFetch; await new Promise(resolve => server.close(resolve)); }
