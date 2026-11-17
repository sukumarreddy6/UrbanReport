const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ejs = require('ejs');
const root = path.resolve(__dirname, '..');
let failed = false;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { failed = true; process.stderr.write(`${file}\n${result.stderr}`); }
    } else if (file.endsWith('.ejs')) {
      try { ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file }); }
      catch (error) { failed = true; console.error(`${file}: ${error.message}`); }
    }
  }
}
walk(root);
if (failed) process.exit(1);
console.log('JavaScript syntax and EJS templates look valid.');
