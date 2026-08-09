const path = require("path");

module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      extends: ["next/core-web-vitals"],
      parserOptions: { project: path.join(__dirname, "apps/web/tsconfig.json") },
      // Base ESLint rules aren't TS-aware: no-undef false-positives on JSX
      // under the new transform, no-unused-vars flags parameter names in
      // type signatures (e.g. `(id: string) => void`) as "unused". TS's own
      // compiler (tsc --noEmit, run separately) already catches real
      // undefined-reference and unused-code issues.
      rules: { "no-undef": "off", "no-unused-vars": "off" },
    },
    {
      files: ["apps/api/**/*.ts"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/recommended"],
      parserOptions: { project: path.join(__dirname, "apps/api/tsconfig.json") },
    },
  ],
  ignorePatterns: ["node_modules", "dist", ".next", "*.js"],
};
