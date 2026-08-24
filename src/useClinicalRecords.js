import { useCallback, useEffect, useState } from "react";

async function requestJson(path, options) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The clinical record could not be saved.");
  return payload;
}

export function useClinicalRecords() {
  const [patients, setPatients] = useState([]);
  const [cases, setCases] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [patientPayload, casePayload] = await Promise.all([
        requestJson("/api/patients"),
        requestJson("/api/cases"),
      ]);
      setPatients(patientPayload.patients || []);
      setCases(casePayload.cases || []);
      setError("");
      setStatus("ready");
    } catch (refreshError) {
      setError(refreshError.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addPatient = useCallback(async (details) => {
    const payload = await requestJson("/api/patients", {
      method: "POST",
      body: JSON.stringify(details),
    });
    setPatients((current) => [payload.patient, ...current]);
    return payload.patient;
  }, []);

  const saveCase = useCallback(async (details) => {
    const payload = await requestJson("/api/cases", {
      method: "POST",
      body: JSON.stringify(details),
    });
    setCases((current) => [payload.case, ...current]);
    setPatients((current) => current.map((patient) => (
      patient.id === payload.patient.id ? payload.patient : patient
    )));
    return payload.case;
  }, []);

  return { patients, cases, status, error, addPatient, saveCase, refresh };
}
