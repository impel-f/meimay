
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'public/data/kanji_data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const kanjiList = JSON.parse(rawData);

const targetKanji = ["陽", "翔", "桜", "葵", "凛", "蓮", "結", "颯", "湊", "悠", "希", "菜", "莉", "咲", "仁", "健", "太", "大", "一", "愛", "心", "光", "海", "空"];

let output = "--- MANAUL CHECK TARGETS ---\n";

targetKanji.forEach(char => {
    const k = kanjiList.find(item => item['漢字'] === char);
    if (k) {
        output += `\n【${k['漢字']}】 (Score: ${k['おすすめ度']})\n`;
        output += `  音: ${k['音']}\n`;
        output += `  訓: ${k['訓']}\n`;
        output += `  名: ${k['伝統名のり']}\n`;
        output += `  意: ${k['意味']}\n`;
        output += `  イ: ${k['名前のイメージ']}\n`;
    } else {
        output += `\n【${char}】 NOT FOUND\n`;
    }
});

fs.writeFileSync(path.join(__dirname, 'inspection_result.txt'), output, 'utf8');
console.log("Saved to inspection_result.txt");
