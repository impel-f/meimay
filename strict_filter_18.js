const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Strict Filtering Rules for Kanji 1700-1799

// 1. Inappropriate for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '惡', '番', '盜', '剩', '階', '寒', '期', '搜', '著', '視', '黑', '短', '悲', '揭', '落', '渴', '給', '辞', '続', '焼', '働', '鉱', '資', '費', '損', '預', '蒸', '裏', '証', '税', '跡', '属', '僧', '嘆', '搬', '腰', '愚', '賊', '塗', '筋', '裁', '裸', '靴', '嫌', '碁', '痛', '塑', '痴', '艇', '幾', '距', '御', '鉢'
];

// Handle old chars/variants Note
const oldChars = {
    '惡': '悪',
    '盜': '盗',
    '剩': '剰',
    '搜': '捜',
    '著': '著',
    '視': '視',
    '黑': '黒',
    '黃': '黄',
    '揭': '掲',
    '渴': '渇'
};

const manualScores = {
    '道': 95, '温': 95, '開': 90, '湖': 95, '港': 85, '勝': 90, '植': 40, '登': 90,
    '湯': 40, '童': 60, '遊': 70, '葉': 100, '陽': 100, '覚': 90, '喜': 95, '景': 95,
    '結': 100, '順': 95, '達': 90, '然': 85, '博': 85, '準': 85, '満': 95, '量': 40,
    '賀': 95, '勧': 70, '測': 40, '程': 60, '統': 70, '富': 90, '貴': 95, '勤': 85,
    '敬': 95, '策': 40, '頑': 40, '善': 95, '尊': 95, '偉': 95, '越': 80, '援': 80,
    '奥': 40, '堅': 90,
    // Negative items explicitly score 1
    '惡': 1, '番': 1, '盜': 1, '剩': 1, '階': 1, '寒': 1, '期': 1, '搜': 1, '著': 1, '視': 1,
    '短': 1, '黑': 1, '悲': 1, '揭': 1, '落': 1, '渴': 1, '給': 1, '辞': 1, '続': 1, '焼': 1,
    '働': 1, '鉱': 1, '資': 1, '費': 1, '損': 1, '預': 1, '蒸': 1, '裏': 1, '税': 1, '跡': 1,
    '僧': 1, '嘆': 1, '搬': 1, '腰': 1, '愚': 1, '賊': 1, '塗': 1, '筋': 1, '裁': 1, '裸': 1,
    '靴': 1, '嫌': 1, '碁': 1, '痛': 1, '塑': 1, '痴': 1, '艇': 1, '幾': 1, '距': 1, '御': 1, '鉢': 1
};

const tagChanges = {
    '道': ['#信念', '#知性'], // remove 水景
    '番': [],
    '植': ['#自然'], // remove 天空
    '陽': ['#希望'], // remove 天空
    '景': ['#品格'], // remove 天空
    '裁': [],
    '晩': [],
    '距': [],
    '晴': ['#希望', '#自然'],
    '朝': ['#希望']
};

let md = '# 漢字レビュー報告（第18回：1700〜1799文字 厳密審査版）\n\n';
md += 'これまでの厳格な基準（**名付けに不自然な文字の排除、現実的なスコア低下、無茶なタグの削除**）を適用し、インデックス1700〜1799の漢字をレビュー・修正しました。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「惡」「盜」「悲」「損」「賊」「痛」「痴」など不穏なもの、「痢」（再掲）「喉」（再掲）「腰」「裸」など解剖的・生理的なもの、「番」「期」「給」「資」「税」「証」「跡」「搬」など事務的すぎるものを含め計53文字を弾きました。\n';
md += '- **「#天空」タグの修正**: 「植」「陽」「景」など不自然な天空タグを除去し、適切なタグ（#希望、#品格、#自然）に振り替えました。\n';
md += '- **「#水景」タグの精査**: 「道」（しんにょうが水を連想させたか？）から水景タグを除去しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 1700; i < 1800; i++) {
    const item = data[i];
    let kanji = item['漢字'];
    let note = '';

    let isFlagged = strictFlags.includes(kanji);
    if (isFlagged) {
        if (item['不適切フラグ'] != 1) {
            item['不適切フラグ'] = 1;
            note += (note ? ' ' : '') + '🆕フラグ追加';
        }
    }

    if (isFlagged) {
        item['おすすめ度'] = 1;
        item['男のおすすめ度'] = 1;
        item['女のおすすめ度'] = 1;
        note += (note ? ' ' : '') + '📉スコア1化';
    } else if (manualScores[kanji] !== undefined) {
        item['おすすめ度'] = manualScores[kanji];
        if (item['男のおすすめ度'] <= 0) item['男のおすすめ度'] = manualScores[kanji];
        if (item['女のおすすめ度'] <= 0) item['女のおすすめ度'] = manualScores[kanji];
        note += (note ? ' ' : '') + '📈設定・調整';
    }

    if (isFlagged) {
        if (item['分類'] !== '') {
            item['分類'] = '';
            note += (note ? ' ' : '') + '🏷️タグ削除済';
        }
    } else if (tagChanges[kanji]) {
        item['分類'] = tagChanges[kanji].join(' ');
        note += (note ? ' ' : '') + '🏷️タグ修正済';
    }

    let displayTags = item['分類'] || '（なし）';
    let rawFlag = item['不適切フラグ'];
    let flagVal = (rawFlag === 1 || rawFlag === '1' || String(rawFlag).toUpperCase() === 'TRUE') ? 1 : 0;
    let scoreAll = item['おすすめ度'];
    let scoreM = item['男のおすすめ度'];
    let scoreF = item['女のおすすめ度'];
    let status = (flagVal === 1) ? '⚠️ 注意' : 'OK';

    if (flagVal === 1) {
        if (!note.includes('フラグ追加')) note += (note ? ' ' : '') + '不適切フラグあり';
    } else if (displayTags === '（なし）') {
        status = '検討';
        if (!note.includes('タグ修正済') && !note.includes('タグなし') && !note.includes('タグ削除済')) note += (note ? ' ' : '') + 'タグなし';
    }

    if (oldChars[kanji]) note += (note ? ' ' : '') + `※${oldChars[kanji]}の旧字/異体字`;

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/18.md', md, 'utf8');
console.log('Batch 18 Script Done');
