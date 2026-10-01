// A tiny static server, so `npm start` gives you a URL instead of a file path.
//
//     npm start    →  http://localhost:8080

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const port = Number(process.env.PORT ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  const name = path === "/" ? "index.html" : path.replace(/^\//, "");
  const ext = name.slice(name.lastIndexOf("."));
  try {
    const body = await readFile(fileURLToPath(new URL(name, dist)));
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`Example running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});