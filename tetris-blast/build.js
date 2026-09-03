/* ============================================================
   build.js — inline css/ and js/ into a single standalone file.
   Run with:  node build.js
   Output:    dist/tetris-blast.html
   ============================================================ */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');

const scripts = ['config', 'sprites', 'backgrounds', 'effects', 'game', 'renderer', 'main']
    .map(n => fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'))
    .join('\n\n');

let out = html
    .replace('<link rel="stylesheet" href="css/style.css">',
        '<style>\n' + css + '\n</style>')
    .replace(/\n *<script src="js\/[a-z]+\.js"><\/script>/g, '');

out = out.replace('</body>', '<script>\n' + scripts + '\n</script>\n</body>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/tetris-blast.html'), out);

console.log('dist/tetris-blast.html  ' + (out.length / 1024).toFixed(1) + ' KB');
