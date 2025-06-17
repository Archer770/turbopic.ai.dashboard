import express from "express";
import compression from "compression";
import path from "path";
import { createRequestHandler } from "@remix-run/express";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.resolve(__dirname, "build");

const app = express();

// ✅ ВАЖЛИВО: окремо обслуговуємо /assets → build/client/assets
app.use(
  "/assets",
  express.static(path.join(BUILD_DIR, "client/assets"), {
    immutable: true,
    maxAge: "1y",
  })
);

// 📦 build/static/ також варто явно покрити (опціонально)
app.use(
  "/build",
  express.static(path.join(BUILD_DIR, "client"), {
    immutable: true,
    maxAge: "1y",
  })
);

// 🔧 публічні файли з /public
app.use("/", express.static("public", { maxAge: "1h" }));

// 🔻 Gzip compress
//app.use(compression());

// 🌍 SSR Remix обробник
app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
    mode: process.env.NODE_ENV,
  })
);

// 🚀 Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Remix server is running on http://localhost:${PORT}`);
});
