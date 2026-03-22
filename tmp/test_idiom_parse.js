function sanitizeKanjiAiText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\*/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isKanjiCharacter(ch) {
    if (!ch) return false;
    const code = ch.codePointAt(0);
    return (code >= 0x3400 && code <= 0x4DBF) || (code >= 0x4E00 && code <= 0x9FFF) || code === 0x3005;
}

function isLikelyRepresentativeIdiomWord(word) {
    const normalized = sanitizeKanjiAiText(word).replace(/[・\s]/g, '');
    if (!normalized) return false;
    const characters = Array.from(normalized);
    if (characters.length !== 2) return false;
    if (!characters.every((ch) => isKanjiCharacter(ch))) return false;
    if (/[。、！？]/.test(normalized)) return false;
    return true;
}

function normalizeRepresentativeIdiomSectionText(content) {
    return sanitizeKanjiAiText(content)
        .replace(/\r\n?/g, '\n')
        .replace(/[•●◇◆]/g, '\n')
        .replace(/[;；]/g, '\n')
        .replace(/([^\n])・(?=[\u4E00-\u9FFF\u3400-\u4DBF])/g, '$1\n・')
        .replace(/([。！？!?])(?=\s*[\u4E00-\u9FFF\u3400-\u4DBF]{1,4}（)/g, '$1\n')
        .replace(/[、,\/／]\s*(?=[\u4E00-\u9FFF\u3400-\u4DBF]{1,4}（)/g, '\n');
}

function parseRepresentativeIdiomLines(content) {
    const normalizedText = normalizeRepresentativeIdiomSectionText(content);
    return normalizedText
        .split('\n')
        .map((line) => sanitizeKanjiAiText(line)
            .replace(/^[・\-•●◇◆\d]+[.)、．]?\s*/, '')
            .trim())
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^(.+?)（(.+?)）[:：]\s*(.+)$/);
            if (match) {
                const word = sanitizeKanjiAiText(match[1]);
                const reading = sanitizeKanjiAiText(match[2]);
                let meaning = sanitizeKanjiAiText(match[3]);
                if (!isLikelyRepresentativeIdiomWord(word)) return '';
                if (meaning && !/[。.!！?？]$/.test(meaning)) meaning += '。';
                return `・${word}（${reading}）：${meaning}`;
            }
            const normalizedLine = sanitizeKanjiAiText(line);
            const word = normalizedLine.replace(/^・/, '').split(/[（(:：]/)[0];
            if (!isLikelyRepresentativeIdiomWord(word)) return '';
            let displayLine = normalizedLine;
            if (!displayLine.startsWith('・')) displayLine = `・${displayLine}`;
            if (!/[。.!！?？]$/.test(displayLine)) displayLine += '。';
            return displayLine;
        })
        .filter(Boolean);
}

const testCases = [
    { label: '改行あり（正常）', input: '日照（にっしょう）：太陽の光が照ること。\n日光（にっこう）：太陽の光のこと。\n日没（にちぼつ）：太陽が沈むこと。' },
    { label: '句点で1行に複数', input: '日照（にっしょう）：太陽の光が照ること。日光（にっこう）：太陽の光のこと。日没（にちぼつ）：太陽が沈むこと。' },
    { label: '読点区切り', input: '日照（にっしょう）：照ること、日光（にっこう）：光のこと、日没（にちぼつ）：沈むこと。' },
    { label: '中黒区切り（行中）', input: '日照（にっしょう）：照ること。・日光（にっこう）：光のこと。・日没（にちぼつ）：沈むこと。' },
    { label: '中黒リスト形式', input: '・日照（にっしょう）：照ること。\n・日光（にっこう）：光のこと。\n・日没（にちぼつ）：沈むこと。' },
    { label: '1個だけ', input: '日照（にっしょう）：太陽の光が照ること。' },
];

testCases.forEach((tc) => {
    const result = parseRepresentativeIdiomLines(tc.input);
    const icon = result.length >= 3 ? 'OK' : result.length >= 1 ? 'NG(少)' : 'NG(0)';
    process.stdout.write(`[${icon}] ${tc.label}: ${result.length}個\n`);
    result.forEach(r => process.stdout.write(`  ${r}\n`));
});
