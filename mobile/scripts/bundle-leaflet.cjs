const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(require.resolve('leaflet/dist/leaflet.js'), 'utf8');
const css = fs.readFileSync(
  require.resolve('leaflet/dist/leaflet.css'),
  'utf8',
);
fs.mkdirSync(path.join(root, 'src/components/maps'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src/components/maps/leaflet-bundle.ts'),
  '// Generated from Leaflet 1.9.4 (BSD-2-Clause). Regenerate: npm run prepare:maps\nexport const leafletJS = ' +
    JSON.stringify(js) +
    ';\nexport const leafletCSS = ' +
    JSON.stringify(css) +
    ';\n',
);
fs.copyFileSync(
  require.resolve('leaflet/LICENSE'),
  path.join(root, 'assets/LEAFLET-LICENSE.txt'),
);
