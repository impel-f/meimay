const { execSync } = require('child_process');

const commits = [
    { hash: '6213123', msg: 'v25.2 - kanji search fix, sidebar reorder, top tools 3-col' },
    { hash: 'bfecc4f', msg: 'v25.1 - fix stock/fortune blocked, free build in stock screen, ranking vertical list' },
    { hash: 'feat-v25-0', msg: 'v25.0 script cache busting' },
    { hash: '25907ac', msg: 'v25.0 - card penetration fix, free build mode, ranking UI, account delete, invite code fix' },
    { hash: '7cf7a1d', msg: 'v24.0 - multi fixes (card z-index, build display, Apple auth, drawer restructure, sound mode branch)' },
    { hash: 'a0d0b18~1', msg: 'swipe UI layout, performance and restore guidance text (if exists)' },
];

// Get the full diff stat from v23.18 to v25.2
const stat = execSync('git diff --stat a0d0b18 6213123', { maxBuffer: 5 * 1024 * 1024 }).toString();
console.log('=== Changed files (v23.18 → v25.2) ===');
console.log(stat);

// Get the names of changed files
const nameOnly = execSync('git diff --name-only a0d0b18 6213123', { maxBuffer: 2 * 1024 * 1024 }).toString();
console.log('=== Changed file list ===');
console.log(nameOnly);
