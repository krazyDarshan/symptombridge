import { createRemedySearchEngine } from "./remedy-search-core.js";

let loadPromise;
let engine;

async function loadDataset(indexUrl) {
  if (!loadPromise) {
    loadPromise = fetch(indexUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        engine = createRemedySearchEngine(payload);
        return engine;
      });
  }
  return loadPromise;
}

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      const loadedEngine = await loadDataset(message.indexUrl);
      self.postMessage({ type: "ready", ...loadedEngine.metadata });
      return;
    }

    if (message.type === "search") {
      await loadPromise;
      const startedAt = performance.now();
      const searchResult = engine.search(message.segments || [], message.limit || 14);
      self.postMessage({
        type: "results",
        requestId: message.requestId,
        ...searchResult,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "Unable to load the remedy dataset.",
    });
  }
};
