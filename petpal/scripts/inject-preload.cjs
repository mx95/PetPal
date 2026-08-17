const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const htmlPath = path.join(buildDir, 'index.html');
const jsDir = path.join(buildDir, 'static', 'js');

if (!fs.existsSync(htmlPath) || !fs.existsSync(jsDir)) {
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');
const files = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js') && !name.endsWith('.map'));

function chunkHref(prefix) {
  const match = files.find((name) => name.startsWith(`${prefix}.`) || name.startsWith(`${prefix}-`));
  return match ? `/static/js/${match}` : null;
}

const tags = [];
const home = chunkHref('home');
if (home && !html.includes(home)) {
  tags.push(`<link rel="preload" as="script" href="${home}">`);
}

if (tags.length) {
  html = html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
  fs.writeFileSync(htmlPath, html);
}
