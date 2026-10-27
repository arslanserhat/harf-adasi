const fs = require('node:fs');
const path = require('node:path');

// Exercise the actual browser model graph without changing the project's ESM
// policy. Pure model imports can now share selection/teacher/profile modules.
const root = path.resolve(__dirname, '../src');
const cache = new Map();
const loading = new Set();
function modelURL(name) {
  const filename = path.resolve(root, name);
  if (!filename.startsWith(root + path.sep) || !filename.endsWith('.js')) throw new Error('Expected an application model module');
  if (cache.has(filename)) return cache.get(filename);
  if (loading.has(filename)) throw new Error(`Circular model dependency: ${path.basename(filename)}`);
  loading.add(filename);
  let source = fs.readFileSync(filename, 'utf8').replace(/^\s*import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
  source = source.replace(/(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"]+\.js)\2/g,
    (_match, prefix, _quote, dependency) => prefix + JSON.stringify(modelURL(path.relative(root, path.resolve(path.dirname(filename), dependency)))));
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  loading.delete(filename); cache.set(filename, url);
  return url;
}
module.exports = { modelURL };
