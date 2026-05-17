const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const preferredPort = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

if (!fs.existsSync(path.join(dist, "index.html"))) {
  const result = spawnSync(process.execPath, [path.join(__dirname, "build-site.js")], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function resolveRequest(url) {
  const parsed = new URL(url, `http://${host}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (!path.extname(pathname)) pathname += ".html";
  const filePath = path.normalize(path.join(dist, pathname));
  if (!filePath.startsWith(dist)) return null;
  return filePath;
}

function createServer() {
  return http.createServer((request, response) => {
    const filePath = resolveRequest(request.url || "/");
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        fs.readFile(path.join(dist, "404.html"), (notFoundError, notFound) => {
          response.writeHead(404, { "Content-Type": types[".html"] });
          response.end(notFoundError ? "Not found" : notFound);
        });
        return;
      }

      const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
    });
  });
}

function listen(port) {
  const server = createServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < preferredPort + 20) {
      listen(port + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`Concord Kung Fu site running at http://${host}:${port}/`);
  });
}

listen(preferredPort);
