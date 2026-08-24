import { useCallback, useEffect, useState } from "react";

const DATABASE_NAME = "symptombridge-clinical-records";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("patients")) database.createObjectStore("patients", { keyPath: "id" });
      if (!database.objectStoreNames.contains("cases")) {
        const caseStore = database.createObjectStore("cases", { keyPath: "id" });
        caseStore.createIndex("patientId", "patientId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The local clinical database could not be opened."));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The local clinical record could not be read."));
  });
}

async function getAll(storeName) {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(storeName, "readonly").objectStore(storeName).getAll());
  } finally {
    database.close();
  }
}

async function writeRecords(storeNames, writer) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, "readwrite");
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("The local clinical record could not be saved.")); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("The local clinical record was not saved.")); };
    writer(transaction);
  });
}

function displayDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function patientForInterface(record) {
  return { ...record, lastVisit: displayDate(record.lastVisit) };
}

function caseForInterface(record) {
  return { ...record, date: displayDate(record.createdAt) };
}

export function useClinicalRecords() {
  const [patients, setPatients] = useState([]);
  const [cases, setCases] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [patientRows, caseRows] = await Promise.all([getAll("patients"), getAll("cases")]);
      patientRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      caseRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPatients(patientRows.map(patientForInterface));
      setCases(caseRows.map(caseForInterface));
      setError("");
      setStatus("ready");
    } catch (refreshError) {
      setError(refreshError.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addPatient = useCallback(async (details) => {
    const name = String(details.name || "").trim();
    const age = details.age === null || details.age === "" || details.age === undefined ? null : Number(details.age);
    if (name.length < 2) throw new Error("A patient name is required.");
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) throw new Error("Enter a valid age between 0 and 120.");
    const record = {
      id: `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      age,
      sex: String(details.sex || ""),
      phone: String(details.phone || ""),
      status: "Active",
      lastVisit: null,
      symptom: "",
      createdAt: new Date().toISOString(),
    };
    await writeRecords(["patients"], (transaction) => transaction.objectStore("patients").put(record));
    const patient = patientForInterface(record);
    setPatients((current) => [patient, ...current]);
    return patient;
  }, []);

  const saveCase = useCallback(async (details) => {
    const patientRows = await getAll("patients");
    const patient = patientRows.find((item) => item.id === details.patientId);
    if (!patient) throw new Error("The selected patient no longer exists.");
    if (!Array.isArray(details.symptoms) || !details.symptoms.length || !details.remedy?.id) throw new Error("Patient, symptoms and a source remedy are required.");

    const createdAt = new Date().toISOString();
    const record = {
      id: `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      patientId: patient.id,
      patientName: patient.name,
      createdAt,
      description: String(details.description || ""),
      symptoms: details.symptoms.map((item) => String(item).trim()).filter(Boolean),
      remedyId: String(details.remedy.id),
      remedyCode: String(details.remedy.code),
      remedyName: String(details.remedy.name),
      remedyScientific: String(details.remedy.scientific || ""),
      rationale: String(details.rationale || ""),
      datasetVersion: String(details.datasetVersion || "1.0.0"),
    };
    const updatedPatient = {
      ...patient,
      status: "Follow-up",
      lastVisit: createdAt,
      symptom: record.symptoms.join(" · "),
    };
    await writeRecords(["patients", "cases"], (transaction) => {
      transaction.objectStore("patients").put(updatedPatient);
      transaction.objectStore("cases").put(record);
    });
    const savedCase = caseForInterface(record);
    setCases((current) => [savedCase, ...current]);
    setPatients((current) => current.map((item) => item.id === patient.id ? patientForInterface(updatedPatient) : item));
    return savedCase;
  }, []);

  return { patients, cases, status, error, addPatient, saveCase, refresh };
}
