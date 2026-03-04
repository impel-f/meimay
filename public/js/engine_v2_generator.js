/**
 * MODULE: ENGINE V2 GENERATOR
 * ニックネームからの名前候補生成ロジック
 */

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

    // Prefer readingsData which has correct tags and gender, fallback to yomiSearchData
    let sourceData = [];
    if (typeof readingsData !== 'undefined' && readingsData && readingsData.length > 0) {
        // map readingsData to the format expected by the generator (yomi, count, popular)
        sourceData = readingsData.map(r => ({
            yomi: r.reading,
            count: r.count,
            popular: r.isPopular,
            gender: r.gender || (r.isNeutral ? 'neutral' : ''),
            examples: r.examples ? r.examples.split(/[,、]/).map(x => x.trim()).filter(x => x) : [],
            tags: r.tags || []
        }));
    } else if (typeof yomiSearchData !== 'undefined' && yomiSearchData && yomiSearchData.length > 0) {
        sourceData = yomiSearchData;
    } else {
        console.warn("GEN: No data available for generation.");
        return [];
    }

    // Filter by gender
    let filteredData = sourceData.filter(item => {
        if (gender === 'male' && item.gender === 'female') return false;
        if (gender === 'female' && item.gender === 'male') return false;
        return true;
    });

    let candidates = [];

    // Check for exact match first
    const exactMatch = filteredData.find(item => item.yomi === nickname);
    if (exactMatch) {
        candidates.push({
            reading: exactMatch.yomi,
            type: 'original',
            score: 10000, // force to top
            examples: exactMatch.examples,
            rawCount: exactMatch.count,
            popular: exactMatch.popular
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
        if (item.yomi === nickname) return; // handled above

        let match = false;
        let pType = '';
        if (position === 'prefix') {
            if (item.yomi.startsWith(nickname)) {
                match = true;
                pType = 'suffix'; // The remaining part is a suffix
            }
        } else {
            if (item.yomi.endsWith(nickname)) {
                match = true;
                pType = 'prefix'; // The remaining part is a prefix
            }
        }

        if (match) {
            candidates.push({
                reading: item.yomi,
                type: pType,
                // Score isn't strictly needed because we will sort by popular then count,
                // but we keep it for any legacy sorting if needed.
                score: item.popular ? 5000 + item.count : item.count,
                examples: item.examples,
                rawCount: item.count,
                popular: item.popular
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

    // Tags and examples are already attached if using readingsData, but we ensure it for fallback
    if (sourceData === yomiSearchData && typeof readingsData !== 'undefined' && readingsData) {
        uniqueCandidates.forEach(cand => {
            const rd = readingsData.find(r => r.reading === cand.reading);
            if (rd) {
                cand.tags = rd.tags || [];
                // cand.examples already handled above or can be supplemented
            } else {
                cand.tags = [];
            }
        });
    } else {
        uniqueCandidates.forEach(cand => {
            const src = sourceData.find(r => r.yomi === cand.reading);
            cand.tags = src ? src.tags || [] : [];
        });
    }

    // AI候補リオーダー (if exists)
    const final = (typeof aiReorderCandidates === 'function')
        ? aiReorderCandidates(uniqueCandidates)
        : uniqueCandidates;

    console.log(`GEN: Generated ${final.length} actual name candidates`);
    return final;
}

// Expose
window.generateNameCandidates = generateNameCandidates;
