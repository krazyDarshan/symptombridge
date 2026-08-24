import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRemedySearchEngine } from "../src/remedy-search-core.js";

const dataset = JSON.parse(await readFile(new URL("../public/data/materia-medica-index.json", import.meta.url), "utf8"));
const engine = createRemedySearchEngine(dataset);

const reportedQuery = engine.search(["cough itching throat swealling"], 14);
assert.deepEqual(reportedQuery.interpretedSegments, ["cough throat", "itching throat", "throat swelling"]);
assert.equal(reportedQuery.inputInterpretations[0].corrections[0]?.to, "swelling");
assert.ok(reportedQuery.results.length > 0);
assert.equal(reportedQuery.results[0].matchedSegmentCount, 3);
assert.equal(reportedQuery.results[0].totalSegmentCount, 3);
assert.equal(reportedQuery.results.some((remedy) => remedy.evidence.some((evidence) => /without (?:vomiting or )?cough/i.test(evidence.text))), false);
assert.equal(reportedQuery.recommendation.mode, "single");
assert.deepEqual(reportedQuery.recommendation.remedyIds, [reportedQuery.results[0].id]);
assert.equal(reportedQuery.recommendation.strongCoveredSegmentCount, 3);

const earQuery = engine.search(["ear pain"], 5);
assert.ok(earQuery.results.length > 0);
assert.equal(earQuery.results.every((remedy) => remedy.evidence.some((evidence) => /(^|[^a-z])ear([^a-z]|$)/i.test(evidence.text))), true);

const row = (id, text) => [id, 1, text, "", 1, 1];
const coverageEngine = createRemedySearchEngine({
  preparations: [
    { id: "A", code: "a", name: "Remedy A", scientific: "A", symptoms: [row("a1", "Sharp pain in the left ear"), row("a2", "Frequent urination at night")] },
    { id: "B", code: "b", name: "Remedy B", scientific: "B", symptoms: [row("b1", "Itching rash on both hands")] },
  ],
});
const coverageQuery = coverageEngine.search(["left ear pain", "frequent urination", "itching rash on hands"], 10);
assert.ok(coverageQuery.combinations.length > 0);
assert.equal(coverageQuery.combinations[0].coveredSegmentCount, coverageQuery.combinations[0].totalSegmentCount);
assert.equal(coverageQuery.recommendation.mode, "group");
assert.equal(coverageQuery.recommendation.count, 2);
assert.deepEqual(new Set(coverageQuery.recommendation.remedyIds), new Set(["A", "B"]));
assert.equal(coverageQuery.recommendation.coveredSegmentCount, coverageQuery.recommendation.totalSegmentCount);

const emptyQuery = coverageEngine.search([], 10);
assert.equal(emptyQuery.recommendation, null);

console.log("Search engine checks passed.");
