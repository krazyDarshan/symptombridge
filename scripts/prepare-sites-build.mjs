import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = resolve(projectDirectory, "dist", "server");

await mkdir(serverDirectory, { recursive: true });
await copyFile(
  resolve(projectDirectory, "server", "index.js"),
  resolve(serverDirectory, "index.js"),
);
