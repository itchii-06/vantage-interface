// Lint-staged config (CommonJS — required because package.json sets "type": "module")
//
// src/vantage/types/ contains typechain-generated files that are excluded from ESLint
// via .eslintignore. Passing them explicitly to ESLint produces "File ignored" warnings
// which fail under --max-warnings=0. We therefore filter them out before running ESLint
// while still running prettier on all staged files.

/** @param {string[]} files */
const srcEslint = (files) => {
  const filtered = files.filter((f) => !f.includes("/vantage/types/"));
  if (filtered.length === 0) return [];
  return `eslint --fix --max-warnings=0 ${filtered.join(" ")}`;
};

module.exports = {
  "sdk/**/*.{js,ts,jsx,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "src/**/*.{js,ts,jsx,tsx}": [srcEslint, "prettier --write"],
  "src/**/*.{css,scss}": ["prettier --write"],
  "landing/**/*.{js,ts,jsx,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "landing/**/*.{css,scss}": ["prettier --write"],
};
