
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'public/data/kanji_data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
let kanjiList = JSON.parse(rawData);

let updateCount = 0;

function updateKanji(char, updates) {
    const k = kanjiList.find(item => item['漢字'] === char);
    if (!k) {
        console.log(`Kanji ${char} not found!`);
        return;
    }

    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
        // For strings, append if it's '伝統名のり' to avoid overwriting existing
        if (key === '伝統名のり' && k[key] && !value.startsWith('REPLACE:')) {
            const currentParts = k[key].split('、').map(s => s.trim());
            const newParts = value.split('、').map(s => s.trim());
            const merged = [...new Set([...currentParts, ...newParts])].sort();
            const newStr = merged.join('、');
            if (k[key] !== newStr) {
                console.log(`[${char}] Updating ${key}: "${k[key]}" -> "${newStr}"`);
                k[key] = newStr;
                changed = true;
            }
        }
        // Force replace if needed (using special prefix) or for other fields
        else {
            const val = value.replace ? value.replace('REPLACE:', '') : value;
            if (k[key] !== val) {
                console.log(`[${char}] Updating ${key}: ${k[key]} -> ${val}`);
                k[key] = val;
                changed = true;
            }
        }
    }
    if (changed) updateCount++;
}

// --- APPLY CHANGES ---

// 凛 (Rin)
updateKanji('凛', {
    'おすすめ度': 100,
    '意味': 'ひきしまる。きびしい。潔い。品格がある。' // Removed "俗字" note from meaning to be cleaner, or just keep it? Let's make it positive.
});

// 希 (Nozomi)
updateKanji('希', {
    '伝統名のり': 'のぞみ、のぞむ'
});

// 愛 (Ai)
updateKanji('愛', {
    '伝統名のり': 'ちか、まな、め'
});

// 空 (Sora)
updateKanji('空', {
    '伝統名のり': 'く、くう'
});

// 陽 (You)
updateKanji('陽', {
    '伝統名のり': 'ひなた、ひかり',
    '意味': '太陽。日向。明るい。積極的。'
});

// 結 (Yui)
updateKanji('結', {
    '伝統名のり': 'ゆ'
});

// 葵 (Aoi)
updateKanji('葵', {
    '伝統名のり': 'き'
});

// 碧 (Ao)
updateKanji('碧', {
    '伝統名のり': 'あお、みどり'
});

// Save back
if (updateCount > 0) {
    fs.writeFileSync(dataPath, JSON.stringify(kanjiList, null, 2), 'utf8');
    console.log(`\nUpdated ${updateCount} kanji records.`);
} else {
    console.log("\nNo changes needed.");
}
