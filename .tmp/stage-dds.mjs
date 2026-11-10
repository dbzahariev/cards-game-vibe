import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (args, options = {}) => execFileSync('git', args, { encoding: 'utf8', ...options });
assert.equal(git(['diff', '--cached', '--name-only']).trim(), '', 'The index must be empty before staging this change.');
const head = (file) => git(['show', `HEAD:${file}`]).replace(/\r\n/g, '\n');
const current = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const stage = (file, text) => {
  const sha = git(['hash-object', '-w', '--stdin', `--path=${file}`], { input: text }).trim();
  git(['update-index', '--add', '--cacheinfo', `100644,${sha},${file}`]);
};

const originalMain = head('src/main.jsx');
let stagedMain = current('src/main.jsx');
const countStart = originalMain.indexOf('  const countRequest = JSON.stringify({');
const functionStart = originalMain.indexOf('  async function exportWord() {');
assert.ok(countStart >= 0 && functionStart > countStart);
assert.ok(!stagedMain.includes('  const countRequest = JSON.stringify({'));
stagedMain = stagedMain.replace('  async function exportWord() {',
  originalMain.slice(countStart, functionStart) + '  async function exportWord() {');
const sectionStart = originalMain.indexOf('        <section className="combination-count"');
const errorStart = originalMain.indexOf('        {generationError &&');
assert.ok(sectionStart >= 0 && errorStart > sectionStart);
assert.ok(!stagedMain.includes('<section className="combination-count"'));
stagedMain = stagedMain.replace('        {generationError &&',
  originalMain.slice(sectionStart, errorStart) + '        {generationError &&');
if (originalMain.startsWith('\uFEFF') && !stagedMain.startsWith('\uFEFF')) stagedMain = '\uFEFF' + stagedMain;
stage('src/main.jsx', stagedMain);

let stagedStyles = current('src/style.css');
assert.ok(!stagedStyles.includes('.combination-count {'));
const countStyles = head('src/style.css').split('\n').filter((line) => line.startsWith('.combination-count'));
assert.equal(countStyles.length, 3);
stagedStyles = stagedStyles.replace('.dds-status {', countStyles.join('\n') + '\n.dds-status {');
stage('src/style.css', stagedStyles);

git(['add', '--', '.github/workflows/deploy.yml', 'package.json',
  'src/dds.js', 'src/dds-worker.js', 'src/export-dds-word.js',
  'src/vendor/dds/LICENSE', 'src/vendor/dds/out.js', 'src/vendor/dds/README.md',
  'tests/dds.mjs', 'tests/dds-export.mjs']);
console.log('Staged DDS source and tests; unrelated counter removals remain in the working tree.');
