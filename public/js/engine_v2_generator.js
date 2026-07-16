/**
 * MODULE: ENGINE V2 GENERATOR
 * ニックネームからの名前候補生成ロジック
 */

let nameCandidateSourceCache = {
    sourceRef: null,
    sourceLength: -1,
    sourceKind: '',
    sourceData: [],
    sourceByReading: new Map(),
    filteredByGender: new Map()
};

function getNameCandidateSourceContext(gender) {
    const hasReadingsData = typeof readingsData !== 'undefined'
        && Array.isArray(readingsData)
        && readingsData.length > 0;
    const hasYomiSearchData = typeof yomiSearchData !== 'undefined'
        && Array.isArray(yomiSearchData)
        && yomiSearchData.length > 0;
    const sourceRef = hasReadingsData
        ? readingsData
        : (hasYomiSearchData ? yomiSearchData : null);
    const sourceKind = hasReadingsData ? 'readings' : (hasYomiSearchData ? 'yomi' : '');

    if (!sourceRef) {
        return { sourceData: [], sourceByReading: new Map(), filteredData: [] };
    }

    if (nameCandidateSourceCache.sourceRef !== sourceRef
        || nameCandidateSourceCache.sourceLength !== sourceRef.length
        || nameCandidateSourceCache.sourceKind !== sourceKind) {
        const sourceData = sourceRef;
        const sourceByReading = new Map();
        sourceData.forEach((item) => {
            const reading = getNameCandidateSourceReading(item, sourceKind);
            if (reading && !sourceByReading.has(reading)) sourceByReading.set(reading, item);
        });
        nameCandidateSourceCache = {
            sourceRef,
            sourceLength: sourceRef.length,
            sourceKind,
            sourceData,
            sourceByReading,
            filteredByGender: new Map()
        };
    }

    const genderKey = gender || 'neutral';
    if (!nameCandidateSourceCache.filteredByGender.has(genderKey)) {
        const filteredData = nameCandidateSourceCache.sourceData.filter((item) => {
            if (gender === 'male' && item.gender === 'female') return false;
            if (gender === 'female' && item.gender === 'male') return false;
            return true;
        });
        nameCandidateSourceCache.filteredByGender.set(genderKey, filteredData);
    }

    return {
        sourceData: nameCandidateSourceCache.sourceData,
        sourceByReading: nameCandidateSourceCache.sourceByReading,
        filteredData: nameCandidateSourceCache.filteredByGender.get(genderKey)
    };
}

function getNameCandidateSourceReading(item, sourceKind) {
    return sourceKind === 'readings' ? item?.reading : item?.yomi;
}

function getNameCandidateSourceValue(item, sourceKind) {
    if (!item) return null;
    const reading = sourceKind === 'readings' ? item.reading : item.yomi;
    const examples = sourceKind === 'readings'
        ? String(item.examples || '').split(/[,、]/).map(value => value.trim()).filter(Boolean)
        : (Array.isArray(item.examples) ? item.examples : []);
    return {
        reading,
        count: Number(item.count) || 0,
        popular: sourceKind === 'readings' ? !!item.isPopular : !!item.popular,
        examples,
        tags: Array.isArray(item.tags) ? item.tags : []
    };
}

/**
 * 名前候補を生成する
 * 読み方リスト_精緻化済.xlsxから生成された yomiSearchData を使用する
 *
 * @param {string} nickname - 入力されたニックネーム（ひらがな）
 * @param {string} gender - 'male', 'female', 'neutral'
 * @param {string} position - 'prefix' (default: 〇〇〜) or 'suffix' (〜〇〇)
 */
function generateNameCandidates(nickname, gender, position = 'prefix') {
    console.log(`GEN: Generating candidates for ${nickname} (${gender}, ${position}) from yomiSearchData`);

    if (!nickname) return [];

    // Normalize and index the 10k+ source rows only when the dataset changes.
    const { sourceData, sourceByReading, filteredData } = getNameCandidateSourceContext(gender);
    const sourceKind = nameCandidateSourceCache.sourceKind;
    if (sourceData.length === 0) {
        console.warn("GEN: No data available for generation.");
        return [];
    }

    let candidates = [];

    // Check for exact match first
    const exactMatch = filteredData.find(item => getNameCandidateSourceReading(item, sourceKind) === nickname);
    if (exactMatch) {
        const exactSource = getNameCandidateSourceValue(exactMatch, sourceKind);
        candidates.push({
            reading: exactSource.reading,
            type: 'original',
            score: 10000, // force to top
            examples: exactSource.examples,
            rawCount: exactSource.count,
            popular: exactSource.popular
        });
    } else if (nickname.length >= 2 && nickname.length <= 3) {
        candidates.push({
            reading: nickname,
            type: 'original',
            score: 10000,
            examples: [],
            rawCount: 0,
            popular: false
        });
    }

    // Find matches
    filteredData.forEach(item => {
        const sourceReading = getNameCandidateSourceReading(item, sourceKind);
        if (!sourceReading || sourceReading === nickname) return; // handled above
        if (typeof noped !== 'undefined' && noped.has(sourceReading)) return; // NOPEスキップ

        let match = false;
        let pType = '';
        if (position === 'prefix') {
            if (sourceReading.startsWith(nickname)) {
                match = true;
                pType = 'suffix'; // The remaining part is a suffix
            }
        } else {
            if (sourceReading.endsWith(nickname)) {
                match = true;
                pType = 'prefix'; // The remaining part is a prefix
            }
        }

        if (match) {
            const source = getNameCandidateSourceValue(item, sourceKind);
            candidates.push({
                reading: source.reading,
                type: pType,
                // Score isn't strictly needed because we will sort by popular then count,
                // but we keep it for any legacy sorting if needed.
                score: source.popular ? 5000 + source.count : source.count,
                examples: source.examples,
                rawCount: source.count,
                popular: source.popular
            });
        }
    });

    // We do NOT want to shuffle or reorder strictly by suffixes anymore,
    // because the user explicitly requested "人気マーク優先 -> 件数順".
    // We just sort them exactly by that rule (which yomiSearchData is originally sorted by,
    // but we can re-sort just to be safe, keeping 'original' at the very top).

    candidates.sort((a, b) => {
        if (a.type === 'original') return -1;
        if (b.type === 'original') return 1;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return (b.rawCount || 0) - (a.rawCount || 0);
    });

    // Remove duplicates just in case
    const uniqueCandidates = [];
    const seen = new Set();
    candidates.forEach(c => {
        if (!seen.has(c.reading)) {
            seen.add(c.reading);
            uniqueCandidates.push(c);
        }
    });

    uniqueCandidates.forEach((candidate) => {
        const source = sourceByReading.get(candidate.reading);
        candidate.tags = source ? getNameCandidateSourceValue(source, sourceKind).tags : [];
    });

    // AI候補リオーダー (if exists)
    const final = (typeof aiReorderCandidates === 'function')
        ? aiReorderCandidates(uniqueCandidates)
        : uniqueCandidates;

    console.log(`GEN: Generated ${final.length} actual name candidates`);
    return final;
}

// Expose
window.generateNameCandidates = generateNameCandidates;
