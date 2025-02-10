import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/run.ts"],
  target: "es2020",
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
  // Ensure we handle node builtins properly
  platform: "node",
  // Bundle dependencies for the CLI
  noExternal: ["ora", "chalk", "inquirer", "conf"],
  // Add shebang to CLI entry point
  esbuildOptions(options) {
    if (options.entryPoints?.includes("src/run.ts")) {
      options.banner = {
        js: "#!/usr/bin/env node",
      };
    }
  },
});
