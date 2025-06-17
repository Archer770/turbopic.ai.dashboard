import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vitePlugin as remix } from "@remix-run/dev";
import { cjsInterop } from "vite-plugin-cjs-interop";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config();

console.log("🧪 PORT from .env:", process.env.PORT);
console.log("🧪 DATABASE_URL from .env:", process.env.DATABASE_URL);

export default defineConfig(({ command }) => {
  const isProd = command === "build";

  return {
    plugins: [
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      tsconfigPaths(),
      // cjsInterop({
      //   dependencies: !isProd ? ["@prisma/client"] : [],
      // }),
    ],
    server: {
      port: Number(process.env.PORT) || 6030,
      allowedHosts: ["shopifyapp.turbopic.ai"],
    },
    ssr: {
      // noExternal: ["@prisma/client"],
      external: ["sharp"], // <-- ❗ обов'язково
    },
    optimizeDeps: {
      exclude: ["sharp"], // <-- ❗ (опційно, але варто)
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
        ignoreTryCatch: false, // (не обов’язково, але іноді покращує динамічні require)
      },
    },
  };
});
