function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function send(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function localClinicalApi() {
  const patients = [];
  const cases = [];
  return {
    name: "local-clinical-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url, "http://localhost").pathname;
        if (!path.startsWith("/api/")) return next();
        try {
          if (path === "/api/patients" && request.method === "GET") return send(response, 200, { patients });
          if (path === "/api/cases" && request.method === "GET") return send(response, 200, { cases });
          if (path === "/api/patients" && request.method === "POST") {
            const body = await readBody(request);
            const name = String(body.name || "").trim();
            if (name.length < 2) return send(response, 400, { error: "A patient name is required." });
            const patient = {
              id: `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
              name,
              age: body.age || null,
              sex: body.sex || "",
              phone: body.phone || "",
              status: "Active",
              lastVisit: null,
              symptom: "",
            };
            patients.unshift(patient);
            return send(response, 201, { patient });
          }
          if (path === "/api/cases" && request.method === "POST") {
            const body = await readBody(request);
            const patient = patients.find((item) => item.id === body.patientId);
            if (!patient) return send(response, 404, { error: "The selected patient no longer exists." });
            if (!Array.isArray(body.symptoms) || !body.symptoms.length || !body.remedy?.id) return send(response, 400, { error: "Patient, symptoms and a source remedy are required." });
            const now = new Date();
            const record = {
              id: `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
              patientId: patient.id,
              patientName: patient.name,
              date: displayDate(now),
              description: body.description || "",
              symptoms: body.symptoms,
              remedyId: body.remedy.id,
              remedyCode: body.remedy.code,
              remedyName: body.remedy.name,
              remedyScientific: body.remedy.scientific || "",
              rationale: body.rationale || "",
              datasetVersion: body.datasetVersion || "1.0.0",
            };
            cases.unshift(record);
            Object.assign(patient, { lastVisit: displayDate(now), symptom: body.symptoms.join(" · "), status: "Follow-up" });
            return send(response, 201, { case: record, patient });
          }
          return send(response, 404, { error: "Not found" });
        } catch (error) {
          return send(response, 500, { error: error instanceof Error ? error.message : "Unexpected local API error." });
        }
      });
    },
  };
}
