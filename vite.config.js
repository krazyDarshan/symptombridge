import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { createAiMiddleware } from './server/ai-api.mjs';


export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const install = server => { server.middlewares.use(createAiMiddleware({ env })); };
  return {
    plugins: [react(), { name: 'local-symptom-ai', configureServer: install, configurePreviewServer: install }],
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
  };
});
