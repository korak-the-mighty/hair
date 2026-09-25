#!/usr/bin/env node
/* Bundles index.html + src/*.js into one self-contained HTML file.
 *   node tools/build.js                 -> dist/nightdrive.html
 *   node tools/build.js --fragment out  -> body-only fragment (for hosts that
 *                                          supply their own <html>/<head>)   */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlined = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) return `<!-- ${src} not present -->`; // e.g. no vocal pack generated yet
  const code = fs.readFileSync(file, 'utf8');
  return `<script>/* ${src} */\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
const args = process.argv.slice(2);
if (args[0] === '--fragment') {
  const title = inlined.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = inlined.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = inlined.match(/<body>([\s\S]*)<\/body>/)[1];
  // preview hosts can't hand the viewer a file, so recording is disabled there
  fs.writeFileSync(args[1], `${title}\n${style}\n<script>window.ND_PREVIEW = true;</script>\n${body}`);
  console.log('fragment ->', args[1]);
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'nightdrive.html');
  fs.writeFileSync(out, inlined);
  console.log('bundle ->', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
