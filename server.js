const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const telemetryLog = [];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function handleTelemetry(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) {
      req.destroy();
    }
  });
  req.on("end", () => {
    try {
      const entry = JSON.parse(body || "{}");
      entry.recordedAt = new Date().toISOString();
      telemetryLog.push(entry);
      if (telemetryLog.length > 100) telemetryLog.shift();
      sendJson(res, 200, { ok: true, count: telemetryLog.length });
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
    }
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/api/telemetry") {
    if (req.method === "POST") return handleTelemetry(req, res);
    if (req.method === "GET") return sendJson(res, 200, { entries: telemetryLog });
  }

  const safeRelative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const fullPath = path.resolve(ROOT_DIR, safeRelative);

  if (!fullPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(serveStatic);

server.on("listening", () => {
  const addr = server.address();
  const activePort = typeof addr === "object" && addr ? addr.port : PORT;
  console.log(`Melestarikan: Tutur Terakhir berjalan di http://localhost:${activePort}`);
});

function startListening(port, retriesLeft = 10) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && retriesLeft > 0) {
      if (port === PORT) {
        console.log(`Port ${port} sudah dipakai (jika server game sudah berjalan, kamu bisa langsung buka http://localhost:${port}).`);
      }
      startListening(port + 1, retriesLeft - 1);
      return;
    }
    throw err;
  });

  server.listen(port, "127.0.0.1");
}

startListening(PORT);
