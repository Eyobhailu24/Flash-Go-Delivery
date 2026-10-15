const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dictionary = JSON.parse(
  fs.readFileSync(path.join(root, 'src/locales/am.json'), 'utf8'),
);
const escape = (value) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const entries = Object.entries(dictionary).sort(([a], [b]) =>
  a.localeCompare(b, 'en'),
);
const lines = [
  '# Amharic translation draft',
  '',
  'Prepared for your review. English text is the lookup key; preserve `{name}`, `{amount}`, `{distance}`, and `{time}` placeholders in translations. Review delivery, payment, permission, and account-status terminology with an Amharic speaker before release.',
  '',
  'The app switches bundled UI strings immediately. Backend catalog content, addresses, and arbitrary server messages are not machine-translated. OS permission text is currently English in `app.config.ts`.',
  '',
  'This draft contains ' +
    entries.length +
    ' entries. Edit `src/locales/am.json` and run `npm run translations:review` to regenerate.',
  '',
  '| English | Amharic draft |',
  '| --- | --- |',
  ...entries.map(([key, value]) => `| ${escape(key)} | ${escape(value)} |`),
  '',
];
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/TRANSLATIONS.md'), lines.join('\n'));
console.log(`Prepared ${entries.length} translation entries for review.`);
