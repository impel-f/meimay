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
    const nameReading = toHira((rawReading || '').trim());
    if (!nameReading || !/^[ぁ-ん]+$/.test(nameReading)) {
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
    const nameReading = toHira(rawVal);

    // 入力チェック
    if (!nameReading) {
        alert("名前の読みをひらがなで入力してください。\n例：はな、かな、ゆうと");
        return;
    }

    if (!/^[ぁ-ん]+$/.test(nameReading)) {
        alert("ひらがなのみで入力してください。");
        return;
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
    const normalSection = document.createElement('div');
    normalSection.className = 'mb-6';
    normalSection.appendChild(createSectionTitle('1文字ずつ探す'));

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
            btn.onclick = () => selectSegment(path);

            if (idx === 0) {
                btn.classList.add('border-[#d9c09a]', 'bg-[#fffcf7]');
            }

            normalSection.appendChild(btn);
        });
        optionsContainer.appendChild(normalSection);
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
        optionsContainer.appendChild(emptyState);
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

        optionsContainer.appendChild(compoundSection);
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

function selectSegment(path) {
    console.log("ENGINE: Selected segments ->", path);
    if (typeof clearCompoundBuildFlow === 'function') {
        clearCompoundBuildFlow();
    }
    segments = path;
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
    const normalizedTarget = normalizeReadingComparisonValue(target);
    const targetSokuon = normalizedTarget;
    console.log(`ENGINE: Loading stack for position ${currentPos + 1}: "${target}"${normalizedTarget !== target ? ` (→ "${normalizedTarget}")` : ''}`);

    // --- Free Stock Auto-Matching ---
    const freeItems = liked.filter(l => l.sessionReading === 'FREE');
    freeItems.forEach(freeItem => {
        // すでにこのスロットに登録済みならスキップ
        const isDuplicateLocal = liked.some(item =>
            item.slot === currentPos && item['漢字'] === freeItem['漢字']
        );
        if (isDuplicateLocal) return;

        const majorReadings = ((freeItem['音'] || '') + ',' + (freeItem['訓'] || ''))
            .split(/[、,，\s/]+/)
            .map(x => normalizeReadingComparisonValue(x))
            .filter(Boolean);
        const minorReadings = (freeItem['伝統名のり'] || '')
            .split(/[、,，\s/]+/)
            .map(x => normalizeReadingComparisonValue(x))
            .filter(Boolean);
        const readings = [...majorReadings, ...minorReadings];
        const normalizedReadings = readings.map(x => normalizeReadingComparisonValue(x)).filter(Boolean);

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

    // フィルタリング
    stack = master.filter(k => {
        if (!isKanjiAccessibleForCurrentMembership(k)) {
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
        const isSameReading = currentPos > 0 && segments[currentPos] === segments[currentPos - 1];

        if (!isSameReading && seen && seen.has(k['漢字'])) {
            // return false; // ユーザー要望により、既読・ストック済みでも再出現させる
        }

        // ユーザー要望：戻った時に、そのターンで選んだ（ストック済み）漢字は候補に出さない
        const alreadyLiked = liked.some(l => l.slot == currentPos && l['漢字'] === k['漢字']);
        if (alreadyLiked) {
            console.log(`ENGINE: Skipping ${k['漢字']} because it is already liked at slot ${currentPos}`);
            return false;
        }

        // NOPEした漢字は出さない（最初から選び直し時にリセット）
        if (!includeNopedForThisLoad && typeof noped !== 'undefined' && noped.has(k['漢字'])) {
            return false;
        }

        // 読みデータの取得（メジャー/マイナー区分）
        // 全角括弧を除去してひらがなに正規化（例: あ（かり）→ あかり）
        const majorReadings = ((k['音'] || '') + ',' + (k['訓'] || ''))
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(x => x);
        const minorReadings = (k['伝統名のり'] || '')
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(x => x);
        const readings = [...majorReadings, ...minorReadings];

        // 読みマッチング判定
        // 優先順位：メジャー完全一致 > マイナー完全一致 > 清音化一致 > 部分一致
        // ※ ぶった切り（isPartial）は名乗りを対象外にする（音読み・訓読みのみ）
        const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
        const allowVoicedFallback = currentPos > 0 && isLeadingDakutenVariant(target, targetSeion);

        // 促音一致: きっ→きつ、てっ→てつ 等（targetSokuon は loadStack 冒頭で定義済み）
        const isMajorExact = majorReadings.includes(target) ||
            (targetSokuon !== target && majorReadings.includes(targetSokuon));
        const isMinorExact = minorReadings.includes(target) ||
            (targetSokuon !== target && minorReadings.includes(targetSokuon));
        const isExact = isMajorExact || isMinorExact;
        // 清音化一致：メジャー読みのみを対象（名乗りは除外）
        const isSeionMatch = allowVoicedFallback && majorReadings.includes(targetSeion);
        // 部分一致（ぶった切り）：音読み・訓読みのみ（名乗りは除外）
        const isPartial = majorReadings.some(r => r.startsWith(target)) || (allowVoicedFallback && majorReadings.some(r => r.startsWith(targetSeion))) ||
            (targetSokuon !== target && majorReadings.some(r => r.startsWith(targetSokuon)));

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
    if (currentPos > 0) {
        const cur = segments[currentPos];
        const prev = segments[currentPos - 1];

        if (cur === prev || isDakutenMatch(cur, prev)) {
            const prevChoices = liked.filter(item => item.slot === currentPos - 1);

            if (prevChoices.length > 0) {
                stack.push({
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
    // stack = applyGenderFilter(stack); 

    // イメージタグによる優先順位付け
    stack = applyImageTagFilter(stack);

    // 総合スコア計算
    stack.forEach(k => {
        k.score = calculateKanjiScore(k);
        if (k.imagePriority === 1) k.score += 1500; // イメージ一致ボーナス
    });

    // 優先度でソート（メジャー/マイナー区分対応）
    stack.sort((a, b) => {
        // 々（繰り返し記号）は最優先
        if (a['漢字'] === '々') return -1;
        if (b['漢字'] === '々') return 1;

        // まず読みの優先度 (1:完全一致, 2:清音一致, 3:部分一致)
        if (a.priority !== b.priority) return a.priority - b.priority;

        // 同じpriority内でメジャー/マイナー区分（readingTier）
        const tierA = a.readingTier || 99;
        const tierB = b.readingTier || 99;
        if (tierA !== tierB) return tierA - tierB;

        // 次に総合スコア（降順）
        return b.score - a.score;
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

/**
 * 次の文字へ進む（または完了）
 */
function nextChar() {
    if (currentPos < segments.length - 1) {
        // 次のスロットへ進む前に、引き継ぎ候補のチェックとモーダル表示を行う（04-ui-flow.jsで定義）
        if (typeof checkInheritForSlot === 'function') {
            checkInheritForSlot(currentPos + 1, () => {
                currentPos++;
                currentIdx = 0;
                swipes = 0;
                loadStack();
            });
        } else {
            // 定義されていなければそのまま進む
            currentPos++;
            currentIdx = 0;
            swipes = 0;
            loadStack();
        }
    } else {
        // 最後の文字ならストック確認してビルドへ
        if (liked.length === 0) {
            if (!confirm('まだストックがありませんが、名前作成に進みますか？')) return;
        }

        if (typeof openBuild === 'function') {
            openBuild();
        } else {
            console.error("ENGINE: openBuild function not found");
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
