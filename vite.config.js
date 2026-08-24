import { sites } from "@openai/sites-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { localClinicalApi } from "./scripts/local-clinical-api.mjs";


export default defineConfig({
  plugins: [localClinicalApi(), react(), sites()],
});
