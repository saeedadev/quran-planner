import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

function sandboxDevPlugin(): Plugin {
  return {
    name: "tawasu-sandbox",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/sandbox")) {
          next();
          return;
        }
        const htmlPath = fileURLToPath(new URL("./dev/sandbox/index.html", import.meta.url));
        const html = readFileSync(htmlPath, "utf8");
        server
          .transformIndexHtml("/sandbox/", html, req.originalUrl)
          .then((transformed) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(transformed);
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), sandboxDevPlugin()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
