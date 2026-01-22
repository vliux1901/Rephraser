module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  globals: {
    chrome: "readonly"
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "script"
  },
  ignorePatterns: ["build/**", "res/**"]
};
