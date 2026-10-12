import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types/index.ts",
  },
  // ESM only: Node 22.12+ can still `require()` it from CommonJS.
  format: ["esm"],
  platform: "neutral",
  target: "es2023",
  dts: true,
  clean: true,
});

export default config;
