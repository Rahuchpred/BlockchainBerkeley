import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Lime's own rules live in lime.eslint.config.mjs and run on their own:
//   npx eslint -c lime.eslint.config.mjs .
// They are kept out of this config because Lime's processor replaces the parser setup Next relies on.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The Lime rule names appear in disable comments, so this config has to know they exist.
    plugins: {
      lime: {
        rules: {
          "no-raw-color": { create: () => ({}) },
          "one-primary": { create: () => ({}) },
        },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design system code, checked by its own lint.
    "components/lime/**",
    "lib/lime/**",
    "lime.eslint.config.mjs",
  ]),
]);

export default eslintConfig;
