import { useEffect, useMemo, useRef, useState } from "react";
import { useSymptomInterpretation } from './ai-input';


export function useRemedySearch(segments, limit = 10, source = 'original') {
  const ai = useSymptomInterpretation(segments);
  const searchKey = JSON.stringify([source, ai.segments, ai.preinterpreted]);
  const [resultKey, setResultKey] = useState('');
  const workerRef = useRef(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState("loading");
  const [results, setResults] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [interpretedSegments, setInterpretedSegments] = useState([]);
  const [inputInterpretations, setInputInterpretations] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");

  const stableSegments = useMemo(
    () => ai.segments.map((segment) => String(segment || "").trim()).filter(Boolean),
    [JSON.stringify(ai.segments)],
  );

  useEffect(() => {
    ++requestRef.current;
    setStatus('loading'); setMetadata(null); setError('');
    setResults([]); setRecommendation(null); setCombinations([]);
    const worker = new Worker(
      new URL("./remedy-search.worker.js", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === "ready") {
        setMetadata({
          datasetVersion: message.datasetVersion,
          preparationCount: message.preparationCount,
          symptomCount: message.symptomCount,
        });
        setStatus("ready");
        return;
      }

      if (message.type === "results" && message.requestId === requestRef.current) {
        setResultKey(message.searchKey);
        setResults(message.results);
        setCombinations(message.combinations || []);
        setRecommendation(message.recommendation || null);
        setInterpretedSegments(message.interpretedSegments || []);
        setInputInterpretations(message.inputInterpretations || []);
        setDurationMs(message.durationMs);
        setStatus("ready");
        return;
      }

      if (message.type === "error" && (!message.requestId || message.requestId === requestRef.current)) {
        setError(message.message);
        setStatus("error");
      }
    };

    worker.postMessage({
      type: "init",
      indexUrl: source === 'combined' ? '/data/combined-remedy-index.json' : '/data/materia-medica-index.json',
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    if (!workerRef.current || !metadata) return undefined;
    const requestId = ++requestRef.current;

    if (stableSegments.length === 0) {
      setResults([]);
      setCombinations([]);
      setRecommendation(null);
      setInterpretedSegments([]);
      setInputInterpretations([]);
      setDurationMs(0);
      setStatus("ready");
      return undefined;
    }

    setStatus("searching");
    const timeout = window.setTimeout(() => {
      workerRef.current?.postMessage({
        type: "search",
        requestId,
        segments: stableSegments,
        limit,
        searchKey,
        preinterpreted: ai.preinterpreted,
      });
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [metadata, stableSegments, limit, searchKey]);

  const current = resultKey === searchKey && stableSegments.length > 0;
  const displayStatus = ai.status === 'interpreting' ? 'searching' : status === 'loading' || status === 'error' ? status : stableSegments.length && !current ? 'searching' : status;
  return { status: displayStatus, results: current ? results : [], combinations: current ? combinations : [], recommendation: current ? recommendation : null, interpretedSegments: current ? interpretedSegments : [], inputInterpretations: current ? inputInterpretations : [], metadata, durationMs: current ? durationMs : 0, error, ai };
}
