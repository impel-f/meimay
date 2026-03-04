const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const batch16 = data.slice(1500, 1600).map((k, i) => {
    return (i + 1500) + ':' + k['漢字'] + ' (Tags: ' + k['分類'] + ', Mean: ' + k['意味'].replace(/\n/g, '').substring(0, 30) + ')';
});
fs.writeFileSync('batch16.txt', batch16.join('\n'), 'utf8');
console.log('Batch 16 extracted to batch16.txt');
