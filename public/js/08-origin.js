/**
 * ============================================================
 * MODULE 08: AI NAME ORIGIN GENERATOR (V13.2 - Fix Syntax)
 * ============================================================
 */

const NAME_ORIGIN_PROMPT_VERSION = 'name_origin_v21_20260816';
const NAME_ORIGIN_CACHE_KEY = 'meimay_name_origin_cache_v1';
const NAME_ORIGIN_CACHE_API_PATH = '/api/name-origin-cache';
const DAILY_NAME_ORIGIN_LIMIT = 1;
const KANJI_DETAIL_AI_PROMPT_VERSION = 'kanji_detail_v13_20260824';
const KANJI_DETAIL_COMPATIBLE_PROMPT_VERSIONS = new Set([
    KANJI_DETAIL_AI_PROMPT_VERSION
]);
const KANJI_READING_AI_PROMPT_VERSION = 'kanji_reading_v8_20260816';
const AI_MODEL_CACHE_VERSION_FALLBACK = 'gemini_model_gemini-3.7-flash';
const KANJI_MEANING_DETAILS_URL = '/data/kanji_meaning_details.json?v=26.02';
let nameOriginGenerationInFlight = false;
let currentNameOriginRenderTarget = null;
let currentNameOriginRenderOptions = {};
let activeNameOriginGenerationToken = 0;
let kanjiMeaningDetailsPromise = null;
let activeAiModelCacheVersion = AI_MODEL_CACHE_VERSION_FALLBACK;
let aiModelMetadataPromise = null;

async function getActiveAiModelMetadata(options = {}) {
    if (options.force === true) aiModelMetadataPromise = null;
    if (!aiModelMetadataPromise) {
        aiModelMetadataPromise = fetch(getMeimayApiUrl('/api/gemini'), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`AI metadata returned ${response.status}`);
                const data = await response.json();
                const cacheVersion = String(data?.model_cache_version || '').trim();
                if (cacheVersion) activeAiModelCacheVersion = cacheVersion;
                return {
                    primaryModel: String(data?.primary_model || '').trim(),
                    modelCacheVersion: activeAiModelCacheVersion
                };
            })
            .catch((error) => {
                console.warn('AI_MODEL_METADATA:', error);
                return {
                    primaryModel: '',
                    modelCacheVersion: activeAiModelCacheVersion
                };
            });
    }
    return aiModelMetadataPromise;
}

function getActiveAiModelCacheVersionSync() {
    return activeAiModelCacheVersion || AI_MODEL_CACHE_VERSION_FALLBACK;
}

async function getAuthenticatedAiRequestHeaders() {
    if (typeof getFirebaseRequestHeaders !== 'function') {
        throw new Error('AIを利用するための認証を準備できませんでした。');
    }
    const headers = await getFirebaseRequestHeaders();
    if (!headers?.Authorization && !headers?.authorization) {
        throw new Error('AIを利用するための認証が完了していません。');
    }
    return headers;
}

function buildVersionedKanjiCacheDocId(parts) {
    return encodeURIComponent(parts.map((part) => String(part || '').trim()).join('__'));
}

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

const NAME_ORIGIN_INITIALS_CAUTION = new Set(['WC', 'SM', 'NG', 'AV', 'DV']);

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

function validateGeneratedNameOriginText(text, result = currentBuildResult) {
    const normalized = normalizeNameOriginText(text)
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    let parsed;
    try {
        parsed = JSON.parse(normalized);
    } catch (error) {
        throw new Error('名前由来のJSON形式が正しくありません。');
    }
    const expectedKeys = ['decision', 'wish', 'sound', 'check'];
    const actualKeys = Object.keys(parsed || {}).sort();
    if (actualKeys.join('|') !== [...expectedKeys].sort().join('|')) {
        throw new Error('名前由来の項目が不足しています。');
    }
    const bannedPattern = /(?:芯の強さ|葵のようにまっすぐ|自然に伝えられます|説明できます|人生の荒波|未来を切り拓く|可能性の扉|自分らしく羽ばたく)/;
    const sourceMeanings = getNameOriginCombination(result)
        .map((part) => getNameOriginMeaning(part))
        .join(' ');
    const guardedExpansions = [
        { output: /(?:前向き|前を向)/, source: /(?:前向き|前を向)/ },
        { output: /(?:健やか|すこやか)/, source: /(?:健やか|すこやか|健康|丈夫)/ },
        { output: /(?:温か|暖か|あたたか)/, source: /(?:温か|暖か|あたたか)/ },
        { output: /(?:瑞々し|みずみずし)/, source: /(?:瑞々し|みずみずし)/ },
        { output: /(?:朗らか|ほがらか)/, source: /(?:朗らか|ほがらか)/ },
        { output: /たくまし/, source: /(?:たくまし|強い|勇)/ },
        { output: /思いやり/, source: /(?:思いやり|慈愛|心)/ }
    ];
    for (const key of expectedKeys) {
        if (typeof parsed[key] !== 'string') throw new Error(`名前由来の${key}が文字列ではありません。`);
        if (bannedPattern.test(parsed[key])) throw new Error(`名前由来の${key}に根拠外の定型表現があります。`);
        for (const rule of guardedExpansions) {
            if (rule.output.test(parsed[key]) && !rule.source.test(sourceMeanings)) {
                throw new Error(`名前由来の${key}に漢字データ外の意味があります。`);
            }
        }
    }
    const lengthLimits = { decision: 80, wish: 80, sound: 60, check: 120 };
    for (const [key, maxLength] of Object.entries(lengthLimits)) {
        if (parsed[key].length > maxLength) throw new Error(`名前由来の${key}が長すぎます。`);
    }
    return JSON.stringify(parsed);
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

function getNameOriginSurnameValue(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const fullName = String(result?.fullName || '').trim();
    if (fullName && givenName && fullName.includes(givenName)) {
        const beforeGiven = fullName.slice(0, fullName.lastIndexOf(givenName)).trim();
        if (beforeGiven) return beforeGiven.replace(/\s+/g, '');
    }
    if (typeof surnameStr !== 'undefined' && surnameStr) return String(surnameStr || '').trim();
    return '';
}

function getNameOriginSurnameReading(result = currentBuildResult) {
    const givenReading = getNameOriginGivenReading(result);
    const reading = String(result?.reading || '').trim();
    const parts = reading.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && (!givenReading || normalizeNameOriginReadingValue(parts[parts.length - 1]) === normalizeNameOriginReadingValue(givenReading))) {
        return parts.slice(0, -1).join('');
    }
    if (typeof surnameReading !== 'undefined' && surnameReading) return String(surnameReading || '').trim();
    if (typeof surnameData !== 'undefined' && Array.isArray(surnameData) && surnameData.length > 0) {
        return surnameData.map(item => item?.['読み'] || item?.reading || '').join('');
    }
    return '';
}

function getNameOriginCacheKey(result = currentBuildResult, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const surname = getNameOriginSurnameValue(result);
    const surnameReadingValue = getNameOriginSurnameReading(result);
    const combinationKey = getNameOriginCombinationKey(result) || givenName;
    if (!givenName && !combinationKey) return '';
    return [
        NAME_ORIGIN_PROMPT_VERSION,
        encodeURIComponent(modelCacheVersion || AI_MODEL_CACHE_VERSION_FALLBACK),
        encodeURIComponent(surname || ''),
        encodeURIComponent(surnameReadingValue || ''),
        encodeURIComponent(givenName),
        encodeURIComponent(givenReading || ''),
        encodeURIComponent(combinationKey)
    ].join('__');
}

function getNameOriginResetKey(result = currentBuildResult, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    const cacheKey = getNameOriginCacheKey(result, modelCacheVersion);
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

function getCachedNameOriginEntry(result = currentBuildResult, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    const key = getNameOriginCacheKey(result, modelCacheVersion);
    if (!key) return null;
    if (hasNameOriginCacheReset(result)) return null;
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.getNameOriginCache === 'function') {
        return StorageBox.getNameOriginCache(key);
    }
    const cache = readNameOriginCacheMap();
    return cache[key] || null;
}

function saveNameOriginCache(result, text, meta = {}) {
    const modelCacheVersion = String(meta.modelCacheVersion || getActiveAiModelCacheVersionSync()).trim();
    const key = getNameOriginCacheKey(result, modelCacheVersion);
    const cleanText = normalizeNameOriginText(text);
    if (!key || !cleanText) return false;
    clearNameOriginCacheReset(result);
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveNameOriginCache === 'function') {
        StorageBox.saveNameOriginCache(key, cleanText, {
            promptVersion: NAME_ORIGIN_PROMPT_VERSION,
            modelCacheVersion,
            modelName: String(meta.modelName || '').trim()
        });
        return true;
    }
    try {
        const cache = readNameOriginCacheMap();
        cache[key] = {
            text: cleanText,
            promptVersion: NAME_ORIGIN_PROMPT_VERSION,
            modelCacheVersion,
            modelName: String(meta.modelName || '').trim(),
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(NAME_ORIGIN_CACHE_KEY, JSON.stringify(cache));
        return true;
    } catch (error) {
        return false;
    }
}

function removeNameOriginCache(result = currentBuildResult, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    const key = getNameOriginCacheKey(result, modelCacheVersion);
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

function getNameOriginStoredTextForItem(item, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    const directIsCurrent = item?.originPromptVersion === NAME_ORIGIN_PROMPT_VERSION
        && item?.originModelCacheVersion === modelCacheVersion;
    const direct = directIsCurrent ? normalizeNameOriginText(item?.origin) : '';
    if (direct) return direct;
    const cached = getCachedNameOriginEntry(item, modelCacheVersion);
    if (cached?.promptVersion && cached.promptVersion !== NAME_ORIGIN_PROMPT_VERSION) return '';
    if (cached?.modelCacheVersion && cached.modelCacheVersion !== modelCacheVersion) return '';
    return normalizeNameOriginText(cached?.text);
}

function getNameOriginDisplayTextForItem(item) {
    const storedText = getNameOriginStoredTextForItem(item)
        || normalizeNameOriginText(item?.origin);
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
    const originMeta = {
        origin: cleanText,
        originPromptVersion: NAME_ORIGIN_PROMPT_VERSION,
        originModelCacheVersion: String(options.modelCacheVersion || getActiveAiModelCacheVersionSync()).trim(),
        originModelName: String(options.modelName || '').trim()
    };

    let changed = false;
    if (options.source === 'own' && Number.isInteger(options.savedIndex) && savedNames[options.savedIndex]) {
        savedNames[options.savedIndex] = { ...savedNames[options.savedIndex], ...originMeta };
        changed = true;
    } else {
        savedNames = savedNames.map(item => {
            if (!isSameNameOriginTarget(item, target)) return item;
            changed = true;
            return { ...item, ...originMeta };
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
    const modelCacheVersion = getActiveAiModelCacheVersionSync();
    const cloudCacheKey = getNameOriginCacheKey(target, modelCacheVersion);
    removeNameOriginCache(target);
    markNameOriginCacheReset(target);
    if (target) target.origin = '';
    if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
        currentBuildResult.origin = '';
    }

    let changed = false;
    if (typeof savedNames !== 'undefined' && Array.isArray(savedNames)) {
        if (options.source === 'own' && Number.isInteger(options.savedIndex) && savedNames[options.savedIndex]) {
            savedNames[options.savedIndex] = {
                ...savedNames[options.savedIndex],
                origin: '',
                originPromptVersion: '',
                originModelCacheVersion: '',
                originModelName: ''
            };
            changed = true;
        } else {
            savedNames = savedNames.map(item => {
                if (!isSameNameOriginTarget(item, target) || !item?.origin) return item;
                changed = true;
                return {
                    ...item,
                    origin: '',
                    originPromptVersion: '',
                    originModelCacheVersion: '',
                    originModelName: ''
                };
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
    if (cloudCacheKey) {
        callNameOriginCacheApi({
            action: 'deleteOrigin',
            cacheKey: cloudCacheKey,
            promptVersion: NAME_ORIGIN_PROMPT_VERSION,
            modelCacheVersion
        }).catch((error) => console.warn('NAME_ORIGIN_CACHE: cloud delete failed', error));
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

function getNameOriginReadingForms(value, options = {}) {
    if (typeof getKanjiReadingForms === 'function') {
        return getKanjiReadingForms(value, options);
    }
    const includeStem = options && options.includeStem === true;
    const forms = new Set();
    String(value || '')
        .split(/[、,，\s/]+/)
        .map(entry => String(entry || '').trim())
        .filter(Boolean)
        .forEach((entry) => {
            const hira = typeof toHira === 'function' ? toHira(entry) : entry;
            const normalized = normalizeNameOriginReadingValue(hira);
            if (normalized) forms.add(normalized);
            if (!includeStem) return;
            const stemBreaks = ['.', '（', '(']
                .map(marker => hira.indexOf(marker))
                .filter(index => index > 0);
            if (stemBreaks.length === 0) return;
            const stem = normalizeNameOriginReadingValue(hira.slice(0, Math.min(...stemBreaks)));
            if (stem) forms.add(stem);
        });
    return [...forms];
}

function getNameOriginReadingBucketsForPart(part) {
    const source = findNameOriginSourceItem(part) || part || {};
    const majorSource = `${source?.['音'] || ''} ${source?.['訓'] || ''}`;
    const minorSource = source?.['伝統名のり'] || '';
    const majorExact = getNameOriginReadingForms(majorSource);
    const majorLoose = getNameOriginReadingForms(majorSource, { includeStem: true });
    const minorExact = getNameOriginReadingForms(minorSource);
    const minorLoose = getNameOriginReadingForms(minorSource, { includeStem: true });
    return {
        majorExact: new Set(majorExact),
        majorLoose: new Set(majorLoose),
        minorExact: new Set(minorExact),
        minorLoose: new Set(minorLoose),
        all: new Set([...majorLoose, ...minorLoose])
    };
}

function getNameOriginSegmentReadingStatus(part, segment) {
    const normalizedSegment = normalizeNameOriginReadingValue(segment);
    if (!normalizedSegment) return 'empty';
    const buckets = getNameOriginReadingBucketsForPart(part);
    if (buckets.majorExact.has(normalizedSegment)) return 'major-exact';
    if (buckets.majorLoose.has(normalizedSegment)) return 'major-loose';
    if (buckets.minorExact.has(normalizedSegment)) return 'minor-exact';
    if (buckets.minorLoose.has(normalizedSegment)) return 'minor-loose';
    return 'unknown';
}

function hasNameOriginExactReadingExample(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = normalizeNameOriginReadingValue(getNameOriginGivenReading(result));
    if (!givenName || !givenReading) return false;

    const containsGivenName = (examples) => {
        const list = Array.isArray(examples)
            ? examples
            : String(examples || '').split(/[\s、,，]+/);
        return list.map(item => String(item || '').trim()).includes(givenName);
    };

    const yomiMatch = typeof yomiSearchData !== 'undefined' && Array.isArray(yomiSearchData)
        ? yomiSearchData.some(item =>
            normalizeNameOriginReadingValue(item?.yomi) === givenReading && containsGivenName(item?.examples)
        )
        : false;
    if (yomiMatch) return true;

    return typeof readingsData !== 'undefined' && Array.isArray(readingsData)
        ? readingsData.some(item =>
            normalizeNameOriginReadingValue(item?.reading) === givenReading && containsGivenName(item?.examples)
        )
        : false;
}

function getNameOriginReadingCandidatesForPart(part) {
    const buckets = getNameOriginReadingBucketsForPart(part);
    return [...new Set([
        ...buckets.majorExact,
        ...buckets.majorLoose,
        ...buckets.minorExact,
        ...buckets.minorLoose
    ])].filter(Boolean).sort((a, b) => b.length - a.length);
}

function inferNameOriginReadableSegmentsFromParts(result = currentBuildResult, parts = null) {
    const targetParts = Array.isArray(parts) ? parts : getNameOriginCombination(result);
    const normalizedGivenReading = normalizeNameOriginReadingValue(getNameOriginGivenReading(result));
    if (!normalizedGivenReading || targetParts.length === 0) return [];

    const candidatesByPart = targetParts.map(part => getNameOriginReadingCandidatesForPart(part));
    if (candidatesByPart.some(candidates => candidates.length === 0)) return [];

    const path = [];
    const walk = (partIndex, offset) => {
        if (partIndex === candidatesByPart.length) return offset === normalizedGivenReading.length;
        for (const candidate of candidatesByPart[partIndex]) {
            if (!normalizedGivenReading.startsWith(candidate, offset)) continue;
            path[partIndex] = candidate;
            if (walk(partIndex + 1, offset + candidate.length)) return true;
        }
        path.length = partIndex;
        return false;
    };

    return walk(0, 0) ? [...path] : [];
}

function getNameOriginReadableSegments(result = currentBuildResult, parts = null) {
    const targetParts = Array.isArray(parts) ? parts : getNameOriginCombination(result);
    const givenReading = getNameOriginGivenReading(result);
    const normalizedGivenReading = normalizeNameOriginReadingValue(givenReading);
    const explicitSegments = targetParts.map((part) => {
        if (part?._compoundOrigin && part.compoundReading) return String(part.compoundReading || '').trim();
        const slot = Number(part?.slot);
        if (Array.isArray(part?.sessionSegments) && Number.isInteger(slot) && part.sessionSegments[slot]) {
            return String(part.sessionSegments[slot] || '').trim();
        }
        return '';
    });
    if (explicitSegments.length === targetParts.length && explicitSegments.every(Boolean)) return explicitSegments;

    const globalSegments = typeof segments !== 'undefined' && Array.isArray(segments)
        ? segments.map(segment => String(segment || '').trim()).filter(Boolean)
        : [];
    if (globalSegments.length === targetParts.length
        && normalizeNameOriginReadingValue(globalSegments.join('')) === normalizedGivenReading) {
        return globalSegments;
    }

    if (typeof getPreferredReadingSegments === 'function' && givenReading) {
        const preferred = getPreferredReadingSegments(givenReading);
        if (Array.isArray(preferred)
            && preferred.length === targetParts.length
            && normalizeNameOriginReadingValue(preferred.join('')) === normalizedGivenReading) {
            return preferred.map(segment => String(segment || '').trim());
        }
    }

    if (typeof getReadingSegmentPaths === 'function' && givenReading) {
        const paths = getReadingSegmentPaths(givenReading, 8, { strictOnly: false, allowFallback: true });
        const match = Array.isArray(paths)
            ? paths.find(path => Array.isArray(path)
                && path.length === targetParts.length
                && normalizeNameOriginReadingValue(path.join('')) === normalizedGivenReading)
            : null;
        if (match) return match.map(segment => String(segment || '').trim());
    }

    return inferNameOriginReadableSegmentsFromParts(result, targetParts);
}

function getNameOriginReadingDifficultyCheckText(result = currentBuildResult) {
    const clarity = getNameOriginReadingClarity(result);
    return clarity.suggestedCheck || '';
}

function getNameOriginReadingClarity(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const parts = getNameOriginCombination(result);
    const empty = {
        level: 'unknown',
        label: '判定なし',
        segments: [],
        statusSummary: [],
        appReason: '',
        suggestedCheck: ''
    };
    if (!givenName || !givenReading || parts.length <= 1) return empty;

    const segmentsForCheck = getNameOriginReadableSegments(result, parts);
    if (segmentsForCheck.length !== parts.length || !segmentsForCheck.every(Boolean)) {
        return {
            ...empty,
            level: 'hard',
            label: '読めない',
            appReason: 'アプリ側の読み候補では、名前全体の読みを自然に分割できませんでした。',
            suggestedCheck: `「${givenName}」は初見では「${givenReading}」と読むのが難しい可能性があります。読みを添えて伝えると安心です。`
        };
    }

    const statuses = [];
    parts.forEach((part, index) => {
        if (part?._compoundOrigin) return;
        const segment = normalizeNameOriginReadingValue(segmentsForCheck[index]);
        if (!segment) return;
        statuses.push(getNameOriginSegmentReadingStatus(part, segment));
    });

    const unknownCount = statuses.filter(status => status === 'unknown').length;
    const nonObviousCount = statuses.filter(status => status === 'major-loose' || status === 'minor-exact' || status === 'minor-loose').length;
    const exactExampleExists = hasNameOriginExactReadingExample(result);
    const mixedButUnattested = !exactExampleExists
        && statuses.length === parts.length
        && nonObviousCount >= 1
        && statuses.some(status => status === 'major-exact' || status === 'major-loose');

    let level = 'obvious';
    let label = '誰でも読める';
    let appReason = '主要な読みの組み合わせとして自然に読める可能性が高いです。';
    let suggestedCheck = '';

    if (unknownCount > 0) {
        level = exactExampleExists ? 'often-misread' : 'hard';
        label = exactExampleExists ? 'よく読み間違われる' : '読めない';
        appReason = '一部の漢字に、入力された読みが一般的な読み候補として見つかりませんでした。';
        suggestedCheck = `「${givenName}」は初見では「${givenReading}」と読むのが難しい可能性があります。読みを添えて伝えると安心です。`;
    } else if (nonObviousCount >= 2) {
        level = exactExampleExists ? 'rare-misread' : 'often-misread';
        label = exactExampleExists ? 'まれに読み違いがある可能性' : 'よく読み間違われる';
        appReason = exactExampleExists
            ? '実例はありますが、複数の漢字で読み方に揺れが出る可能性があります。'
            : '複数の漢字で、主要読みから少し外れる読み方が使われています。';
        suggestedCheck = exactExampleExists
            ? `「${givenName}」は比較的読みやすい名前ですが、初対面では念のため「${givenReading}」と読みを添えるとより伝わりやすいです。`
            : `「${givenName}」は初見では別の読みを想像される可能性があります。読みを添えて伝えると安心です。`;
    } else if (nonObviousCount === 1 || mixedButUnattested) {
        level = 'rare-misread';
        label = 'まれに読み違いがある可能性';
        appReason = 'おおむね読めますが、一部の読みで別読みを想像される可能性があります。';
        suggestedCheck = `「${givenName}」は比較的読みやすい名前ですが、初対面では念のため「${givenReading}」と読みを添えるとより伝わりやすいです。`;
    }

    return {
        level,
        label,
        segments: segmentsForCheck,
        statusSummary: statuses,
        exactExampleExists,
        appReason,
        suggestedCheck
    };
}

function kanaToNameOriginRomaji(value) {
    const hira = normalizeNameOriginReadingValue(value);
    if (!hira) return '';
    const digraphs = {
        きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
        しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
        ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
        にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
        ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
        みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
        りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
        ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
        じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
        びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
        ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo'
    };
    const singles = {
        あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
        か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
        さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
        た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
        な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
        は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
        ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
        や: 'ya', ゆ: 'yu', よ: 'yo',
        ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
        わ: 'wa', を: 'o', ん: 'n',
        が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
        ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
        だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
        ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
        ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
        ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
        ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ー: ''
    };
    let result = '';
    let doubleNext = false;
    for (let index = 0; index < hira.length; index += 1) {
        const pair = hira.slice(index, index + 2);
        let chunk = '';
        if (hira[index] === 'つ' && hira[index + 1]) {
            doubleNext = true;
            continue;
        }
        if (digraphs[pair]) {
            chunk = digraphs[pair];
            index += 1;
        } else {
            chunk = singles[hira[index]] || '';
        }
        if (!chunk) continue;
        if (doubleNext) {
            chunk = chunk[0] + chunk;
            doubleNext = false;
        }
        result += chunk;
    }
    return result;
}

function getNameOriginAlphabetCheckText(result = currentBuildResult) {
    const surname = getNameOriginSurnameValue(result);
    const surnameYomi = getNameOriginSurnameReading(result);
    const givenReading = getNameOriginGivenReading(result);
    if (!surname || !surnameYomi || !givenReading) return '';
    const surnameInitial = kanaToNameOriginRomaji(surnameYomi).slice(0, 1).toUpperCase();
    const givenInitial = kanaToNameOriginRomaji(givenReading).slice(0, 1).toUpperCase();
    const surnameFirstInitials = `${surnameInitial}${givenInitial}`;
    const givenFirstInitials = `${givenInitial}${surnameInitial}`;
    const cautions = [
        { initials: surnameFirstInitials, label: '姓→名' },
        { initials: givenFirstInitials, label: '名→姓' }
    ].filter((item, index, list) =>
        item.initials.length === 2
        && NAME_ORIGIN_INITIALS_CAUTION.has(item.initials)
        && list.findIndex(other => other.initials === item.initials) === index
    );
    if (cautions.length === 0) return '';
    const labels = cautions.map(item => `${item.label}で「${item.initials}」`).join('、');
    return `ローマ字表記の頭文字が${labels}になるため、表記する場面で気になるか確認すると安心です。`;
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

function getNameOriginFullNameCharacters(result = currentBuildResult) {
    const surname = getNameOriginSurnameValue(result);
    const givenName = getNameOriginGivenName(result);
    return Array.from(`${surname || ''}${givenName || ''}`).filter(Boolean);
}

function getNameOriginLocalCheckText(result = currentBuildResult, options = {}) {
    const includeReadingDifficulty = options.includeReadingDifficulty !== false;
    const checks = [];
    const givenName = getNameOriginGivenName(result);
    const surname = getNameOriginSurnameValue(result);
    const chars = getNameOriginCharacterParts(result);
    const kanjiChars = chars.map(item => item.kanji);
    const readingDifficultyCheck = getNameOriginReadingDifficultyCheckText(result);
    if (includeReadingDifficulty && readingDifficultyCheck) checks.push(readingDifficultyCheck);

    Object.entries(NAME_ORIGIN_HARD_COMPOUND_NOTES).forEach(([compound, note]) => {
        if (givenName.includes(compound)) checks.push(note);
    });

    const alphabetCheck = getNameOriginAlphabetCheckText(result);
    if (alphabetCheck) checks.push(alphabetCheck);

    const compoundParts = getNameOriginCombination(result)
        .map(part => getNameOriginKanjiValue(part))
        .filter(kanji => Array.from(kanji).length > 1);
    if (compoundParts.length > 0 && !checks.some(text => text.includes('熟字訓'))) {
        checks.push('まとめ読みを含むため、初見では読み方を確認される可能性があります。');
    }

    const fullNameChars = getNameOriginFullNameCharacters(result);
    const adjacentSplit = !!surname && fullNameChars.some((char, index) =>
        index > 0 &&
        NAME_ORIGIN_LEFT_RIGHT_KANJI.has(char) &&
        NAME_ORIGIN_LEFT_RIGHT_KANJI.has(fullNameChars[index - 1])
    );
    if (adjacentSplit) {
        checks.push('名字と名前を縦に並べると、左右に分かれる形の字が続いて少し割れて見える場合があります。');
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

    return checks.slice(0, 3).join('\n');
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
                decision: normalizeNameOriginSectionValue(parsed.decision || parsed['この名前の決め手'] || parsed['決め手'], 60),
                wish: normalizeNameOriginSectionValue(parsed.wish || parsed.familyLine || parsed.family || parsed['家族に伝える願い'] || parsed['パパママからの願い'] || parsed['願い'] || parsed['家族に伝える一言'], 60),
                sound: normalizeNameOriginSectionValue(parsed.sound || parsed['呼んだときの印象'] || parsed['響き'], 45),
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
        wish: /(?:家族に伝える願い|パパママからの願い|願い|家族に伝える一言)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:漢字|呼んだときの印象|響き|確認しておきたいこと)[:：\n]|$)/,
        sound: /(?:呼んだときの印象|響きの印象|響き)[:：\n]\s*([\s\S]*?)(?=\n\s*(?:家族に伝える一言|確認しておきたいこと)[:：\n]|$)/,
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
    const combinedMeaning = [firstMeaning, secondMeaning].filter(Boolean).join('と、');
    const legacy = repairNameOriginQuoteText(text, result);

    if (legacy) {
        return {
            decision: normalizeNameOriginSectionValue(legacy, 120),
            wish: givenName ? `「${givenName}」には、漢字の意味を大切にした願いを込めました。` : '',
            sound: givenReading ? `「${givenReading}」は、落ち着いて呼びやすい響きです。` : '',
            check: getNameOriginLocalCheckText(result, { includeReadingDifficulty: false })
        };
    }

    return {
        decision: `${givenName}は、${firstMeaning}${secondMeaning ? `と、${secondMeaning}` : ''}を重ねた名前です。`,
        wish: `「${givenName}」には、${combinedMeaning}という意味を大切にしてほしいという願いを込めました。`,
        sound: givenReading ? `「${givenReading}」は、やさしく落ち着いた印象で、日常でも呼びやすい響きです。` : '',
        check: getNameOriginLocalCheckText(result, { includeReadingDifficulty: false })
    };
}

function getNameOriginCheckCategory(line) {
    const normalized = String(line || '').replace(/\s+/g, '');
    if (!normalized) return '';
    if (/ローマ字|アルファベット|頭文字|イニシャル|[Ww]\.?[Cc]\.?|[Nn]\.?[Gg]\.?|[Ss]\.?[Mm]\.?|[Aa]\.?[Vv]\.?|[Dd]\.?[Vv]\.?/.test(normalized)) {
        return 'alphabet-initials';
    }
    if (/縦書き|縦に並べる|縦割れ|左右に分かれる|割れて見える/.test(normalized)) {
        return 'vertical-split';
    }
    if (/熟字訓|心太|海月|日常語|一般語|まとめ読み/.test(normalized)) {
        return 'compound-reading';
    }
    if (/初見|読みにく|読みづら|読み方|読むのが難しい|読みを添え|読みを確認/.test(normalized)) {
        return 'reading-difficulty';
    }
    if (/旧字体|異体字|別体|大字|字形|届出|表記/.test(normalized)) {
        return 'glyph-form';
    }
    if (/画数|手書き/.test(normalized)) {
        return 'stroke-count';
    }
    if (/へん|偏り|重なる|統一感/.test(normalized)) {
        return 'visual-balance';
    }
    return normalized.replace(/[「」『』。、，,.・\s]/g, '').slice(0, 24);
}

function splitNameOriginCheckSegments(value) {
    return normalizeNameOriginText(value)
        .split(/\n+/)
        .flatMap(line => line
            .replace(/\s*また(?=「?[^。！？!?]{0,30}(?:旧字体|異体字|別体|大字|字形|届出|表記|初見|読みにく|読みづら|ローマ字|アルファベット|縦割れ))/g, '\nまた')
            .match(/[^。！？!?]+[。！？!?]?/g) || [])
        .map(line => normalizeNameOriginSectionValue(line, 120))
        .filter(Boolean);
}

function mergeNameOriginCheckText(aiCheck, localCheck) {
    const lines = [];
    const categories = new Set();
    [localCheck, aiCheck].forEach((value) => {
        splitNameOriginCheckSegments(value)
            .forEach((line) => {
                const category = getNameOriginCheckCategory(line);
                if (category && categories.has(category)) return;
                if (!lines.includes(line)) lines.push(line);
                if (category) categories.add(category);
            });
    });
    return lines.slice(0, 3).join('\n');
}

function getNameOriginCheckMaterials(result = currentBuildResult) {
    const readingClarity = getNameOriginReadingClarity(result);
    const itemsByCategory = {};
    getNameOriginLocalCheckText(result, { includeReadingDifficulty: false })
        .split(/\n+/)
        .map(line => normalizeNameOriginSectionValue(line, 120))
        .filter(Boolean)
        .forEach((line) => {
            const category = getNameOriginCheckCategory(line) || 'note';
            if (!itemsByCategory[category]) itemsByCategory[category] = line;
        });

    return {
        readingClarity,
        possibleHardToRead: readingClarity.suggestedCheck || '',
        compoundReading: itemsByCategory['compound-reading'] || '',
        initials: itemsByCategory['alphabet-initials'] || '',
        verticalSplit: itemsByCategory['vertical-split'] || '',
        glyphForm: itemsByCategory['glyph-form'] || '',
        strokeCount: itemsByCategory['stroke-count'] || '',
        visualBalance: itemsByCategory['visual-balance'] || '',
        notes: Object.entries(itemsByCategory)
            .filter(([category]) => ![
                'reading-difficulty',
                'compound-reading',
                'alphabet-initials',
                'vertical-split',
                'glyph-form',
                'stroke-count',
                'visual-balance'
            ].includes(category))
            .map(([, line]) => line)
    };
}

function getNameOriginStructuredModel(result = currentBuildResult, text = '') {
    const parsed = parseNameOriginStructuredText(text);
    const fallback = buildFallbackNameOriginModel(result, parsed ? '' : text);
    const localCheck = getNameOriginLocalCheckText(result, { includeReadingDifficulty: false });
    return {
        decision: normalizeNameOriginSectionValue(parsed?.decision || fallback.decision, 60),
        wish: normalizeNameOriginSectionValue(parsed?.wish || fallback.wish, 60),
        sound: normalizeNameOriginSectionValue(parsed?.sound || fallback.sound, 45),
        check: mergeNameOriginCheckText(parsed?.check || fallback.check, localCheck),
        meanings: getNameOriginMeaningRows(result)
    };
}

function buildNameOriginCopyText(result = currentBuildResult, text = '') {
    const model = getNameOriginStructuredModel(result, text);
    const blocks = [];
    if (model.decision) blocks.push(`この名前の決め手\n${model.decision}`);
    if (model.meanings.length > 0) {
        blocks.push(`漢字に込めた意味\n${model.meanings.map(row => `${row.kanji}：${row.meaning}`).join('\n')}`);
    }
    if (model.wish) blocks.push(`家族に伝える願い\n${model.wish}`);
    if (model.check) blocks.push(`確認しておきたいこと\n${model.check}`);
    if (model.sound) blocks.push(`呼んだときの印象\n${model.sound}`);
    return blocks.join('\n\n').trim();
}

function stringifyNameOriginModel(model) {
    return JSON.stringify({
        decision: model.decision || '',
        wish: model.wish || '',
        sound: model.sound || '',
        check: model.check || ''
    }, null, 2);
}

function buildNameOriginPrompt(result = currentBuildResult) {
    const givenName = getNameOriginGivenName(result);
    const givenReading = getNameOriginGivenReading(result);
    const surname = getNameOriginSurnameValue(result);
    const surnameYomi = getNameOriginSurnameReading(result);
    const checkMaterials = getNameOriginCheckMaterials(result);
    const originDetails = getNameOriginCombination(result).map((part) => {
        const kanji = getNameOriginKanjiValue(part);
        const meaning = kanji === '々'
            ? '直前の漢字を重ねる記号。前の字の印象を重ねて響かせる。'
            : getNameOriginMeaning(part);
        return { kanji, meaning };
    }).filter(item => item.kanji && item.meaning);
    const originDataText = JSON.stringify(originDetails);
    const checkMaterialsText = JSON.stringify(checkMaterials);

    return `
あなたは名付けアプリの由来文を整えるライターです。入力された確定情報だけを文章化してください。

【内部手順】
1. 漢字データを、この回答で使用できる意味の全量として整理する。
2. 確認材料から、実際に表示すべき注意点だけを選ぶ。
3. 整理した事実だけを使ってJSONを書く。整理過程は出力しない。

【出力】
・JSONだけを出力し、キーは "decision", "wish", "sound", "check" の4つだけにする。
・decisionは35〜60字。漢字の意味の取り合わせと、名前を選ぶ決め手を書く。願いと音の印象は書かない。
・wishは35〜60字。家族にそのまま伝えられる一文で、漢字データにある意味と親の願いをまとめる。
・soundは25〜45字。入力された読みの音の並びと呼びやすさだけを書く。
・checkは確認材料に根拠がある場合のみ20〜55字で書き、なければ空文字にする。
・JSON文字列内に改行を入れず、です・ます調で統一する。

【事実の制約】
・漢字データにない性格、能力、象徴、植物の性質、歴史、縁起、故事を足さない。
・「健やか」「瑞々しい」「成長」「生命力」「前向き」「朗らか」「温かな心」「芯の強さ」などは、漢字データに同じ意味が明記されている場合だけ使う。
・意味を自然に言い換えてよいが、新しい理想像や「〜のような存在」を作らない。
・根拠に迷う語は削り、情報量を増やすために推測しない。
・checkは確認材料だけを根拠にし、独自の読みづらさや一般語判定を追加しない。

【表現】
・decisionとwishで同じ内容・結論・語尾を繰り返さない。
・decisionは「〜が決め手です」「〜を組み合わせた名前です」の自然な現在形にし、「選ばれます」のような受け身の説明口調を使わない。
・将来を断定せず、「人生の荒波」「未来を切り拓く」「道しるべ」「可能性の扉」「輝く未来」などの定型比喩を使わない。
・名字との相性は書かない。ただしcheckの確認材料に名字由来の項目がある場合だけ触れてよい。
・soundでは漢字の意味、性別、流行、年代、語源に触れない。
・soundで「誰からも」「誰にでも」「必ず」のような普遍的な呼びやすさを断定しない。
・名前をかぎ括弧で書く場合は、入力された名前を「」で正しく囲む。

【JSON形式】
{"decision":"","wish":"","sound":"","check":""}

【入力】
名前: ${givenName || ''}
読み: ${givenReading || ''}
名字: ${surname || ''}
名字読み: ${surnameYomi || ''}
漢字データ: ${originDataText}
確認材料: ${checkMaterialsText}
`.trim();
}

async function generateOrigin(options = {}) {
    if (nameOriginGenerationInFlight) return;

    const target = options.result || currentBuildResult;
    const givenName = getNameOriginGivenName(target);
    const combination = getNameOriginCombination(target);
    if (!target || !givenName) {
        alert('名前が決定されていません');
        return;
    }

    const persistedOriginText = normalizeNameOriginText(target?.origin);
    if (persistedOriginText && !options.force) {
        renderAIOriginResult(target, persistedOriginText, false, options);
        if (typeof syncBuildSaveButton === 'function') syncBuildSaveButton(true);
        return;
    }
    if (combination.length === 0) {
        alert('名前の漢字情報が見つかりません');
        return;
    }

    const modelMetadata = await getActiveAiModelMetadata();
    let modelCacheVersion = modelMetadata.modelCacheVersion;
    let cachedModelName = '';
    const cloudCacheKey = getNameOriginCacheKey(target, modelCacheVersion);
    let cachedText = getNameOriginStoredTextForItem(target, modelCacheVersion);
    if (!cachedText && !options.force && !hasNameOriginCacheReset(target)) {
        try {
            const cloudCache = await callNameOriginCacheApi({
                action: 'getOrigin',
                cacheKey: cloudCacheKey,
                promptVersion: NAME_ORIGIN_PROMPT_VERSION,
                modelCacheVersion
            });
            if (cloudCache?.hit) {
                cachedText = validateGeneratedNameOriginText(cloudCache.text || '', target);
                cachedModelName = String(cloudCache.modelName || '').trim();
            }
        } catch (error) {
            console.warn('NAME_ORIGIN_CACHE: cloud read failed', error);
        }
    }
    if (cachedText && !options.force) {
        target.origin = cachedText;
        target.originPromptVersion = NAME_ORIGIN_PROMPT_VERSION;
        target.originModelCacheVersion = modelCacheVersion;
        target.originModelName = cachedModelName;
        if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
            currentBuildResult.origin = cachedText;
            currentBuildResult.originPromptVersion = NAME_ORIGIN_PROMPT_VERSION;
            currentBuildResult.originModelCacheVersion = modelCacheVersion;
            currentBuildResult.originModelName = cachedModelName;
        }
        const cacheMeta = { modelCacheVersion, modelName: cachedModelName };
        saveNameOriginCache(target, cachedText, cacheMeta);
        persistNameOriginToSavedItems(target, cachedText, { ...options, ...cacheMeta });
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
    const generationToken = ++activeNameOriginGenerationToken;
    renderNameOriginLoading(target);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(getMeimayApiUrl('/api/gemini'), {
            method: 'POST',
            headers: await getAuthenticatedAiRequestHeaders(),
            body: JSON.stringify({
                prompt: buildNameOriginPrompt(target),
                taskType: 'nameOrigin'
            }),
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
        modelCacheVersion = String(data.model_cache_version || modelCacheVersion).trim();
        const modelName = String(data.debug_used_model || '').trim();
        const aiText = validateGeneratedNameOriginText(data.text, target);
        if (!aiText) throw new Error('由来文を取得できませんでした。');

        target.origin = aiText;
        target.originPromptVersion = NAME_ORIGIN_PROMPT_VERSION;
        target.originModelCacheVersion = modelCacheVersion;
        target.originModelName = modelName;
        if (typeof currentBuildResult !== 'undefined' && currentBuildResult && isSameNameOriginTarget(currentBuildResult, target)) {
            currentBuildResult.origin = aiText;
            currentBuildResult.originPromptVersion = NAME_ORIGIN_PROMPT_VERSION;
            currentBuildResult.originModelCacheVersion = modelCacheVersion;
            currentBuildResult.originModelName = modelName;
        }
        const cacheMeta = { modelCacheVersion, modelName };
        saveNameOriginCache(target, aiText, cacheMeta);
        persistNameOriginToSavedItems(target, aiText, { ...options, ...cacheMeta });
        try {
            await callNameOriginCacheApi({
                action: 'saveOrigin',
                cacheKey: getNameOriginCacheKey(target, modelCacheVersion),
                promptVersion: NAME_ORIGIN_PROMPT_VERSION,
                modelCacheVersion,
                modelName,
                text: aiText
            });
        } catch (cacheError) {
            console.warn('NAME_ORIGIN_CACHE: cloud save failed', cacheError);
        }
        if (generationToken === activeNameOriginGenerationToken) {
            renderAIOriginResult(target, aiText, false, options);
        }
    } catch (err) {
        await refundDailyNameOriginUseForGeneration(consumption);
        console.warn("AI_NAME_ORIGIN_FAILURE:", err);
        const fallbackText = generateFallbackOrigin(givenName, combination);
        if (generationToken === activeNameOriginGenerationToken) {
            renderAIOriginResult(target, fallbackText, true, options);
            if (typeof showToast === 'function') showToast('AI由来を作れませんでした', '!');
        }
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
    modal.onclick = (event) => {
        if (event.target === modal) closeOriginModal();
    };
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in name-origin-sheet">
            <button type="button" class="name-origin-dismiss-action" onclick="closeOriginModal()" aria-label="閉じる">×</button>
            <div class="name-origin-header">
                <div class="name-origin-eyebrow">名前に込める願い</div>
                ${renderNameOriginHeaderCards(result, { disabled: true })}
                ${givenReading ? `<div class="name-origin-reading">${givenReading}</div>` : ''}
            </div>
            <div class="name-origin-loading-content">
                <div class="name-origin-loading-mark" aria-hidden="true"></div>
                <p class="name-origin-loading-text">名前に込める願いを整えています</p>
            </div>
        </div>
    `;
}

function escapeNameOriginHtml(text) {
    return escapeHtml(normalizeNameOriginText(text));
}

const NAME_ORIGIN_SECTION_META = {
    'この名前の決め手': { icon: '🌱', label: '決め手' },
    '家族に伝える願い': { icon: '💛', label: '家族に伝える願い' },
    '漢字に込めた意味': { icon: '💡', label: '漢字の意味' },
    '呼んだときの印象': { icon: '🔊', label: '響き' },
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
            ${renderNameOriginMeaningSection(model.meanings)}
            ${renderNameOriginSection('家族に伝える願い', model.wish)}
            ${renderNameOriginSection('確認しておきたいこと', model.check)}
            ${renderNameOriginSection('呼んだときの印象', model.sound)}
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
    modal.onclick = (event) => {
        if (event.target === modal) closeOriginModal();
    };
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in name-origin-sheet">
            <button type="button" class="name-origin-dismiss-action" onclick="closeOriginModal()" aria-label="閉じる">×</button>
            <div class="name-origin-header">
                <div class="name-origin-eyebrow">${isFallback ? '由来案' : '名前に込める願い'}</div>
                ${renderNameOriginHeaderCards(result)}
                ${givenReading ? `<div class="name-origin-reading">${givenReading}</div>` : ''}
            </div>
            <div class="name-origin-scroll-area">
                <div class="name-origin-card">
                    ${renderNameOriginStructuredBody(result, text)}
                </div>
                ${isFallback ? `
                    <p class="name-origin-note">
                        AIサービスに接続できなかったため、端末内の情報で下書きを表示しています。
                    </p>
                ` : ''}
                <div class="name-origin-actions">
                    <button onclick="saveCurrentNameFromOrigin()" class="name-origin-save-action">
                        <div class="build-save-btn-title">💾 保存</div>
                        <div class="build-save-btn-detail">今の名前を保存</div>
                    </button>
                </div>
                <button onclick="closeOriginModal()" class="name-origin-close-action">閉じる</button>
            </div>
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
    activeNameOriginGenerationToken += 1;
    if (m) {
        m.classList.remove('active');
        m.onclick = null;
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

function saveCurrentNameFromOrigin() {
    const target = currentNameOriginRenderTarget || currentBuildResult;
    if (!target || !getNameOriginGivenName(target)) {
        alert('保存する名前がありません');
        return;
    }

    if (typeof currentBuildResult !== 'undefined') {
        currentBuildResult = target;
    }

    const originText = normalizeNameOriginText(target.origin);
    if (originText) {
        saveNameOriginCache(target, originText);
        persistNameOriginToSavedItems(target, originText, currentNameOriginRenderOptions);
    }

    closeOriginModal();
    if (typeof saveName === 'function') {
        saveName();
    } else if (typeof showToast === 'function') {
        showToast('保存画面を開けませんでした', '!');
    } else {
        alert('保存画面を開けませんでした');
    }
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

async function loadKanjiMeaningDetails() {
    if (!kanjiMeaningDetailsPromise) {
        kanjiMeaningDetailsPromise = fetch(KANJI_MEANING_DETAILS_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`meaning details load failed: ${response.status}`);
                return response.json();
            })
            .catch((error) => {
                console.warn('KANJI_MEANING_DETAILS:', error);
                return {};
            });
    }
    return kanjiMeaningDetailsPromise;
}

function getKanjiMeaningDetailText(kanji, meaningDetails) {
    const entry = meaningDetails && typeof meaningDetails === 'object' ? meaningDetails[kanji] : null;
    const raw = typeof entry === 'string' ? entry : entry?.meaning;
    return typeof clean === 'function' ? clean(raw || '') : String(raw || '').trim();
}

function isKanjiDetailAiCacheCurrent(cached, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    return !!(cached
        && cached.promptVersion === KANJI_DETAIL_AI_PROMPT_VERSION
        && cached.modelCacheVersion === modelCacheVersion);
}

function isKanjiDetailAiCacheCompatible(cached, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    return !!(cached
        && KANJI_DETAIL_COMPATIBLE_PROMPT_VERSIONS.has(cached.promptVersion)
        && cached.modelCacheVersion === modelCacheVersion);
}

function getStoredKanjiDetailAiText(kanji, modelCacheVersion = getActiveAiModelCacheVersionSync()) {
    if (typeof StorageBox === 'undefined' || typeof StorageBox.getKanjiAiCache !== 'function') return '';
    const cached = StorageBox.getKanjiAiCache(kanji);
    if (!isKanjiDetailAiCacheCompatible(cached, modelCacheVersion)) return '';
    return String(cached?.text || '').trim();
}

window.isKanjiDetailAiCacheCurrent = isKanjiDetailAiCacheCurrent;
window.isKanjiDetailAiCacheCompatible = isKanjiDetailAiCacheCompatible;
window.KANJI_DETAIL_AI_PROMPT_VERSION = KANJI_DETAIL_AI_PROMPT_VERSION;

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
        promptContext: '検証済みメモ: 「舵」は形声字として扱い、漢字構成は「舟」と「它」です。成り立ちの説明はこの検証済み情報から逸脱しないでください。',
        requiredKeywords: ['舟', '它']
    },
    '櫂': {
        promptContext: '検証済みメモ: 「櫂」は形声字として扱い、漢字構成は「木」と「翟」です。成り立ちの説明はこの検証済み情報から逸脱しないでください。',
        requiredKeywords: ['木', '翟']
    }
};
const KANJI_ORIGIN_UNVERIFIED_TEXT = '検証済みの字源情報がないため、成り立ちの説明は掲載していません。';

const KANJI_DETAIL_CORE_SECTION_ORDER = ['成り立ち', '意味の深掘り', '代表的な熟語'];
const KANJI_DETAIL_CORE_SECTION_SET = new Set(KANJI_DETAIL_CORE_SECTION_ORDER);
const KANJI_DETAIL_DISPLAY_SECTION_ORDER = ['意味の深掘り', '成り立ち'];
const KANJI_DETAIL_SECTION_ICON_MAP = {
    '成り立ち': '🧬',
    '意味の深掘り': '💡',
    '代表的な熟語': '✨'
};

const KANJI_DETAIL_DATASET_URL = '/data/kanji_detail_dataset.json?v=25.24';
const KANJI_ETYMOLOGY_FACTS_URL = '/data/kanji_etymology_facts.json?v=26.06';
const KANJI_COMPOUNDS_URL = '/data/kanji_compounds.json?v=26.03';
let kanjiDetailDatasetPromise = null;
let kanjiEtymologyFactsPromise = null;
let kanjiCompoundsPromise = null;

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

function representativeIdiomLineHasMeaning(line) {
    return /^・?.+?（.+?）[:：]\s*.+/.test(sanitizeKanjiAiText(line));
}

function dedupeRepresentativeIdiomLines(lines, limit = 5) {
    const mergedLines = [];
    const wordIndexes = new Map();

    for (const rawLine of Array.isArray(lines) ? lines : []) {
        const line = sanitizeKanjiAiText(rawLine);
        if (!line) continue;

        const word = extractRepresentativeIdiomWord(line);
        const normalizedWord = sanitizeKanjiAiText(word).replace(/[・\s]/g, '');
        const key = normalizedWord || line;
        if (wordIndexes.has(key)) {
            const currentIndex = wordIndexes.get(key);
            if (!representativeIdiomLineHasMeaning(mergedLines[currentIndex])
                && representativeIdiomLineHasMeaning(line)) {
                mergedLines[currentIndex] = line;
            }
            continue;
        }

        wordIndexes.set(key, mergedLines.length);
        mergedLines.push(line);
    }

    return limit ? mergedLines.slice(0, limit) : mergedLines;
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

async function loadKanjiEtymologyFacts() {
    if (!kanjiEtymologyFactsPromise) {
        kanjiEtymologyFactsPromise = fetch(KANJI_ETYMOLOGY_FACTS_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`etymology facts load failed: ${response.status}`);
                return response.json();
            })
            .then((data) => (data?.entries && typeof data.entries === 'object' ? data.entries : {}))
            .catch((error) => {
                console.warn('KANJI_ETYMOLOGY_FACTS:', error);
                return {};
            });
    }
    return kanjiEtymologyFactsPromise;
}

async function loadKanjiCompounds() {
    if (!kanjiCompoundsPromise) {
        kanjiCompoundsPromise = fetch(KANJI_COMPOUNDS_URL)
            .then((response) => {
                if (!response.ok) throw new Error(`kanji compounds load failed: ${response.status}`);
                return response.json();
            })
            .then((data) => (data?.entries && typeof data.entries === 'object' ? data.entries : {}))
            .catch((error) => {
                console.warn('KANJI_COMPOUNDS:', error);
                return {};
            });
    }
    return kanjiCompoundsPromise;
}

function normalizeEtymologyFactValues(values) {
    return (Array.isArray(values) ? values : [])
        .map((value) => sanitizeKanjiAiText(value))
        .filter(Boolean);
}

function buildStructuredEtymologyText(kanji, factEntry) {
    const fixedOriginText = sanitizeKanjiAiText(factEntry?.fixedOriginText || '');
    if (fixedOriginText) return fixedOriginText;

    const formationTypes = normalizeEtymologyFactValues(factEntry?.formationTypes);
    const semanticComponent = sanitizeKanjiAiText(factEntry?.semanticComponent || '');
    const phoneticComponent = sanitizeKanjiAiText(factEntry?.phoneticComponent || '');
    const isCrossChecked = factEntry?.verificationStatus === 'cross_checked';
    let originText = '';

    // KRAD components are visual search data, not etymological evidence.
    // Never turn component-only records into a user-facing origin explanation.
    if (factEntry?.verificationStatus === 'component_only') return '';

    if (!formationTypes.length) {
        return '';
    }

    if (formationTypes.length === 1 && formationTypes[0] === '形声' && semanticComponent && phoneticComponent) {
        originText = isCrossChecked
            ? `「${kanji}」は、意味を表す「${semanticComponent}」と、音を表す「${phoneticComponent}」を組み合わせた形声文字です。`
            : `参照資料では「${kanji}」は、意味を表す「${semanticComponent}」と、音を表す「${phoneticComponent}」を組み合わせた形声文字とされています。`;
    } else if (formationTypes.length === 1) {
        const explanationMap = {
            '象形': 'ものの形をかたどって作られた象形文字',
            '指事': '記号的な印で概念を示して作られた指事文字',
            '会意': '複数の要素の意味を組み合わせて作られた会意文字',
            '形声': '意味を表す要素と音を表す要素を組み合わせた形声文字',
            '会意形声': '要素の意味と音の手がかりを併せ持つ会意形声文字',
            '仮借': '既存の文字を、音が近い別の語に用いた仮借文字'
        };
        const explanation = explanationMap[formationTypes[0]] || '';
        if (explanation) {
            originText = isCrossChecked
                ? `「${kanji}」は、${explanation}です。`
                : `参照資料では「${kanji}」は、${explanation}とされています。`;
        }
    } else {
        originText = `「${kanji}」の成り立ちは、資料上で「${formationTypes.join('・')}」の分類が示されています。`;
    }

    if (!originText) return '';
    // IDS strings such as 「⿰氵毎」 are internal structure metadata and must not be shown.
    if (phoneticComponent && !originText.includes(`「${phoneticComponent}」`)) {
        originText += `音を表す要素は「${phoneticComponent}」です。`;
    }
    return sanitizeKanjiAiText(originText);
}

function buildStructuredEtymologyHint(kanji, factEntry) {
    const originText = buildStructuredEtymologyText(kanji, factEntry);
    if (!originText) return null;

    const keywordSet = new Set(normalizeEtymologyFactValues(factEntry?.formationTypes));
    if (factEntry?.fixedOriginText) {
        return {
            promptContext: `検証済みの構造化データ: ${originText}`,
            requiredKeywords: Array.from(keywordSet),
            fixedOriginText: originText
        };
    }
    appendRequiredHanCharacters(keywordSet, factEntry?.semanticComponent || '');
    appendRequiredHanCharacters(keywordSet, factEntry?.phoneticComponent || '');
    normalizeEtymologyFactValues(factEntry?.visualComponents)
        .forEach((component) => appendRequiredHanCharacters(keywordSet, component));
    if (keywordSet.size === 0) {
        appendRequiredHanCharacters(keywordSet, String(factEntry?.structure || '').replace(/[\u2FF0-\u2FFF]/g, ''));
    }
    return {
        promptContext: `検証済みの構造化データ: ${originText}`,
        requiredKeywords: Array.from(keywordSet),
        fixedOriginText: originText
    };
}

function normalizeCompoundGlosses(item) {
    return (Array.isArray(item?.glosses) ? item.glosses : [])
        .map((gloss) => sanitizeKanjiAiText(gloss).replace(/[\r\n]+/g, ' ').slice(0, 120))
        .filter(Boolean)
        .slice(0, 1);
}

function buildCompoundPromptCandidateText(compoundItems) {
    const lines = [];
    const seenMeanings = new Set();
    for (const item of (Array.isArray(compoundItems) ? compoundItems : []).slice(0, 24)) {
            const word = sanitizeKanjiAiText(item?.word || '');
            const reading = sanitizeKanjiAiText(item?.reading || '');
            const glosses = normalizeCompoundGlosses(item);
            if (!isLikelyRepresentativeIdiomWord(word) || !reading || !glosses.length) continue;
            const meaningKey = `${reading}|${glosses.join('|').toLowerCase()}`;
            if (seenMeanings.has(meaningKey)) continue;
            seenMeanings.add(meaningKey);
            lines.push(`・${word}（${reading}）：${glosses.join(' / ')}`);
    }
    return lines.join('\n');
}

function parseValidatedCompoundMeaningLine(line, allowedCompounds) {
    const normalized = sanitizeKanjiAiText(line).replace(/^[・\-•●◇◆\d０-９]+[.)、．.]?\s*/, '');
    const match = normalized.match(/^(.+?)（(.+?)）[:：]\s*(.+)$/);
    if (!match) return null;

    const word = sanitizeKanjiAiText(match[1]);
    const reading = sanitizeKanjiAiText(match[2]);
    let meaning = sanitizeKanjiAiText(match[3]);
    const allowed = allowedCompounds.get(word);
    if (!allowed || reading !== allowed.reading) return null;
    if (meaning.length < 6 || meaning.length > 70) return null;
    if (!/[\u3040-\u30ff\u3400-\u9fff]/u.test(meaning)) return null;
    if (/https?:\/\/|出典|参考|アスタリスク/.test(meaning)) return null;
    const compactMeaning = meaning.replace(/[\s、。,.!！?？「」『』（）()]/g, '');
    if (
        compactMeaning === word
        || compactMeaning === `${word}のこと`
        || compactMeaning === `${word}をいう`
        || compactMeaning === `${word}すること`
        || compactMeaning === `${word}です`
    ) {
        return null;
    }
    if (!/[。.!！?？]$/.test(meaning)) meaning += '。';
    return `・${word}（${reading}）：${meaning}`;
}

function buildStructuredCompoundText(compoundItems, aiContent = '') {
    const allowedCompounds = new Map();
    for (const item of Array.isArray(compoundItems) ? compoundItems : []) {
        const word = sanitizeKanjiAiText(item?.word || '');
        const reading = sanitizeKanjiAiText(item?.reading || '');
        if (!isLikelyRepresentativeIdiomWord(word) || !reading || allowedCompounds.has(word)) continue;
        allowedCompounds.set(word, { reading });
    }

    const lines = [];
    const seen = new Set();
    for (const rawLine of normalizeRepresentativeIdiomSectionText(aiContent).split('\n')) {
        const line = parseValidatedCompoundMeaningLine(rawLine, allowedCompounds);
        const word = line ? extractRepresentativeIdiomWord(line) : '';
        if (!line || !word || seen.has(word)) continue;
        seen.add(word);
        lines.push(line);
        if (lines.length >= 3) return lines.join('\n');
    }
    if (lines.length) return lines.join('\n');

    for (const item of Array.isArray(compoundItems) ? compoundItems : []) {
        const word = sanitizeKanjiAiText(item?.word || '');
        const reading = sanitizeKanjiAiText(item?.reading || '');
        if (!isLikelyRepresentativeIdiomWord(word) || !reading || seen.has(word)) continue;
        seen.add(word);
        lines.push(`・${word}（${reading}）`);
        if (lines.length >= 3) break;
    }
    return lines.join('\n');
}

function getRequiredRepresentativeIdiomCount(compoundItems) {
    const words = new Set();
    for (const item of Array.isArray(compoundItems) ? compoundItems : []) {
        const word = sanitizeKanjiAiText(item?.word || '');
        const reading = sanitizeKanjiAiText(item?.reading || '');
        const glosses = normalizeCompoundGlosses(item);
        if (!isLikelyRepresentativeIdiomWord(word) || !reading || !glosses.length) continue;
        words.add(word);
        if (words.size >= 3) return 3;
    }
    return words.size;
}

function buildDatasetGroundedHint(kanji, datasetEntry) {
    const originText = getKanjiDetailDatasetSectionText(datasetEntry, '成り立ち');
    const originSource = String(datasetEntry?.sources?.origin || '').trim();
    const hasBrokenGlyph = /[\uE000-\uF8FF\uFFFD]/u.test(originText);
    const hasOriginBasis = /(?:字源|漢字構成|形声|会意|象形|指事)/.test(originText);
    if (!originText || originText.length < 25 || !originSource || hasBrokenGlyph || !hasOriginBasis) return null;
    return {
        promptContext: `検証済みメモ: 「${kanji}」の成り立ちは次の情報に従ってください。${originText}`,
        requiredKeywords: extractRequiredKeywordsFromOriginText(originText)
    };
}

function getKanjiDetailGroundedHint(kanji, datasetEntry, etymologyFact) {
    return buildStructuredEtymologyHint(kanji, etymologyFact)
        || KANJI_DETAIL_GROUNDED_HINTS[kanji]
        || buildDatasetGroundedHint(kanji, datasetEntry)
        || null;
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

function getKanjiDetailDisplaySections(aiText) {
    const sections = getOrderedKanjiDetailSections(aiText);
    const byTitle = new Map(sections.map((section) => [section.title, section]));
    const coreTitles = new Set(KANJI_DETAIL_CORE_SECTION_ORDER);
    const preferred = KANJI_DETAIL_DISPLAY_SECTION_ORDER
        .map((title) => byTitle.get(title))
        .filter(Boolean);
    const readingEvidence = sections.filter((section) => !coreTitles.has(section.title));
    const idioms = byTitle.get('代表的な熟語');
    return [...preferred, ...readingEvidence, ...(idioms ? [idioms] : [])];
}

function canonicalizeKanjiDetailText(aiText) {
    const sections = getOrderedKanjiDetailSections(aiText);
    if (!sections.length) return sanitizeKanjiAiText(aiText);
    return sections
        .map(({ title, content }) => {
            const body = title === '代表的な熟語'
                ? (formatRepresentativeIdiomContent(content) || (sanitizeKanjiAiText(content) === '該当なし' ? '該当なし' : ''))
                : sanitizeKanjiAiText(content);
            return body ? `【${title}】\n${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function mergeKanjiDetailSectionsFromDataset(aiText, datasetEntry, kanji = '', groundedSegments = null, etymologyFact = null, compoundItems = []) {
    const sectionMap = extractKanjiDetailSectionMap(aiText);
    const blocks = [];
    const structuredOriginText = buildStructuredEtymologyText(kanji, etymologyFact);

    for (const title of KANJI_DETAIL_CORE_SECTION_ORDER) {
        const datasetSection = title === '成り立ち' && structuredOriginText
            ? structuredOriginText
            : getKanjiDetailDatasetSectionText(datasetEntry, title);
        const aiSection = sectionMap.get(title) || '';
        if (title === '代表的な熟語') {
            const verifiedCompounds = buildStructuredCompoundText(compoundItems, aiSection);
            blocks.push(`【${title}】\n${verifiedCompounds || '該当なし'}`);
            continue;
        }

        const content = title === '成り立ち'
            ? (structuredOriginText || (isLikelyTruncatedSection(aiSection) && sanitizeKanjiAiText(datasetSection)
                ? sanitizeKanjiAiText(datasetSection)
                : (sanitizeKanjiAiText(aiSection).includes(KANJI_ORIGIN_UNVERIFIED_TEXT)
                    ? KANJI_ORIGIN_UNVERIFIED_TEXT
                    : sanitizeKanjiAiText(aiSection || datasetSection))))
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
    if (!groundedHint) return normalized !== KANJI_ORIGIN_UNVERIFIED_TEXT;
    if (normalized.length < 12) return true;
    if (/[、,・\/／:：]$/.test(normalized)) return true;
    if (!/[。！？!?．.]$/.test(normalized)) return true;
    if (groundedHint && !cachedKanjiDetailMatchesHint(normalized, groundedHint)) return true;
    return false;
}

function getKanjiDetailCompletionStatus(aiText, groundedHint = null, requiredIdiomsCount = 1) {
    const sectionMap = extractKanjiDetailSectionMap(aiText);
    const originSection = sectionMap.get('成り立ち') || '';
    const meaningSection = sectionMap.get('意味の深掘り') || '';
    const idiomsSection = sectionMap.get('代表的な熟語') || '';
    const idiomsCount = countRepresentativeIdiomCandidates(idiomsSection);
    const idiomLines = parseRepresentativeIdiomLines(idiomsSection);
    const idiomsMarkedNone = sanitizeKanjiAiText(idiomsSection) === '該当なし';
    const idiomsHaveMeanings = idiomLines.length > 0
        && idiomLines.every((line) => /^・?.+?（.+?）[:：]\s*.+[。.!！?？]$/.test(line));
    const missingSections = [];

    if (isOriginSectionTooShallow(originSection, groundedHint)) missingSections.push('成り立ち');
    if (isMeaningSectionTooShallow(meaningSection)) missingSections.push('意味の深掘り');
    const normalizedRequiredIdiomsCount = Math.max(0, Math.min(3, Number(requiredIdiomsCount) || 0));
    const idiomsComplete = normalizedRequiredIdiomsCount === 0
        ? idiomsMarkedNone
        : (idiomsHaveMeanings && idiomsCount >= normalizedRequiredIdiomsCount);
    if (!sectionMap.has('代表的な熟語') || !idiomsComplete) {
        missingSections.push('代表的な熟語');
    }
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

function formatRepresentativeIdiomContent(content, targetKanji = '', groundedSegments = null) {
    const parsed = parseRepresentativeIdiomLines(content);
    const unsafeMeaningPattern = /(?:人名|人物|大夫|宗主|名は|の子|政治家|武将|詩人|歌人|学者|僧侶|天皇|皇帝|王の名)/;
    const normalizedGroundedSegments = Array.isArray(groundedSegments)
        ? groundedSegments.map((segment) => sanitizeKanjiAiText(segment).replace(/\s+/g, '')).filter(Boolean)
        : null;
    const filtered = parsed.filter((line) => {
        const word = extractRepresentativeIdiomWord(line);
        if (targetKanji && !word.includes(targetKanji)) return false;
        if (normalizedGroundedSegments && !normalizedGroundedSegments.some((segment) => segment.includes(word))) return false;
        return !unsafeMeaningPattern.test(line);
    });
    return dedupeRepresentativeIdiomLines(filtered).slice(0, 3).join('\n');
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

function buildKanjiDetailPrompt(kanji, readings, meaning, detailedMeaning, groundedHint, compoundItems = []) {
    const compoundCandidates = buildCompoundPromptCandidateText(compoundItems);
    const requiredIdiomsCount = getRequiredRepresentativeIdiomCount(compoundItems);
    return `
漢字「${kanji}」について、以下の項目を簡潔にまとめてください。

【入力情報】
読み: ${readings || '不明'}
意味の要約: ${meaning || '不明'}
漢字データの詳細語義: ${detailedMeaning || meaning || '不明'}
${groundedHint?.promptContext ? `検証済み情報: ${groundedHint.promptContext}` : ''}
検証済み熟語候補（英語語義はJMdict収録情報）:
${compoundCandidates || '該当なし'}

以下の3項目をすべて必ず出力してください。1項目でも欠けた回答は失敗です。順番と見出しは完全一致させてください。

【成り立ち】
${groundedHint?.promptContext
        ? '検証済み情報だけを言い換え、この漢字がどのように作られたかを45〜75文字で説明してください。検証済み情報にない部品、声符、解釈は足さないでください。'
        : `検証済みの字源情報が入力されていません。「${KANJI_ORIGIN_UNVERIFIED_TEXT}」とだけ出力してください。部品、つくり、声符を推測しないでください。`}

【意味の深掘り】
「漢字データの詳細語義」に書かれている意味だけを使い、元々の意味、名前に使うときのニュアンス、広がりを60〜100文字で説明してください。入力にない象徴や性格を足さず、必ず句点で終えてください。

【代表的な熟語】
検証済み熟語候補から${requiredIdiomsCount > 0 ? `必ず${requiredIdiomsCount}語` : '該当なし'}を出し、「・熟語（よみ）：日本語の意味。」の形式で1行ずつ出力してください。候補がある限り、各行の意味を省略しないでください。

【絶対に守るルール】
・セクション順は必ず【成り立ち】→【意味の深掘り】→【代表的な熟語】にしてください。
・【成り立ち】【意味の深掘り】【代表的な熟語】の3セクションを必ずすべて出力してください。
・見出しは指定された3種類の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。
・口調は必ずです・ます調で統一してください。
・「アプリ内辞書では」という表現は使わないでください。
・詳細語義に複数の意味がある場合は、名前向きに自然な意味を中心にしつつ、字義の広がりがあることも反映してください。
・詳細語義にある意味と矛盾する説明は書かないでください。
・熟語は検証済み候補にある語だけを使い、新しい熟語を生成しないでください。表記と読みを変更しないでください。
・熟語の意味は、候補に付いた英語語義から確認できる範囲だけを自然な日本語で要約してください。推測や連想を足さないでください。
・熟語候補に複数の語義があっても意味を混ぜず、最初の語義だけを簡潔に説明してください。
・意味は初めて読む人にも分かる平易な言葉で15〜45文字を目安に説明し、「音楽：音楽。」のように熟語をそのまま繰り返すだけの説明は禁止します。
・熟語は命名画面に合う印象を考え、肯定的な語、中立的な語、否定的な語の順で優先してください。ただし候補が少ない場合は否定的な語も省略せず、優先順位を下げて使用してください。
・候補が4語以上ある場合、否定的な語より肯定的・中立的な語を優先してください。たとえば「音」では「弱音」「爆音」より「音楽」「和音」「音色」のような語を優先してください。
・四字熟語・故事成語・ことわざは出力しないでください。
・架空の人物、存在しない著名人、存在しない言葉は絶対に書かないでください。
・脚注記号、アスタリスク、参考番号、URLは書かないでください。
・【入力情報】や【基本情報】のようなセクションは出力しないでください。
・セクション名以外の前置きや締めの一文は書かないでください。
・部品、つくり、声符を推測で書かないでください。確信がない場合でも【成り立ち】は省略せず、不確かさが残る説明として出力してください。
・検証済み情報が与えられている場合は、必ずそれに従ってください。勝手に別の部品へ言い換えないでください。
・「人生の荒波」「未来を切り拓く」「道しるべ」「可能性を広げる」など、字義にない比喩や定型的な名付け表現を足さないでください。
`.trim();
}

function getKanjiReadingEvidence(kanjiData, currentReading) {
    const normalizedReading = normalizeNameOriginReadingValue(currentReading);
    const sources = [
        { category: '音読み', raw: kanjiData?.['音'] || '' },
        { category: '訓読み', raw: kanjiData?.['訓'] || '' },
        { category: '名乗り', raw: kanjiData?.['伝統名のり'] || '' }
    ];
    for (const source of sources) {
        const forms = getNameOriginReadingForms(source.raw, { includeStem: true });
        if (forms.includes(normalizedReading)) {
            return {
                verified: true,
                category: source.category,
                sourceReadings: String(source.raw || '').trim()
            };
        }
    }
    return {
        verified: false,
        category: '未確認',
        sourceReadings: sources.map((source) => `${source.category}: ${source.raw || 'なし'}`).join(' / ')
    };
}

function buildKanjiReadingPrompt(kanji, currentReading, evidence = {}) {
    return `
漢字「${kanji}」の「${currentReading}」という読みについて、検証済みの収録データだけを使い、100文字以内で説明してください。

【検証済み情報】
判定: ${evidence.verified ? '確認済み' : '未確認'}
読みの分類: ${evidence.category || '未確認'}
収録されている読み: ${evidence.sourceReadings || 'なし'}

【絶対に守るルール】
・口調は必ずです・ます調で統一してください。
・本文だけを出力し、見出しは付けないでください。
・判定が確認済みなら、どの分類に収録されている読みかを説明してください。
・音読み・訓読み・名乗りとして収録されている事実と、その読みが歴史的に成立した理由は別です。成立理由の資料は与えられていないため、語源、古代語、熟字訓、別の熟語からの派生を推測しないでください。
・判定が未確認なら「この漢字単独の読みとして、現在の収録データでは確認できません。」とだけ出力してください。
・架空の理由、存在しない出典、人物名、熟語の頭文字に由来するという説明は絶対に書かないでください。
・不確かな情報を補わず、確認できる事実だけを書いてください。
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
    if (/(?:人生の荒波|未来を切り拓く|道しるべ|可能性を広げる|輝く未来)/.test(normalized)) return true;
    if (!/[。！？!?．.]$/.test(normalized)) return true;
    return false;
}

function buildKanjiDetailRepairPrompt(kanji, readings, meaning, detailedMeaning, groundedHint, currentMeaning, compoundItems = []) {
    const compoundCandidates = buildCompoundPromptCandidateText(compoundItems);
    const requiredIdiomsCount = getRequiredRepresentativeIdiomCount(compoundItems);
    return `
漢字「${kanji}」の説明を完全な形に修正してください。

【入力情報】
読み: ${readings || '不明'}
意味の要約: ${meaning || '不明'}
漢字データの詳細語義: ${detailedMeaning || meaning || '不明'}
${groundedHint?.promptContext ? `検証済み情報: ${groundedHint.promptContext}` : ''}
検証済み熟語候補（英語語義はJMdict収録情報）:
${compoundCandidates || '該当なし'}

【現在の内容】
意味の深掘り: ${currentMeaning || 'なし'}

【お願い】
・足りない部分を補い、必ず3セクションをすべて出力してください。
・出力順は必ず【成り立ち】→【意味の深掘り】→【代表的な熟語】にしてください。
・見出しは【成り立ち】【意味の深掘り】【代表的な熟語】の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。
・【成り立ち】は、${groundedHint?.promptContext
        ? '検証済み情報だけを使って45〜75文字で書き、入力にない部品や声符を足さないでください。'
        : `「${KANJI_ORIGIN_UNVERIFIED_TEXT}」とだけ書いてください。部品や声符を推測しないでください。`}
・【意味の深掘り】は、「漢字データの詳細語義」を優先し、字義だけで終わらせず、元々の意味、名前に使うときのニュアンス、広がりを含めて60〜100文字で書いてください。必ず句点で終えてください。
・詳細語義にある意味と矛盾する説明は書かないでください。
・【代表的な熟語】は検証済み熟語候補から${requiredIdiomsCount > 0 ? `必ず${requiredIdiomsCount}語` : '該当なし'}を出し、「・熟語（よみ）：日本語の意味。」の形式で出力してください。候補にない語を生成せず、表記と読みを変えないでください。
・熟語は肯定的、中立的、否定的な印象の順で優先してください。候補が少ない場合は否定的な語も使用し、意味は必ず付けてください。
・熟語の意味は候補の英語語義だけを自然な日本語に要約し、推測や連想を足さないでください。
・熟語候補に複数の語義があっても意味を混ぜず、最初の語義だけを簡潔に説明してください。
・意味は初めて読む人にも分かる平易な言葉で15〜45文字を目安に説明し、熟語をそのまま繰り返すだけの説明は禁止します。
・四字熟語・故事成語・ことわざは出力しないでください。
・意味だけ、成り立ちだけで終わらせないでください。
`.trim();
}

async function callKanjiCacheApiWithAuth(payload) {
    const headers = await getAuthenticatedAiRequestHeaders();
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
    clearKanjiDetailReset(kanji, currentReading);
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.removeKanjiAiCache === 'function') {
        StorageBox.removeKanjiAiCache(kanji);
    }

    try {
        const metadata = await getActiveAiModelMetadata({ force: true });
        await callKanjiCacheApiWithAuth({
            action: 'delete',
            kanji,
            reading: readingPayload,
            promptVersion: KANJI_DETAIL_AI_PROMPT_VERSION,
            readingPromptVersion: KANJI_READING_AI_PROMPT_VERSION,
            modelCacheVersion: metadata.modelCacheVersion
        });

        markKanjiDetailReset(kanji, currentReading);
        const resultEl = document.getElementById('ai-kanji-result');
        if (resultEl) resultEl.innerHTML = '';
        alert('漢字の説明キャッシュをリセットしました。');
        return true;
    } catch (error) {
        console.warn('KANJI_DETAIL_RESET: api cache delete failed', error);
        clearKanjiDetailReset(kanji, currentReading);
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
    const [kanjiMeaningDetails, kanjiDetailDataset, kanjiEtymologyFacts, kanjiCompounds] = await Promise.all([
        loadKanjiMeaningDetails(),
        loadKanjiDetailDataset(),
        loadKanjiEtymologyFacts(),
        loadKanjiCompounds()
    ]);
    const detailedMeaning = getKanjiMeaningDetailText(kanji, kanjiMeaningDetails);
    const datasetEntry = kanjiDetailDataset?.[kanji] || null;
    const etymologyFact = kanjiEtymologyFacts?.[kanji] || null;
    const compoundItems = kanjiCompounds?.[kanji] || [];
    const requiredIdiomsCount = getRequiredRepresentativeIdiomCount(compoundItems);
    const groundedHint = getKanjiDetailGroundedHint(kanji, datasetEntry, etymologyFact);
    const modelMetadata = await getActiveAiModelMetadata();
    let modelCacheVersion = modelMetadata.modelCacheVersion;
    let baseModelName = '';
    let readingModelName = '';
    const readingCacheId = !isSpecialKanjiAiReading(currentReading)
        ? buildVersionedKanjiCacheDocId([
            kanji,
            currentReading,
            KANJI_READING_AI_PROMPT_VERSION,
            modelCacheVersion
        ])
        : '';
    const readingEvidence = getKanjiReadingEvidence(kanjiData, currentReading);
    const cacheResetMarked = hasKanjiDetailReset(kanji, currentReading);

    let baseText = '';
    let readingText = '';
    let baseFreshGenerated = false;
    let readingFreshGenerated = false;
    let finalIdiomsCount = 0;
    let baseGroundedSegments = [];
    let cacheHit = false;
    let dailyUseConsumed = false;

    const ensureDailyKanjiDetailUse = () => {
        if (dailyUseConsumed) return true;
        if (!consumeDailyKanjiDetailUse()) {
            if (typeof showToast === 'function') showToast('今日の無料AIは使い切りました', '🌙');
            return false;
        }
        dailyUseConsumed = true;
        return true;
    };

    try {
        const localCachedText = getStoredKanjiDetailAiText(kanji, modelCacheVersion);
        if (localCachedText && !cacheResetMarked) {
            const mergedLocalText = mergeKanjiDetailSectionsFromDataset(localCachedText, datasetEntry, kanji, null, etymologyFact, compoundItems);
            const localStatus = getKanjiDetailCompletionStatus(mergedLocalText, groundedHint, requiredIdiomsCount);
            if (localStatus.complete) {
                baseText = canonicalizeKanjiDetailText(mergedLocalText);
                finalIdiomsCount = localStatus.idiomsCount;
                cacheHit = true;
            }
            if (!localStatus.complete) console.warn('AI_KANJI_DETAIL: local cached explanation rejected', {
                kanji,
                missingSections: localStatus.missingSections,
                idiomCount: localStatus.idiomsCount
            });
            if (!localStatus.complete && typeof StorageBox !== 'undefined' && typeof StorageBox.removeKanjiAiCache === 'function') {
                StorageBox.removeKanjiAiCache(kanji);
            }
        }

        resultEl.innerHTML = `
            <div class="flex items-center justify-center py-6">
                <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                <span class="text-sm text-[#7a6f5a]">AIが分析中です...</span>
            </div>
        `;

        if (!cacheHit && typeof firebaseDb !== 'undefined' && firebaseDb && !cacheResetMarked) {
            try {
                let cachedData = null;
                let cachedText = '';
                for (const promptVersion of KANJI_DETAIL_COMPATIBLE_PROMPT_VERSIONS) {
                    const compatibleCacheId = buildVersionedKanjiCacheDocId([
                        kanji,
                        promptVersion,
                        modelCacheVersion
                    ]);
                    const doc = await firebaseDb.collection('kanji_ai_explanations').doc(compatibleCacheId).get();
                    const candidateData = doc.exists ? (doc.data() || {}) : null;
                    if (!isKanjiDetailAiCacheCompatible(candidateData, modelCacheVersion)) continue;
                    const candidateText = sanitizeKanjiAiText(candidateData?.text || '');
                    if (!candidateText) continue;
                    cachedData = candidateData;
                    cachedText = candidateText;
                    break;
                }
                if (cachedText) {
                    const mergedCachedText = mergeKanjiDetailSectionsFromDataset(cachedText, datasetEntry, kanji, null, etymologyFact, compoundItems);
                    const cachedStatus = getKanjiDetailCompletionStatus(mergedCachedText, groundedHint, requiredIdiomsCount);
                    if (cachedStatus.complete) {
                        baseText = canonicalizeKanjiDetailText(mergedCachedText);
                        finalIdiomsCount = cachedStatus.idiomsCount;
                        baseModelName = String(cachedData?.modelName || '').trim();
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
            if (!ensureDailyKanjiDetailUse()) return;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(getMeimayApiUrl('/api/gemini'), {
                method: 'POST',
                headers: await getAuthenticatedAiRequestHeaders(),
                body: JSON.stringify({
                    prompt: buildKanjiDetailPrompt(kanji, readings, meaning, detailedMeaning, groundedHint, compoundItems),
                    taskType: 'kanjiFact'
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
            modelCacheVersion = String(data.model_cache_version || modelCacheVersion).trim();
            baseModelName = String(data.debug_used_model || '').trim();
            baseGroundedSegments = Array.isArray(data.grounded_text_segments) ? data.grounded_text_segments : [];
            baseText = mergeKanjiDetailSectionsFromDataset(data.text || '', datasetEntry, kanji, baseGroundedSegments, etymologyFact, compoundItems);
            if (!baseText) {
                throw new Error('AIから説明を取得できませんでした。');
            }
            baseFreshGenerated = true;

            if (baseFreshGenerated) {
                for (let repairAttempt = 0; repairAttempt < 2; repairAttempt += 1) {
                    const status = getKanjiDetailCompletionStatus(baseText, groundedHint, requiredIdiomsCount);
                    if (status.complete) break;

                    try {
                        const repairController = new AbortController();
                        const repairTimeoutId = setTimeout(() => repairController.abort(), 30000);
                        const repairResponse = await fetch(getMeimayApiUrl('/api/gemini'), {
                            method: 'POST',
                            headers: await getAuthenticatedAiRequestHeaders(),
                            body: JSON.stringify({
                                prompt: buildKanjiDetailRepairPrompt(
                                    kanji,
                                    readings,
                                    meaning,
                                    detailedMeaning,
                                    groundedHint,
                                    status.meaningSection,
                                    compoundItems
                                ),
                                taskType: 'kanjiFact'
                            }),
                            signal: repairController.signal
                        });
                        clearTimeout(repairTimeoutId);

                        if (repairResponse.ok) {
                            const repairData = await repairResponse.json();
                            modelCacheVersion = String(repairData.model_cache_version || modelCacheVersion).trim();
                            baseModelName = String(repairData.debug_used_model || baseModelName).trim();
                            if (Array.isArray(repairData.grounded_text_segments)) {
                                baseGroundedSegments.push(...repairData.grounded_text_segments);
                            }
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

            baseText = mergeKanjiDetailSectionsFromDataset(baseText, datasetEntry, kanji, baseGroundedSegments, etymologyFact, compoundItems);
            const finalStatus = getKanjiDetailCompletionStatus(baseText, groundedHint, requiredIdiomsCount);
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
                        text: baseText,
                        promptVersion: KANJI_DETAIL_AI_PROMPT_VERSION,
                        modelCacheVersion,
                        modelName: baseModelName
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
                const readingCacheData = readingDoc.exists ? (readingDoc.data() || {}) : {};
                const cachedReason = sanitizeKanjiAiText(readingCacheData.text || '');
                const readingCacheCurrent = readingCacheData.promptVersion === KANJI_READING_AI_PROMPT_VERSION
                    && readingCacheData.modelCacheVersion === modelCacheVersion;
                if (cachedReason && readingCacheCurrent) {
                    readingText = `【「${currentReading}」の由来】\n${cachedReason}`;
                    readingCacheHit = true;
                }
                } catch (cacheError) {
                    console.warn('AI_KANJI_DETAIL: reading cache read failed', cacheError);
                }
            }

            if (!readingCacheHit && !readingEvidence.verified) {
                readingText = `【「${currentReading}」の由来】\nこの漢字単独の読みとして、現在の収録データでは確認できません。`;
                readingCacheHit = true;
            }

            if (!readingCacheHit && ensureDailyKanjiDetailUse()) {
                try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 120000);
                const response2 = await fetch(getMeimayApiUrl('/api/gemini'), {
                    method: 'POST',
                    headers: await getAuthenticatedAiRequestHeaders(),
                    body: JSON.stringify({
                        prompt: buildKanjiReadingPrompt(kanji, currentReading, readingEvidence),
                        taskType: 'kanjiFact'
                    }),
                    signal: controller2.signal
                });
                clearTimeout(timeoutId2);

                if (response2.ok) {
                    const data2 = await response2.json();
                    modelCacheVersion = String(data2.model_cache_version || modelCacheVersion).trim();
                    readingModelName = String(data2.debug_used_model || '').trim();
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
                                    text: reasonText,
                                    promptVersion: KANJI_READING_AI_PROMPT_VERSION,
                                    modelCacheVersion,
                                    modelName: readingModelName
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
            StorageBox.saveKanjiAiCache(kanji, baseText, {
                promptVersion: KANJI_DETAIL_AI_PROMPT_VERSION,
                modelCacheVersion,
                modelName: baseModelName
            });
        }

        if (getKanjiDetailCompletionStatus(baseText, groundedHint, requiredIdiomsCount).complete
            && (readingFreshGenerated || (baseFreshGenerated && isSpecialKanjiAiReading(currentReading)))) {
            clearKanjiDetailReset(kanji, currentReading);
        }
    } catch (err) {
        console.error('AI_KANJI_DETAIL:', err);
        if (shouldRefundOnFailure && dailyUseConsumed) {
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
    const sections = getKanjiDetailDisplaySections(normalizedText);

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
window.saveCurrentNameFromOrigin = saveCurrentNameFromOrigin;
window.regenerateCurrentNameOrigin = regenerateCurrentNameOrigin;
window.openNameOriginKanjiDetail = openNameOriginKanjiDetail;

console.log("ORIGIN: Module loaded (syntax corrected)");
