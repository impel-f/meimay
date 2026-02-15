/**
 * MODULE: ENGINE V2 GENERATOR
 * ニックネームからの名前候補生成ロジック
 */

// Suffix/Prefix Definitions
const NAME_PATTERNS = {
    male: {
        suffixes: [
            // User provided
            'いち', 'おん', 'が', 'き', 'ご', 'さく', 'し', 'じ', 'すけ', 'せい',
            'た', 'だい', 'と', 'なり', 'ひと', 'ひろ', 'へい', 'ま', 'まる', 'み',
            'む', 'や', 'ゆき', 'り', 'る', 'ろう', 'わ',
            // Existing complementary
            'あき', 'お', 'かず', 'かつ', 'く', 'ご', 'さ', 'し', 'す', 'ぞう',
            'たか', 'つぐ', 'とし', 'とも', 'なお', 'のぶ', 'のり', 'はる',
            'ひこ', 'ひさ', 'ひで', 'ふみ', 'まさ', 'みち', 'みつ', 'もと',
            'もり', 'やす', 'よし'
        ],
        prefixes: [
            // Common male prefixes
            'まさ', 'よし', 'たか', 'かず', 'ひろ', 'とも', 'なお', 'ひで',
            'のぶ', 'やす', 'みつ', 'かつ', 'とし', 'あき', 'しげ', 'たけ'
        ]
    },
    female: {
        suffixes: [
            // User provided
            'い', 'え', 'お', 'おり', 'おん', 'か', 'き', 'こ', 'さ', 'さき',
            'すず', 'すみ', 'せ', 'つき', 'な', 'なみ', 'ね', 'の', 'はる',
            'ほ', 'ま', 'み', 'や', 'ゆ', 'ゆう', 'よ', 'り',
            // Existing complementary
            'あ', 'え', 'か', 'な', 'の', 'は', 'ひ', 'ほ', 'み', 'め', 'や', 'よ', 'ら', 'り', 'る', 'れ', 'わ'
        ],
        prefixes: [
            'こ', 'み', 'ゆ', 'ち', 'ま', 'さ', 'あ', 'な', 'は', 'り', 'き', 'え'
        ]
    }
};

/**
 * 名前候補を生成する
 * @param {string} nickname - 入力されたニックネーム（ひらがな）
 * @param {string} gender - 'male', 'female', 'neutral'
 * @param {string} position - 'prefix' (default: 〇〇〜) or 'suffix' (〜〇〇)
 */
function generateNameCandidates(nickname, gender, position = 'prefix') {
    console.log(`GEN: Generating candidates for ${nickname} (${gender}, ${position})`);

    let candidates = [];

    // Validate input
    if (!nickname) return [];

    // Add valid simple nickname itself if it makes sense (e.g. "Haru" -> "Haru")
    // Only if it's not too short/long
    if (nickname.length >= 2 && nickname.length <= 3) {
        candidates.push({ reading: nickname, type: 'original', score: 100 });
    }

    // Determine target lists based on gender
    let targetGenders = [];
    if (gender === 'male') targetGenders = ['male'];
    else if (gender === 'female') targetGenders = ['female'];
    else targetGenders = ['male', 'female']; // Neutral includes both

    targetGenders.forEach(g => {
        const patterns = NAME_PATTERNS[g];
        if (!patterns) return;

        if (position === 'prefix') {
            // Nickname is prefix (e.g. Haru -> Haru-to)
            patterns.suffixes.forEach(suf => {
                const combined = nickname + suf;
                if (isValidReading(combined)) {
                    candidates.push({
                        reading: combined,
                        type: 'suffix',
                        score: getPatternScore(suf, g),
                        gender: g
                    });
                }
            });
        } else {
            // Nickname is suffix (e.g. Haru -> Masa-haru)
            patterns.prefixes.forEach(pre => {
                const combined = pre + nickname;
                if (isValidReading(combined)) {
                    candidates.push({
                        reading: combined,
                        type: 'prefix',
                        score: getPatternScore(pre, g),
                        gender: g
                    });
                }
            });
        }
    });

    // Deduplicate by reading
    const uniqueCandidates = [];
    const seen = new Set();

    // Sort by score first to keep highest score duplicates
    candidates.sort((a, b) => b.score - a.score);

    candidates.forEach(c => {
        if (!seen.has(c.reading)) {
            seen.add(c.reading);
            uniqueCandidates.push(c);
        }
    });

    console.log(`GEN: Generated ${uniqueCandidates.length} candidates`);
    return uniqueCandidates;
}

/**
 * 読みの妥当性チェック
 */
function isValidReading(reading) {
    // 5文字以内 (長すぎる名前は除外)
    if (reading.length > 5) return false;

    // 「ん」から始まるのはNG
    if (reading.startsWith('ん')) return false;

    // 同じ文字の3連続はNG
    if (/(.)\1\1/.test(reading)) return false;

    // 特定の不自然な反復 (はるはる -> NG)
    // 完全に同じ2文字以上の繰り返し
    const half = Math.floor(reading.length / 2);
    if (reading.length >= 4 && reading.length % 2 === 0) {
        const first = reading.slice(0, half);
        const second = reading.slice(half);
        if (first === second) return false;
    }

    return true;
}

/**
 * パターンスコアリング
 * 一般的な接辞ほどスコアを高くする
 */
function getPatternScore(pattern, gender) {
    let score = 50;

    const highValueMale = ['と', 'き', 'た', 'ま', 'すけ', 'たろう'];
    const highValueFemale = ['な', 'か', 'こ', 'み', 'り', 'え'];

    if (gender === 'male' && highValueMale.includes(pattern)) score += 30;
    if (gender === 'female' && highValueFemale.includes(pattern)) score += 30;

    return score;
}

// Expose
window.generateNameCandidates = generateNameCandidates;
