// ESLint config for the Android (React Native / Expo) project.
// This config uses a minimal, RN-compatible set of rules without importing
// any web-only ESLint plugins (e.g. react-refresh, tanstack, etc.)
module.exports = {
  root: true,
  extends: [
    "expo",
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-restricted-imports": "off",
  },
};
