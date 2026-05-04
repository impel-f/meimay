/* ============================================================
   MODULE 02: ENGINE (V13.0)
   読み分割エンジン・スタック生成・スコアリング
   ============================================================ */

/**
 * 読みの分割パターンを計算
 */
function isInvalidReadingSegment(part) {
    if (!part) return true;
    if (/^[んぁぃぅぇぉゃゅょゎっ]/.test(part)) return true;
    return false;
}

function isLeadingDakutenVariant(target, seionTarget) {
    if (!target || !seionTarget) return false;
    if (target === seionTarget) return false;
    if (Array.from(target).length !== Array.from(seionTarget).length) return false;
    return Array.from(target).slice(1).join('') === Array.from(seionTarget).slice(1).join('');
}

function splitReadingIntoMoraUnits(rawReading) {
    const nameReading = toHira((rawReading || '').trim());
    const units = [];
    Array.from(nameReading).forEach((char) => {
        if (/^[ゃゅょぁぃぅぇぉゎ]$/.test(char) && units.length > 0) {
            units[units.length - 1] += char;
        } else {
            units.push(char);
        }
    });
    return units;
}

function isPremiumAccessActive() {
    return typeof PremiumManager !== 'undefined'
        && PremiumManager
        && typeof PremiumManager.isPremium === 'function'
        && PremiumManager.isPremium();
}

function isCommonKanjiEntry(item) {
    if (!item) return false;
    const flag = item['常用漢字'];
    return flag === true || flag === 'true' || flag === 1 || flag === '1';
}

function isKanjiAccessibleForCurrentMembership(item) {
    if (!item) return false;
    if (isPremiumAccessActive()) return true;
    return isCommonKanjiEntry(item);
}

function filterKanjiByCurrentMembership(items) {
    return (Array.isArray(items) ? items : []).filter(isKanjiAccessibleForCurrentMembership);
}

if (typeof window !== 'undefined' && typeof window.includeKanaCandidatesForSegments === 'undefined') {
    window.includeKanaCandidatesForSegments = false;
}
if (typeof window !== 'undefined' && typeof window.includeKanaCandidateScriptsForSegments === 'undefined') {
    window.includeKanaCandidateScriptsForSegments = {
        hiragana: !!window.includeKanaCandidatesForSegments,
        katakana: !!window.includeKanaCandidatesForSegments
    };
}

const KANA_VOICED_MAP = {
    'か': 'が', 'き': 'ぎ', 'く': 'ぐ', 'け': 'げ', 'こ': 'ご',
    'さ': 'ざ', 'し': 'じ', 'す': 'ず', 'せ': 'ぜ', 'そ': 'ぞ',
    'た': 'だ', 'ち': 'ぢ', 'つ': 'づ', 'て': 'で', 'と': 'ど',
    'は': 'ば', 'ひ': 'び', 'ふ': 'ぶ', 'へ': 'べ', 'ほ': 'ぼ',
    'う': 'ゔ'
};

const KANA_BASE_STROKES = {
    'あ': 3, 'い': 2, 'う': 2, 'え': 2, 'お': 3,
    'か': 3, 'き': 4, 'く': 1, 'け': 3, 'こ': 2,
    'さ': 3, 'し': 1, 'す': 2, 'せ': 3, 'そ': 1,
    'た': 4, 'ち': 2, 'つ': 1, 'て': 1, 'と': 2,
    'な': 4, 'に': 3, 'ぬ': 2, 'ね': 2, 'の': 1,
    'は': 3, 'ひ': 1, 'ふ': 4, 'へ': 1, 'ほ': 4,
    'ま': 3, 'み': 2, 'む': 3, 'め': 2, 'も': 3,
    'や': 3, 'ゆ': 2, 'よ': 2,
    'ら': 2, 'り': 2, 'る': 1, 'れ': 2, 'ろ': 1,
    'わ': 2, 'ゐ': 2, 'ゑ': 3, 'を': 3, 'ん': 1,
    'ぁ': 3, 'ぃ': 2, 'ぅ': 2, 'ぇ': 2, 'ぉ': 3,
    'ゃ': 3, 'ゅ': 2, 'ょ': 2, 'っ': 1,
    'ー': 1, 'ゝ': 1, 'ゞ': 3, 'ヽ': 1, 'ヾ': 3
};

const KATAKANA_BASE_STROKES = {
    'ア': 2, 'イ': 2, 'ウ': 3, 'エ': 3, 'オ': 3,
    'カ': 2, 'キ': 3, 'ク': 2, 'ケ': 3, 'コ': 2,
    'サ': 3, 'シ': 3, 'ス': 2, 'セ': 2, 'ソ': 2,
    'タ': 3, 'チ': 3, 'ツ': 3, 'テ': 3, 'ト': 2,
    'ナ': 2, 'ニ': 2, 'ヌ': 2, 'ネ': 4, 'ノ': 1,
    'ハ': 2, 'ヒ': 2, 'フ': 1, 'ヘ': 1, 'ホ': 4,
    'マ': 2, 'ミ': 3, 'ム': 2, 'メ': 2, 'モ': 3,
    'ヤ': 2, 'ユ': 2, 'ヨ': 3,
    'ラ': 2, 'リ': 2, 'ル': 2, 'レ': 1, 'ロ': 3,
    'ワ': 2, 'ヰ': 2, 'ヱ': 3, 'ヲ': 3, 'ン': 2,
    'ァ': 2, 'ィ': 2, 'ゥ': 3, 'ェ': 3, 'ォ': 3,
    'ャ': 2, 'ュ': 2, 'ョ': 3, 'ッ': 3,
    'ヵ': 2, 'ヶ': 3, 'ヮ': 2,
    'ー': 1, 'ヽ': 1, 'ヾ': 3
};

function isKatakanaForKanaStroke(char) {
    return /^[ァ-ヺヽヾ]$/.test(String(char || ''));
}

function toKataKanaForKanaCandidate(value) {
    return String(value || '').replace(/[\u3041-\u3096]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) + 0x60)
    );
}

function voiceKanaChar(char) {
    const hira = typeof toHira === 'function' ? toHira(char || '') : String(char || '');
    return KANA_VOICED_MAP[hira] || hira;
}

function expandKanaIterationMarks(value) {
    const hira = typeof toHira === 'function' ? toHira(value || '') : String(value || '');
    let result = '';
    let previousKana = '';

    Array.from(hira).forEach((char) => {
        if (char === 'ゝ' || char === 'ヽ') {
            const repeated = previousKana || '';
            result += repeated;
            previousKana = repeated || previousKana;
            return;
        }
        if (char === 'ゞ' || char === 'ヾ') {
            const repeated = previousKana ? voiceKanaChar(previousKana) : '';
            result += repeated;
            previousKana = repeated || previousKana;
            return;
        }
        result += char;
        previousKana = char;
    });

    return result;
}

function getKanaStrokeCount(char) {
    const display = String(char || '');
    if (!display) return 1;
    const chars = Array.from(display);
    if (chars.length > 1) {
        return chars.reduce((sum, part) => sum + getKanaStrokeCount(part), 0);
    }
    if (Object.prototype.hasOwnProperty.call(KATAKANA_BASE_STROKES, display)) {
        return KATAKANA_BASE_STROKES[display];
    }
    if (Object.prototype.hasOwnProperty.call(KANA_BASE_STROKES, display)) {
        return KANA_BASE_STROKES[display];
    }

    const hira = typeof toHira === 'function' ? toHira(display) : display;
    const seion = typeof toSeion === 'function' ? toSeion(hira) : hira;
    const isKatakana = isKatakanaForKanaStroke(display);
    const seionKata = isKatakana ? toKataKanaForKanaCandidate(seion) : '';
    const base = isKatakana
        ? (KATAKANA_BASE_STROKES[seionKata] || KATAKANA_BASE_STROKES[display] || 1)
        : (KANA_BASE_STROKES[seion] || KANA_BASE_STROKES[hira] || 1);
    if (hira !== seion) {
        return base + (/^[ぱぴぷぺぽ]$/.test(hira) ? 1 : 2);
    }
    return base;
}

function normalizeKanaCandidateSegment(segment) {
    const expanded = typeof toHira === 'function'
        ? toHira(expandKanaIterationMarks(segment))
        : expandKanaIterationMarks(segment);
    return String(expanded || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^\u3041-\u3096\u30fc]/g, '');
}

function isOneCharSegmentPath(path) {
    return Array.isArray(path)
        && path.length > 0
        && path.every((segment) => Array.from(normalizeKanaCandidateSegment(segment)).length === 1);
}

function normalizeKanaCandidateScriptSettings(value) {
    if (value && typeof value === 'object') {
        return {
            hiragana: !!value.hiragana,
            katakana: !!value.katakana
        };
    }
    const enabled = !!value;
    return { hiragana: enabled, katakana: enabled };
}

function getKanaCandidateScriptSettings() {
    return normalizeKanaCandidateScriptSettings(
        window.includeKanaCandidateScriptsForSegments || window.includeKanaCandidatesForSegments
    );
}

function setKanaCandidatesEnabledForSegments(settings, segmentPath = segments) {
    const normalized = normalizeKanaCandidateScriptSettings(settings);
    const enabledForPath = isOneCharSegmentPath(segmentPath);
    const nextSettings = {
        hiragana: enabledForPath && normalized.hiragana,
        katakana: enabledForPath && normalized.katakana
    };
    window.includeKanaCandidateScriptsForSegments = nextSettings;
    window.includeKanaCandidatesForSegments = nextSettings.hiragana || nextSettings.katakana;
    return window.includeKanaCandidatesForSegments;
}

function isKanaCandidatesEnabledForSegments(segmentPath = segments) {
    const settings = getKanaCandidateScriptSettings();
    return !!((settings.hiragana || settings.katakana) && isOneCharSegmentPath(segmentPath));
}

function getActiveKanaCandidateScriptSettings(segmentPath = segments, options = {}) {
    const settings = normalizeKanaCandidateScriptSettings(options.kanaScripts || getKanaCandidateScriptSettings());
    if (!options.force && !isOneCharSegmentPath(segmentPath)) {
        return { hiragana: false, katakana: false };
    }
    return settings;
}

function getKanaCandidateSessionReading(options = {}) {
    if (typeof options.currentReading === 'string' && options.currentReading) return options.currentReading;
    if (typeof getCurrentSessionReading === 'function') return getCurrentSessionReading();
    return Array.isArray(segments) ? segments.join('') : '';
}

function createKanaCandidate(display, reading, slotIdx, options = {}) {
    const strokes = getKanaStrokeCount(display);
    const type = options.type || 'hiragana';
    const label = type.includes('iteration')
        ? '前のかなをくり返す表記'
        : (type === 'katakana' ? 'カタカナの表記' : 'ひらがなの表記');
    const sessionSegments = Array.isArray(options.segments)
        ? [...options.segments]
        : (Array.isArray(segments) ? [...segments] : []);
    const sessionReading = getKanaCandidateSessionReading(options);

    return {
        '\u6f22\u5b57': display,
        '\u753b\u6570': strokes,
        '\u97f3': '',
        '\u8a13': reading,
        '\u4f1d\u7d71\u540d\u306e\u308a': '',
        '\u610f\u5473': label,
        '\u5206\u985e': '#かな',
        '\u540d\u524d\u306e\u30a4\u30e1\u30fc\u30b8': label,
        '\u304a\u3059\u3059\u3081\u5ea6': 60,
        '\u7537\u306e\u304a\u3059\u3059\u3081\u5ea6': 60,
        '\u5973\u306e\u304a\u3059\u3059\u3081\u5ea6': 60,
        '\u4e0d\u9069\u5207\u30d5\u30e9\u30b0': 0,
        kanji: display,
        strokes,
        kanji_reading: reading,
        reading,
        gender: gender || 'neutral',
        priority: 1,
        readingTier: 1,
        score: 1000000 - Math.max(0, slotIdx || 0),
        isKanaCandidate: true,
        kanaCandidateType: type,
        slot: Number.isInteger(slotIdx) ? slotIdx : -1,
        sessionReading,
        sessionSegments
    };
}

function getKanaIterationCandidatesForSegment(reading, slotIdx, segmentPath = segments, options = {}) {
    if (!Number.isInteger(slotIdx) || slotIdx <= 0 || !Array.isArray(segmentPath)) return [];

    const previous = normalizeKanaCandidateSegment(segmentPath[slotIdx - 1]);
    const current = normalizeKanaCandidateSegment(reading);
    if (!previous || !current) return [];

    const candidates = [];
    const scriptSettings = getActiveKanaCandidateScriptSettings(segmentPath, options);
    if (current === previous) {
        if (scriptSettings.hiragana) {
            candidates.push(createKanaCandidate('ゝ', current, slotIdx, { ...options, type: 'hiragana-iteration' }));
        }
        if (scriptSettings.katakana) {
            candidates.push(createKanaCandidate('ヽ', current, slotIdx, { ...options, type: 'katakana-iteration' }));
        }
    } else if (current === voiceKanaChar(previous)) {
        if (scriptSettings.hiragana) {
            candidates.push(createKanaCandidate('ゞ', current, slotIdx, { ...options, type: 'hiragana-iteration' }));
        }
        if (scriptSettings.katakana) {
            candidates.push(createKanaCandidate('ヾ', current, slotIdx, { ...options, type: 'katakana-iteration' }));
        }
    }

    return candidates;
}

function getKanaCandidatesForSegment(segment, slotIdx = currentPos, options = {}) {
    const segmentPath = Array.isArray(options.segments)
        ? options.segments
        : (Array.isArray(segments) ? segments : []);
    const scriptSettings = getActiveKanaCandidateScriptSettings(segmentPath, options);
    if (!scriptSettings.hiragana && !scriptSettings.katakana) return [];

    const reading = normalizeKanaCandidateSegment(segment);
    if (!reading || Array.from(reading).length !== 1) return [];

    const hira = reading;
    const kata = toKataKanaForKanaCandidate(hira);
    const candidates = [];
    if (scriptSettings.hiragana) {
        candidates.push(createKanaCandidate(hira, reading, slotIdx, { ...options, type: 'hiragana', segments: segmentPath }));
    }
    if (scriptSettings.katakana && kata && kata !== hira) {
        candidates.push(createKanaCandidate(kata, reading, slotIdx, { ...options, type: 'katakana', segments: segmentPath }));
    }
    candidates.push(...getKanaIterationCandidatesForSegment(reading, slotIdx, segmentPath, { ...options, segments: segmentPath }));

    const seenDisplays = new Set();
    return candidates.filter((item) => {
        const display = item['\u6f22\u5b57'] || item.kanji || '';
        if (!display || seenDisplays.has(display)) return false;
        seenDisplays.add(display);
        return true;
    });
}

function getSwipeKanaCandidatesForCurrentSlot(target, slotIdx = currentPos) {
    const currentReading = getKanaCandidateSessionReading();
    return getKanaCandidatesForSegment(target, slotIdx, {
        currentReading,
        segments: Array.isArray(segments) ? segments : []
    }).filter((candidate) => {
        const display = candidate['\u6f22\u5b57'] || candidate.kanji || '';
        if (!display) return false;
        const alreadyLiked = Array.isArray(liked) && liked.some((item) =>
            item
            && item.slot === slotIdx
            && (item['\u6f22\u5b57'] || item.kanji) === display
            && (!item.sessionReading || item.sessionReading === currentReading)
        );
        if (alreadyLiked) return false;
        if (typeof noped !== 'undefined' && noped && noped.has && noped.has(display)) return false;
        return true;
    });
}

window.expandKanaIterationMarks = expandKanaIterationMarks;
window.setKanaCandidatesEnabledForSegments = setKanaCandidatesEnabledForSegments;
window.isKanaCandidatesEnabledForSegments = isKanaCandidatesEnabledForSegments;
window.getKanaCandidateScriptSettings = getKanaCandidateScriptSettings;
window.getKanaCandidatesForSegment = getKanaCandidatesForSegment;

function getFallbackReadingSegmentPaths(rawReading, limit = 5) {
    const units = splitReadingIntoMoraUnits(rawReading);
    if (!units.length) return [];

    const candidates = [];
    const pushPath = (path) => {
        if (!Array.isArray(path) || path.length === 0 || path.length > 3) return;
        if (path.some(isInvalidReadingSegment)) return;
        if (path.some((segment) => !hasViableKanjiForReading(segment))) return;
        candidates.push(path);
    };

    pushPath([units.join('')]);

    for (let i = 1; i < units.length; i++) {
        pushPath([units.slice(0, i).join(''), units.slice(i).join('')]);
    }

    for (let i = 1; i < units.length - 1; i++) {
        for (let j = i + 1; j < units.length; j++) {
            pushPath([
                units.slice(0, i).join(''),
                units.slice(i, j).join(''),
                units.slice(j).join('')
            ]);
        }
    }

    const scored = candidates.map((path) => {
        let score = 0;
        if (path.length === 2) score += 2000;
        else if (path.length === 3) score += 1800;
        else score += 400;
        path.forEach((segment) => {
            if (segment.length === 2) score += 450;
            else if (segment.length === 3) score += 320;
            else if (segment.length === 1) score += 80;
        });
        return { path, score };
    }).sort((a, b) => b.score - a.score);

    const uniquePaths = [];
    const seenSet = new Set();
    scored.forEach(({ path }) => {
        const key = JSON.stringify(path);
        if (!seenSet.has(key)) {
            seenSet.add(key);
            uniquePaths.push(path);
        }
    });
    return uniquePaths.slice(0, limit);
}

function getReadingSegmentRuleState(part) {
    const normalizedPart = typeof normalizeReadingSegmentRuleKey === 'function'
        ? normalizeReadingSegmentRuleKey(part)
        : toHira(String(part || '').trim()).replace(/[^\u3041-\u3093\u30fc]/g, '');
    if (!normalizedPart) {
        return { state: 'missing', candidates: [] };
    }

    const approvedSegments = readingSegmentRules?.approvedSegments || {};
    if (Object.prototype.hasOwnProperty.call(approvedSegments, normalizedPart)) {
        return {
            state: 'approved',
            candidates: Array.isArray(approvedSegments[normalizedPart]) ? approvedSegments[normalizedPart] : []
        };
    }

    const disabledSegments = Array.isArray(readingSegmentRules?.disabledSegments)
        ? readingSegmentRules.disabledSegments
        : [];
    if (disabledSegments.includes(normalizedPart)) {
        return { state: 'disabled', candidates: [] };
    }

    return { state: 'missing', candidates: [] };
}

function getMasterKanjiReadings(item) {
    if (typeof getKanjiReadingBuckets === 'function') {
        const buckets = getKanjiReadingBuckets(item);
        if (Array.isArray(buckets?.allStrictReadings) && buckets.allStrictReadings.length > 0) {
            return buckets.allStrictReadings;
        }
        if (Array.isArray(buckets?.allReadings)) {
            return buckets.allReadings;
        }
    }

    const majorReadings = ((item?.['音'] || '') + ',' + (item?.['訓'] || ''))
        .split(/[、,\/\s]+/)
        .map(x => normalizeReadingComparisonValue(x))
        .filter(Boolean);
    const minorReadings = (item?.['伝統名のり'] || '')
        .split(/[、,\/\s]+/)
        .map(x => normalizeReadingComparisonValue(x))
        .filter(Boolean);
    return [...majorReadings, ...minorReadings];
}

function hasMasterKanjiCandidatesForReading(part, targetGender = gender || 'neutral') {
    if (!part || !Array.isArray(master) || master.length === 0) return false;

    const target = normalizeReadingComparisonValue(part);
    if (!target) return false;

    const targetSeion = typeof toSeion === 'function' ? normalizeReadingComparisonValue(toSeion(target)) : target;
    const canUseSeionFallback = isLeadingDakutenVariant(target, targetSeion);

    return master.some((k) => {
        if (!isKanjiAccessibleForCurrentMembership(k)) return false;
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') {
            if (typeof showInappropriateKanji === 'undefined' || !showInappropriateKanji) return false;
        }
        if (isKanjiGenderMismatch(k, targetGender)) return false;

        const readings = getMasterKanjiReadings(k);
        return readings.includes(target) ||
            (canUseSeionFallback && readings.includes(targetSeion));
    });
}

function hasViableKanjiForReading(part, targetGender = gender || 'neutral') {
    const target = normalizeReadingComparisonValue(part);
    if (!target || !Array.isArray(master) || master.length === 0) return false;

    const segmentState = getReadingSegmentRuleState(target);
    if (segmentState.state === 'approved') {
        return segmentState.candidates.length > 0;
    }
    if (segmentState.state === 'disabled') {
        return false;
    }

    const moraLength = splitReadingIntoMoraUnits(target).length;
    if (moraLength < 3) return false;

    return hasMasterKanjiCandidatesForReading(target, targetGender);

    if (false) {
    if (!part || !Array.isArray(master) || master.length === 0) return false;

    if (typeof getCuratedReadingSegmentCandidates === 'function') {
        const curatedCandidates = getCuratedReadingSegmentCandidates(part);
        if (Array.isArray(curatedCandidates)) {
            return curatedCandidates.length > 0;
        }
        return false;
    }

    return false;

    const target = toHira(part);
    const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
    const targetSokuon = target.replace(/っ$/, 'つ');
    const canUseSeionFallback = isLeadingDakutenVariant(target, targetSeion);

    return master.some((k) => {
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') {
            if (typeof showInappropriateKanji === 'undefined' || !showInappropriateKanji) return false;
        }
        if (isKanjiGenderMismatch(k, targetGender)) return false;

        const majorReadings = ((k['音'] || '') + ',' + (k['訓'] || ''))
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(Boolean);
        const minorReadings = (k['伝統名のり'] || '')
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(Boolean);
        const readings = [...majorReadings, ...minorReadings];
        const normalizedReadings = readings.map(x => normalizeReadingComparisonValue(x)).filter(Boolean);

        return readings.includes(target) ||
            (canUseSeionFallback && readings.includes(targetSeion)) ||
            (targetSokuon !== target && readings.includes(targetSokuon));
    });
    }
}

function getReadingSegmentPaths(rawReading, limit = 5, options = {}) {
    const nameReading = expandKanaIterationMarks(toHira((rawReading || '').trim()));
    if (!nameReading || !/^[ぁ-ゖー]+$/.test(nameReading)) {
        return [];
    }

    const strictOnly = options && options.strictOnly === true;
    const allowFallback = !options || options.allowFallback !== false;
    const useStrictMatching = strictOnly || rule === 'strict';
    const targetGender = options?.gender || gender || 'neutral';
    const canUseReadingSegment = (part) => {
        const normalizedPart = normalizeReadingComparisonValue(part);
        if (isInvalidReadingSegment(normalizedPart)) return false;
        const partSeion = typeof toSeion === 'function' ? normalizeReadingComparisonValue(toSeion(normalizedPart)) : normalizedPart;
        const canUseSeionFallback = isLeadingDakutenVariant(normalizedPart, partSeion);
        const segmentState = getReadingSegmentRuleState(normalizedPart);
        const masterFallback = segmentState.state === 'missing'
            && splitReadingIntoMoraUnits(normalizedPart).length >= 3
            && hasMasterKanjiCandidatesForReading(normalizedPart, targetGender);
        const hasStrictReading = !useStrictMatching || (validReadingsSet && (
            validReadingsSet.has(normalizedPart) ||
            (canUseSeionFallback && validReadingsSet.has(partSeion))
        )) || segmentState.state === 'approved' || masterFallback;
        return hasStrictReading && hasViableKanjiForReading(normalizedPart, targetGender);
    };
    let allPaths = [];

    function findPath(remaining, currentPath) {
        if (currentPath.length > 3) return;

        if (remaining.length === 0) {
            if (currentPath.length >= 1) {
                allPaths.push([...currentPath]);
            }
            return;
        }

        for (let i = 1; i <= Math.min(3, remaining.length); i++) {
            const part = remaining.slice(0, i);
            if (canUseReadingSegment(part)) {
                currentPath.push(part);
                findPath(remaining.slice(i), currentPath);
                currentPath.pop();
            }
        }
    }

    findPath(nameReading, []);

    const scoredSplits = allPaths.map(path => {
        let score = 0;

        if (path.length === 2) score += 2000;
        else if (path.length === 3) score += 1800;
        else if (path.length === 1) score += 500;

        path.forEach(p => {
            if (p.length === 2) score += 500;
            if (p.length === 1) {
                if (["た", "ま", "と", "の", "か", "ほ", "ひ", "み", "な", "り", "さ", "こ", "あ"].includes(p)) {
                    score += 200;
                } else {
                    score += 50;
                }
            }
        });

        let singleCombo = 0;
        let maxSingleCombo = 0;
        path.forEach(p => {
            if (p.length === 1) singleCombo++;
            else singleCombo = 0;
            maxSingleCombo = Math.max(maxSingleCombo, singleCombo);
        });
        if (maxSingleCombo >= 3) score -= 3000;

        return { path, score };
    });

    scoredSplits.sort((a, b) => b.score - a.score);

    const uniquePaths = [];
    const seenSet = new Set();
    scoredSplits.forEach(item => {
        const key = JSON.stringify(item.path);
        if (!seenSet.has(key) && item.score > -1000) {
            uniquePaths.push(item.path);
            seenSet.add(key);
        }
    });

    const moraUnits = splitReadingIntoMoraUnits(nameReading);
    const fullMoraPath = [...moraUnits];
    const fullMoraKey = JSON.stringify(fullMoraPath);
    if (
        moraUnits.length === 3 &&
        !seenSet.has(fullMoraKey) &&
        fullMoraPath.every(canUseReadingSegment)
    ) {
        const insertIndex = Math.min(1, uniquePaths.length);
        uniquePaths.splice(insertIndex, 0, fullMoraPath);
        seenSet.add(fullMoraKey);
    }

    uniquePaths.sort((a, b) => {
        const aFirstLength = Array.isArray(a) && a[0] ? String(a[0]).length : 0;
        const bFirstLength = Array.isArray(b) && b[0] ? String(b[0]).length : 0;
        if (aFirstLength !== bFirstLength) return bFirstLength - aFirstLength;

        const aLength = Array.isArray(a) ? a.length : 0;
        const bLength = Array.isArray(b) ? b.length : 0;
        if (aLength !== bLength) return aLength - bLength;

        return String((a || []).join('/')).localeCompare(String((b || []).join('/')), 'ja');
    });

    if (uniquePaths.length === 0 && allowFallback) {
        return getFallbackReadingSegmentPaths(nameReading, limit);
    }

    return uniquePaths.slice(0, limit);
}

function getKanjiRecommendationScore(k, targetGender = gender || 'neutral') {
    const allScore = parseInt(k['\u304A\u3059\u3059\u3081\u5EA6']) || 0;
    const maleScore = parseInt(k['\u7537\u306E\u304A\u3059\u3059\u3081\u5EA6']) || 0;
    const femaleScore = parseInt(k['\u5973\u306E\u304A\u3059\u3059\u3081\u5EA6']) || 0;

    if (targetGender === 'male') {
        return (maleScore || allScore) * 100 + allScore * 8 - femaleScore * 12;
    }

    if (targetGender === 'female') {
        return (femaleScore || allScore) * 100 + allScore * 8 - maleScore * 12;
    }

    return allScore * 100 + Math.max(maleScore, femaleScore) * 10;
}

function getKanjiGenderPriority(k, targetGender = gender || 'neutral') {
    if (!targetGender || targetGender === 'neutral') {
        return 1;
    }

    const kanji = (k['\u6F22\u5B57'] || '').trim();
    const combined = `${kanji}${k['\u540D\u524D\u306E\u30A4\u30E1\u30FC\u30B8'] || ''}${k['\u610F\u5473'] || ''}`;
    const maleScore = parseInt(k['\u7537\u306E\u304A\u3059\u3059\u3081\u5EA6']) || 0;
    const femaleScore = parseInt(k['\u5973\u306E\u304A\u3059\u3059\u3081\u5EA6']) || 0;
    const maleKeywords = ['\u7537', '\u529B\u5F37', '\u52C7', '\u96C4', '\u7FD4', '\u967D', '\u5263', '\u525B', '\u5927', '\u738B'];
    const femaleKeywords = ['\u5973', '\u512A', '\u7F8E', '\u611B', '\u82B1', '\u97F3', '\u9999', '\u83DC', '\u67D4', '\u9E97'];
    const hasMaleKeyword = maleKeywords.some(keyword => combined.includes(keyword));
    const hasFemaleKeyword = femaleKeywords.some(keyword => combined.includes(keyword));

    if (targetGender === 'male') {
        if (kanji === '\u5973') return 3;
        if (femaleScore > maleScore + 1 || hasFemaleKeyword) return 3;
        if (maleScore > 0 || hasMaleKeyword) return 1;
        return 2;
    }

    if (kanji === '\u7537') return 3;
    if (maleScore > femaleScore + 1 || hasMaleKeyword) return 3;
    if (femaleScore > 0 || hasFemaleKeyword) return 1;
    return 2;
}

function isKanjiGenderMismatch(k, targetGender = gender || 'neutral') {
    // 性別は並び順の優先度としてだけ使い、候補の除外には使わない。
    return false;
}
function fitSegmentOptionButton(button) {
    if (!button) return;
    const labelEl = button.querySelector('[data-segment-label]');
    if (!labelEl) return;

    const pieceEls = Array.from(labelEl.querySelectorAll('[data-segment-piece]'));
    const separatorEls = Array.from(labelEl.querySelectorAll('[data-segment-separator]'));
    const countEl = button.querySelector('[data-segment-count]');

    const presets = [
        { buttonGap: 10, buttonPadX: 16, fontSize: 16, piecePadX: 8, slashPadX: 4, countPadX: 12, countFontSize: 10 },
        { buttonGap: 8, buttonPadX: 14, fontSize: 15, piecePadX: 6, slashPadX: 3, countPadX: 11, countFontSize: 10 },
        { buttonGap: 6, buttonPadX: 12, fontSize: 14, piecePadX: 5, slashPadX: 2, countPadX: 10, countFontSize: 10 },
        { buttonGap: 5, buttonPadX: 11, fontSize: 13, piecePadX: 4, slashPadX: 1, countPadX: 9, countFontSize: 9 },
        { buttonGap: 4, buttonPadX: 10, fontSize: 12, piecePadX: 3, slashPadX: 0, countPadX: 8, countFontSize: 9 },
        { buttonGap: 3, buttonPadX: 8, fontSize: 11, piecePadX: 2, slashPadX: 0, countPadX: 7, countFontSize: 9 },
        { buttonGap: 2, buttonPadX: 7, fontSize: 10, piecePadX: 1, slashPadX: 0, countPadX: 6, countFontSize: 8 }
    ];

    const applyPreset = (preset) => {
        button.style.gap = `${preset.buttonGap}px`;
        button.style.paddingLeft = `${preset.buttonPadX}px`;
        button.style.paddingRight = `${preset.buttonPadX}px`;

        labelEl.style.fontSize = `${preset.fontSize}px`;
        labelEl.style.letterSpacing = preset.fontSize <= 11 ? '-0.02em' : '0';

        pieceEls.forEach((piece) => {
            piece.style.paddingLeft = `${preset.piecePadX}px`;
            piece.style.paddingRight = `${preset.piecePadX}px`;
        });

        separatorEls.forEach((separator) => {
            separator.style.paddingLeft = `${preset.slashPadX}px`;
            separator.style.paddingRight = `${preset.slashPadX}px`;
        });

        if (countEl) {
            countEl.style.paddingLeft = `${preset.countPadX}px`;
            countEl.style.paddingRight = `${preset.countPadX}px`;
            countEl.style.fontSize = `${preset.countFontSize}px`;
        }
    };

    const fits = () => labelEl.scrollWidth <= labelEl.clientWidth;

    for (const preset of presets) {
        applyPreset(preset);
        if (fits()) return;
    }

    labelEl.style.letterSpacing = '-0.04em';
    if (countEl) {
        countEl.style.paddingLeft = '5px';
        countEl.style.paddingRight = '5px';
    }
}
function calcSegments() {
    console.log("ENGINE: calcSegments() called");

    const inputEl = document.getElementById('in-name');
    if (!inputEl) {
        console.error("ENGINE: 'in-name' element not found");
        return;
    }

    const rawVal = inputEl.value.trim();
    const nameReading = expandKanaIterationMarks(toHira(rawVal));

    // 入力チェック
    if (!nameReading) {
        alert("名前の読みをひらがなで入力してください。\n例：はな、かな、ゆうと");
        return;
    }

    if (!/^[ぁ-ゖー]+$/.test(nameReading)) {
        alert("ひらがなのみで入力してください。");
        return;
    }

    if (/[ゝゞヽヾ]/.test(rawVal) && inputEl.value !== nameReading) {
        inputEl.value = nameReading;
    }

    // データ読み込みチェック
    if (!master || master.length === 0) {
        alert("漢字データを読み込み中です。\n3〜5秒待ってから再度お試しください。");
        return;
    }

    if (typeof updateEncounteredLibraryEntry === 'function') {
        updateEncounteredLibraryEntry('reading', nameReading, {
            reading: nameReading,
            mode: 'direct-input',
            tags: [],
            examples: [],
            encounterOrigin: 'direct-input'
        }, {
            incrementSeen: true
        });
    }

    // オプションコンテナ取得
    const optionsContainer = document.getElementById('seg-options');
    if (!optionsContainer) {
        console.error("ENGINE: 'seg-options' element not found");
        return;
    }
    optionsContainer.innerHTML = '<div class="text-center text-[#bca37f] text-sm">分割パターンを計算中...</div>';

    let uniquePaths = [];
    try {
        uniquePaths = getReadingSegmentPaths(nameReading, 8, {
            strictOnly: true,
            allowFallback: false
        });
        console.log(`ENGINE: ${uniquePaths.length} strict segment patterns ready`);
    } catch (e) {
        console.error("ENGINE: Search failed", e);
        alert("分割計算中にエラーが発生しました。");
        return;
    }

    const compoundOptions = typeof getCompoundReadingOptions === 'function'
        ? getCompoundReadingOptions(nameReading, 8, gender || 'neutral')
        : [];

    const getPathCandidateAvailability = (path) => {
        if (!Array.isArray(path) || path.length === 0) return { viable: false, total: 0, exactWhole: false };
        if (typeof findStrictKanjiCandidatesForSegment !== 'function') {
            return { viable: true, total: path.length, exactWhole: path.length === 1 };
        }
        const counts = path.map((segment, segmentIndex) => {
            try {
                return findStrictKanjiCandidatesForSegment(segment, 1, gender || 'neutral', { segmentIndex }).length;
            } catch (error) {
                return 1;
            }
        });
        const normalizedWhole = typeof normalizeReadingComparisonValue === 'function'
            ? normalizeReadingComparisonValue(nameReading)
            : nameReading;
        const normalizedPathReading = typeof normalizeReadingComparisonValue === 'function'
            ? normalizeReadingComparisonValue(path.join(''))
            : path.join('');
        return {
            viable: counts.every(count => count > 0),
            total: counts.reduce((sum, count) => sum + count, 0),
            exactWhole: path.length === 1 && counts[0] > 0 && normalizedPathReading === normalizedWhole
        };
    };

    uniquePaths = uniquePaths
        .map((path, index) => ({
            path,
            index,
            availability: getPathCandidateAvailability(path)
        }))
        .sort((a, b) => {
            if (a.availability.viable !== b.availability.viable) {
                return a.availability.viable ? -1 : 1;
            }
            if (a.availability.exactWhole !== b.availability.exactWhole) {
                return a.availability.exactWhole ? -1 : 1;
            }
            if (b.availability.total !== a.availability.total) {
                return b.availability.total - a.availability.total;
            }
            return a.index - b.index;
        })
        .map(item => item.path);

    function createSectionTitle(title, subtitle = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3 text-left';
        wrapper.innerHTML = `
            <div class="text-[11px] font-black tracking-[0.18em] text-[#b9965b] uppercase">${title}</div>
            ${subtitle ? `<div class="mt-1 text-[11px] text-[#a6967a]">${subtitle}</div>` : ''}
        `;
        return wrapper;
    }

    optionsContainer.innerHTML = '';
    const choiceTarget = document.createElement('div');
    choiceTarget.id = 'seg-choice-target';
    optionsContainer.appendChild(choiceTarget);

    const normalSection = document.createElement('div');
    normalSection.className = 'mb-6';
    normalSection.appendChild(createSectionTitle('1文字ずつ探す'));

    const hasOneCharPath = uniquePaths.some(path => isOneCharSegmentPath(path));
    const kanaSettings = getKanaCandidateScriptSettings();
    const kanaOptionNote = hasOneCharPath
        ? '一文字ずつに分ける候補を選んだとき、かなも候補に入ります。'
        : 'この読みは一文字ずつに分けられないため、かな候補は使えません。';
    const kanaOption = document.createElement('div');
    kanaOption.className = `w-[92%] mx-auto mt-1 mb-4 px-4 py-3 rounded-[26px] border border-[#eadfce] bg-white/80 shadow-sm text-left ${hasOneCharPath ? '' : 'opacity-50'}`;
    kanaOption.innerHTML = `
        <div class="mb-2 text-sm font-black text-[#5d5444]">かな表記も候補に出す</div>
        <div class="grid grid-cols-2 gap-2">
            <label class="relative flex items-center justify-center gap-2 rounded-[18px] border border-[#eadfce] bg-[#fffaf4] px-3 py-2 text-center transition-all ${hasOneCharPath ? 'cursor-pointer active:scale-[0.99]' : ''}">
                <input id="seg-include-hiragana" type="checkbox" class="peer sr-only" ${kanaSettings.hiragana ? 'checked' : ''} ${hasOneCharPath ? '' : 'disabled'}>
                <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d8c9b2] bg-white text-[10px] font-black text-transparent transition-all peer-checked:border-[#b9965b] peer-checked:bg-[#b9965b] peer-checked:text-white">✓</span>
                <span class="text-[13px] font-black text-[#6b6254] transition-colors peer-checked:text-[#5d5444]">ひらがな</span>
            </label>
            <label class="relative flex items-center justify-center gap-2 rounded-[18px] border border-[#eadfce] bg-[#fffaf4] px-3 py-2 text-center transition-all ${hasOneCharPath ? 'cursor-pointer active:scale-[0.99]' : ''}">
                <input id="seg-include-katakana" type="checkbox" class="peer sr-only" ${kanaSettings.katakana ? 'checked' : ''} ${hasOneCharPath ? '' : 'disabled'}>
                <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d8c9b2] bg-white text-[10px] font-black text-transparent transition-all peer-checked:border-[#b9965b] peer-checked:bg-[#b9965b] peer-checked:text-white">✓</span>
                <span class="text-[13px] font-black text-[#6b6254] transition-colors peer-checked:text-[#5d5444]">カタカナ</span>
            </label>
        </div>
        <div class="mt-2 text-[11px] leading-relaxed text-[#a6967a]">${kanaOptionNote}</div>
    `;

    if (uniquePaths.length > 0) {
        uniquePaths.forEach((path, idx) => {
            const btn = document.createElement('button');
            btn.className = "w-[92%] mx-auto py-4 px-4 bg-[#fffaf4] text-[#5d5444] font-black rounded-[34px] border border-[#eadfce] shadow-sm transition-all mb-3 hover:border-[#bca37f] hover:shadow-md active:scale-98 flex items-center gap-2 group text-left overflow-hidden";
            const countLabel = `${path.length}文字名`;

            const displayParts = path.map((p, index) => {
                const piece = `<span data-segment-piece class="shrink-0 inline-flex items-center whitespace-nowrap px-2">${p}</span>`;
                if (index === path.length - 1) return piece;
                return `${piece}<span data-segment-separator class="shrink-0 inline-flex items-center whitespace-nowrap px-2 text-sm text-[#d4c5af] opacity-40 group-hover:opacity-100 transition-opacity">/</span>`;
            }).join('');

            btn.innerHTML = `
                <span data-segment-count class="shrink-0 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-black text-[#b9965b] shadow-sm">${countLabel}</span>
                <div data-segment-label class="min-w-0 flex-1 flex items-center flex-nowrap whitespace-nowrap overflow-hidden text-[clamp(0.9rem,2.3vw,1.05rem)] leading-tight">
                    ${displayParts}
                </div>
            `;
            btn.onclick = () => {
                const includeHiraganaInput = document.getElementById('seg-include-hiragana');
                const includeKatakanaInput = document.getElementById('seg-include-katakana');
                selectSegment(path, {
                    includeKanaScripts: {
                        hiragana: !!(includeHiraganaInput && includeHiraganaInput.checked),
                        katakana: !!(includeKatakanaInput && includeKatakanaInput.checked)
                    }
                });
            };

            if (idx === 0) {
                btn.classList.add('border-[#d9c09a]', 'bg-[#fffcf7]');
            }

            normalSection.appendChild(btn);
        });
        choiceTarget.appendChild(normalSection);
        normalSection.querySelectorAll('[data-segment-label]').forEach((label) => {
            const button = label.closest('button');
            fitSegmentOptionButton(button);
        });
        requestAnimationFrame(() => {
            normalSection.querySelectorAll('[data-segment-label]').forEach((label) => {
                const button = label.closest('button');
                fitSegmentOptionButton(button);
            });
        });
    } else {
        const emptyState = document.createElement('div');
        emptyState.className = 'mb-5 rounded-[28px] border border-dashed border-[#eadfce] bg-[#fffaf4] px-5 py-5 text-center text-[0.9rem] font-bold text-[#a6967a]';
        emptyState.textContent = '1文字ずつで進められる候補がまだ見つかりません';
        choiceTarget.appendChild(emptyState);
    }

    if (compoundOptions.length > 0) {
        const compoundSection = document.createElement('div');
        compoundSection.className = 'mt-2';
        compoundSection.appendChild(createSectionTitle('まとめ読み候補'));

        compoundOptions.forEach((option, idx) => {
            const btn = document.createElement('button');
            btn.className = "w-[92%] mx-auto py-4 px-4 bg-[#fffaf4] text-[#5d5444] font-black rounded-[34px] border border-[#eadfce] shadow-sm transition-all mb-3 hover:border-[#bca37f] hover:shadow-md active:scale-98 flex items-center gap-2 group text-left overflow-hidden";
            const labelParts = String(option.label || '').split(' / ').filter(Boolean);
            const displayLabelParts = labelParts.length > 0 ? labelParts : [''];
            const displayParts = displayLabelParts.map((part, index) => {
                const piece = `<span data-segment-piece class="shrink-0 inline-flex items-center whitespace-nowrap px-2">${part}</span>`;
                if (index === displayLabelParts.length - 1) return piece;
                return `${piece}<span data-segment-separator class="shrink-0 inline-flex items-center whitespace-nowrap px-2 text-sm text-[#d4c5af] opacity-40 group-hover:opacity-100 transition-opacity">/</span>`;
            }).join('');
            btn.innerHTML = `
                <span data-segment-count class="shrink-0 inline-flex items-center rounded-full border border-[#eadfce] bg-white px-3 py-1 text-[10px] font-black text-[#b9965b] shadow-sm">${option.badgeLabel || 'まとめ読み'}</span>
                <div data-segment-label class="min-w-0 flex-1 flex items-center flex-nowrap whitespace-nowrap overflow-hidden text-[clamp(0.9rem,2.3vw,1.05rem)] leading-tight">
                    ${displayParts}
                </div>
            `;
            btn.onclick = () => {
                setKanaCandidatesEnabledForSegments(false, []);
                if (typeof startCompoundReadingFlow === 'function') {
                    startCompoundReadingFlow(option, {
                        reading: nameReading,
                        tags: Array.isArray(option.tags) ? option.tags : [],
                        gender: gender || 'neutral'
                    });
                }
            };

            if (idx === 0) {
                btn.classList.add('border-[#d9c7ab]');
            }

            compoundSection.appendChild(btn);
        });

        choiceTarget.appendChild(compoundSection);
        compoundSection.querySelectorAll('[data-segment-label]').forEach((label) => {
            const button = label.closest('button');
            fitSegmentOptionButton(button);
        });
        requestAnimationFrame(() => {
            compoundSection.querySelectorAll('[data-segment-label]').forEach((label) => {
                const button = label.closest('button');
                fitSegmentOptionButton(button);
            });
        });
    }

    if (uniquePaths.length > 0) {
        optionsContainer.appendChild(kanaOption);
    }

    // 画面遷移
    changeScreen('scr-segment');
}

/**
 * 分割パターン選択
 */
function getActiveCompoundSwipeFlow() {
    if (typeof window.getCompoundBuildFlow !== 'function') return null;
    const flow = window.getCompoundBuildFlow();
    if (!flow || !Array.isArray(flow.segments) || !Array.isArray(segments)) return null;
    if (flow.segments.join('/') !== segments.join('/')) return null;
    return flow;
}

function selectSegment(path, options = {}) {
    console.log("ENGINE: Selected segments ->", path);
    if (typeof clearCompoundBuildFlow === 'function') {
        clearCompoundBuildFlow();
    }
    segments = path;
    setKanaCandidatesEnabledForSegments(options.includeKanaScripts || !!options.includeKana, segments);
    swipes = 0;
    currentPos = 0; // Reset position

    // 読みモードはイメージ選択をスキップ → 直接スワイプへ
    // （イメージ選択は「自由に漢字を探す」モードのみ使用）
    window.selectedImageTags = ['none'];
    isFreeSwipeMode = false;
    if (typeof startSwiping === 'function') startSwiping();
}

function setTemporarySwipeRule(slotIdx, nextRule) {
    if (!Number.isInteger(slotIdx) || slotIdx < 0) return;
    if (!window._temporarySwipeRules || typeof window._temporarySwipeRules !== 'object') {
        window._temporarySwipeRules = {};
    }
    if (nextRule) {
        window._temporarySwipeRules[slotIdx] = nextRule;
        return;
    }
    delete window._temporarySwipeRules[slotIdx];
}

function getTemporarySwipeRule(slotIdx = currentPos) {
    if (!Number.isInteger(slotIdx) || slotIdx < 0) return null;
    const overrides = window._temporarySwipeRules;
    if (!overrides || typeof overrides !== 'object') return null;
    return overrides[slotIdx] || null;
}

function getActiveSwipeRule(slotIdx = currentPos) {
    return getTemporarySwipeRule(slotIdx) || rule;
}

function clearTemporarySwipeRules() {
    window._temporarySwipeRules = {};
}
window.setTemporarySwipeRule = setTemporarySwipeRule;
window.getActiveSwipeRule = getActiveSwipeRule;
window.clearTemporarySwipeRules = clearTemporarySwipeRules;

function getSwipeStackContext(slotIdx = currentPos, options = {}) {
    const segmentList = Array.isArray(segments) ? segments : [];
    const safeSlotIdx = Number.isInteger(slotIdx) && slotIdx >= 0 ? slotIdx : currentPos;
    const target = toHira(segmentList[safeSlotIdx] || '');
    const normalizedTarget = normalizeReadingComparisonValue(target);
    const activeRule = options.ruleOverride || options.nextRule ||
        (typeof getActiveSwipeRule === 'function' ? getActiveSwipeRule(safeSlotIdx) : rule);

    return {
        slotIdx: safeSlotIdx,
        segmentList,
        target,
        normalizedTarget,
        activeRule,
        includeNoped: options.includeNoped === true,
        premiumOverride: options.premiumOverride === true,
        suppressLogs: options.suppressLogs === true
    };
}

function getSwipeCandidateDisplayKey(item) {
    return String(item?.['漢字'] || item?.kanji || '').trim();
}

function getSwipeReadingEntries(value) {
    if (typeof splitKanjiReadingEntries === 'function') {
        return splitKanjiReadingEntries(value);
    }
    return String(value || '')
        .split(/[、,，\s/]+/)
        .map(entry => String(entry || '').trim())
        .filter(Boolean);
}

function getSwipeReadingEntryForms(entry) {
    if (typeof getKanjiReadingForms === 'function') {
        return getKanjiReadingForms(entry);
    }
    const normalized = normalizeReadingComparisonValue(entry);
    return normalized ? [normalized] : [];
}

function formatSwipeFlexibleReadingLabel(targetReading, rawReading, normalizedReading) {
    const raw = String(rawReading || '').trim();
    const hiraRaw = typeof toHira === 'function' ? toHira(raw) : raw;
    const normalizedRaw = normalizeReadingComparisonValue(hiraRaw);
    const normalizedTarget = normalizeReadingComparisonValue(targetReading);
    const normalizedMatch = normalizeReadingComparisonValue(normalizedReading || normalizedRaw);

    if (hiraRaw && /[（(]/.test(hiraRaw)) {
        return hiraRaw.replace(/\(/g, '（').replace(/\)/g, '）');
    }
    if (normalizedTarget && normalizedMatch.startsWith(normalizedTarget) && normalizedMatch.length > normalizedTarget.length) {
        return `${normalizedTarget}（${normalizedMatch.slice(normalizedTarget.length)}）`;
    }
    return hiraRaw || normalizedMatch;
}

function getSwipeFlexibleReadingMatch(k, normalizedTarget, targetSeion, allowVoicedFallback) {
    const targets = [normalizedTarget];
    if (allowVoicedFallback && targetSeion && targetSeion !== normalizedTarget) {
        targets.push(targetSeion);
    }
    const entries = getSwipeReadingEntries(((k?.['音'] || '') + ',' + (k?.['訓'] || '')));

    for (const entry of entries) {
        const forms = getSwipeReadingEntryForms(entry);
        for (const target of targets) {
            const matched = forms.find(form => form.startsWith(target) && form.length > target.length);
            if (matched) {
                return {
                    raw: entry,
                    normalized: matched,
                    label: formatSwipeFlexibleReadingLabel(target, entry, matched)
                };
            }
        }
    }
    return null;
}

function countAdditionalSwipeCandidates(nextCandidates, baseCandidates) {
    const baseKeys = new Set((Array.isArray(baseCandidates) ? baseCandidates : [])
        .map(getSwipeCandidateDisplayKey)
        .filter(Boolean));
    const seen = new Set();
    return (Array.isArray(nextCandidates) ? nextCandidates : []).filter((item) => {
        const key = getSwipeCandidateDisplayKey(item);
        if (!key || baseKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).length;
}

function getApprovedSwipeKanjiList(target) {
    const segmentState = typeof getReadingSegmentRuleState === 'function'
        ? getReadingSegmentRuleState(target)
        : { state: 'missing', candidates: [] };
    return segmentState.state === 'approved' && Array.isArray(segmentState.candidates)
        ? segmentState.candidates.map((kanji) => String(kanji || '').trim()).filter(Boolean)
        : [];
}

function markApprovedSwipeCandidates(candidates, approvedKanjiList, context) {
    const list = Array.isArray(candidates) ? candidates : [];
    const approvedList = Array.isArray(approvedKanjiList) ? approvedKanjiList.filter(Boolean) : [];
    if (approvedList.length === 0) return list;

    const {
        slotIdx,
        includeNoped,
        premiumOverride,
        suppressLogs
    } = context || {};
    const byKanji = new Map();
    list.forEach((item) => {
        const kanji = getSwipeCandidateDisplayKey(item);
        if (kanji && !byKanji.has(kanji)) byKanji.set(kanji, item);
    });

    approvedList.forEach((kanji, index) => {
        const masterItem = Array.isArray(master)
            ? master.find((item) => String(item?.['漢字'] || '').trim() === kanji)
            : null;
        const accessible = masterItem && typeof isKanjiAccessibleForCurrentMembership === 'function'
            ? isKanjiAccessibleForCurrentMembership(masterItem)
            : (premiumOverride === true);

        if (!accessible && premiumOverride !== true) return;

        const alreadyLiked = Array.isArray(liked)
            ? liked.some((item) => item && item.slot == slotIdx && item['漢字'] === kanji)
            : false;
        if (alreadyLiked) {
            if (!suppressLogs) console.log(`ENGINE: Skipping approved ${kanji} because it is already liked at slot ${slotIdx}`);
            return;
        }
        if (!includeNoped && typeof noped !== 'undefined' && noped && noped.has(kanji)) return;

        let item = byKanji.get(kanji);
        if (!item) {
            if (!masterItem) return;
            item = { ...masterItem };
            list.push(item);
            byKanji.set(kanji, item);
        }

        item.priority = Math.min(item.priority || 1, 1);
        item.readingTier = Math.min(item.readingTier || 1, 1);
        item._approvedSwipeCandidate = true;
        item._approvedSwipeOrder = index;
        item._approvedSwipeNoise = Math.random();
    });

    return list;
}

function buildSwipeStackCandidates(options = {}) {
    const additionalBaseKeys = options.additionalBaseKeys instanceof Set
        ? options.additionalBaseKeys
        : (Array.isArray(options.additionalBaseKeys) ? new Set(options.additionalBaseKeys) : null);
    const {
        slotIdx,
        segmentList,
        target,
        normalizedTarget,
        activeRule,
        includeNoped,
        premiumOverride,
        suppressLogs
    } = getSwipeStackContext(options.slotIdx, options);

    if (!target || !Array.isArray(master) || master.length === 0) return [];
    const approvedKanjiList = getApprovedSwipeKanjiList(normalizedTarget);

    let candidates = master.filter(k => {
        delete k._swipeMatchKind;
        delete k._swipeMatchedReading;
        delete k._swipeMatchedReadingRaw;
        delete k._swipeMatchDisplayLabel;

        if (!premiumOverride && !isKanjiAccessibleForCurrentMembership(k)) {
            return false;
        }
        // 不適切フラグのハードフィルタ（設定でONにしない限り除外）
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') {
            if (typeof showInappropriateKanji === 'undefined' || !showInappropriateKanji) return false;
        }

        if (isKanjiGenderMismatch(k)) {
            return false;
        }

        // 同じ読みが続く場合は、seenチェックをスキップ
        const isSameReading = slotIdx > 0 && segmentList[slotIdx] === segmentList[slotIdx - 1];

        if (!isSameReading && seen && seen.has(k['漢字'])) {
            // return false; // ユーザー要望により、既読・ストック済みでも再出現させる
        }

        // ユーザー要望：戻った時に、そのターンで選んだ（ストック済み）漢字は候補に出さない
        const alreadyLiked = liked.some(l => l.slot == slotIdx && l['漢字'] === k['漢字']);
        if (alreadyLiked) {
            if (!suppressLogs) {
                console.log(`ENGINE: Skipping ${k['漢字']} because it is already liked at slot ${slotIdx}`);
            }
            return false;
        }

        // NOPEした漢字は出さない（最初から選び直し時にリセット）
        if (!includeNoped && typeof noped !== 'undefined' && noped.has(k['漢字'])) {
            return false;
        }

        // 読みデータの取得（メジャー/マイナー区分）
        // 全角括弧を除去してひらがなに正規化（例: あ（かり）→ あかり）
        const readingBuckets = typeof getKanjiReadingBuckets === 'function'
            ? getKanjiReadingBuckets(k)
            : null;
        const majorReadings = Array.isArray(readingBuckets?.majorReadings)
            ? readingBuckets.majorReadings
            : ((k['音'] || '') + ',' + (k['訓'] || ''))
                .split(/[、,，\s/]+/)
                .map(x => normalizeReadingComparisonValue(x))
                .filter(Boolean);
        const minorReadings = Array.isArray(readingBuckets?.minorReadings)
            ? readingBuckets.minorReadings
            : (k['伝統名のり'] || '')
                .split(/[、,，\s/]+/)
                .map(x => normalizeReadingComparisonValue(x))
                .filter(Boolean);
        const majorStrictReadings = Array.isArray(readingBuckets?.majorStrictReadings) && readingBuckets.majorStrictReadings.length > 0
            ? readingBuckets.majorStrictReadings
            : majorReadings;
        const minorStrictReadings = Array.isArray(readingBuckets?.minorStrictReadings) && readingBuckets.minorStrictReadings.length > 0
            ? readingBuckets.minorStrictReadings
            : minorReadings;

        // 読みマッチング判定
        // 優先順位：メジャー完全一致 > マイナー完全一致 > 清音化一致 > 一部読み一致
        // ※ 一部読み一致（isPartial）は名乗りを対象外にする（音読み・訓読みのみ）
        const targetSeion = typeof toSeion === 'function' ? normalizeReadingComparisonValue(toSeion(target)) : normalizedTarget;
        const allowVoicedFallback = slotIdx > 0 && isLeadingDakutenVariant(normalizedTarget, targetSeion);
        const isMajorExact = majorStrictReadings.includes(normalizedTarget);
        const isMinorExact = minorStrictReadings.includes(normalizedTarget);
        // 清音化一致：メジャー読みのみを対象（名乗りは除外）
        const isSeionMatch = allowVoicedFallback && majorStrictReadings.includes(targetSeion);
        // 一部読み一致：音読み・訓読みのみ（名乗りは除外）
        const isPartial = majorReadings.some(r => r.startsWith(normalizedTarget)) ||
            (allowVoicedFallback && majorReadings.some(r => r.startsWith(targetSeion)));

        if (isMajorExact) {
            k.priority = 1;      // メジャー読み完全一致（最優先）
            k.readingTier = 1;
        } else if (isMinorExact) {
            k.priority = 1;      // マイナー（名乗り）完全一致
            k.readingTier = 2;   // メジャーの後に表示
        } else if (isSeionMatch) {
            k.priority = 2;
            k.readingTier = 3;
        } else if (isPartial) {
            k.priority = 3;
            k.readingTier = 4;
            const match = getSwipeFlexibleReadingMatch(k, normalizedTarget, targetSeion, allowVoicedFallback);
            if (match && match.label) {
                k._swipeMatchKind = 'partial';
                k._swipeMatchedReading = match.normalized;
                k._swipeMatchedReadingRaw = match.raw;
                k._swipeMatchDisplayLabel = match.label;
            }
        } else {
            k.priority = 0;
            k.readingTier = 99;
        }

        // ルールに応じてフィルタ (priority=1:完全一致, priority=2:連濁一致)
        return activeRule === 'strict' ? (k.priority === 1 || k.priority === 2) : k.priority > 0;
    });

    // 々（同じ字点）の対応
    // 条件：前の文字と同じ、または濁点・半濁点の関係にある場合
    // 例：さ⇔ざ、か⇔が、は⇔ば⇔ぱ
    if (slotIdx > 0) {
        const cur = segmentList[slotIdx];
        const prev = segmentList[slotIdx - 1];

        if (cur === prev || isDakutenMatch(cur, prev)) {
            const currentReadingRaw = typeof getCurrentSessionReading === 'function'
                ? getCurrentSessionReading()
                : segmentList.join('');
            const currentReadingNormalized = typeof normalizeReadingComparisonValue === 'function'
                ? normalizeReadingComparisonValue(currentReadingRaw)
                : String(currentReadingRaw || '').trim();
            const prevNormalized = typeof normalizeReadingComparisonValue === 'function'
                ? normalizeReadingComparisonValue(prev)
                : String(prev || '').trim();
            const prevChoices = liked.filter(item => {
                if (item.slot !== slotIdx - 1 || item.isKanaCandidate || item['漢字'] === '々') return false;

                const itemReadingNormalized = typeof normalizeReadingComparisonValue === 'function'
                    ? normalizeReadingComparisonValue(item.sessionReading || '')
                    : String(item.sessionReading || '').trim();
                if (!currentReadingNormalized || itemReadingNormalized !== currentReadingNormalized) return false;

                if (Array.isArray(item.sessionSegments)) {
                    const itemPrevSegment = item.sessionSegments[item.slot] || '';
                    const itemPrevNormalized = typeof normalizeReadingComparisonValue === 'function'
                        ? normalizeReadingComparisonValue(itemPrevSegment)
                        : String(itemPrevSegment || '').trim();
                    if (prevNormalized && itemPrevNormalized && itemPrevNormalized !== prevNormalized) return false;
                }

                return true;
            });

            if (prevChoices.length > 0) {
                candidates.push({
                    '漢字': '々',
                    '画数': prevChoices[0]['画数'],
                    '音': '',
                    '訓': '',
                    '伝統名のり': '',
                    '意味': '前の漢字を繰り返す',
                    '名前のイメージ': '【繰り返し】',
                    '分類': '【記号】',
                    priority: 1,
                    score: 999999 // Ensure it appears first
                });
            }
        }
    }

    // 性別による優先順位付け (calculateKanjiScoreで考慮)
    // candidates = applyGenderFilter(candidates);

    // イメージタグによる優先順位付け
    candidates = applyImageTagFilter(candidates);

    // 総合スコア計算
    candidates.forEach(k => {
        k.score = calculateKanjiScore(k);
        if (k.imagePriority === 1) k.score += 1500; // イメージ一致ボーナス
    });
    candidates = markApprovedSwipeCandidates(candidates, approvedKanjiList, {
        slotIdx,
        includeNoped,
        premiumOverride,
        suppressLogs
    });
    candidates.forEach(k => {
        if (k._approvedSwipeCandidate) {
            k.score = (Number(k.score) || 0) + 12000 + Math.random() * 2000;
        }
    });

    // 優先度でソート（メジャー/マイナー区分対応）
    candidates.sort((a, b) => {
        // 々（繰り返し記号）は最優先
        if (a['漢字'] === '々') return -1;
        if (b['漢字'] === '々') return 1;

        // まず読みの優先度 (1:完全一致, 2:清音一致, 3:一部読み一致)
        if (a.priority !== b.priority) return a.priority - b.priority;

        // 同じpriority内でメジャー/マイナー区分（readingTier）
        const tierA = a.readingTier || 99;
        const tierB = b.readingTier || 99;
        if (tierA !== tierB) return tierA - tierB;

        if (!!a._approvedSwipeCandidate !== !!b._approvedSwipeCandidate) {
            return a._approvedSwipeCandidate ? -1 : 1;
        }
        if (a._approvedSwipeCandidate && b._approvedSwipeCandidate) {
            const noiseDelta = (a._approvedSwipeNoise || 0) - (b._approvedSwipeNoise || 0);
            if (noiseDelta !== 0) return noiseDelta;
            return (a._approvedSwipeOrder || 0) - (b._approvedSwipeOrder || 0);
        }

        // 次に総合スコア（降順）
        return b.score - a.score;
    });

    const kanaCandidates = getSwipeKanaCandidatesForCurrentSlot(target, slotIdx);
    let combinedCandidates = kanaCandidates.length > 0 ? [...kanaCandidates, ...candidates] : candidates;
    if (additionalBaseKeys && additionalBaseKeys.size > 0) {
        combinedCandidates = combinedCandidates.filter(item => !additionalBaseKeys.has(getSwipeCandidateDisplayKey(item)));
    }
    return combinedCandidates;
}

function getSwipeEmptyStateActionCounts(slotIdx = currentPos) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return { revisit: 0, flexible: 0, premium: 0 };
    }

    const activeRule = typeof getActiveSwipeRule === 'function' ? getActiveSwipeRule(slotIdx) : rule;
    const baseCandidates = buildSwipeStackCandidates({
        slotIdx,
        ruleOverride: activeRule,
        includeNoped: false,
        suppressLogs: true
    });
    const revisitCandidates = buildSwipeStackCandidates({
        slotIdx,
        ruleOverride: activeRule,
        includeNoped: true,
        suppressLogs: true
    });
    const counts = {
        revisit: countAdditionalSwipeCandidates(revisitCandidates, baseCandidates),
        flexible: 0,
        premium: 0
    };

    if (activeRule === 'strict') {
        const flexibleCandidates = buildSwipeStackCandidates({
            slotIdx,
            ruleOverride: 'lax',
            includeNoped: true,
            suppressLogs: true
        });
        counts.flexible = countAdditionalSwipeCandidates(flexibleCandidates, revisitCandidates);
    }

    if (!isPremiumAccessActive()) {
        const premiumCandidates = buildSwipeStackCandidates({
            slotIdx,
            ruleOverride: activeRule,
            includeNoped: false,
            premiumOverride: true,
            suppressLogs: true
        });
        counts.premium = countAdditionalSwipeCandidates(premiumCandidates, baseCandidates);
    }

    return counts;
}
window.getSwipeEmptyStateActionCounts = getSwipeEmptyStateActionCounts;

/**
 * スワイプ用スタックの生成
 */

/**
 * スワイプ用スタックの生成（性別＋イメージタグフィルター対応）
 */
function loadStack() {
    if (!segments || segments.length === 0) {
        console.error("ENGINE: Segments not defined");
        return;
    }

    const target = toHira(segments[currentPos]);
    const activeRule = typeof getActiveSwipeRule === 'function' ? getActiveSwipeRule(currentPos) : rule;
    const includeNopedForThisLoad = window._includeNopedForSlot === currentPos;
    window._includeNopedForSlot = null;
    const additionalFilter = window._swipeAdditionalBaseKeysForSlot;
    const additionalBaseKeysForThisLoad = additionalFilter && additionalFilter.slotIdx === currentPos && Array.isArray(additionalFilter.keys)
        ? new Set(additionalFilter.keys)
        : null;
    if (additionalFilter && additionalFilter.slotIdx === currentPos) {
        window._swipeAdditionalBaseKeysForSlot = null;
    }
    const normalizedTarget = normalizeReadingComparisonValue(target);
    console.log(`ENGINE: Loading stack for position ${currentPos + 1}: "${target}"${normalizedTarget !== target ? ` (→ "${normalizedTarget}")` : ''}`);

    // --- Free Stock Auto-Matching ---
    const freeItems = liked.filter(l => l.sessionReading === 'FREE');
    freeItems.forEach(freeItem => {
        // すでにこのスロットに登録済みならスキップ
        const isDuplicateLocal = liked.some(item =>
            item.slot === currentPos && item['漢字'] === freeItem['漢字']
        );
        if (isDuplicateLocal) return;

        const readingBuckets = typeof getKanjiReadingBuckets === 'function'
            ? getKanjiReadingBuckets(freeItem)
            : null;
        const normalizedReadings = Array.isArray(readingBuckets?.allStrictReadings) && readingBuckets.allStrictReadings.length > 0
            ? readingBuckets.allStrictReadings
            : (((freeItem['音'] || '') + ',' + (freeItem['訓'] || '') + ',' + (freeItem['伝統名のり'] || ''))
                .split(/[、,，\s/]+/)
                .map(x => normalizeReadingComparisonValue(x))
                .filter(Boolean));

        const targetSeion = typeof toSeion === 'function' ? normalizeReadingComparisonValue(toSeion(normalizedTarget)) : normalizedTarget;
        const allowVoicedFallback = currentPos > 0 && isLeadingDakutenVariant(normalizedTarget, targetSeion);
        const isExact = normalizedReadings.includes(normalizedTarget);
        const isSeionMatch = allowVoicedFallback && normalizedReadings.includes(targetSeion);
        const isPartial = normalizedReadings.some(r => r.startsWith(normalizedTarget)) || (allowVoicedFallback && normalizedReadings.some(r => r.startsWith(targetSeion)));

        let match = false;
        if (typeof activeRule !== 'undefined' && activeRule === 'strict') {
            match = isExact || isSeionMatch;
        } else {
            match = isExact || isSeionMatch || isPartial;
        }

        if (match) {
            liked.push({
                ...freeItem,
                slot: currentPos,
                sessionReading: typeof getCurrentSessionReading === 'function' ? getCurrentSessionReading() : segments.join(''),
                sessionSegments: [...segments]
            });
            console.log(`ENGINE: Auto-injected Free Stock => ${freeItem['漢字']} for slot ${currentPos}`);
        }
    });

    // インジケーター更新
    const indicator = document.getElementById('pos-indicator');
    if (indicator) {
        const totalSlots = segments.length;
        const compoundFlow = getActiveCompoundSwipeFlow();
        const slotLabel = totalSlots === 2 ?
            (currentPos === 0 ? '1文字目' : '2文字目') :
            (currentPos === 0 ? '1文字目' : currentPos === totalSlots - 1 ? `${totalSlots}文字目` : `${currentPos + 1}文字目`);

        indicator.innerText = `${slotLabel}：${target}`;
    }

    // ナビゲーションボタン更新
    const btnPrev = document.getElementById('btn-prev-char');
    const btnNext = document.getElementById('btn-next-char');

    if (btnPrev) {
        btnPrev.classList.remove('opacity-0', 'pointer-events-none');
        btnPrev.onclick = () => prevChar();

        // 1文字目の場合は「戻る」表記にするなどの調整も可能だが、統一感のためアイコンのままでも可
        // ここでは特段の見た目変更はせず、機能のみ有効化
    }

    if (indicator) {
        const totalSlots = segments.length;
        const activeCompoundFlow = getActiveCompoundSwipeFlow();
        const compoundLabel = activeCompoundFlow && Array.isArray(activeCompoundFlow.slotLabels)
            ? activeCompoundFlow.slotLabels[currentPos]
            : '';
        const fallbackLabel = totalSlots === 2
            ? (currentPos === 0 ? '1文字目' : '2文字目')
            : (currentPos === 0 ? '1文字目' : currentPos === totalSlots - 1 ? `${totalSlots}文字目` : `${currentPos + 1}文字目`);

        indicator.innerText = compoundLabel || `${fallbackLabel}：${target}`;
    }

    if (btnPrev) {
        const activeCompoundFlow = getActiveCompoundSwipeFlow();
        const minSwipeSlot = activeCompoundFlow && Number.isInteger(activeCompoundFlow.firstInteractiveSlot) && activeCompoundFlow.firstInteractiveSlot >= 0
            ? activeCompoundFlow.firstInteractiveSlot
            : 0;

        if (currentPos <= minSwipeSlot) {
            btnPrev.classList.remove('opacity-0', 'pointer-events-none');
            btnPrev.innerHTML = '&lt; 戻る';
            btnPrev.onclick = () => {
                if (typeof goBack === 'function') goBack();
            };
        } else {
            btnPrev.classList.remove('opacity-0', 'pointer-events-none');
            btnPrev.innerHTML = '&lt; 戻る';
            btnPrev.onclick = () => prevChar();
        }
    }

    if (btnNext) {
        window._addMoreFromBuild = currentPos >= segments.length - 1 ? window._addMoreFromBuild : false;
        btnNext.onclick = () => nextChar();
        if (currentPos < segments.length - 1) {
            btnNext.innerHTML = '次へ &gt;';
            // Outline style
            btnNext.classList.remove('bg-[#bca37f]', 'text-white');
            btnNext.classList.add('bg-white', 'text-[#bca37f]', 'border-2', 'border-[#bca37f]');
        } else {
            // Solid style for Done
            btnNext.innerHTML = '完了 &gt;';
            btnNext.classList.remove('bg-white', 'text-[#bca37f]');
            btnNext.classList.add('bg-[#bca37f]', 'text-white', 'border-2', 'border-[#bca37f]');
        }
    }

    stack = buildSwipeStackCandidates({
        slotIdx: currentPos,
        ruleOverride: activeRule,
        includeNoped: includeNopedForThisLoad,
        additionalBaseKeys: additionalBaseKeysForThisLoad
    });

    console.log(`ENGINE: Stack loaded with ${stack.length} candidates`);

    currentIdx = 0;

    if (typeof render === 'function') {
        render();
    }
}
function calculateKanjiScore(k) {
    let score = getKanjiRecommendationScore(k);

    if (isKanjiGenderMismatch(k)) {
        return -999999;
    }

    // 不適切フラグ（名前にふさわしくない）
    if (k['不適切フラグ'] && !showInappropriateKanji) {
        return -999999;
    }

    const genderPriority = getKanjiGenderPriority(k);
    if (genderPriority === 1) score += 160;
    else if (genderPriority === 2) score += 40;

    // 画数適性は補助的にだけ使う
    const strokes = parseInt(k['画数']) || 0;
    if (strokes >= 6 && strokes <= 15) {
        score += 18;
    }

    // 姓名判断優先モード
    if (prioritizeFortune && surnameData && surnameData.length > 0) {
        // 簡易的な相性チェック（実装は fortune.js 参照）
        score += 40;
    }

    return score;
}

console.log("ENGINE: Module loaded");

/**
 * 性別フィルター適用
 */
function applyGenderFilter(kanjis) {
    if (!gender || gender === 'neutral') {
        // 指定なしの場合は全て同じ優先度
        kanjis.forEach(k => k.genderPriority = 1);
        return kanjis;
    }

    // キーワードマッピング
    const maleKeywords = ['力強', '剛', '勇', '雄', '男', '太', '大', '翔', '斗', '輝', '陽', '壮大', 'リーダー', '成功'];
    const femaleKeywords = ['優', '美', '麗', '花', '菜', '子', '愛', '華', '彩', '音', '里', '柔', '優しさ', '慈愛', '清らか'];

    return kanjis.map(k => {
        const img = k['名前のイメージ'] || '';
        const meaning = k['意味'] || '';
        const combined = img + meaning;

        // キーワードマッチング
        const isMale = maleKeywords.some(kw => combined.includes(kw));
        const isFemale = femaleKeywords.some(kw => combined.includes(kw));

        if (gender === 'male') {
            k.genderPriority = isMale ? 1 : (isFemale ? 3 : 2);
        } else if (gender === 'female') {
            k.genderPriority = isFemale ? 1 : (isMale ? 3 : 2);
        } else {
            k.genderPriority = 1;
        }

        return k;
    });
}

/**
 * イメージタグフィルター適用
 */
function applyImageTagFilter(kanjis) {
    // selectedImageTagsが未定義または「こだわらない」が選択されている場合
    if (typeof selectedImageTags === 'undefined' || !selectedImageTags || selectedImageTags.includes('none')) {
        kanjis.forEach(k => k.imagePriority = 1);
        return kanjis;
    }

    // 04-ui-flow.js の VIBES 配列 id → #分類 値のマッピング
    // データに実際に存在するタグのみ（古い #海・水 / #勇気 等は使わない）
    const tagKeywords = {
        'nature':       ['#自然'],
        'sky':          ['#天空'],
        'water':        ['#水景'],
        'color':        ['#色彩'],
        'kindness':     ['#慈愛'],
        'strength':     ['#勇壮'],
        'intelligence': ['#知性'],
        'soar':         ['#飛躍'],
        'happiness':    ['#幸福'],
        'beauty':       ['#品格'],
        'hope':         ['#希望'],
        'belief':       ['#信念'],
        'harmony':      ['#調和'],
        'tradition':    ['#伝統'],
        'music':        ['#奏楽'],
    };

    return kanjis.map(k => {
        const category = k['分類'] || '';

        // 選択されたタグのいずれかにマッチするかチェック
        const matches = selectedImageTags.some(tagId => {
            const keywords = tagKeywords[tagId] || [];
            return keywords.some(kw => category.includes(kw));
        });

        k.imagePriority = matches ? 1 : 2;
        return k;
    });
}

console.log("ENGINE: Module loaded (v13.1 - Gender + Image Tag filters)");

function getCompoundInteractiveSlotBefore(slotIndex) {
    const flow = getActiveCompoundSwipeFlow();
    if (!flow || !Array.isArray(flow.interactiveSlots)) return slotIndex - 1;
    const candidates = flow.interactiveSlots.filter((idx) => idx < slotIndex);
    if (candidates.length === 0) return null;
    return candidates[candidates.length - 1];
}

function getCompoundInteractiveSlotAfter(slotIndex) {
    const flow = getActiveCompoundSwipeFlow();
    if (!flow || !Array.isArray(flow.interactiveSlots)) {
        return Array.isArray(segments) && slotIndex < segments.length - 1 ? slotIndex + 1 : null;
    }
    const next = flow.interactiveSlots.find((idx) => idx > slotIndex);
    return Number.isInteger(next) ? next : null;
}

/**
 * 前の文字へ戻る
 */
function prevChar() {
    const compoundFlow = getActiveCompoundSwipeFlow();
    const minSwipeSlot = compoundFlow && Number.isInteger(compoundFlow.firstInteractiveSlot) && compoundFlow.firstInteractiveSlot >= 0
        ? compoundFlow.firstInteractiveSlot
        : 0;

    const prevInteractiveSlot = getCompoundInteractiveSlotBefore(currentPos);

    if (prevInteractiveSlot !== null && prevInteractiveSlot >= minSwipeSlot) {
        currentPos = prevInteractiveSlot;
        currentIdx = 0; // スタックの先頭に戻す
        swipes = 0;
        loadStack();
    } else {
        // 1文字目の場合は分割選択画面に戻る（読みモードはvibe画面なし）
        if (confirm('分割選択画面に戻りますか？\n（現在の進行状況はリセットされます）')) {
            changeScreen('scr-segment');
        }
    }
}


// グローバル公開
window.loadStack = loadStack;
window.prevChar = prevChar;
window.nextChar = nextChar;
window.getReadingSegmentPaths = getReadingSegmentPaths;

/**
 * 濁点・半濁点の関係かどうか判定
 */
function isDakutenMatch(a, b) {
    if (!a || !b) return false;

    // ベース文字（清音）への変換マップ
    const normalize = (char) => {
        const map = {
            'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
            'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
            'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
            'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
            'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ',
            'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
            'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'
        };
        return map[char] || char;
    };

    return normalize(a) === normalize(b);
}

function nextChar() {
    const nextInteractiveSlot = getCompoundInteractiveSlotAfter(currentPos);
    const hasMoreSlots = Number.isInteger(nextInteractiveSlot);

    if (hasMoreSlots) {
        window._addMoreFromBuild = false;

        if (typeof checkInheritForSlot === 'function') {
            checkInheritForSlot(nextInteractiveSlot, () => {
                window._addMoreFromBuild = false;
                currentPos = nextInteractiveSlot;
                currentIdx = 0;
                swipes = 0;
                loadStack();
            });
            return;
        }

        currentPos = nextInteractiveSlot;
        currentIdx = 0;
        swipes = 0;
        loadStack();
        return;
    }

    if (liked.length === 0) {
        if (!confirm('まだストックがありませんが、ビルド画面に進みますか？')) return;
    }

    if (typeof openBuild === 'function') {
        openBuild();
    } else {
        console.error("ENGINE: openBuild function not found");
    }
}

window.nextChar = nextChar;
