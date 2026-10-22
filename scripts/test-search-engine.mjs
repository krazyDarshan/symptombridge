import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRemedySearchEngine } from "../src/remedy-search-core.js";

const dataset = JSON.parse(await readFile(new URL("../public/data/materia-medica-index.json", import.meta.url), "utf8"));
const engine = createRemedySearchEngine(dataset);

const aiConcept = 'dry cough worse at night';
const aiSearch = engine.search([aiConcept], 14, { preinterpreted: true });
assert.deepEqual(aiSearch.interpretedSegments, [aiConcept]);
assert.deepEqual(aiSearch.inputInterpretations[0].corrections, []);
assert.ok(aiSearch.results.length > 0);

const reportedQuery = engine.search(["cough itching throat swealling"], 14);
assert.deepEqual(reportedQuery.interpretedSegments, ["cough throat", "itching throat", "throat swelling"]);
assert.equal(reportedQuery.inputInterpretations[0].corrections[0]?.to, "swelling");
assert.ok(reportedQuery.results.length > 0);
assert.equal(reportedQuery.results[0].matchedSegmentCount, 3);
assert.equal(reportedQuery.results[0].totalSegmentCount, 3);
assert.equal(reportedQuery.results.some((remedy) => remedy.evidence.some((evidence) => /without (?:vomiting or )?cough/i.test(evidence.text))), false);
assert.equal(reportedQuery.recommendation.mode, "single");
assert.deepEqual(reportedQuery.recommendation.remedyIds, [reportedQuery.results[0].id]);
assert.equal(reportedQuery.recommendation.coveredSegmentCount, 3);
assert.ok(reportedQuery.recommendation.assignments.every((assignment) => assignment.supported));

const earQuery = engine.search(["ear pain"], 5);
assert.ok(earQuery.results.length > 0);
assert.equal(earQuery.results.every((remedy) => remedy.evidence.some((evidence) => /(^|[^a-z])ear([^a-z]|$)/i.test(evidence.text))), true);

const livePrefixQuery = engine.search(["co"], 5);
assert.equal(livePrefixQuery.results.length, 5);
assert.equal(livePrefixQuery.results.every((remedy) => remedy.evidence.some((evidence) => /\bco[a-z]+/i.test(evidence.text))), true);

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

const locationEngine = createRemedySearchEngine({
  preparations: [
    { id: "LEFT", code: "left", name: "Left remedy", scientific: "Left", symptoms: [["l1", 1, "Severe shooting pain in the left ear", "", 1, 1]] },
    { id: "RIGHT", code: "right", name: "Right remedy", scientific: "Right", symptoms: [["r1", 1, "Severe shooting pain in the right ear", "", 3, 1]] },
    { id: "OTHER", code: "other", name: "Other remedy", scientific: "Other", symptoms: [["o1", 1, "Severe shooting pain in the left knee", "", 3, 1]] },
  ],
});
const leftEar = locationEngine.search(["left ear pain"], 10);
assert.equal(leftEar.results[0].id, "LEFT");
assert.equal(leftEar.results.some((remedy) => remedy.id === "RIGHT"), false);
assert.equal(leftEar.results.some((remedy) => remedy.id === "OTHER"), false);

const priorityEngine = createRemedySearchEngine({
  preparations: [
    { id: "NORMAL", code: "normal", name: "Normal source", scientific: "Normal", symptoms: [["n1", 1, "Dry cough at night", "", 1, 1]] },
    { id: "BOLD", code: "bold", name: "Bold source", scientific: "Bold", symptoms: [["b1", 1, "Dry cough at night", "Dry cough at night", 3, 1]] },
  ],
});
const priorityQuery = priorityEngine.search(["dry cough at night"], 10);
assert.equal(priorityQuery.results[0].id, "BOLD");

const duplicateQuery = engine.search(["itching throat", "itching throat"], 10);
assert.equal(duplicateQuery.interpretedSegments.length, 1);

console.log("Search engine checks passed.");
