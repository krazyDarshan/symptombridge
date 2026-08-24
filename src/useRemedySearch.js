import { useEffect, useMemo, useRef, useState } from "react";


export function useRemedySearch(segments, limit = 10) {
  const workerRef = useRef(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState("loading");
  const [results, setResults] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");

  const stableSegments = useMemo(
    () => segments.map((segment) => String(segment || "").trim()).filter(Boolean),
    [JSON.stringify(segments)],
  );

  useEffect(() => {
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
        setResults(message.results);
        setCombinations(message.combinations || []);
        setDurationMs(message.durationMs);
        setStatus("ready");
        return;
      }

      if (message.type === "error") {
        setError(message.message);
        setStatus("error");
      }
    };

    worker.postMessage({
      type: "init",
      indexUrl: "/data/materia-medica-index.json",
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current || !metadata) return undefined;

    if (stableSegments.length === 0) {
      setResults([]);
      setCombinations([]);
      setDurationMs(0);
      setStatus("ready");
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus("searching");
      workerRef.current?.postMessage({
        type: "search",
        requestId,
        segments: stableSegments,
        limit,
      });
    }, 160);

    return () => window.clearTimeout(timeout);
  }, [metadata, stableSegments, limit]);

  return { status, results, combinations, metadata, durationMs, error };
}
