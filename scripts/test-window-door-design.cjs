// Runs the real Konva canvas renderer in headless Chrome, without a server or API.
// Override CHROME_BIN if Chrome is installed elsewhere.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(fs.existsSync);
assert.ok(chrome, 'Set CHROME_BIN to a Chrome/Chromium executable.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'window-door-design-'));
const modules = {
  design: 'modules/product-configurator/utils/window-door-design.ts',
  duplicate: 'modules/quotation/utils/duplicate-preview.ts',
};
let code = `const modules = {}; function require(name) {
  if (name === 'konva/lib/index') return Konva;
  if (name.endsWith('/window-door-design')) return modules.design;
  throw new Error('Unexpected module: ' + name);
}\n`;
for (const [name, filename] of Object.entries(modules)) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  code += `{ const exports = {}; ${compiled}\n modules.${name} = exports; }\n`;
}
function browserTests() {
  const D = modules.design;
  const { prepareDuplicateDesign } = modules.duplicate;
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const equal = (actual, expected, message) => assert(actual === expected, message);
  const test = (name, fn) => {
    try { fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack }); }
  };
  const fixture = (patch = {}) => {
    const layout = { ...D.createRoot('Casement'), description: 'Left Openable', sash: 'left', frameColor: '#854922' };
    return { id: 'source', productType: 'Window', width: 1500, height: 1500,
      systemType: 'Casement', description: 'Left Openable', colorFinish: 'Custom finish',
      rate: 100, quantity: 1, glassSpec: '6mm Clear Toughened', configuratorLayout: layout,
      ...patch };
  };
  const duplicate = (item) => ({ ...structuredClone(item), id: 'copy', refCode: 'COPY',
    subItems: item.subItems?.map((sub, index) => ({ ...structuredClone(sub), id: `copy-${index}` })) });
  const styles = [
    ['Casement', 'Left Openable'], ['Casement', 'Right Openable'],
    ['Casement', 'Top Hung Window'], ['Casement', 'Bottom Hung Window'],
    ['Casement', 'Tilt and Turn Window'], ['Casement', 'French Door'],
    ['Sliding', '2 Track 2 Glass'], ['Louvers', 'Louvers'], ['Blank Area', 'Blank Area'],
    ...[2, 3, 4, 5, 6].map((count) => ['Slide N Fold', `${count} Panel (1+${count - 1})`]),
  ];
  styles.forEach(([systemType, description]) => test(`${systemType}: ${description} retains identical pixels`, () => {
    const item = fixture({ systemType, description });
    Object.assign(item.configuratorLayout, { systemType, description });
    const original = JSON.stringify(item);
    const expected = D.generateWindowDoorPreview(item);
    const copy = duplicate(item);
    prepareDuplicateDesign(item, copy);
    equal(copy.refImage, expected, 'Regenerated duplicate differs from configurator export');
    equal(JSON.stringify(item), original, 'Source was mutated');
  }));
  test('Unchanged legacy images are copied exactly', () => {
    const item = fixture({ refImage: 'https://example.invalid/saved-original.png' });
    const copy = duplicate(item);
    prepareDuplicateDesign(item, copy);
    equal(copy.refImage, item.refImage, 'Legacy image changed');
  });
  test('Arches, mesh, custom color, and exhaust fan survive resizing', () => {
    for (const archType of ['circular', 'triangle']) {
      const item = fixture();
      Object.assign(item.configuratorLayout, { archType, archHeightRatio: .3, hasExhaustFan: true,
        exhaustFanX: .3, exhaustFanY: .6, exhaustFanSize: .4, mesh: 'Yes', description: 'Fix' });
      item.refImage = D.generateWindowDoorPreview(item);
      const copy = duplicate(item);
      copy.width = 2100;
      copy.height = 1800;
      prepareDuplicateDesign(item, copy);
      assert(copy.refImage !== item.refImage, 'Resized image was not regenerated');
      equal(copy.refImage, D.generateWindowDoorPreview(copy), 'Resized export differs');
      equal(copy.configuratorLayout.archType, archType, 'Arch was lost');
      equal(copy.configuratorLayout.exhaustFanX, .3, 'Fan position was lost');
      equal(copy.configuratorLayout.frameColor, '#854922', 'Custom color was lost');
    }
  });
  const combination = () => {
    const item = fixture({ systemType: 'Combination', width: 2000, height: 1000 });
    const leaf = (id, x, y, w, h, description) => ({ ...D.createRoot('Casement'), id, x, y, w, h, description });
    const a = leaf('a', 0, 0, .5, .5, 'Left Openable');
    const b = leaf('b', 0, .5, .5, .5, 'Right Openable');
    const c = leaf('c', .5, 0, .5, 1, 'Fix');
    const group = { ...D.createRoot('Casement'), id: 'group', w: .5, split: 'horizontal', children: [a, b] };
    Object.assign(item.configuratorLayout, { split: 'vertical', children: [group, c], dividerTypes: { 'divider-0': 'C', 'divider-1': 'M' } });
    item.subItems = [a,b,c].map(node => ({ id: node.id, width: node.w * item.width, height: node.h * item.height,
      systemType: node.systemType, description: node.description, area: 5, rate: 100, quantity: 1 }));
    item.joins = [{ p1: 'group', p2: 'c', type: 'Coupler' }, { p1: 'a', p2: 'b', type: 'Mullion' }];
    return item;
  };
  test('Nested layouts preserve section identity and remap joins', () => {
    const item = combination();
    const copy = duplicate(item);
    const expected = D.generateWindowDoorPreview(item);
    prepareDuplicateDesign(item, copy);
    equal(copy.refImage, expected, 'Nested copy differs');
    const leaves = [];
    D.mapLeafNodes(copy.configuratorLayout, leaf => leaves.push(leaf));
    leaves.forEach((leaf, index) => equal(leaf.id, copy.subItems[index].id, 'Section ID mismatch'));
    const ids = new Set();
    const collect = node => { ids.add(node.id); node.children?.forEach(collect); };
    collect(copy.configuratorLayout);
    copy.joins.forEach(join => assert(ids.has(join.p1) && ids.has(join.p2), 'Dangling join reference'));
    equal(copy.configuratorLayout.dividerTypes['divider-0'], 'C', 'Join badge changed');
    equal(D.mapItemToConfiguratorState(copy).root.children[0].children[1].id, 'copy-1', 'Reopening mismatched sections');
  });
  test('Resized parent scales nested sections; edited sections update geometry', () => {
    const item = combination();
    const copy = duplicate(item);
    copy.width = 3000;
    prepareDuplicateDesign(item, copy);
    equal(copy.subItems[0].width, 1500, 'Child did not scale with parent');
    equal(copy.subItems[2].width, 1500, 'Sibling did not scale with parent');
    const resized = duplicate(item);
    resized.subItems[0].height = 250;
    resized.subItems[1].height = 750;
    prepareDuplicateDesign(item, resized);
    equal(resized.configuratorLayout.children[0].children[0].h, .25, 'Edited section proportion ignored');
    equal(resized.subItems[1].height, 750, 'Section dimensions disagree with layout');
    equal(resized.refImage, D.generateWindowDoorPreview(resized), 'Resized preview differs on reopen');
  });
  test('Sliding panel proportions, movement and mesh are preserved', () => {
    const item = fixture({ systemType: 'Sliding', description: '2 Track 2 Glass' });
    Object.assign(item.configuratorLayout, { systemType: 'Sliding', description: '2 Track 2 Glass',
      panelFractions: [.3, .7], panelSashes: ['left', 'double'], panelMeshCount: 1, mesh: 'Yes' });
    const copy = duplicate(item);
    copy.width = 2000;
    prepareDuplicateDesign(item, copy);
    equal(JSON.stringify(copy.configuratorLayout.panelFractions), '[0.3,0.7]', 'Panel proportions lost');
    equal(JSON.stringify(copy.configuratorLayout.panelSashes), '["left","double"]', 'Movement lost');
    equal(copy.configuratorLayout.panelMeshCount, 1, 'Mesh lost');
  });
  test('Exports clean up temporary Konva stages', () => equal(Konva.stages.length, 0, 'Export leaked stages'));
  document.getElementById('results').textContent = JSON.stringify(results);
}
try {
  fs.copyFileSync(path.join(root, 'node_modules/konva/konva.min.js'), path.join(directory, 'konva.js'));
  fs.writeFileSync(path.join(directory, 'tests.js'), code + `\n(${browserTests.toString()})();`);
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><pre id="results"></pre><script src="konva.js"></script><script src="tests.js"></script>');
  const run = spawnSync(chrome, ['--headless', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${path.join(directory, 'profile')}`, '--dump-dom', `file://${directory}/index.html`],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(run.status, 0, run.error?.message || run.stderr || `Chrome exited with signal ${run.signal}`);
  const match = run.stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/);
  assert.ok(match?.[1], 'Browser did not produce test results: ' + run.stderr);
  const results = JSON.parse(match[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.error ? '\n' + result.error : ''}`);
  assert.ok(results.every(result => result.pass), 'Visual regression checks failed');
  console.log(`${results.length} browser checks passed.`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
