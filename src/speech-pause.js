// Language-independent energy detector, not a speech recognizer.
export function createPauseDetector({ pauseMs = 2500, initialWaitMs = 12000, threshold = 0.012, speechMs = 300 } = {}) {
  let start, previous, lastSound, voicedMs = 0, heard = false, finished = false;
  return (rms, now) => {
    if (finished) return null;
    if (start === undefined) { start = now; previous = now; }
    const elapsed = Math.min(150, Math.max(0, now - previous)); previous = now;
    if (rms >= threshold) {
      lastSound = now; voicedMs += elapsed;
      if (voicedMs >= speechMs) heard = true;
    } else if (!heard) voicedMs = 0;
    if (heard && now - lastSound >= pauseMs) { finished = true; return 'pause'; }
    if (!heard && now - start >= initialWaitMs) { finished = true; return 'no-speech'; }
    return null;
  };
}

export function watchSpeechPause(context, stream, onResult) {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser(); analyser.fftSize = 2048;
  source.connect(analyser); // Never connect microphone audio to speakers.
  const samples = new Float32Array(analyser.fftSize);
  const detect = createPauseDetector();
  const timer = setInterval(() => {
    if (context.state !== 'running') return;
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const result = detect(rms, performance.now());
    if (result) onResult(result);
  }, 100);
  return () => { clearInterval(timer); source.disconnect(); analyser.disconnect(); };
}
