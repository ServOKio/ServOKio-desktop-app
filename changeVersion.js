const fs = require('fs');
let old = JSON.parse(fs.readFileSync('./package.json'));
const vMatch = old.version.match(/([0-9].*)\.([0-9].*)\.([0-9].*)/);
old.version = `${vMatch[1]}.${vMatch[2]}.${Number.parseInt(vMatch[3])+1}`;
fs.writeFileSync('./package.json', JSON.stringify(old, null, 2), 'utf-8');
