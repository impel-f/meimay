/**
 * ============================================================
 * MODULE 08: AI NAME ORIGIN GENERATOR (V13.2 - Fix Syntax)
 * ============================================================
 */

async function generateOrigin() {
    console.log("ORIGIN: generateOrigin called");

    if (!currentBuildResult || !currentBuildResult.givenName) {
        alert('名前が決定されていません');
        return;
    }

    const { givenName, combination } = currentBuildResult;
    console.log("ORIGIN_START: AI由来生成開始");

    const modal = document.getElementById('modal-origin');
    if (!modal) {
        console.error("ORIGIN: modal-origin not found");
        return;
    }

    // Modal Display (Loading)
    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in flex flex-col items-center">
            <div class="text-[10px] font-black text-[#bca37f] mb-8 tracking-widest opacity-60 uppercase">AI Writing Service</div>
            <div class="flex flex-col items-center py-20 text-center">
                <div class="w-10 h-10 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mb-6"></div>
                <p class="text-[12px] font-bold text-[#7a6f5a] leading-loose">
                    「${givenName}」の由来を<br>生成しています。
                </p>
            </div>
        </div>
    `;

    // Prepare Prompt
    const originDetails = combination.map(c => {
        const src = (typeof liked !== 'undefined') ? liked.find(l => l['漢字'] === c['漢字']) : null;
        return `【${c['漢字']}】：${src ? src['意味'] : "良い意味"}`;
    }).join('\n');

    const prompt = `
名前「${givenName}」の由来を、以下の漢字データのみを使って、漢字の意味を生かして100文字から150文字程度で簡潔に作成してください。

【禁止事項 - 厳守】
・「生命の誕生は～」「親の愛は～」などの前置きは一切不要。
・名字についての言及、名字との響きについての解説も一切書かないでください。
・架空の人物・著名人への言及は絶対にしないでください。
・存在しない故事やことわざを捏造しないでください。

【作成ルール】
・提示された漢字の意味に直結した、一人の人間としての成長や願いを直球で書いてください。
・漢字の実際の意味のみに基づいてください。

【漢字データ】
${originDetails}
`.trim();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        console.log("ORIGIN: Fetching from API...");
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMsg = `API疎通エラー (Status: ${response.status})`;
            try {
                const errData = await response.json();
                if (errData.error) errorMsg += `\n${errData.error}`;
                if (errData.details) errorMsg += `\n${errData.details}`;
                if (errData.available_models) errorMsg += `\nAvailable Models:\n${errData.available_models.join('\n')}`;
                if (errData.debug_model_codes) errorMsg += `\nCodes: ${JSON.stringify(errData.debug_model_codes)}`;
            } catch (e) {
                // JSON parse error, ignore
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const aiText = data.text || '由来を生成できませんでした。';
        console.log("ORIGIN: API Success", aiText);

        // Update Data
        currentBuildResult.origin = aiText;
        if (typeof savedNames !== 'undefined') {
            const index = savedNames.findIndex(n => n.fullName === currentBuildResult.fullName);
            if (index !== -1) {
                savedNames[index].origin = aiText;
                if (typeof StorageBox !== 'undefined' && StorageBox.saveSavedNames) {
                    StorageBox.saveSavedNames();
                }
                console.log("ORIGIN: 保存済みデータの由来を更新しました。");
            }
        }

        renderAIOriginResult(givenName, aiText);

    } catch (err) {
        console.error("AI_FAILURE:", err);
        // Alert the user about the specific error for debugging
        alert(`AIエラーが発生しました:\n${err.message}\n(詳細なログはコンソールを確認してください)`);

        const fallbackText = generateFallbackOrigin(givenName, combination);
        currentBuildResult.origin = fallbackText;

        renderAIOriginResult(givenName, fallbackText, true);
    }
}

function generateFallbackOrigin(givenName, combination) {
    const meanings = combination.map(c => {
        const src = (typeof liked !== 'undefined') ? liked.find(l => l['漢字'] === c['漢字']) : null;
        const m = src ? clean(src['意味']) : '良い意味';
        return m.split(/[。、]/)[0].substring(0, 20);
    });

    const templates = [
        `「${givenName}」という名前には、${meanings.map(m => `「${m}」`).join('、')}という漢字の意味が込められています。この名前を持つ子が、それぞれの漢字が示すように、${meanings[0]}を大切にし、心豊かに成長してほしいという願いが込められています。`,

        `${givenName}。${combination.length}つの漢字それぞれに、深い意味が込められています。${meanings.map((m, i) => `${i + 1}文字目の「${combination[i]['漢字']}」は${m}を表し`).join('、')}ます。これらが組み合わさることで、唯一無二の名前が生まれました。`,

        `この名前を選んだ理由は明確です。${meanings.map((m, i) => `「${combination[i]['漢字']}」には${m}という意味があり`).join('、')}、これらすべてが「${givenName}」という名前に込められた願いを表しています。`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
}

function renderAIOriginResult(givenName, text, isFallback = false) {
    const modal = document.getElementById('modal-origin');
    if (!modal) return;
    modal.innerHTML = `
        <div class="detail-sheet animate-fade-in flex flex-col items-center max-w-[420px]">
            <div class="text-[10px] font-black text-[#bca37f] mb-8 tracking-widest opacity-60 uppercase">
                ${isFallback ? 'Template Origin' : 'The Origin Story'}
            </div>
            <div class="text-6xl font-black text-[#5d5444] mb-10 tracking-tight">${givenName}</div>
            <div class="w-full bg-[#fdfaf5] border border-[#eee5d8] rounded-[40px] p-8 mb-10 shadow-inner overflow-y-auto max-h-[50vh] no-scrollbar">
                <p class="text-[14px] leading-relaxed text-[#5d5444] font-bold whitespace-pre-wrap">${text}</p>
            </div>
            ${isFallback ? `
                <p class="text-xs text-[#a6967a] mb-4 text-center">
                    ⚠️ AIサービスが利用できないため、テンプレートで生成しました
                </p>
            ` : ''}
            <div class="flex flex-col gap-3 w-full">
                <button onclick="copyOriginToClipboard()" class="w-full py-5 bg-[#5d5444] text-white rounded-[35px] font-black uppercase tracking-widest active:scale-95 transition-transform">📋 由来をコピー</button>
                <button onclick="closeOriginModal()" class="w-full py-5 bg-white border border-[#eee5d8] rounded-[35px] text-[#a6967a] font-black uppercase tracking-widest">閉じる</button>
            </div>
        </div>
    `;
}

function closeOriginModal() {
    const m = document.getElementById('modal-origin');
    if (m) m.classList.remove('active');
}

function copyOriginToClipboard() {
    const p = document.querySelector('#modal-origin p');
    if (p) {
        navigator.clipboard.writeText(p.innerText.trim()).then(() => alert("由来をコピーしました。"));
    }
}

/**
 * 漢字詳細AIを生成（成り立ち・意味・熟語・名乗り理由）
 */
async function generateKanjiDetail(kanji, currentReading) {
    const resultEl = document.getElementById('ai-kanji-result');
    if (!resultEl) return;

    // ローディング表示
    resultEl.innerHTML = `
        <div class="flex items-center justify-center py-6">
            <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
            <span class="text-sm text-[#7a6f5a]">AIが分析中...</span>
        </div>
    `;

    // 漢字データを取得
    const kanjiData = master.find(k => k['漢字'] === kanji);
    if (!kanjiData) {
        resultEl.innerHTML = '<p class="text-xs text-[#f28b82]">漢字データが見つかりません</p>';
        return;
    }

    const meaning = clean(kanjiData['意味'] || '');
    const readings = [kanjiData['音'], kanjiData['訓'], kanjiData['伝統名のり']]
        .filter(x => clean(x)).join('、');

    let baseText = '';
    let readingText = '';
    const readingCacheId = !isSpecialKanjiAiReading(currentReading)
        ? encodeURIComponent(`${kanji}__${currentReading}`)
        : '';

    try {
        // 1. 基本解説のキャッシュ確認 (Firestore)
        let hasCache = false;
        if (typeof firebaseDb !== 'undefined') {
            const docRef = firebaseDb.collection('kanji_ai_explanations').doc(kanji);
            const doc = await docRef.get();
            if (doc.exists) {
                baseText = doc.data().text;
                hasCache = true;
                console.log(`ORIGIN: Loaded base explanation for ${kanji} from cache`);
            }
        }

        // 2. キャッシュがない場合は生成
        if (!hasCache) {
            console.log(`ORIGIN: Generating new base explanation for ${kanji}`);
            const prompt = `
漢字「${kanji}」について、以下の項目を簡潔にまとめてください。

【基本情報】
読み: ${readings}
意味: ${meaning}

以下の各セクションを【】で区切って回答してください。

【成り立ち】
この漢字がどのように作られたか（象形・会意・形声など）を50〜80文字で説明。

【意味の深掘り】
元々の意味と、名前に使われるときのポジティブな意味合いを50〜80文字で。

【代表的な熟語】
この漢字を使った有名な熟語を3〜5個、読みと意味付きで。
必ず実在する熟語のみを挙げてください。

【絶対に守るルール】
・架空の人物や存在しない著名人を絶対に書かないでください。
・確実に実在すると断言できる情報のみ記載してください。
・熟語も実在するものだけを挙げてください。不確かなら書かないでください。
`.trim();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            baseText = data.text || '';

            // Firestoreにキャッシュ保存
            if (typeof firebaseDb !== 'undefined' && baseText) {
                await firebaseDb.collection('kanji_ai_explanations').doc(kanji).set({
                    text: baseText,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`ORIGIN: Saved base explanation for ${kanji} to cache`);
            }
        }

        // 3. 名乗りの理由が必要な場合のみ追加で生成
        if (currentReading && currentReading !== 'FREE' && currentReading !== 'SEARCH' && currentReading !== 'RANKING' && currentReading !== 'SHARED') {
            resultEl.innerHTML = `
                <div class="flex items-center justify-center py-6">
                    <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                    <span class="text-sm text-[#7a6f5a]">「${currentReading}」という読みの由来を分析中...</span>
                </div>
            `;

            console.log(`ORIGIN: Generating specific reading reason for ${kanji} (${currentReading})`);
            const nanoriPrompt = `
漢字「${kanji}」が名前で「${currentReading}」と読まれる理由や由来を、歴史的背景や音韻の変化を含めて説明してください。なぜ日本人はこの漢字をそう読むのか、100文字以内でわかりやすく教えてください。

【回答形式】
絶対に【名乗りの理由】（または【名乗り〇〇の理由】）という見出しをつけずに、本文だけを出力してください。
架空の理由は絶対に作成しないでください。
`.trim();
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 30000);
            const response2 = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: nanoriPrompt }),
                signal: controller2.signal
            });
            clearTimeout(timeoutId2);

            if (response2.ok) {
                const data2 = await response2.json();
                readingText = `\n【名乗り「${currentReading}」の理由】\n` + (data2.text || '').trim();
            }
        }

        const combinedText = baseText + (readingText ? `\n\n${readingText}` : '');
        renderKanjiDetailSections(resultEl, combinedText);

    } catch (err) {
        console.error("AI_KANJI_DETAIL:", err);
        resultEl.innerHTML = `
            <div class="bg-[#fef2f2] p-3 rounded-xl text-xs text-[#f28b82] mb-2">
                AI生成に失敗しました: ${err.message}
            </div>
        `;
    }
}

/**
 * AI漢字詳細テキストをパースしてDOMに描画し、再出力ボタンを追加する
 */
function renderKanjiDetailText(resultEl, aiText) {
    const sections = aiText.split(/【(.+?)】/).filter(s => s.trim());
    let html = '';

    for (let i = 0; i < sections.length; i += 2) {
        const title = sections[i] || '';
        const content = sections[i + 1] || '';
        if (title && content) {
            const icon = title.includes('成り立ち') ? '📜'
                : title.includes('意味') ? '💡'
                    : title.includes('熟語') ? '📖'
                        : title.includes('名乗り') ? '🎓' : '✨';
            html += `
                <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                    <div class="text-xs font-bold text-[#bca37f] mb-1 flex items-center gap-1">
                        <span>${icon}</span>
                        ${title}
                    </div>
                    <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${content.trim()}</p>
                </div>
            `;
        }
    }

    if (!html) {
        html = `
            <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${aiText}</p>
            </div>
        `;
    }

    resultEl.innerHTML = html;
}

function isSpecialKanjiAiReading(reading) {
    return !reading || ['FREE', 'SEARCH', 'RANKING', 'SHARED'].includes(reading);
}

function sanitizeKanjiAiText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\*/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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

const KANJI_DETAIL_DATASET_URL = '/data/kanji_detail_dataset.json?v=25.21';
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

function upsertKanjiDetailSection(aiText, title, content) {
    const normalizedText = sanitizeKanjiAiText(aiText);
    const normalizedContent = sanitizeKanjiAiText(content);
    if (!normalizedContent) return normalizedText;

    const matches = Array.from(normalizedText.matchAll(/【([^】]+)】([\s\S]*?)(?=【[^】]+】|$)/g));
    if (!matches.length) {
        return `【${title}】\n${normalizedContent}`;
    }

    let found = false;
    const rebuilt = matches.map((match) => {
        const currentTitle = normalizeKanjiDetailTitle(match[1]);
        const currentContent = sanitizeKanjiAiText(match[2]);
        if (!currentTitle) return '';
        if (currentTitle === title) {
            found = true;
            return `【${title}】\n${normalizedContent}`;
        }
        return `【${currentTitle}】\n${currentContent}`;
    }).filter(Boolean);

    if (!found) rebuilt.unshift(`【${title}】\n${normalizedContent}`);
    return rebuilt.join('\n\n');
}

function normalizeKanjiDetailTitle(title) {
    const normalized = sanitizeKanjiAiText(title);
    if (normalized === '入力情報' || normalized === '基本情報') return '';
    return normalized;
}

function formatRepresentativeIdiomContent(content) {
    return sanitizeKanjiAiText(content)
        .split('\n')
        .map((line) => sanitizeKanjiAiText(line).replace(/^[・\-•●]+/, ''))
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^(.+?)（(.+?)）[:：]\s*(.+)$/);
            if (match) {
                const word = sanitizeKanjiAiText(match[1]);
                const reading = sanitizeKanjiAiText(match[2]);
                let meaning = sanitizeKanjiAiText(match[3]);
                if (meaning && !/[。.!！?？]$/.test(meaning)) meaning += '。';
                return `・${word}（${reading}）：${meaning}`;
            }
            let normalizedLine = line;
            if (!normalizedLine.startsWith('・')) normalizedLine = `・${normalizedLine}`;
            if (!/[。.!！?？]$/.test(normalizedLine)) normalizedLine += '。';
            return normalizedLine;
        })
        .join('\n');
}

function buildKanjiDetailPrompt(kanji, readings, meaning, groundedHint) {
    return `
漢字「${kanji}」について、以下の項目を簡潔にまとめてください。

【入力情報】
読み: ${readings || '不明'}
意味: ${meaning || '不明'}
${groundedHint?.promptContext ? `検証済み情報: ${groundedHint.promptContext}` : ''}

以下の各セクションを【】で区切って回答してください。

【成り立ち】
${groundedHint?.promptContext
        ? 'この漢字がどのように作られたか（象形・会意・形声など）を、50〜80文字で説明してください。'
        : '部品やつくりを確実に断定できる場合にのみ、50〜80文字で説明してください。少しでも自信がない場合は、このセクション自体を出力しないでください。'}

【意味の深掘り】
元々の意味と、名前に使われるときの前向きな意味合いを、50〜80文字で説明してください。

【代表的な熟語】
この漢字を使った実在する二字熟語または三字熟語を3〜5個、読みと意味付きで挙げてください。

【絶対に守るルール】
・口調は必ずです・ます調で統一してください。
・架空の人物、存在しない著名人、存在しない熟語は絶対に書かないでください。
・不確かな情報は断定せず、確実に実在すると言える情報だけを書いてください。少しでも怪しい熟語は挙げないでください。
・実在を確信できない場合は、熟語を無理に埋めず、そのセクションを空にしてかまいません。
・一般的な漢和辞典や国語辞典に載る実在語だけを挙げてください。人名、作品名、俗語、ネット用語、造語は書かないでください。
・四字熟語、故事成語、ことわざは書かないでください。
・脚注記号、アスタリスク、参考番号、URLは書かないでください。
・【入力情報】や【基本情報】のようなセクションは出力しないでください。
・セクション名以外の前置きや締めの一文は書かないでください。
・部品、つくり、声符を推測で書かないでください。確信がない場合は【成り立ち】を出力しないでください。
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

async function resetKanjiDetailCache(kanji, currentReading) {
    if (typeof firebaseDb === 'undefined' || !firebaseDb) {
        alert('キャッシュをリセットできませんでした。');
        return false;
    }

    try {
        await firebaseDb.collection('kanji_ai_explanations').doc(kanji).delete();
    } catch (error) {
        console.warn('KANJI_DETAIL_RESET: base cache delete failed', error);
    }

    if (!isSpecialKanjiAiReading(currentReading)) {
        const readingCacheId = encodeURIComponent(`${kanji}__${currentReading}`);
        try {
            await firebaseDb.collection('kanji_ai_reading_explanations').doc(readingCacheId).delete();
        } catch (error) {
            console.warn('KANJI_DETAIL_RESET: reading cache delete failed', error);
        }
    }

    const resultEl = document.getElementById('ai-kanji-result');
    if (resultEl) resultEl.innerHTML = '';
    alert('漢字の深掘りキャッシュをリセットしました。');
    return true;
}

async function generateKanjiDetail(kanji, currentReading) {
    const resultEl = document.getElementById('ai-kanji-result');
    if (!resultEl) return;

    resultEl.innerHTML = `
        <div class="flex items-center justify-center py-6">
            <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
            <span class="text-sm text-[#7a6f5a]">AIが分析中です...</span>
        </div>
    `;

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
    const groundedOriginText = getKanjiDetailDatasetSectionText(datasetEntry, '成り立ち');
    const readingCacheId = !isSpecialKanjiAiReading(currentReading)
        ? encodeURIComponent(`${kanji}__${currentReading}`)
        : '';

    let baseText = '';
    let readingText = '';

    try {
        let cacheHit = false;
        if (typeof firebaseDb !== 'undefined' && firebaseDb) {
            try {
                const doc = await firebaseDb.collection('kanji_ai_explanations').doc(kanji).get();
                const cachedText = sanitizeKanjiAiText(doc.exists ? doc.data()?.text : '');
                if (cachedText && cachedKanjiDetailMatchesHint(cachedText, groundedHint)) {
                    baseText = cachedText;
                    cacheHit = true;
                }
            } catch (cacheError) {
                console.warn('AI_KANJI_DETAIL: base cache read failed', cacheError);
            }
        }

        if (!cacheHit) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch('/api/gemini', {
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
            baseText = sanitizeKanjiAiText(data.text || '');
            if (!baseText) {
                throw new Error('AIから説明を取得できませんでした。');
            }

            if (groundedOriginText && !cachedKanjiDetailMatchesHint(baseText, groundedHint)) {
                baseText = upsertKanjiDetailSection(baseText, '成り立ち', groundedOriginText);
            }

            if (typeof firebaseDb !== 'undefined' && firebaseDb) {
                try {
                    await firebaseDb.collection('kanji_ai_explanations').doc(kanji).set({
                        text: baseText,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (cacheError) {
                    console.warn('AI_KANJI_DETAIL: base cache save failed', cacheError);
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
            if (typeof firebaseDb !== 'undefined' && firebaseDb && readingCacheId) {
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
                const response2 = await fetch('/api/gemini', {
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
                        if (typeof firebaseDb !== 'undefined' && firebaseDb && readingCacheId) {
                            await firebaseDb.collection('kanji_ai_reading_explanations').doc(readingCacheId).set({
                                kanji,
                                reading: currentReading,
                                text: reasonText,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                        }
                    }
                }
                } catch (readingError) {
                    console.warn('AI_KANJI_DETAIL: reading generation failed', readingError);
                }
            }
        }

        const combinedText = [baseText, readingText].filter(Boolean).join('\n\n');
        if (!combinedText) {
            throw new Error('表示できる説明がありません。');
        }

        renderKanjiDetailSections(resultEl, combinedText);
    } catch (err) {
        console.error('AI_KANJI_DETAIL:', err);
        resultEl.innerHTML = `
            <div class="bg-[#fef2f2] p-3 rounded-xl text-xs text-[#f28b82] mb-2">
                漢字の説明を取得できませんでした。時間をおいてもう一度お試しください。
                ${err?.message ? `<div class="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed opacity-80">${escapeHtml(err.message)}</div>` : ''}
            </div>
        `;
    }
}

function renderKanjiDetailText(resultEl, aiText) {
    const normalizedText = sanitizeKanjiAiText(aiText);
    const matches = Array.from(normalizedText.matchAll(/【([^】]+)】([\s\S]*?)(?=【[^】]+】|$)/g));
    const iconMap = {
        '成り立ち': '🧬',
        '意味の深掘り': '💡',
        '代表的な熟語': '📚'
    };

    if (!matches.length) {
        resultEl.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${normalizedText}</p>
            </div>
        `;
        return;
    }

    const html = matches.map((match) => {
        const title = normalizeKanjiDetailTitle(match[1]);
        let content = sanitizeKanjiAiText(match[2]);
        if (!title || !content) return '';
        if (title === '代表的な熟語') {
            content = formatRepresentativeIdiomContent(content);
        }
        const icon = iconMap[title] || (title.includes('由来') ? '🏷️' : '✨');
        return `
            <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <div class="text-xs font-bold text-[#bca37f] mb-1 flex items-center gap-1">
                    <span>${icon}</span>
                    ${title}
                </div>
                <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${content}</p>
            </div>
        `;
    }).join('');

    resultEl.innerHTML = html;
}

function renderKanjiDetailSections(resultEl, aiText) {
    const normalizedText = sanitizeKanjiAiText(aiText);
    const sectionPattern = /^【([^】]+)】\s*([\s\S]*?)(?=^【[^】]+】|\s*$)/gm;
    const sections = [];
    let match;

    while ((match = sectionPattern.exec(normalizedText)) !== null) {
        const rawTitle = sanitizeKanjiAiText(match[1]);
        const title = normalizeKanjiDetailTitle(rawTitle) || rawTitle;
        const content = sanitizeKanjiAiText(match[2]);
        if (title || content) sections.push({ title, content });
    }

    const getIcon = (title) => {
        if (title.includes('成り立ち')) return '🧬';
        if (title.includes('由来') || title.includes('理由') || title.includes('読み')) return '🏷️';
        if (title.includes('熟語')) return '✨';
        return '✨';
    };

    const renderBlock = (title, content) => {
        if (!title || !content) return '';
        const displayContent = title.includes('熟語')
            ? formatRepresentativeIdiomContent(content)
            : content;
        return `
            <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <div class="text-xs font-bold text-[#bca37f] mb-1 flex items-center gap-1">
                    <span>${getIcon(title)}</span>
                    ${title}
                </div>
                <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${displayContent}</p>
            </div>
        `;
    };

    if (!sections.length) {
        resultEl.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${normalizedText}</p>
            </div>
        `;
        return;
    }

    const html = sections.map(({ title, content }) => renderBlock(title, content)).filter(Boolean).join('');
    resultEl.innerHTML = html || `
        <div class="bg-white p-4 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
            <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${normalizedText}</p>
        </div>
    `;
}

// Global Exports
window.generateOrigin = generateOrigin;
window.generateKanjiDetail = generateKanjiDetail;
window.renderKanjiDetailText = renderKanjiDetailSections;
window.renderKanjiDetailSections = renderKanjiDetailSections;
window.resetKanjiDetailCache = resetKanjiDetailCache;
window.closeOriginModal = closeOriginModal;
window.copyOriginToClipboard = copyOriginToClipboard;

console.log("ORIGIN: Module loaded (syntax corrected)");
