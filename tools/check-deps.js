// Checks that every package Mochi needs is installed. Exits with 1 (and lists what's
// missing) if something isn't, so the start scripts know to run "npm install".
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { dependencies = {} } = require(path.join(root, 'package.json'));

// Looks for the files on disk instead of loading them, which is quick and works for every package.
const missing = Object.keys(dependencies).filter(
  (name) => !fs.existsSync(path.join(root, 'node_modules', ...name.split('/'), 'package.json')),
);

if (missing.length) {
  console.log(`Mochi needs to install: ${missing.join(', ')}`);
  process.exit(1);
}
