const fs = require('fs');
const path = 'public/data/kanji_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Strict Filtering Rules for Kanji 2000-2099

// 1. Inappropriate for names -> Flag 1, Score 1, Tags removed
const strictFlags = [
    '線', '業', '談', '選', '試', '敵', '戦', '編', '稿', '腸', '震', '禁', '群',
    '踏', '罪', '盤', '飼', '敷', '噴', '舗', '黙', '衝', '嘱', '請', '潜', '腹',
    '幕', '諾', '駐', '鋳', '墜', '墳', '憂', '稼', '詰', '窮', '遷', '槽', '罷',
    '撲', '窯', '寝', '潰', '餌', '蓄', '踪', '誰', '嘲', '罵', '箸', '溶', '雷',
    '膝', '餅', '慨', '蝦', '隔', '蕎', '棄', '糊', '撒', '催', '撰', '鄭', '噌',
    '噂', '歎'
];

const manualScores = {
    '意': 90, '感': 85, '漢': 60, '詩': 100, '想': 90, '鉄': 70, '福': 95, '路': 85,
    '愛': 100, '照': 95, '節': 80, '解': 40, '幹': 85, '義': 95, '勢': 85, '豊': 95,
    '夢': 100, '絹': 95, '源': 95, '誠': 100, '聖': 100, '暖': 100, '魅': 70, '雅': 100,
    '誇': 85, '継': 80, '詳': 80, '慎': 95, '履': 60, '誉': 100, '慈': 100, '滝': 95,
    // Negative items explicitly score 1
    '線': 1, '業': 1, '談': 1, '選': 1, '試': 1, '敵': 1, '戦': 1, '編': 1, '稿': 1, '腸': 1,
    '震': 1, '禁': 1, '群': 1, '踏': 1, '罪': 1, '盤': 1, '飼': 1, '敷': 1, '噴': 1, '舗': 1,
    '黙': 1, '衝': 1, '嘱': 1, '請': 1, '潜': 1, '腹': 1, '幕': 1, '諾': 1, '駐': 1, '鋳': 1,
    '墜': 1, '墳': 1, '憂': 1, '稼': 1, '詰': 1, '窮': 1, '遷': 1, '槽': 1, '罷': 1, '撲': 1,
    '窯': 1, '寝': 1, '潰': 1, '餌': 1, '蓄': 1, '踪': 1, '誰': 1, '嘲': 1, '罵': 1, '箸': 1,
    '溶': 1, '雷': 1, '膝': 1, '餅': 1, '慨': 1, '蝦': 1, '隔': 1, '蕎': 1, '棄': 1, '糊': 1,
    '撒': 1, '催': 1, '撰': 1, '鄭': 1, '噌': 1, '噂': 1, '歎': 1
};

const tagChanges = {
    '照': ['#希望', '#知性'], // remove 天空
    '慈': ['#慈愛'], // move away from 天空
    '想': ['#知性', '#信念'],
    '感': ['#慈愛', '#信念'],
    '鉄': ['#勇壮']
};

let md = '# 漢字レビュー報告（第21回：2000〜2099文字 厳密審査版）\n\n';
md += 'インデックス2000番台に突入しました。引き続き、名付けに相応しくない事務的・解剖学的・ネガティブな漢字を厳格に排除しています。\n\n';
md += '### 主な修正内容\n';
md += '- **完全排除（スコア1＆フラグ）**: 「敵」「戦」「震」「罪」「墜」「墳」「憂」「窮」「撲」「潰」「嘲」「罵」「噂」「歎」など不穏・攻撃的なもの、「腸」「腹」「膝」など解剖学的なもの、「線」「業」「談」「選」「試」「編」「稿」「駐」「稼」「詰」「遷」など事務的・日常的すぎるもの計67文字を弾きました。\n';
md += '- **「#天空」タグの修正**: 「照」（#希望に振り替え）、「慈」（元々#天空だったものを#慈愛に修正）など、不自然な天空タグを整理しました。また、不適切と判定した字からもタグを削除しています。\n';
md += '- **高評価**: 名付けにおいて普遍的な人気や高い品格、美しい意味を持つ「詩」「夢」「愛」「誠」「聖」「雅」「誉」「慈」「滝」などを最高ランクで評価しました。\n\n';
md += '| 漢字 | 分類 | 総合スコア | 男スコア | 女スコア | フラグ | 判定 | 備考 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

for (let i = 2000; i < 2100; i++) {
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
    }

    md += `| ${kanji} | ${displayTags} | ${scoreAll} | ${scoreM} | ${scoreF} | ${flagVal} | ${status} | ${note} |\n`;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('C:/Users/8mits.DESKTOP-4N9QJ6A/OneDrive/ドキュメント/meimay/21.md', md, 'utf8');
console.log('Batch 21 Script Done');
