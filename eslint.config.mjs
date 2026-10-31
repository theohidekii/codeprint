import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Domain code stays pure: no framework, UI, I/O adapters or routes.
    files: ["src/features/*/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "next"],
          patterns: ["next/*", "**/ui/**", "**/providers/**", "@/app/**"],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
