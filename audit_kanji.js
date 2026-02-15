
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'public/data/kanji_data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const kanjiList = JSON.parse(rawData);

console.log(`Total Kanji: ${kanjiList.length}`);

const issues = {
    missingMeaning: [],
    missingImage: [],
    missingNanori: [], // Might be valid for some
    contradiction: [], // High score + Inappropriate
    lowScorePopular: [], // Potential false negatives
    suspiciousReadings: [],
    badMeaningButHighScore: [] // Keywords like "死", "殺", "悪" in meaning but high score
};

const negativeKeywords = ["死", "殺", "悪", "病", "苦", "毒", "恨", "邪", "魔", "葬", "罪", "恥", "汚", "貧"];
const popularKanji = ["愛", "優", "結", "陽", "翔", "菜", "莉", "桜", "琴", "蓮", "湊", "蒼", "樹", "大", "太"];

kanjiList.forEach(k => {
    // 1. Missing Fields
    if (!k['意味'] || k['意味'].trim() === "") {
        issues.missingMeaning.push(k['漢字']);
    }
    if (!k['名前のイメージ'] || k['名前のイメージ'].trim() === "") {
        issues.missingImage.push(k['漢字']);
    }

    // 2. Contradiction
    // Score > 50 but flagged as inappropriate
    if (k['おすすめ度'] >= 50 && k['不適切フラグ']) {
        issues.contradiction.push(`${k['漢字']} (Score: ${k['おすすめ度']})`);
    }

    // 3. Bad Meaning Check
    if (k['意味']) {
        const hasNegative = negativeKeywords.some(w => k['意味'].includes(w));
        if (hasNegative && k['おすすめ度'] >= 60 && !k['不適切フラグ']) {
            // Exclude some context like "死なない" (immortal) -> naive check might be false positive, but worth checking
            issues.badMeaningButHighScore.push(`${k['漢字']} (Score: ${k['おすすめ度']}, Meaning: ${k['意味']})`);
        }
    }

    // 4. Check specific popular kanji for low score
    if (popularKanji.includes(k['漢字']) && k['おすすめ度'] < 80) {
        issues.lowScorePopular.push(`${k['漢字']} (Score: ${k['おすすめ度']})`);
    }

    // 5. Check empty Nanori for likely checks (basic check, just length 0)
    // Many kanji don't have nanori, so maybe just check ones with high score?
    if (k['おすすめ度'] >= 80 && (!k['伝統名のり'] || k['伝統名のり'] === "")) {
        issues.missingNanori.push(`${k['漢字']}`);
    }
});

console.log("--- AUDIT REPORT ---");
console.log(`Missing Meaning: ${issues.missingMeaning.length}`, issues.missingMeaning.slice(0, 20));
console.log(`Missing Image: ${issues.missingImage.length}`, issues.missingImage.slice(0, 20));
console.log(`Contradictions: ${issues.contradiction.length}`, issues.contradiction);
console.log(`Bad Meaning but High Score: ${issues.badMeaningButHighScore.length}`, issues.badMeaningButHighScore.slice(0, 20));
console.log(`Popular but Low Score: ${issues.lowScorePopular.length}`, issues.lowScorePopular);
console.log(`High Score but Missing Nanori: ${issues.missingNanori.length}`, issues.missingNanori.slice(0, 20));

// Output detailed list to a file for review
const report = JSON.stringify(issues, null, 2);
fs.writeFileSync(path.join(__dirname, 'audit_report.json'), report);
console.log("Report saved to audit_report.json");
