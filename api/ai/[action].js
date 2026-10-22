import { createAiMiddleware } from '../../server/ai-api.mjs';

const middleware = createAiMiddleware({ env: process.env });
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  return middleware(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown API endpoint.' }));
  });
}
