import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const port = Number(process.env.PORT ?? 8090);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

createServer(async (req, res) => {
  const name = (req.url ?? "/").split("?")[0] === "/" ? "index.html" : req.url.slice(1);
  try {
    const body = await readFile(fileURLToPath(new URL(name, dist)));
    res.writeHead(200, { "content-type": TYPES[name.slice(name.lastIndexOf("."))] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`grouped-form at http://localhost:${port}`));
