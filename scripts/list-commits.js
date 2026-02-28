const { execSync } = require('child_process');
const log = execSync('git log --pretty=format:"%s" a0d0b18..6213123', { maxBuffer: 2 * 1024 * 1024 }).toString();
log.split('\n').filter(Boolean).forEach((l, i) => console.log((i + 1) + '. ' + l));
