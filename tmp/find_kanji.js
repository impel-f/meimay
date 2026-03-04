const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./public/data/kanji_data.json', 'utf8'));

const results = [];
for (const item of data) {
    if (!item['不適切']) {
        if (item['意味'] && item['意味'].includes('※')) {
            results.push(`【${item['漢字']}】\n意味: ${item['意味']}\n`);
        }
    }
}

const out = `該当件数: ${results.length}件\n\n` + results.join('\n');
fs.writeFileSync('tmp/results_utf8.txt', out, 'utf8');
console.log('Finished writing ' + results.length + ' items');
