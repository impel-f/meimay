/**
 * ============================================================
 * MODULE 08: AI NAME ORIGIN GENERATOR (V13.2 - Fix Syntax)
 * ============================================================
 */

const NAME_ORIGIN_PROMPT_VERSION = 'name_origin_v8_20260509';
const NAME_ORIGIN_CACHE_KEY = 'meimay_name_origin_cache_v1';
const NAME_ORIGIN_CACHE_API_PATH = '/api/name-origin-cache';
const DAILY_NAME_ORIGIN_LIMIT = 1;
let nameOriginGenerationInFlight = false;
let currentNameOriginRenderTarget = null;
let currentNameOriginRenderOptions = {};

const NAME_ORIGIN_LEFT_RIGHT_KANJI = new Set(Array.from(
    '明朋服期朝湖瑚珊理琉璃珠玲玖珂珀瑛瑞琳瑠環瑶琴珈祐祥裕俊侑佑佐佳依怜悟恒想惟慎拓陽陸陵梨桜桃椿楓柚梓樹波海洋浬渚治浩洸清淳湊満潤澪瀬沙汐汰江沖河晴暖昭時智暉彩結紗絢綾緒純紬詩誠語諒謙護証論'
));

const NAME_ORIGIN_VISIBLE_RADICAL_GROUPS = [
    { label: '王へん', chars: '玲玖珂珀珊珠理琉璃瑚瑞瑛琳瑠環瑶琴珈' },
    { label: 'さんずい', chars: '沙汐江沖河波海洋浬渚治浩洸清淳湊満潤澪瀬汰' },
    { label: '木へん', chars: '杉杏李材村杜杷松林枝柊柚柳桜桃栞栖栗栞梨梓椿楓樹' },
    { label: '糸へん', chars: '紗紘純紬絃絆絢結綾緒緋緑縁' },
    { label: '言へん', chars: '詠詩誠諒謙護証論' },
    { label: 'にんべん', chars: '仁介仰伊伍伎休佐佑佳侑俊信修倫倭偉' }
].map(group => ({ ...group, set: new Set(Array.from(group.chars)) }));

const NAME_ORIGIN_HARD_COMPOUND_NOTES = {
    '心太': '「心太」のような熟字訓は、初見では読み方を迷われやすい表記です。',
    '海月': '「海月」のような熟字訓は、日常語としての読みが先に浮かぶ場合があります。'
};

function _getDailyNameOriginKey() {
    const d = new Date();
    return `meimay_daily_name_origin_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function getDailyNameOriginUseCount() {
    try {
        const count = Number(localStorage.getItem(_getDailyNameOriginKey()) || 0);
        return Number.isFinite(count) && count > 0 ? count : 0;
    } catch (error) {
        return 0;
    }
}

function canUseDailyNameOriginAI() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return true;
    return getDailyNameOriginUseCount() < DAILY_NAME_ORIGIN_LIMIT;
}

function consumeDailyNameOriginUse() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return true;
    if (!canUseDailyNameOriginAI()) return false;
    try {
        localStorage.setItem(_getDailyNameOriginKey(), String(getDailyNameOriginUseCount() + 1));
        return true;
    } catch (error) {
        return false;
    }
}

function refundDailyNameOriginUse() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return;
    try {
        const nextCount = Math.max(0, getDailyNameOriginUseCount() - 1);
        if (nextCount === 0) localStorage.removeItem(_getDailyNameOriginKey());
        else localStorage.setItem(_getDailyNameOriginKey(), String(nextCount));
    } catch (error) { }
}

function normalizeNameOriginText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getNameOriginKanjiValue(part) {
    if (typeof part === 'string') return part.trim();
    return String(part?.['漢字'] || part?.kanji || part?.displayKanji || '').trim();
}

function getNameOriginRawCombination(result = currentBuildResult) {
    if (Array.isArray(result?.combination) && result.combination.length > 0) {
        return result.combination;
    }
    if (Array.isArray(result?.combinationKeys) && result.combinationKeys.length > 0) {
        return result.combinationKeys.map(key => ({ '漢字': key }));
    }
    return [];
}

function getNameOriginDirectGivenNameValue(result = currentBuildResult) {
    const direct = String(result?.givenName || '').trim();
    if (direct) return direct;
    const fullName = String(result?.fullName || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function normalizeNameOriginReadingValue(value) {
    if (typeof normalizeReadingComparisonValue === 'function') {
        return normalizeReadingComparisonValue(value);
    }
    return String(value || '').trim().replace(/\s+/g, '');
}

function getNameOriginCompoundMatchAt(givenName, givenReading, charIndex, unitOffset) {
    if (!Array.isArray(compoundReadingsData) || !givenName) return null;
    const normalizedReading = normalizeNameOriginReadingValue(givenReading);
    const matches = [];

    compoundReadingsData.forEach((entry) => {
        const kanji = String(entry?.kanji || entry?.['漢字'] || '').trim();
        if (!kanji || Array.from(kanji).length <= 1) return;
        if (!givenName.startsWith(kanji, unitOffset)) return;

        const variants = Array.isArray(entry.variants) ? entry.variants : [];
        let bestReading = '';
        let bestScore = normalizedReading ? 0 : 50;

        variants.forEach((variant) => {
            const reading = String(variant?.reading || '').trim();
            const normalizedVariantReading = normalizeNameOriginReadingValue(reading);
            if (!normalizedVariantReading) return;

            let score = 0;
            if (normalizedReading === normalizedVariantReading) score = 120;
            else if (charIndex === 0 && normalizedReading.startsWith(normalizedVariantReading)) score = 100;
            else if (normalizedReading.includes(normalizedVariantReading)) score = 70;

            if (score > bestScore) {
                bestScore = score;
                bestReading = reading;
            }
        });

        if (normalizedReading && bestScore <= 0) return;

        matches.push({
            entry,
            kanji,
            reading: bestReading,
            score: bestScore + (parseInt(entry.priority, 10) || 0),
            length: Array.from(kanji).length
        });
    });

    return matches.sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return b.score - a.score;
    })[0] || null;
}

function getNameOriginCombination(result = currentBuildResult) {
    const raw = getNameOriginRawCombination(result);
    const givenName = getNameOriginDirectGivenNameValue(result) || raw.map(getNameOriginKanjiValue).filter(Boolean).join('');
    if (!givenName) return raw;

    const hasCompositeRawPart = raw.some((part) => Array.from(getNameOriginKanjiValue(part)).length > 1);
    if (hasCompositeRawPart) return raw;

    const chars = Array.from(givenName);
    const baseParts = raw.length === chars.length
        ? raw
        : chars.map((char) => ({ '漢字': char }));
    if (baseParts.length !== chars.length) return raw;

    const offsets = [];
    let unitOffset = 0;
    chars.forEach((char) => {
        offsets.push(unitOffset);
        unitOffset += char.length;
    });

    const merged = [];
    for (let index = 0; index < chars.length;) {
        const match = getNameOriginCompoundMatchAt(
            givenName,
            getNameOriginGivenReading(result),
            index,
            offsets[index] || 0
        );
        if (match) {
            const sourceParts = baseParts.slice(index, index + match.length);
            merged.push({
                ...match.entry,
                '漢字': match.kanji,
                '意味': match.entry?.['意味'] || match.entry?.meaning || '',
                compoundReading: match.reading,
                _compoundOrigin: true,
                sourceParts
            });
            index += match.length;
            continue;
        }

        merged.push(baseParts[index]);
        index += 1;
    }

    return merged;
}

function getNameOriginCombinationKey(result = currentBuildResult) {
    return getNameOriginCombination(result).map(getNameOriginKanjiValue).filter(Boolean).join('');
}

function getNameOriginGivenName(result = currentBuildResult) {
    const direct = getNameOriginDirectGivenNameValue(result);
    if (direct) return direct;
    const combo = getNameOriginCombinationKey(result);
    if (combo) return combo;
    return '';
}

function getNameOriginGivenReading(result = currentBuildResult) {
    const direct = String(result?.givenReading || result?.givenNameReading || '').trim();
    if (direct) return direct;
    const reading = String(result?.reading || '').trim();
    const parts = reading.split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : reading;
}

function getNameOriginCacheKey(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const combinationKey = getNameOriginCombinationKey(result) || givenName;
    if (!givenName && !combinationKey) return '';
    return [
        NAME_ORIGIN_PROMPT_VERSION,
        encodeURIComponent(givenName),
        encodeURIComponent(givenReading || ''),
        encodeURIComponent(combinationKey)
    ].join('__');
}

function getNameOriginResetKey(result = currentBuildResult) {
    const cacheKey = getNameOriginCacheKey(result);
    return cacheKey ? `meimay_name_origin_reset_${cacheKey}` : '';
}

function markNameOriginCacheReset(result = currentBuildResult) {
    const key = getNameOriginResetKey(result);
    if (!key) return false;
    try {
        localStorage.setItem(key, String(Date.now()));
        return true;
    } catch (error) {
        return false;
    }
}

function clearNameOriginCacheReset(result = currentBuildResult) {
    const key = getNameOriginResetKey(result);
    if (!key) return false;
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}

function hasNameOriginCacheReset(result = currentBuildResult) {
    const key = getNameOriginResetKey(result);
    if (!key) return false;
    try {
        return !!localStorage.getItem(key);
    } catch (error) {
        return false;
    }
}

function readNameOriginCacheMap() {
    try {
        const raw = localStorage.getItem(NAME_ORIGIN_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function getCachedNameOriginEntry(result = currentBuildResult) {
    const key = getNameOriginCacheKey(result);
    if (!key) return null;
    if (hasNameOriginCacheReset(result)) return null;
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.getNameOriginCache === 'function') {
        return StorageBox.getNameOriginCache(key);
    }
    const cache = readNameOriginCacheMap();
    return cache[key] || null;
}

function saveNameOriginCache(result, text) {
    const key = getNameOriginCacheKey(result);
    const cleanText = normalizeNameOriginText(text);
    if (!key || !cleanText) return false;
    clearNameOriginCacheReset(result);
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveNameOriginCache === 'function') {
        StorageBox.saveNameOriginCache(key, cleanText);
        return true;
    }
    try {
        const cache = readNameOriginCacheMap();
        cache[key] = {
            text: cleanText,
            promptVersion: NAME_ORIGIN_PROMPT_VERSION,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(NAME_ORIGIN_CACHE_KEY, JSON.stringify(cache));
        return true;
    } catch (error) {
        return false;
    }
}

function removeNameOriginCache(result = currentBuildResult) {
    const key = getNameOriginCacheKey(result);
    if (!key) return false;
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.removeNameOriginCache === 'function') {
        return StorageBox.removeNameOriginCache(key);
    }
    try {
        const cache = readNameOriginCacheMap();
        delete cache[key];
        localStorage.setItem(NAME_ORIGIN_CACHE_KEY, JSON.stringify(cache));
        return true;
    } catch (error) {
        return false;
    }
}

async function callNameOriginCacheApi(payload, options = {}) {
    let headers = { 'Content-Type': 'application/json' };
    if (options.auth !== false && typeof getFirebaseRequestHeaders === 'function') {
        headers = await getFirebaseRequestHeaders();
    }
    if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(getMeimayApiUrl(NAME_ORIGIN_CACHE_API_PATH), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
        const error = new Error(data.details || data.error || `Name origin cache API returned ${response.status}`);
        error.code = data.error || data.code || 'name_origin_cache_api_failed';
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function consumeDailyNameOriginUseForGeneration() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) {
        return { ok: true, consumed: false, premium: true, source: 'local-premium' };
    }

    try {
        const data = await callNameOriginCacheApi({ action: 'consumeDaily' });
        return { ok: true, consumed: data?.consumed === true, premium: data?.premium === true, source: 'cloud' };
    } catch (error) {
        if (Number(error.status) === 429 || error.code === 'daily_limit_exceeded') {
            return { ok: false, limit: true, source: 'cloud' };
        }
        console.warn('NAME_ORIGIN_DAILY: cloud consume failed, falling back to local counter', error);
    }

    if (!consumeDailyNameOriginUse()) {
        return { ok: false, limit: true, source: 'local' };
    }
    return { ok: true, consumed: true, premium: false, source: 'local' };
}

async function refundDailyNameOriginUseForGeneration(consumption) {
    if (!consumption || !consumption.consumed || consumption.premium) return;

    if (consumption.source === 'cloud') {
        try {
            await callNameOriginCacheApi({ action: 'refundDaily' });
            return;
        } catch (error) {
            console.warn('NAME_ORIGIN_DAILY: cloud refund failed', error);
        }
    }

    refundDailyNameOriginUse();
}

function getNameOriginStoredTextForItem(item) {
    const direct = normalizeNameOriginText(item?.origin);
    if (direct) return direct;
    const cached = getCachedNameOriginEntry(item);
    return normalizeNameOriginText(cached?.text);
}

function getNameOriginDisplayTextForItem(item) {
    const storedText = getNameOriginStoredTextForItem(item);
    return storedText ? buildNameOriginCopyText(item, storedText) : '';
}

function isSameNameOriginTarget(a, b) {
    const keyA = getNameOriginCacheKey(a);
    const keyB = getNameOriginCacheKey(b);
    return !!keyA && keyA === keyB;
}

function persistNameOriginToSavedItems(target, originText, options = {}) {
    if (typeof savedNames === 'undefined' || !Array.isArray(savedNames)) return false;
    const cleanText = normalizeNameOriginText(originText);
    if (!cleanText) return false;

    let changed = false;
    if (options.source === 'own' && Number.isInteger(options.savedIndex) && savedNames[options.savedIndex]) {
        savedNames[options.savedIndex] = { ...savedNames[options.savedIndex], origin: cleanText };
        changed = true;
    } else {
        savedNames = savedNames.map(item => {
            if (!isSameNameOriginTarget(item, target)) return item;
            changed = true;
            return { ...item, origin: cleanText };
        });
    }

    if (changed) {
        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveSavedNames === 'function') {
            StorageBox.saveSavedNames();
        } else {
            localStorage.setItem('meimay_saved', JSON.stringify(savedNames));
            localStorage.removeItem('meimay_saved_cleared_at');
        }
        if (typeof persistActiveChildWorkspaceSnapshot === 'function') {
            persistActiveChildWorkspaceSnapshot('name-origin-update');
        }
    }
    return changed;
}

function clearPersistedNameOrigin(target, options = {}) {
    removeNameOriginCache(target);
    markNameOriginCacheReset(target);
    if (target) target.origin = '';
    if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
        currentBuildResult.origin = '';
    }

    let changed = false;
    if (typeof savedNames !== 'undefined' && Array.isArray(savedNames)) {
        if (options.source === 'own' && Number.isInteger(options.savedIndex) && savedNames[options.savedIndex]) {
            savedNames[options.savedIndex] = { ...savedNames[options.savedIndex], origin: '' };
            changed = true;
        } else {
            savedNames = savedNames.map(item => {
                if (!isSameNameOriginTarget(item, target) || !item?.origin) return item;
                changed = true;
                return { ...item, origin: '' };
            });
        }
    }

    if (changed) {
        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveSavedNames === 'function') {
            StorageBox.saveSavedNames();
        } else {
            localStorage.setItem('meimay_saved', JSON.stringify(savedNames));
        }
        if (typeof persistActiveChildWorkspaceSnapshot === 'function') {
            persistActiveChildWorkspaceSnapshot('name-origin-clear');
        }
    }
    if (typeof syncBuildSaveButton === 'function') {
        syncBuildSaveButton(!!(currentBuildResult && currentBuildResult.fullName));
    }
    return true;
}

function findNameOriginSourceItem(part) {
    const kanji = getNameOriginKanjiValue(part);
    if (!kanji) return null;
    if (part && typeof part === 'object' && (part['意味'] || part.meaning)) return part;
    if (Array.from(kanji).length > 1 && Array.isArray(compoundReadingsData)) {
        const compoundItem = compoundReadingsData.find(item => getNameOriginKanjiValue(item) === kanji);
        if (compoundItem) return compoundItem;
    }
    if (typeof liked !== 'undefined' && Array.isArray(liked)) {
        const likedItem = liked.find(item => getNameOriginKanjiValue(item) === kanji);
        if (likedItem) return likedItem;
    }
    if (typeof master !== 'undefined' && Array.isArray(master)) {
        return master.find(item => getNameOriginKanjiValue(item) === kanji) || null;
    }
    return null;
}

function getNameOriginMeaning(part) {
    const source = findNameOriginSourceItem(part);
    const raw = source?.['意味'] || source?.meaning || part?.['意味'] || part?.meaning || '';
    const cleaned = typeof clean === 'function'
        ? clean(raw)
        : String(raw || '').replace(/\s+/g, ' ').trim();
    return cleaned || '名前に込めたい印象を持つ漢字';
}

function getNameOriginMeaningSummary(part) {
    const kanji = getNameOriginKanjiValue(part);
    if (kanji === '々') return '直前の漢字を重ねる記号。';
    const meaning = getNameOriginMeaning(part);
    const sentences = meaning
        .split('。')
        .map(text => text.trim())
        .filter(Boolean);
    return (sentences.length > 0 ? sentences.slice(0, 2).join('。') + '。' : meaning).trim();
}

function getNameOriginMeaningRows(result = currentBuildResult) {
    return getNameOriginCombination(result)
        .map((part) => {
            const kanji = getNameOriginKanjiValue(part);
            if (!kanji) return null;
            return {
                kanji,
                meaning: getNameOriginMeaningSummary(part)
            };
        })
        .filter(Boolean);
}

function findNameOriginMasterItemByKanji(kanji) {
    const value = String(kanji || '').trim();
    if (!value || typeof master === 'undefined' || !Array.isArray(master)) return null;
    return master.find(item => getNameOriginKanjiValue(item) === value) || null;
}

function getNameOriginCharacterParts(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const chars = Array.from(givenName || '').filter(Boolean);
    const raw = getNameOriginRawCombination(result);
    return chars.map((char, index) => {
        const rawPart = raw[index];
        const rawKanji = getNameOriginKanjiValue(rawPart);
        const source = rawKanji === char ? rawPart : findNameOriginMasterItemByKanji(char);
        return {
            kanji: char,
            source: source || { '漢字': char }
        };
    });
}

function getNameOriginLocalCheckText(result = currentBuildResult) {
    const checks = [];
    const givenName = getNameOriginGivenName(result);
    const chars = getNameOriginCharacterParts(result);
    const kanjiChars = chars.map(item => item.kanji);

    Object.entries(NAME_ORIGIN_HARD_COMPOUND_NOTES).forEach(([compound, note]) => {
        if (givenName.includes(compound)) checks.push(note);
    });

    const compoundParts = getNameOriginCombination(result)
        .map(part => getNameOriginKanjiValue(part))
        .filter(kanji => Array.from(kanji).length > 1);
    if (compoundParts.length > 0 && !checks.some(text => text.includes('熟字訓'))) {
        checks.push('まとめ読みを含むため、初見では読み方を確認される可能性があります。');
    }

    const adjacentSplit = kanjiChars.some((char, index) =>
        index > 0 &&
        NAME_ORIGIN_LEFT_RIGHT_KANJI.has(char) &&
        NAME_ORIGIN_LEFT_RIGHT_KANJI.has(kanjiChars[index - 1])
    );
    if (adjacentSplit) {
        checks.push('左右に分かれる形の漢字が続くため、縦書きでは少し割れて見える場合があります。');
    }

    const radicalGroup = NAME_ORIGIN_VISIBLE_RADICAL_GROUPS.find(group =>
        kanjiChars.filter(char => group.set.has(char)).length >= 2
    );
    if (radicalGroup) {
        checks.push(`${radicalGroup.label}の字が重なるため、統一感がある一方で見た目の偏りも確認すると安心です。`);
    }

    const specialFormChars = chars
        .filter(item => /旧字体|異体字|別体|大字/.test(String(item.source?.['字形種別'] || '')))
        .map(item => item.kanji);
    if (specialFormChars.length > 0) {
        checks.push(`${specialFormChars.join('・')}は字形の確認が必要なため、届出や説明時の表記も見ておくと安心です。`);
    }

    const highStrokeChars = chars
        .filter(item => Number(item.source?.['画数'] || 0) >= 18)
        .map(item => item.kanji);
    if (highStrokeChars.length > 0) {
        checks.push(`${highStrokeChars.join('・')}は画数が多めなので、手書きしたときの重さも確認しておくと安心です。`);
    }

    return checks.slice(0, 2).join('\n');
}

function normalizeNameOriginSectionValue(value, maxLength = 90) {
    const text = normalizeNameOriginText(Array.isArray(value) ? value.join('、') : value)
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength).replace(/[、。,.，\s]+$/g, '') + '。' : text;
}

function extractNameOriginJsonText(text) {
    const raw = normalizeNameOriginText(text);
    if (!raw) return '';
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) return fenced[1].trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    return start >= 0 && end > start ? raw.slice(start, end + 1) : '';
}

function parseNameOriginStructuredText(text) {
    const jsonText = extractNameOriginJsonText(text);
    if (jsonText) {
        try {
            const parsed = JSON.parse(jsonText);
            const model = {
                decision: normalizeNameOriginSectionValue(parsed.decision || parsed['この名前の決め手'] || parsed['決め手']),
                wish: normalizeNameOriginSectionValue(parsed.wish || parsed['パパママからの願い'] || parsed['願い']),
                sound: normalizeNameOriginSectionValue(parsed.sound || parsed['呼んだときの印象'] || parsed['響き']),
                familyLine: normalizeNameOriginSectionValue(parsed.familyLine || parsed.family || parsed['家族に伝える一言'] || parsed['説明']),
                check: normalizeNameOriginSectionValue(parsed.check || parsed.caution || parsed['確認しておきたいこと'] || parsed['気になる点'] || parsed['注意点'], 120)
            };
            return Object.values(model).some(Boolean) ? model : null;
        } catch (error) {
            return null;
        }
    }

    const raw = normalizeNameOriginText(text);
    if (!raw) return null;
    const sectionPatterns = {
        decision: /(?:この名前の決め手|決め手)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:パパママからの願い|願い|漢字|呼んだときの印象|響き|家族に伝える一言|確認しておきたいこと)[:：\n]|$)/,
        wish: /(?:パパママからの願い|願い)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:漢字|呼んだときの印象|響き|家族に伝える一言|確認しておきたいこと)[:：\n]|$)/,
        sound: /(?:呼んだときの印象|響きの印象|響き)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:家族に伝える一言|確認しておきたいこと)[:：\n]|$)/,
        familyLine: /(?:家族に伝える一言|家族に伝えるなら|説明するなら)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:確認しておきたいこと|気になる点|注意点)[:：\n]|$)/,
        check: /(?:確認しておきたいこと|気になる点|注意点)[:：\n]\s*([\s\S]*?)$/
    };
    const model = {};
    Object.entries(sectionPatterns).forEach(([key, pattern]) => {
        const match = raw.match(pattern);
        model[key] = normalizeNameOriginSectionValue(match?.[1] || '');
    });
    return Object.values(model).some(Boolean) ? model : null;
}

function repairNameOriginQuoteText(text, result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    let repaired = normalizeNameOriginText(text);
    if (givenName && repaired.startsWith(`${givenName}」`)) {
        repaired = `「${repaired}`;
    }
    return repaired;
}

function buildFallbackNameOriginModel(result = currentBuildResult, text = '') {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const rows = getNameOriginMeaningRows(result);
    const firstMeaning = rows[0]?.meaning.replace(/。$/, '') || '漢字の意味';
    const secondMeaning = rows[1]?.meaning.replace(/。$/, '') || '';
    const legacy = repairNameOriginQuoteText(text, result);

    if (legacy) {
        return {
            decision: normalizeNameOriginSectionValue(legacy, 120),
            wish: '',
            sound: givenReading ? `「${givenReading}」は、落ち着いて呼びやすい響きです。` : '',
            familyLine: givenName ? `「${givenName}」には、漢字の意味を大切にした願いを込めました。` : '',
            check: getNameOriginLocalCheckText(result)
        };
    }

    return {
        decision: `${givenName}は、${firstMeaning}${secondMeaning ? `と、${secondMeaning}` : ''}を重ねた名前です。`,
        wish: '人にやさしく、自分らしさを大切にしながら歩んでほしいという願いを込められます。',
        sound: givenReading ? `「${givenReading}」は、やさしく落ち着いた印象で、日常でも呼びやすい響きです。` : '',
        familyLine: givenName ? `「${givenName}」には、漢字の意味を大切にした願いを込めました。` : '',
        check: getNameOriginLocalCheckText(result)
    };
}

function mergeNameOriginCheckText(aiCheck, localCheck) {
    const lines = [];
    [aiCheck, localCheck].forEach((value) => {
        normalizeNameOriginText(value)
            .split(/\n+/)
            .map(line => normalizeNameOriginSectionValue(line, 120))
            .filter(Boolean)
            .forEach((line) => {
                if (!lines.includes(line)) lines.push(line);
            });
    });
    return lines.slice(0, 2).join('\n');
}

function getNameOriginStructuredModel(result = currentBuildResult, text = '') {
    const parsed = parseNameOriginStructuredText(text);
    const fallback = buildFallbackNameOriginModel(result, parsed ? '' : text);
    const localCheck = getNameOriginLocalCheckText(result);
    return {
        decision: normalizeNameOriginSectionValue(parsed?.decision || fallback.decision),
        wish: normalizeNameOriginSectionValue(parsed?.wish || fallback.wish),
        sound: normalizeNameOriginSectionValue(parsed?.sound || fallback.sound),
        familyLine: normalizeNameOriginSectionValue(parsed?.familyLine || fallback.familyLine),
        check: mergeNameOriginCheckText(parsed?.check || fallback.check, localCheck),
        meanings: getNameOriginMeaningRows(result)
    };
}

function buildNameOriginCopyText(result = currentBuildResult, text = '') {
    const model = getNameOriginStructuredModel(result, text);
    const blocks = [];
    if (model.decision) blocks.push(`この名前の決め手\n${model.decision}`);
    if (model.wish) blocks.push(`パパママからの願い\n${model.wish}`);
    if (model.meanings.length > 0) {
        blocks.push(`漢字に込めた意味\n${model.meanings.map(row => `${row.kanji}：${row.meaning}`).join('\n')}`);
    }
    if (model.sound) blocks.push(`呼んだときの印象\n${model.sound}`);
    if (model.familyLine) blocks.push(`家族に伝える一言\n${model.familyLine}`);
    if (model.check) blocks.push(`確認しておきたいこと\n${model.check}`);
    return blocks.join('\n\n').trim();
}

function stringifyNameOriginModel(model) {
    return JSON.stringify({
        decision: model.decision || '',
        wish: model.wish || '',
        sound: model.sound || '',
        familyLine: model.familyLine || '',
        check: model.check || ''
    }, null, 2);
}

function buildNameOriginPrompt(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const localCheck = getNameOriginLocalCheckText(result);
    const originDetails = getNameOriginCombination(result).map((part) => {
        const kanji = getNameOriginKanjiValue(part);
        const meaning = kanji === '々'
            ? '直前の漢字を重ねる記号。前の字の印象を重ねて響かせる。'
            : getNameOriginMeaning(part);
        return { kanji, meaning };
    }).filter(item => item.kanji && item.meaning);
    const originDataText = JSON.stringify(originDetails);

    return `
名前「${givenName}」（読み: ${givenReading || '未指定'}）について、親が名前を決める材料になる短い由来案を作成してください。

【出力ルール】
・出力はJSONだけにする。前置き、見出し、Markdown、コードブロックは不要。
・キーは必ず "decision", "wish", "sound", "familyLine", "check" の5つだけにする。
・すべてJSON文字列で出力する。末尾カンマは付けない。
・JSON文字列の中に改行を入れない。
・checkが空文字の場合を除き、各項目は40〜75字程度にする。
・長い一段落にしない。読みやすい短文にし、読点を入れすぎない。
・decision、wish、familyLine は同じ内容を繰り返さない。

【各項目の役割】
・decision：この名前を選ぶ後押しになる「決め手」を短く書く。
・wish：漢字データの意味を出発点にし、親が込められる願いを自然な名付けの言葉で書く。
・sound：読み「${givenReading || '未指定'}」の響きにだけ軽く触れる。漢字の意味は書かない。
・familyLine：家族や祖父母にそのまま説明できる一文にする。
・check：確認材料に基づき、親が確認するとよい点だけをやさしく書く。気になる点がなければ空文字にする。

【書き分け】
・decision は「この名前を選びたくなる理由」を書く。
・wish は「親が子どもに込める願い」を書く。
・familyLine は「家族に説明するときの一文」として書く。
・3項目で同じ表現や同じ結論を繰り返さない。

【根拠とAI補助の使い方】
・漢字の意味そのものは漢字データを主根拠にする。
・decision、wish、familyLine では、漢字データをもとにAIの一般的な日本語感覚・名付け文としての表現力を使ってよい。
・ただし、漢字データにない意味を「漢字の意味」として足さない。
・sound は、読み「${givenReading || '未指定'}」の音の印象だけを根拠にする。
・check は原則として空文字でよい。明確な確認ポイントがある場合だけ書く。
・check は確認材料を優先する。
・AIが一般的な読みづらさ、別読み、字形上の注意を明確に判断できる場合だけ補足してよい。
・ただし、一般語として別の読みが強い熟字訓への言及は、確認材料に記載がある場合のみ行う。
・漢字データや確認材料にない縁起、故事、ことわざ、宗教的な断定、将来の保証を書かない。
・根拠が足りない場合は無理に補わず、控えめに書く。

【表現ルール】
・親が家族にそのまま話せる自然な言葉にする。
・「〜になるでしょう」「必ず〜」のように将来を断定しない。
・「人生という舞台」「自分にしか果たせない役割」「道しるべ」「未来を切り開く」「温かく照らす」「輝く未来」のような抽象的でテンプレート感のある表現は使わない。
・名前をかぎ括弧で書く場合は、必ず「${givenName}」のように開き括弧から書く。
・名字、名字との相性、架空の故事・ことわざ・人物・有名人には触れない。
・読みの響きは sound 以外では触れない。
・sound では、性別らしさ、流行、人気、年代感を断定しない。
・checkでは欠点のように強く言わず、「確認しておくと安心です」のようにやさしく書く。
・「心太」「海月」のように一般語として別の読みが強い熟字訓は、確認材料に記載がある場合のみ、初見で読み方を迷われる可能性に触れる。

【JSON形式】
{"decision":"","wish":"","sound":"","familyLine":"","check":""}

【漢字データ】
${originDataText}

【確認材料】
${localCheck || ''}
`.trim();
}

async function generateOrigin(options = {}) {
    if (nameOriginGenerationInFlight) return;

    const target = options.result || currentBuildResult;
    const givenName = getNameOriginGivenName(target);
    const combination = getNameOriginCombination(target);
    if (!target || !givenName || combination.length === 0) {
        alert('名前が決定されていません');
        return;
    }

    const cachedText = getNameOriginStoredTextForItem(target);
    if (cachedText && !options.force) {
        target.origin = cachedText;
        if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
            currentBuildResult.origin = cachedText;
        }
        saveNameOriginCache(target, cachedText);
        persistNameOriginToSavedItems(target, cachedText, options);
        renderAIOriginResult(target, cachedText, false, options);
        if (typeof syncBuildSaveButton === 'function') syncBuildSaveButton(true);
        return;
    }

    const consumption = await consumeDailyNameOriginUseForGeneration();
    if (!consumption.ok) {
        if (typeof showToast === 'function') showToast('今日の無料AI由来は使い切りました', '🌙');
        else alert('今日の無料AI由来は使い切りました');
        if (typeof syncBuildSaveButton === 'function') syncBuildSaveButton(true);
        return;
    }

    const modal = document.getElementById('modal-origin');
    if (!modal) {
        console.error("ORIGIN: modal-origin not found");
        await refundDailyNameOriginUseForGeneration(consumption);
        return;
    }

    nameOriginGenerationInFlight = true;
    renderNameOriginLoading(target);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(getMeimayApiUrl('/api/gemini'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: buildNameOriginPrompt(target) }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMsg = `API Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.error) errorMsg += `\n${errData.error}`;
                if (errData.details) errorMsg += `\n${errData.details}`;
            } catch (parseError) { }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const aiText = normalizeNameOriginText(data.text);
        if (!aiText) throw new Error('由来文を取得できませんでした。');

        target.origin = aiText;
        if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
            currentBuildResult.origin = aiText;
        }
        saveNameOriginCache(target, aiText);
        persistNameOriginToSavedItems(target, aiText, options);
        renderAIOriginResult(target, aiText, false, options);
    } catch (err) {
        await refundDailyNameOriginUseForGeneration(consumption);
        console.warn("AI_NAME_ORIGIN_FAILURE:", err);
        const fallbackText = generateFallbackOrigin(givenName, combination);
        renderAIOriginResult(target, fallbackText, true, options);
        if (typeof showToast === 'function') showToast('AI由来を作れませんでした', '!');
    } finally {
        nameOriginGenerationInFlight = false;
        if (typeof syncBuildSaveButton === 'function') syncBuildSaveButton(!!(currentBuildResult && currentBuildResult.fullName));
    }
}

function generateFallbackOrigin(givenName, combination) {
    return stringifyNameOriginModel(buildFallbackNameOriginModel({
        givenName,
        combination
    }));
}

function renderNameOriginLoading(result = currentBuildResult) {
    const modal = document.getElementById('modal-origin');
    if (!modal) return;
    const givenReading = escapeHtml(getNameOriginGivenReading(result));
    modal.classList.add('active', 'modal-overlay-dark');
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in name-origin-sheet">
            <div class="flex flex-col items-center text-center">
                <div class="name-origin-eyebrow">名前に込める願い</div>
                ${renderNameOriginHeaderCards(result, { disabled: true })}
                ${givenReading ? `<div class="name-origin-reading">${givenReading}</div>` : ''}
                <div class="name-origin-loading-mark" aria-hidden="true"></div>
                <p class="name-origin-loading-text">漢字の意味をつないでいます。</p>
            </div>
        </div>
    `;
}

function escapeNameOriginHtml(text) {
    return escapeHtml(normalizeNameOriginText(text));
}

const NAME_ORIGIN_SECTION_META = {
    'この名前の決め手': { icon: '🌱', label: '決め手' },
    'パパママからの願い': { icon: '💛', label: '願い' },
    '漢字に込めた意味': { icon: '💡', label: '漢字の意味' },
    '呼んだときの印象': { icon: '🔊', label: '響き' },
    '家族に伝える一言': { icon: '🏠', label: '伝える一言' },
    '確認しておきたいこと': { icon: '🫧', label: '確認' }
};

function renderNameOriginHeaderCards(result = currentBuildResult, options = {}) {
    const parts = getNameOriginCharacterParts(result);
    if (parts.length === 0) {
        const givenName = escapeNameOriginHtml(getNameOriginGivenName(result));
        return `<div class="name-origin-title">${givenName}</div>`;
    }

    const disabled = options.disabled === true;
    const cards = parts.map((part, index) => {
        const kanji = escapeNameOriginHtml(part.kanji);
        const attrs = disabled
            ? 'disabled aria-disabled="true"'
            : `onclick="openNameOriginKanjiDetail(${index})" aria-label="${kanji}の漢字詳細を見る"`;
        return `
            <button type="button" class="name-origin-title-card" ${attrs}>
                <span>${kanji}</span>
            </button>
        `;
    }).join('');
    return `<div class="name-origin-title-grid">${cards}</div>`;
}

function renderNameOriginSection(title, body) {
    const safeBody = normalizeNameOriginText(body);
    if (!safeBody) return '';
    const meta = NAME_ORIGIN_SECTION_META[title] || { icon: '✨', label: title };
    return `
        <section class="name-origin-section">
            <h4 class="name-origin-section-title">
                <span class="name-origin-section-icon" aria-hidden="true">${escapeNameOriginHtml(meta.icon)}</span>
                <span>${escapeNameOriginHtml(meta.label)}</span>
            </h4>
            <p class="name-origin-section-text">${escapeNameOriginHtml(safeBody)}</p>
        </section>
    `;
}

function renderNameOriginMeaningSection(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const meta = NAME_ORIGIN_SECTION_META['漢字に込めた意味'];
    return `
        <section class="name-origin-section">
            <h4 class="name-origin-section-title">
                <span class="name-origin-section-icon" aria-hidden="true">${escapeNameOriginHtml(meta.icon)}</span>
                <span>${escapeNameOriginHtml(meta.label)}</span>
            </h4>
            <dl class="name-origin-meaning-list">
                ${rows.map(row => `
                    <div class="name-origin-meaning-row">
                        <dt class="name-origin-meaning-kanji">${escapeNameOriginHtml(row.kanji)}</dt>
                        <dd class="name-origin-meaning-text">${escapeNameOriginHtml(row.meaning)}</dd>
                    </div>
                `).join('')}
            </dl>
        </section>
    `;
}

function renderNameOriginStructuredBody(result, text) {
    const model = getNameOriginStructuredModel(result, text);
    return `
        <div id="name-origin-text" class="name-origin-body">
            ${renderNameOriginSection('この名前の決め手', model.decision)}
            ${renderNameOriginSection('パパママからの願い', model.wish)}
            ${renderNameOriginMeaningSection(model.meanings)}
            ${renderNameOriginSection('呼んだときの印象', model.sound)}
            ${renderNameOriginSection('家族に伝える一言', model.familyLine)}
            ${renderNameOriginSection('確認しておきたいこと', model.check)}
        </div>
    `;
}

function renderAIOriginResult(resultOrName, text, isFallback = false, options = {}) {
    const modal = document.getElementById('modal-origin');
    if (!modal) return;
    const result = typeof resultOrName === 'string'
        ? { givenName: resultOrName, reading: '', combination: [] }
        : (resultOrName || currentBuildResult);
    const givenReading = escapeHtml(getNameOriginGivenReading(result));
    currentNameOriginRenderTarget = result;
    currentNameOriginRenderOptions = { ...options };
    modal.classList.add('active', 'modal-overlay-dark');
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in name-origin-sheet">
            <div class="name-origin-header">
                <div class="name-origin-eyebrow">${isFallback ? '由来案' : '名前に込める願い'}</div>
                ${renderNameOriginHeaderCards(result)}
                ${givenReading ? `<div class="name-origin-reading">${givenReading}</div>` : ''}
            </div>
            <div class="name-origin-card">
                ${renderNameOriginStructuredBody(result, text)}
            </div>
            ${isFallback ? `
                <p class="name-origin-note">
                    AIサービスに接続できなかったため、端末内の情報で下書きを表示しています。
                </p>
            ` : ''}
            <div class="name-origin-actions">
                <button onclick="copyOriginToClipboard()" class="name-origin-primary-action">由来をコピー</button>
                <button onclick="regenerateCurrentNameOrigin()" class="name-origin-secondary-action">もう一度生成</button>
            </div>
            <button onclick="closeOriginModal()" class="name-origin-close-action">閉じる</button>
        </div>
    `;
}

function openNameOriginKanjiDetail(index) {
    const target = currentNameOriginRenderTarget || currentBuildResult;
    const parts = getNameOriginCharacterParts(target);
    const part = parts[index];
    if (!part || !part.kanji) return;

    const data = findNameOriginMasterItemByKanji(part.kanji) || part.source || { '漢字': part.kanji };
    if (data && typeof showKanjiDetail === 'function') {
        showKanjiDetail(data);
    } else if (data && typeof showDetailByData === 'function') {
        showDetailByData(data);
    }
}

function closeOriginModal() {
    const m = document.getElementById('modal-origin');
    if (m) {
        m.classList.remove('active');
        m.innerHTML = '';
    }
    currentNameOriginRenderTarget = null;
    currentNameOriginRenderOptions = {};
}

async function regenerateCurrentNameOrigin() {
    const target = currentNameOriginRenderTarget || currentBuildResult;
    if (!target || !getNameOriginGivenName(target)) return;
    removeNameOriginCache(target);
    markNameOriginCacheReset(target);
    target.origin = '';
    if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
        currentBuildResult.origin = '';
    }
    await generateOrigin({
        ...currentNameOriginRenderOptions,
        result: target,
        force: true
    });
}

function copyOriginToClipboard() {
    const p = document.getElementById('name-origin-text');
    if (!p) return;
    navigator.clipboard.writeText(p.innerText.trim()).then(() => {
        if (typeof showToast === 'function') showToast('由来をコピーしました', '✓');
        else alert("由来をコピーしました。");
    });
}

function getNameOriginSavedItem(index, source = 'own') {
    const pairInsights = typeof window.MeimayPartnerInsights !== 'undefined' ? window.MeimayPartnerInsights : null;
    const ownSaved = typeof getSavedNames === 'function'
        ? getSavedNames()
        : (Array.isArray(savedNames) ? savedNames : []);
    const partnerSaved = pairInsights?.getPartnerSaved ? pairInsights.getPartnerSaved() : [];
    const sourceSaved = source === 'partner' ? partnerSaved : ownSaved;
    return sourceSaved[index] || null;
}

async function generateOriginFromSaved(index, source = 'own') {
    const item = getNameOriginSavedItem(index, source);
    if (!item) return;
    currentBuildResult = JSON.parse(JSON.stringify(item));
    closeSavedNameDetail();
    await generateOrigin({
        result: currentBuildResult,
        savedIndex: index,
        source
    });
}

function clearNameOriginFromSaved(index, source = 'own') {
    const item = getNameOriginSavedItem(index, source);
    if (!item) return false;
    clearPersistedNameOrigin(item, {
        savedIndex: index,
        source
    });
    if (typeof showToast === 'function') showToast('由来キャッシュをクリアしました', '✓');
    return true;
}

function clearCurrentBuildNameOrigin() {
    if (!currentBuildResult || !getNameOriginGivenName(currentBuildResult)) return false;
    clearPersistedNameOrigin(currentBuildResult);
    if (typeof showToast === 'function') showToast('由来キャッシュをクリアしました', '✓');
    return true;
}

function attachNameOriginLongPress(button, getTarget) {
    if (!button || button._meimayNameOriginLongPressAttached) return;
    button._meimayNameOriginLongPressAttached = true;
    let longPressTimer = null;
    let longPressTriggered = false;

    const clearTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    const startLongPress = () => {
        clearTimer();
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            const target = typeof getTarget === 'function' ? getTarget() : {};
            if (target?.savedIndex != null) {
                clearNameOriginFromSaved(target.savedIndex, target.source || 'own');
            } else {
                clearCurrentBuildNameOrigin();
            }
        }, 5000);
    };

    button.addEventListener('mousedown', startLongPress);
    button.addEventListener('touchstart', startLongPress, { passive: true });
    button.addEventListener('mouseup', clearTimer);
    button.addEventListener('mouseleave', clearTimer);
    button.addEventListener('touchend', clearTimer);
    button.addEventListener('touchcancel', clearTimer);
    button.addEventListener('click', (event) => {
        if (!longPressTriggered) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressTriggered = false;
    }, true);
}

function bindBuildNameOriginLongPress() {
    const button = document.getElementById('build-origin-btn');
    attachNameOriginLongPress(button, () => ({ result: currentBuildResult }));
}

function attachSavedNameOriginLongPress(index, source = 'own') {
    const button = document.getElementById('saved-origin-btn');
    attachNameOriginLongPress(button, () => ({ savedIndex: index, source }));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBuildNameOriginLongPress);
} else {
    bindBuildNameOriginLongPress();
}

/**
 * 漢字詳細AIを生成（成り立ち・意味・熟語・名乗り理由）
 */
/**
 * AI漢字詳細テキストをパースしてDOMに描画し、再出力ボタンを追加する
 */
function isSpecialKanjiAiReading(reading) {
    return !reading || ['FREE', 'SEARCH', 'RANKING', 'SHARED'].includes(reading);
}

const DAILY_KANJI_DETAIL_LIMIT = 1;

function _getDailyKanjiDetailKey() {
    const d = new Date();
    return `meimay_daily_kanji_detail_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function getDailyKanjiDetailUseCount() {
    try {
        const raw = localStorage.getItem(_getDailyKanjiDetailKey());
        const count = Number(raw || 0);
        return Number.isFinite(count) && count > 0 ? count : 0;
    } catch (error) {
        return 0;
    }
}

function canUseDailyKanjiDetailAI() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return true;
    return getDailyKanjiDetailUseCount() < DAILY_KANJI_DETAIL_LIMIT;
}

function consumeDailyKanjiDetailUse() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return true;
    if (!canUseDailyKanjiDetailAI()) return false;
    try {
        localStorage.setItem(_getDailyKanjiDetailKey(), String(getDailyKanjiDetailUseCount() + 1));
        return true;
    } catch (error) {
        return false;
    }
}

function refundDailyKanjiDetailUse() {
    if (typeof isPremiumAccessActive === 'function' && isPremiumAccessActive()) return;
    try {
        const nextCount = Math.max(0, getDailyKanjiDetailUseCount() - 1);
        if (nextCount === 0) {
            localStorage.removeItem(_getDailyKanjiDetailKey());
        } else {
            localStorage.setItem(_getDailyKanjiDetailKey(), String(nextCount));
        }
    } catch (error) { }
}

function getStoredKanjiDetailAiText(kanji) {
    if (typeof StorageBox === 'undefined' || typeof StorageBox.getKanjiAiCache !== 'function') return '';
    const cached = StorageBox.getKanjiAiCache(kanji);
    return String(cached?.text || '').trim();
}

function sanitizeKanjiAiText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\*/g, '')
        .replace(/アプリ内辞書では/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getKanjiDetailResetKey(kanji, currentReading = '') {
    const encodedKanji = encodeURIComponent(String(kanji || ''));
    if (!currentReading || isSpecialKanjiAiReading(currentReading)) {
        return `kanji_detail_reset__${encodedKanji}`;
    }
    return `kanji_detail_reset__${encodedKanji}__${encodeURIComponent(String(currentReading || ''))}`;
}

function markKanjiDetailReset(kanji, currentReading) {
    try {
        localStorage.setItem(getKanjiDetailResetKey(kanji), String(Date.now()));
        if (!isSpecialKanjiAiReading(currentReading)) {
            localStorage.setItem(getKanjiDetailResetKey(kanji, currentReading), String(Date.now()));
        }
        return true;
    } catch (error) {
        console.warn('KANJI_DETAIL_RESET: local mark failed', error);
        return false;
    }
}

function clearKanjiDetailReset(kanji, currentReading) {
    try {
        localStorage.removeItem(getKanjiDetailResetKey(kanji));
        if (!isSpecialKanjiAiReading(currentReading)) {
            localStorage.removeItem(getKanjiDetailResetKey(kanji, currentReading));
        }
    } catch (error) {
        console.warn('KANJI_DETAIL_RESET: local clear failed', error);
    }
}

function hasKanjiDetailReset(kanji, currentReading) {
    try {
        if (localStorage.getItem(getKanjiDetailResetKey(kanji))) return true;
        if (!isSpecialKanjiAiReading(currentReading) && localStorage.getItem(getKanjiDetailResetKey(kanji, currentReading))) return true;
    } catch (error) {
        console.warn('KANJI_DETAIL_RESET: local read failed', error);
    }
    return false;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const KANJI_DETAIL_GROUNDED_HINTS = {
    '舵': {
        promptContext: '検証済みメモ: 「舵」は形声字として扱い、漢字構成は「舟」と「它」です。右側のつくりは「朶」でも「巴」でもありません。成り立ちの説明はこの検証済み情報から逸脱しないでください。',
        requiredKeywords: ['舟', '它']
    },
    '櫂': {
        promptContext: '検証済みメモ: 「櫂」は形声字として扱い、漢字構成は「木」と「翟」です。右側のつくりは「會」ではありません。成り立ちの説明はこの検証済み情報から逸脱しないでください。',
        requiredKeywords: ['木', '翟']
    }
};

const KANJI_DETAIL_CORE_SECTION_ORDER = ['成り立ち', '意味の深掘り', '代表的な熟語'];
const KANJI_DETAIL_CORE_SECTION_SET = new Set(KANJI_DETAIL_CORE_SECTION_ORDER);
const KANJI_DETAIL_SECTION_ICON_MAP = {
    '成り立ち': '🧬',
    '意味の深掘り': '💡',
    '代表的な熟語': '✨'
};

const KANJI_DETAIL_DATASET_URL = '/data/kanji_detail_dataset.json?v=25.22';
let kanjiDetailDatasetPromise = null;

function isKanjiCharacter(ch) {
    if (!ch) return false;
    const code = ch.codePointAt(0);
    return (
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0x4E00 && code <= 0x9FFF) ||
        code === 0x3005
    );
}

function appendRequiredHanCharacters(keywordSet, text) {
    for (const ch of Array.from(String(text || ''))) {
        if (isKanjiCharacter(ch)) keywordSet.add(ch);
    }
}

function getKanjiDetailDatasetSectionText(datasetEntry, title) {
    if (!datasetEntry || !Array.isArray(datasetEntry.sections)) return '';
    const section = datasetEntry.sections.find((item) => normalizeKanjiDetailTitle(item?.title) === title);
    return sanitizeKanjiAiText(section?.text || '');
}

function isLikelyRepresentativeIdiomWord(word) {
    const normalized = sanitizeKanjiAiText(word).replace(/[・\s]/g, '');
    if (!normalized) return false;

    const characters = Array.from(normalized);
    if (characters.length < 2 || characters.length > 3) return false;
    if (!characters.every((ch) => isKanjiCharacter(ch))) return false;
    if (/[。、！？]/.test(normalized)) return false;

    return true;
}

function normalizeRepresentativeIdiomSectionText(content) {
    return sanitizeKanjiAiText(content)
        .replace(/\r\n?/g, '\n')
        .replace(/[•●◇◆]/g, '\n')
        .replace(/[;；]/g, '\n')
        // 「・漢字（読み）：」パターン: 行中にある・の前で改行（行頭の・は行頭のまま）
        .replace(/([^\n])・(?=[\u4E00-\u9FFF\u3400-\u4DBF])/g, '$1\n・')
        // 句点の後に新しい熟語パターンが続く場合に改行を挿入
        .replace(/([。！？!?])(?=\s*[\u4E00-\u9FFF\u3400-\u4DBF]{1,4}（)/g, '$1\n')
        // 読点・カンマ・スラッシュの後に熟語パターンが続く場合に改行を挿入
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

function extractRepresentativeIdiomWord(line) {
    return sanitizeKanjiAiText(line)
        .replace(/^[・\-•●◇◆\d０-９]+[.)、．.]\s*/, '')
        .split(/[（(〔【:：\/／\s]/)[0]
        .trim();
}

function dedupeRepresentativeIdiomLines(lines, limit = 5) {
    const mergedLines = [];
    const seenWords = new Set();

    for (const rawLine of Array.isArray(lines) ? lines : []) {
        const line = sanitizeKanjiAiText(rawLine);
        if (!line) continue;

        const word = extractRepresentativeIdiomWord(line);
        const normalizedWord = sanitizeKanjiAiText(word).replace(/[・\s]/g, '');
        const key = normalizedWord || line;
        if (seenWords.has(key)) continue;

        seenWords.add(key);
        mergedLines.push(line);
        if (limit && mergedLines.length >= limit) break;
    }

    return mergedLines;
}

function collectRepresentativeIdiomFallbackLines(kanji, dataset) {
    const targetKanji = String(kanji || '').trim();
    if (!targetKanji) return [];

    const lines = [];
    const seenWords = new Set();

    for (const entry of Object.values(dataset || {})) {
        const sectionText = getKanjiDetailDatasetSectionText(entry, '代表的な熟語');
        if (!sectionText) continue;

        for (const rawLine of sectionText.split('\n')) {
            const line = sanitizeKanjiAiText(rawLine);
            if (!line) continue;

            const word = extractRepresentativeIdiomWord(line);
            const normalizedWord = sanitizeKanjiAiText(word).replace(/[・\s]/g, '');
            if (!normalizedWord) continue;
            if (!normalizedWord.includes(targetKanji)) continue;
            if (!isLikelyRepresentativeIdiomWord(normalizedWord)) continue;
            if (seenWords.has(normalizedWord)) continue;

            seenWords.add(normalizedWord);
            lines.push(line);
            if (lines.length >= 5) return lines;
        }
    }

    return lines;
}

function extractRequiredKeywordsFromOriginText(originText) {
    const keywordSet = new Set();
    const structureMatch = originText.match(/漢字構成は([^。]+?)と整理されています/);
    if (structureMatch) {
        appendRequiredHanCharacters(keywordSet, structureMatch[1].replace(/[\u2FF0-\u2FFF]/g, ''));
    }

    const soundMatches = originText.matchAll(/(?:声符|脚注では声符)は([^。]+?)とされます/g);
    for (const match of soundMatches) {
        appendRequiredHanCharacters(keywordSet, match[1]);
    }

    return Array.from(keywordSet);
}

async function loadKanjiDetailDataset() {
    if (!kanjiDetailDatasetPromise) {
        kanjiDetailDatasetPromise = fetch(KANJI_DETAIL_DATASET_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`dataset load failed: ${response.status}`);
                return response.json();
            })
            .catch((error) => {
                console.warn('KANJI_DETAIL_DATASET:', error);
                return {};
            });
    }
    return kanjiDetailDatasetPromise;
}

function buildDatasetGroundedHint(kanji, datasetEntry) {
    const originText = getKanjiDetailDatasetSectionText(datasetEntry, '成り立ち');
    if (!originText) return null;
    return {
        promptContext: `検証済みメモ: 「${kanji}」の成り立ちは次の情報に従ってください。${originText}`,
        requiredKeywords: extractRequiredKeywordsFromOriginText(originText)
    };
}

function getKanjiDetailGroundedHint(kanji, datasetEntry) {
    return KANJI_DETAIL_GROUNDED_HINTS[kanji] || buildDatasetGroundedHint(kanji, datasetEntry) || null;
}

function cachedKanjiDetailMatchesHint(text, groundedHint) {
    if (!groundedHint || !Array.isArray(groundedHint.requiredKeywords) || !groundedHint.requiredKeywords.length) {
        return true;
    }
    const normalizedText = sanitizeKanjiAiText(text);
    return groundedHint.requiredKeywords.every((keyword) => normalizedText.includes(keyword));
}

function normalizeKanjiDetailSectionMarkers(text) {
    return sanitizeKanjiAiText(text)
        .replace(/[［\[]/g, '【')
        .replace(/[］\]]/g, '】')
        .replace(/(^|\n)\s*[^\n【】]{0,12}【\s*(成り立ち|意味の深掘り|代表的な熟語)\s*(?=[\s　:：\-ー]|$)/g, '$1【$2】\n')
        .replace(/(^|\n)\s*[🧬💡✨📚🏷️⭐️★☆◆◇・\-\s]*(?:代表\s*)?【\s*(成り立ち|意味の深掘り|代表的な熟語)\s*】/g, '$1【$2】')
        .replace(/(^|\n)\s*[🧬💡✨📚🏷️⭐️★☆◆◇・\-\s]*(成り立ち|意味の深掘り|代表的な熟語)\s*[:：]\s*/g, '$1【$2】\n')
        .replace(/([^\n])(?=【(?:成り立ち|意味の深掘り|代表的な熟語|[^】\n]{1,28}由来)】)/g, '$1\n')
        .trim();
}

function mergeKanjiDetailSectionContent(title, primaryContent, nextContent) {
    const primary = sanitizeKanjiAiText(primaryContent);
    const next = sanitizeKanjiAiText(nextContent);
    if (!primary) return next;
    if (!next || primary === next) return primary;
    if (title === '代表的な熟語') return mergeRepresentativeIdiomSectionText(primary, next);
    if (KANJI_DETAIL_CORE_SECTION_SET.has(title)) return primary;
    return primary;
}

function extractKanjiDetailSectionList(aiText) {
    const normalizedText = normalizeKanjiDetailSectionMarkers(aiText);
    const sectionPattern = /^【([^】]+)】\s*([\s\S]*?)(?=^【[^】]+】|(?![^]))/gm;
    const sections = [];
    let match;

    while ((match = sectionPattern.exec(normalizedText)) !== null) {
        const title = normalizeKanjiDetailTitle(match[1]) || sanitizeKanjiAiText(match[1]);
        const content = sanitizeKanjiAiText(match[2]);
        if (title && content) sections.push({ title, content });
    }

    return sections;
}

function extractKanjiDetailSectionMap(aiText) {
    const sectionMap = new Map();

    for (const { title, content } of extractKanjiDetailSectionList(aiText)) {
        const currentContent = sectionMap.get(title) || '';
        sectionMap.set(title, mergeKanjiDetailSectionContent(title, currentContent, content));
    }

    return sectionMap;
}

function getOrderedKanjiDetailSections(aiText) {
    const sectionMap = new Map();
    const extras = [];
    const extraTitles = new Set();

    for (const { title, content } of extractKanjiDetailSectionList(aiText)) {
        if (!title || !content) continue;

        if (KANJI_DETAIL_CORE_SECTION_SET.has(title)) {
            const currentContent = sectionMap.get(title) || '';
            sectionMap.set(title, mergeKanjiDetailSectionContent(title, currentContent, content));
            continue;
        }

        if (extraTitles.has(title)) continue;
        extraTitles.add(title);
        extras.push({ title, content });
    }

    return [
        ...KANJI_DETAIL_CORE_SECTION_ORDER
            .map((title) => ({ title, content: sectionMap.get(title) || '' }))
            .filter((section) => section.content),
        ...extras
    ];
}

function canonicalizeKanjiDetailText(aiText) {
    const sections = getOrderedKanjiDetailSections(aiText);
    if (!sections.length) return sanitizeKanjiAiText(aiText);
    return sections
        .map(({ title, content }) => {
            const body = title === '代表的な熟語'
                ? formatRepresentativeIdiomContent(content)
                : sanitizeKanjiAiText(content);
            return body ? `【${title}】\n${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function mergeKanjiDetailSectionsFromDataset(aiText, datasetEntry) {
    const sectionMap = extractKanjiDetailSectionMap(aiText);
    const blocks = [];

    for (const title of KANJI_DETAIL_CORE_SECTION_ORDER) {
        const datasetSection = getKanjiDetailDatasetSectionText(datasetEntry, title);
        const aiSection = sectionMap.get(title) || '';
        if (title === '代表的な熟語') {
            const mergedIdioms = mergeRepresentativeIdiomSectionText(aiSection, datasetSection);
            if (mergedIdioms) blocks.push(`【${title}】\n${mergedIdioms}`);
            continue;
        }

        const content = title === '成り立ち'
            ? (isLikelyTruncatedSection(aiSection) && sanitizeKanjiAiText(datasetSection)
                ? sanitizeKanjiAiText(datasetSection)
                : sanitizeKanjiAiText(aiSection || datasetSection))
            : sanitizeKanjiAiText(aiSection || datasetSection);
        if (content) blocks.push(`【${title}】\n${content}`);
    }

    if (!blocks.length) return canonicalizeKanjiDetailText(aiText);
    return canonicalizeKanjiDetailText(blocks.join('\n\n'));
}

function upsertKanjiDetailSection(aiText, title, content) {
    const normalizedText = sanitizeKanjiAiText(aiText);
    const normalizedContent = sanitizeKanjiAiText(content);
    if (!normalizedContent) return normalizedText;

    const sections = extractKanjiDetailSectionList(normalizedText);
    if (!sections.length) {
        return `【${title}】\n${normalizedContent}`;
    }

    let found = false;
    const rebuilt = sections.map(({ title: rawTitle, content: rawContent }) => {
        const currentTitle = normalizeKanjiDetailTitle(rawTitle);
        const currentContent = sanitizeKanjiAiText(rawContent);
        if (!currentTitle) return '';
        if (currentTitle === title) {
            found = true;
            return `【${title}】\n${normalizedContent}`;
        }
        return `【${currentTitle}】\n${currentContent}`;
    }).filter(Boolean);

    if (!found) rebuilt.unshift(`【${title}】\n${normalizedContent}`);
    return canonicalizeKanjiDetailText(rebuilt.join('\n\n'));
}

function normalizeKanjiDetailTitle(title) {
    const normalized = sanitizeKanjiAiText(title)
        .replace(/[【】［］\[\]]/g, '')
        .replace(/[🧬💡✨📚🏷️⭐️★☆◆◇・]/g, '')
        .replace(/^[\s\d０-９一二三四五六七八九十]+[.)、．:：\-ー]?\s*/, '')
        .trim();
    const compact = normalized.replace(/\s+/g, '');
    if (!compact || compact === '入力情報' || compact === '基本情報') return '';
    if (/成り立|字源/.test(compact)) return '成り立ち';
    if (/代表的な熟語|熟語/.test(compact) || compact === '代表' || /^代表[:：]?/.test(compact)) return '代表的な熟語';
    if (/意味|深掘|字義|ニュアンス/.test(compact)) return '意味の深掘り';
    return normalized;
}

function isLikelyTruncatedSection(text) {
    const normalized = sanitizeKanjiAiText(text);
    if (!normalized) return true;
    if (normalized.length < 35) return true;
    if (/[、,・\/／:：]$/.test(normalized)) return true;
    if (!/[。！？!?．.]$/.test(normalized) && normalized.length < 60) return true;
    return false;
}

function isOriginSectionTooShallow(text, groundedHint = null) {
    const normalized = sanitizeKanjiAiText(text);
    if (!normalized) return true;
    if (normalized.length < 12) return true;
    if (/[、,・\/／:：]$/.test(normalized)) return true;
    if (!/[。！？!?．.]$/.test(normalized) && normalized.length < 24) return true;
    if (groundedHint && !cachedKanjiDetailMatchesHint(normalized, groundedHint)) return true;
    return false;
}

function getKanjiDetailCompletionStatus(aiText, groundedHint = null) {
    const sectionMap = extractKanjiDetailSectionMap(aiText);
    const originSection = sectionMap.get('成り立ち') || '';
    const meaningSection = sectionMap.get('意味の深掘り') || '';
    const idiomsSection = sectionMap.get('代表的な熟語') || '';
    const idiomsCount = countRepresentativeIdiomCandidates(idiomsSection);
    const missingSections = [];

    if (isOriginSectionTooShallow(originSection, groundedHint)) missingSections.push('成り立ち');
    if (isMeaningSectionTooShallow(meaningSection)) missingSections.push('意味の深掘り');
    if (idiomsCount < 3) missingSections.push('代表的な熟語');

    return {
        complete: missingSections.length === 0,
        missingSections,
        originSection,
        meaningSection,
        idiomsSection,
        idiomsCount
    };
}

function applyKanjiDetailRepairText(baseText, repairText, status) {
    const repairSections = extractKanjiDetailSectionMap(repairText);
    let nextText = sanitizeKanjiAiText(baseText);
    const completion = status || getKanjiDetailCompletionStatus(nextText);

    const repairedOrigin = sanitizeKanjiAiText(repairSections.get('成り立ち') || '');
    if (completion.missingSections.includes('成り立ち') && repairedOrigin) {
        nextText = upsertKanjiDetailSection(nextText, '成り立ち', repairedOrigin);
    }

    const repairedMeaning = sanitizeKanjiAiText(repairSections.get('意味の深掘り') || '');
    if (completion.missingSections.includes('意味の深掘り') && repairedMeaning) {
        nextText = upsertKanjiDetailSection(nextText, '意味の深掘り', repairedMeaning);
    }

    const repairedIdioms = repairSections.get('代表的な熟語') || '';
    if (completion.missingSections.includes('代表的な熟語') && repairedIdioms) {
        const mergedIdioms = mergeRepresentativeIdiomSectionText(completion.idiomsSection, repairedIdioms);
        if (mergedIdioms) nextText = upsertKanjiDetailSection(nextText, '代表的な熟語', mergedIdioms);
    }

    return canonicalizeKanjiDetailText(nextText);
}

function formatRepresentativeIdiomContent(content) {
    const parsed = parseRepresentativeIdiomLines(content);
    return dedupeRepresentativeIdiomLines(parsed).join('\n');
}

function mergeRepresentativeIdiomSectionText(primaryContent, secondaryContent) {
    return dedupeRepresentativeIdiomLines([
        ...parseRepresentativeIdiomLines(primaryContent),
        ...parseRepresentativeIdiomLines(secondaryContent)
    ]).join('\n');
}

function countRepresentativeIdiomCandidates(content) {
    return parseRepresentativeIdiomLines(content).length;
}

function buildKanjiDetailPrompt(kanji, readings, meaning, groundedHint) {
    return `
漢字「${kanji}」について、以下の項目を簡潔にまとめてください。

【入力情報】
読み: ${readings || '不明'}
意味: ${meaning || '不明'}
${groundedHint?.promptContext ? `検証済み情報: ${groundedHint.promptContext}` : ''}

以下の3項目をすべて必ず出力してください。1項目でも欠けた回答は失敗です。順番と見出しは完全一致させてください。

【成り立ち】
${groundedHint?.promptContext
        ? 'この漢字がどのように作られたか（象形・会意・形声など）を、50〜80文字で説明してください。'
        : '部品やつくりを確実に断定できる範囲で、50〜80文字で説明してください。断定できない場合も、このセクションは省略せず、「一般には字形・字義の変化を踏まえて説明されます」のように不確かさを明記して必ず出力してください。'}

【意味の深掘り】
字義だけで終わらせず、元々の意味、名前に使うときのニュアンス、広がりを含めて80〜120文字で説明してください。単に「〜を表す字です」で終わらせないでください。必ず句点で終えてください。

【代表的な熟語】
この漢字を使った実在する熟語を3〜5個、読みと意味付きで挙げてください。2字熟語または3字熟語だけにし、1行に1個ずつ、各行を完結させてください。読点やカンマで複数候補を1行にまとめないでください。最低3個は必ず出してください。1個だけで終わらせないでください。

【絶対に守るルール】
・セクション順は必ず【成り立ち】→【意味の深掘り】→【代表的な熟語】にしてください。
・【成り立ち】【意味の深掘り】【代表的な熟語】の3セクションを必ずすべて出力してください。意味だけで終わらせないでください。
・見出しは【成り立ち】【意味の深掘り】【代表的な熟語】の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。【代表的な熟語】は必ず1回だけ、最後に出力してください。
・口調は必ずです・ます調で統一してください。
・「アプリ内辞書では」という表現は使わないでください。
・架空の人物、存在しない著名人、存在しない熟語は絶対に書かないでください。
・不確かな情報は断定せず、確実に実在すると言える情報だけを書いてください。少しでも怪しい熟語は挙げないでください。
・実在を確信できるものだけを書いてください。ただし、3個に満たない場合でも、一般的で安全な実在の熟語を優先して3個以上になるように選んでください。
・一般的な漢和辞典や国語辞典に載る実在語だけを挙げてください。人名、作品名、俗語、ネット用語、造語は書かないでください。
・代表的な熟語は必ず2字熟語または3字熟語にしてください。4字以上の語は書かないでください。
・四字熟語、故事成語、ことわざ、慣用句、成句は書かないでください。これらは別枠で表示します。
・代表的な熟語は1行に1個ずつ、各行を完結させてください。読点やカンマで複数候補を1行にまとめないでください。最低3個になるようにしてください。1個だけで終わらせないでください。
・脚注記号、アスタリスク、参考番号、URLは書かないでください。
・【入力情報】や【基本情報】のようなセクションは出力しないでください。
・セクション名以外の前置きや締めの一文は書かないでください。
・部品、つくり、声符を推測で書かないでください。確信がない場合でも【成り立ち】は省略せず、不確かさが残る説明として出力してください。
・検証済み情報が与えられている場合は、必ずそれに従ってください。勝手に別の部品へ言い換えないでください。
`.trim();
}

function buildKanjiReadingPrompt(kanji, currentReading) {
    return `
漢字「${kanji}」が名前で「${currentReading}」と読まれる理由や由来を、100文字以内でわかりやすく説明してください。

【絶対に守るルール】
・口調は必ずです・ます調で統一してください。
・本文だけを出力し、見出しは付けないでください。
・架空の理由、存在しない出典、存在しない人物名は絶対に書かないでください。
・不確かな場合は断定しないでください。
・アスタリスク、参考番号、URLは書かないでください。
`.trim();
}

function isMeaningSectionTooShallow(text) {
    const normalized = sanitizeKanjiAiText(text);
    if (!normalized) return true;
    if (normalized.length < 35) return true;
    if (/を表す字です。?$/.test(normalized)) return true;
    if (/^「?.{1,2}」?を表す字です。/.test(normalized)) return true;
    if (/名前に使うときも、その意味を素直な願いとして重ねやすい漢字です。?$/.test(normalized)) return true;
    if (/^アプリ内辞書では/.test(normalized)) return true;
    if (!/[。！？!?．.]$/.test(normalized) && normalized.length < 120) return true;
    return false;
}

function buildKanjiDetailRepairPrompt(kanji, readings, meaning, groundedHint, currentMeaning, currentIdioms) {
    const currentIdiomsCount = countRepresentativeIdiomCandidates(currentIdioms);
    return `
漢字「${kanji}」の説明を完全な形に修正してください。

【入力情報】
読み: ${readings || '不明'}
意味: ${meaning || '不明'}
${groundedHint?.promptContext ? `検証済み情報: ${groundedHint.promptContext}` : ''}

【現在の内容】
意味の深掘り: ${currentMeaning || 'なし'}
代表的な熟語:
${currentIdioms || 'なし'}
現在の代表的な熟語数: ${currentIdiomsCount}個

【お願い】
・足りない部分を補い、必ず3セクションをすべて出力してください。
・出力順は必ず【成り立ち】→【意味の深掘り】→【代表的な熟語】にしてください。
・見出しは【成り立ち】【意味の深掘り】【代表的な熟語】の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。【代表的な熟語】は必ず1回だけ、最後に出力してください。
・【成り立ち】は、この漢字がどのように作られたかを50〜80文字で書いてください。不確かな部品や声符は断定せず、不確かさを明記してください。
・【意味の深掘り】は、字義だけで終わらせず、元々の意味、名前に使うときのニュアンス、広がりを含めて80〜120文字で書いてください。必ず句点で終えてください。
・【代表的な熟語】は、実在する2字熟語または3字熟語を3〜5個、読みと意味付きで、1行に1個ずつ書いてください。4字以上の語は書かないでください。現在の件数が${currentIdiomsCount}個なら、そこから必ず増やして最低3個にしてください。既出と重複しない語を優先してください。
・読点やカンマで複数候補を1行にまとめないでください。各行を完結させてください。
・四字熟語、故事成語、ことわざ、慣用句、成句は書かないでください。これらは別枠で表示します。
・意味だけ、熟語だけ、成り立ちだけで終わらせないでください。
`.trim();
}

async function callKanjiCacheApiWithAuth(payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) {
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        } catch (authErr) {
            console.warn('KANJI_CACHE_API: Failed to get auth token', authErr);
        }
    }
    const response = await fetch(getMeimayApiUrl('/api/kanji-cache'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }
}

async function resetKanjiDetailCache(kanji, currentReading) {
    const readingPayload = isSpecialKanjiAiReading(currentReading) ? '' : currentReading;
    let lastError = null;
    clearKanjiDetailReset(kanji, currentReading);
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.removeKanjiAiCache === 'function') {
        StorageBox.removeKanjiAiCache(kanji);
    }

    try {
        const response = await fetch(getMeimayApiUrl('/api/kanji-cache'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                kanji,
                reading: readingPayload
            })
        });

        if (!response.ok) {
            let errorMsg = `Cache reset failed: ${response.status}`;
            try {
                const rawBody = await response.text();
                if (rawBody) {
                    try {
                        const errData = JSON.parse(rawBody);
                        if (errData.error) errorMsg += `\n${errData.error}`;
                        if (errData.details) errorMsg += `\n${errData.details}`;
                        if (errData.code) errorMsg += `\nCode: ${errData.code}`;
                        if (errData.cause) errorMsg += `\nCause: ${errData.cause}`;
                    } catch (jsonError) {
                        errorMsg += `\n${rawBody.slice(0, 500)}`;
                    }
                }
            } catch (parseError) {
                console.warn('KANJI_DETAIL_RESET: failed to read API error response', parseError);
            }
            throw new Error(errorMsg);
        }

        markKanjiDetailReset(kanji, currentReading);
        const resultEl = document.getElementById('ai-kanji-result');
        if (resultEl) resultEl.innerHTML = '';
        alert('漢字の説明キャッシュをリセットしました。');
        return true;
    } catch (error) {
        lastError = error;
        console.warn('KANJI_DETAIL_RESET: api cache delete failed', error);
        clearKanjiDetailReset(kanji, currentReading);
        console.warn('KANJI_DETAIL_RESET: all cache delete attempts failed', lastError);
        alert(`キャッシュのリセットに失敗しました。\n${error?.message || ''}`.trim());
        return false;
    }
}

async function generateKanjiDetail(kanji, currentReading) {
    const resultEl = document.getElementById('ai-kanji-result');
    if (!resultEl) return;

    const shouldRefundOnFailure = !(typeof isPremiumAccessActive === 'function' && isPremiumAccessActive());
    const kanjiData = Array.isArray(master)
        ? master.find((item) => item && item['漢字'] === kanji)
        : null;

    if (!kanjiData) {
        resultEl.innerHTML = '<p class="text-xs text-[#f28b82]">漢字データが見つかりません。</p>';
        return;
    }

    const meaning = typeof clean === 'function' ? clean(kanjiData['意味'] || '') : String(kanjiData['意味'] || '').trim();
    const readings = [kanjiData['音'], kanjiData['訓'], kanjiData['伝統名のり']]
        .map((item) => (typeof clean === 'function' ? clean(item) : String(item || '').trim()))
        .filter(Boolean)
        .join(' / ');
    const kanjiDetailDataset = await loadKanjiDetailDataset();
    const datasetEntry = kanjiDetailDataset?.[kanji] || null;
    const groundedHint = getKanjiDetailGroundedHint(kanji, datasetEntry);
    const readingCacheId = !isSpecialKanjiAiReading(currentReading)
        ? encodeURIComponent(`${kanji}__${currentReading}`)
        : '';
    const cacheResetMarked = hasKanjiDetailReset(kanji, currentReading);

    let baseText = '';
    let readingText = '';
    let baseFreshGenerated = false;
    let readingFreshGenerated = false;
    let finalIdiomsCount = 0;

    try {
        const localCachedText = getStoredKanjiDetailAiText(kanji);
        if (localCachedText && !cacheResetMarked) {
            const mergedLocalText = mergeKanjiDetailSectionsFromDataset(localCachedText, datasetEntry);
            const localStatus = getKanjiDetailCompletionStatus(mergedLocalText, groundedHint);
            if (localStatus.complete) {
                renderKanjiDetailSections(resultEl, canonicalizeKanjiDetailText(mergedLocalText));
                return;
            }
            console.warn('AI_KANJI_DETAIL: local cached explanation rejected', {
                kanji,
                missingSections: localStatus.missingSections,
                idiomCount: localStatus.idiomsCount
            });
            if (typeof StorageBox !== 'undefined' && typeof StorageBox.removeKanjiAiCache === 'function') {
                StorageBox.removeKanjiAiCache(kanji);
            }
        }

        if (!consumeDailyKanjiDetailUse()) {
            if (typeof showToast === 'function') {
                showToast('今日の無料AIは使い切りました', '🌙');
            }
            return;
        }

        resultEl.innerHTML = `
            <div class="flex items-center justify-center py-6">
                <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                <span class="text-sm text-[#7a6f5a]">AIが分析中です...</span>
            </div>
        `;

        let cacheHit = false;
        if (typeof firebaseDb !== 'undefined' && firebaseDb && !cacheResetMarked) {
            try {
                const doc = await firebaseDb.collection('kanji_ai_explanations').doc(kanji).get();
                const cachedText = sanitizeKanjiAiText(doc.exists ? doc.data()?.text : '');
                if (cachedText) {
                    const mergedCachedText = mergeKanjiDetailSectionsFromDataset(cachedText, datasetEntry);
                    const cachedStatus = getKanjiDetailCompletionStatus(mergedCachedText, groundedHint);
                    if (cachedStatus.complete) {
                        baseText = canonicalizeKanjiDetailText(mergedCachedText);
                        finalIdiomsCount = cachedStatus.idiomsCount;
                        cacheHit = true;
                    } else {
                        console.warn('AI_KANJI_DETAIL: cached explanation rejected', {
                            kanji,
                            missingSections: cachedStatus.missingSections,
                            idiomCount: cachedStatus.idiomsCount
                        });
                    }
                }
            } catch (cacheError) {
                console.warn('AI_KANJI_DETAIL: base cache read failed', cacheError);
            }
        }

        if (!cacheHit) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(getMeimayApiUrl('/api/gemini'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: buildKanjiDetailPrompt(kanji, readings, meaning, groundedHint)
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMsg = `API Error: ${response.status}`;
                try {
                    const errData = await response.json();
                    if (errData.error) errorMsg += `\n${errData.error}`;
                    if (errData.details) {
                        errorMsg += `\n${typeof errData.details === 'string' ? errData.details : JSON.stringify(errData.details)}`;
                    }
                    if (Array.isArray(errData.attempts)) {
                        errorMsg += `\nAttempts: ${errData.attempts.length}`;
                    }
                } catch (parseError) {
                    console.warn('AI_KANJI_DETAIL: failed to parse error response', parseError);
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            baseText = mergeKanjiDetailSectionsFromDataset(data.text || '', datasetEntry);
            if (!baseText) {
                throw new Error('AIから説明を取得できませんでした。');
            }
            baseFreshGenerated = true;

            if (baseFreshGenerated) {
                for (let repairAttempt = 0; repairAttempt < 2; repairAttempt += 1) {
                    const status = getKanjiDetailCompletionStatus(baseText, groundedHint);
                    if (status.complete) break;

                    try {
                        const repairController = new AbortController();
                        const repairTimeoutId = setTimeout(() => repairController.abort(), 30000);
                        const repairResponse = await fetch(getMeimayApiUrl('/api/gemini'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: buildKanjiDetailRepairPrompt(
                                    kanji,
                                    readings,
                                    meaning,
                                    groundedHint,
                                    status.meaningSection,
                                    status.idiomsSection
                                )
                            }),
                            signal: repairController.signal
                        });
                        clearTimeout(repairTimeoutId);

                        if (repairResponse.ok) {
                            const repairData = await repairResponse.json();
                            baseText = applyKanjiDetailRepairText(baseText, repairData.text || '', status);
                        }
                    } catch (repairError) {
                        console.warn('AI_KANJI_DETAIL: base repair failed', repairError);
                        break;
                    }
                }
            }

            const finalBaseSections = extractKanjiDetailSectionMap(baseText);
            let finalIdiomsSection = finalBaseSections.get('代表的な熟語') || '';
            finalIdiomsCount = countRepresentativeIdiomCandidates(finalIdiomsSection);

            if (finalIdiomsCount < 3) {
                const fallbackLines = collectRepresentativeIdiomFallbackLines(kanji, kanjiDetailDataset);
                if (fallbackLines.length) {
                    const mergedFallbackIdioms = mergeRepresentativeIdiomSectionText(
                        finalIdiomsSection,
                        fallbackLines.join('\n')
                    );
                    const mergedFallbackCount = countRepresentativeIdiomCandidates(mergedFallbackIdioms);
                    if (mergedFallbackCount > finalIdiomsCount) {
                        finalIdiomsSection = mergedFallbackIdioms;
                        finalIdiomsCount = mergedFallbackCount;
                        baseText = upsertKanjiDetailSection(baseText, '代表的な熟語', mergedFallbackIdioms);
                        console.warn('AI_KANJI_DETAIL: idioms topped up from dataset fallback', {
                            kanji,
                            fallbackCount: fallbackLines.length,
                            idiomCount: finalIdiomsCount
                        });
                    }
                }
            }

            baseText = canonicalizeKanjiDetailText(baseText);
            const finalStatus = getKanjiDetailCompletionStatus(baseText, groundedHint);
            finalIdiomsCount = finalStatus.idiomsCount;
            if (!finalStatus.complete) {
                throw new Error(`AI説明の必須項目が不足しています: ${finalStatus.missingSections.join('、')}`);
            }
            const shouldPersistBaseText = finalStatus.complete;

            if (shouldPersistBaseText) {
                try {
                    await callKanjiCacheApiWithAuth({
                        action: 'saveBase',
                        kanji: kanji,
                        text: baseText
                    });
                } catch (cacheError) {
                    console.warn('AI_KANJI_DETAIL: base cache save failed via API', cacheError);
                }
            }
        }

        if (!isSpecialKanjiAiReading(currentReading)) {
            resultEl.innerHTML = `
                <div class="flex items-center justify-center py-6">
                    <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                    <span class="text-sm text-[#7a6f5a]">「${currentReading}」という読みを確認しています...</span>
            </div>
        `;

            let readingCacheHit = false;
            if (typeof firebaseDb !== 'undefined' && firebaseDb && readingCacheId && !cacheResetMarked) {
                try {
                const readingDoc = await firebaseDb.collection('kanji_ai_reading_explanations').doc(readingCacheId).get();
                const cachedReason = sanitizeKanjiAiText(readingDoc.exists ? readingDoc.data()?.text : '');
                if (cachedReason) {
                    readingText = `【「${currentReading}」の由来】\n${cachedReason}`;
                    readingCacheHit = true;
                }
                } catch (cacheError) {
                    console.warn('AI_KANJI_DETAIL: reading cache read failed', cacheError);
                }
            }

            if (!readingCacheHit) {
                try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 120000);
                const response2 = await fetch(getMeimayApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: buildKanjiReadingPrompt(kanji, currentReading)
                    }),
                    signal: controller2.signal
                });
                clearTimeout(timeoutId2);

                if (response2.ok) {
                    const data2 = await response2.json();
                    const reasonText = sanitizeKanjiAiText(data2.text || '');
                    if (reasonText) {
                        readingText = `【「${currentReading}」の由来】\n${reasonText}`;
                        readingFreshGenerated = true;
                        if (readingCacheId && reasonText) {
                            try {
                                await callKanjiCacheApiWithAuth({
                                    action: 'saveReading',
                                    kanji: kanji,
                                    reading: currentReading,
                                    text: reasonText
                                });
                            } catch (readingCacheError) {
                                console.warn('AI_KANJI_DETAIL: reading cache save failed via API', readingCacheError);
                            }
                        }
                    }
                }
                } catch (readingError) {
                    console.warn('AI_KANJI_DETAIL: reading generation failed', readingError);
                }
            }
        }

        const combinedText = canonicalizeKanjiDetailText([baseText, readingText].filter(Boolean).join('\n\n'));
        if (!combinedText) {
            throw new Error('表示できる説明がありません。');
        }

        renderKanjiDetailSections(resultEl, combinedText);
        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveKanjiAiCache === 'function') {
            StorageBox.saveKanjiAiCache(kanji, combinedText);
        }

        if (finalIdiomsCount >= 3 && (readingFreshGenerated || (baseFreshGenerated && isSpecialKanjiAiReading(currentReading)))) {
            clearKanjiDetailReset(kanji, currentReading);
        }
    } catch (err) {
        console.error('AI_KANJI_DETAIL:', err);
        if (shouldRefundOnFailure) {
            refundDailyKanjiDetailUse();
        }
        resultEl.innerHTML = `
            <div class="bg-[#fff7ed] p-3 rounded-xl text-xs text-[#9a6a36] mb-2 border border-[#f1ddbf]">
                <div class="font-black text-[#8b5d28]">AI説明を取得できませんでした。</div>
                <div class="mt-1 leading-relaxed">通信状態を確認して、少し時間をおいてもう一度お試しください。無料AI回数は消費していません。</div>
            </div>
        `;
    }
}

function renderKanjiDetailText(resultEl, aiText) {
    renderKanjiDetailSections(resultEl, aiText);
}

function renderKanjiDetailSections(resultEl, aiText) {
    const normalizedText = sanitizeKanjiAiText(aiText);
    const sections = getOrderedKanjiDetailSections(normalizedText);

    const getIcon = (title) => {
        if (KANJI_DETAIL_SECTION_ICON_MAP[title]) return KANJI_DETAIL_SECTION_ICON_MAP[title];
        if (title.includes('由来') || title.includes('理由') || title.includes('読み')) return '🏷️';
        return '✨';
    };

    const renderBlock = (title, content) => {
        if (!title || !content) return '';
        const displayContent = title.includes('熟語')
            ? formatRepresentativeIdiomContent(content)
            : content;
        if (!displayContent) return '';
        return `
            <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <div class="text-xs font-bold text-[#bca37f] mb-1 flex items-center gap-1">
                    <span>${escapeHtml(getIcon(title))}</span>
                    ${escapeHtml(title)}
                </div>
                <p class="kanji-detail-wrap-text text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${escapeHtml(displayContent)}</p>
            </div>
        `;
    };

    if (!sections.length) {
        resultEl.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <p class="kanji-detail-wrap-text text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${escapeHtml(normalizedText)}</p>
            </div>
        `;
        return;
    }

    const html = sections.map(({ title, content }) => renderBlock(title, content)).filter(Boolean).join('');
    resultEl.innerHTML = html || `
        <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
            <p class="kanji-detail-wrap-text text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${escapeHtml(normalizedText)}</p>
        </div>
    `;
}

// Global Exports
window.generateOrigin = generateOrigin;
window.generateOriginFromSaved = generateOriginFromSaved;
window.getNameOriginDisplayTextForItem = getNameOriginDisplayTextForItem;
window.canUseDailyNameOriginAI = canUseDailyNameOriginAI;
window.attachSavedNameOriginLongPress = attachSavedNameOriginLongPress;
window.generateKanjiDetail = generateKanjiDetail;
window.canUseDailyKanjiDetailAI = canUseDailyKanjiDetailAI;
window.consumeDailyKanjiDetailUse = consumeDailyKanjiDetailUse;
window.refundDailyKanjiDetailUse = refundDailyKanjiDetailUse;
window.renderKanjiDetailText = renderKanjiDetailSections;
window.renderKanjiDetailSections = renderKanjiDetailSections;
window.resetKanjiDetailCache = resetKanjiDetailCache;
window.closeOriginModal = closeOriginModal;
window.copyOriginToClipboard = copyOriginToClipboard;
window.regenerateCurrentNameOrigin = regenerateCurrentNameOrigin;
window.openNameOriginKanjiDetail = openNameOriginKanjiDetail;

console.log("ORIGIN: Module loaded (syntax corrected)");
