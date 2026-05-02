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
        const response = await fetch(getMeimayApiUrl('/api/gemini'), {
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
    if (characters.length < 2 || characters.length > 4) return false;
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
            const content = mergedIdioms || sanitizeKanjiAiText(aiSection) || sanitizeKanjiAiText(datasetSection);
            if (content) blocks.push(`【${title}】\n${content}`);
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

function formatRepresentativeIdiomContent(content) {
    const parsed = parseRepresentativeIdiomLines(content);
    if (parsed.length > 0) return dedupeRepresentativeIdiomLines(parsed).join('\n');
    const fallbackLines = sanitizeKanjiAiText(content)
        .split('\n')
        .map((line) => line
            .replace(/^[・\-•●◇◆\d]+[.)、．]?\s*/, '')
            .trim())
        .filter(Boolean)
        .map((line) => line.startsWith('・') ? line : `・${line}`);
    return dedupeRepresentativeIdiomLines(fallbackLines).join('\n');
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

以下の順番と見出しで回答してください。見出しはこの3種類以外を使わず、文字列を完全一致させてください。

【成り立ち】
${groundedHint?.promptContext
        ? 'この漢字がどのように作られたか（象形・会意・形声など）を、50〜80文字で説明してください。'
        : '部品やつくりを確実に断定できる場合にのみ、50〜80文字で説明してください。少しでも自信がない場合は、このセクション自体を出力しないでください。'}

【意味の深掘り】
字義だけで終わらせず、元々の意味、名前に使うときのニュアンス、広がりを含めて80〜120文字で説明してください。単に「〜を表す字です」で終わらせないでください。必ず句点で終えてください。

【代表的な熟語】
この漢字を使った実在する熟語を3〜5個、読みと意味付きで挙げてください。2〜4字を目安にし、1行に1個ずつ、各行を完結させてください。読点やカンマで複数候補を1行にまとめないでください。最低3個は必ず出してください。1個だけで終わらせないでください。

【絶対に守るルール】
・セクション順は必ず【成り立ち】→【意味の深掘り】→【代表的な熟語】にしてください。
・見出しは【成り立ち】【意味の深掘り】【代表的な熟語】の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。【代表的な熟語】は必ず1回だけ、最後に出力してください。
・口調は必ずです・ます調で統一してください。
・「アプリ内辞書では」という表現は使わないでください。
・架空の人物、存在しない著名人、存在しない熟語は絶対に書かないでください。
・不確かな情報は断定せず、確実に実在すると言える情報だけを書いてください。少しでも怪しい熟語は挙げないでください。
・実在を確信できるものだけを書いてください。ただし、3個に満たない場合でも、一般的で安全な実在の熟語を優先して3個以上になるように選んでください。
・一般的な漢和辞典や国語辞典に載る実在語だけを挙げてください。人名、作品名、俗語、ネット用語、造語は書かないでください。
・四字熟語、故事成語、ことわざは書かないでください。
・代表的な熟語は1行に1個ずつ、各行を完結させてください。読点やカンマで複数候補を1行にまとめないでください。最低3個になるようにしてください。1個だけで終わらせないでください。
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
漢字「${kanji}」の説明を修正してください。

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
・足りない部分だけを直してください。
・出力順は必ず【意味の深掘り】→【代表的な熟語】にしてください。
・見出しは【意味の深掘り】【代表的な熟語】の文字列だけにしてください。絵文字、番号、装飾、補足語を見出しに付けないでください。
・同じ見出しを2回以上出力しないでください。【代表的な熟語】は必ず1回だけ、最後に出力してください。
・【意味の深掘り】は、字義だけで終わらせず、元々の意味、名前に使うときのニュアンス、広がりを含めて80〜120文字で書いてください。必ず句点で終えてください。
・【代表的な熟語】は、実在する熟語を3〜5個、読みと意味付きで、1行に1個ずつ書いてください。2〜4字を目安にしてください。現在の件数が${currentIdiomsCount}個なら、そこから必ず増やして最低3個にしてください。既出と重複しない語を優先してください。
・読点やカンマで複数候補を1行にまとめないでください。各行を完結させてください。
・四字熟語、故事成語、ことわざは書かないでください。
・出力は【意味の深掘り】と【代表的な熟語】だけにしてください。
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

    const cachedText = getStoredKanjiDetailAiText(kanji);
    if (cachedText && !hasKanjiDetailReset(kanji, currentReading)) {
        renderKanjiDetailSections(resultEl, cachedText);
        return;
    }

    const shouldRefundOnFailure = !(typeof isPremiumAccessActive === 'function' && isPremiumAccessActive());
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
        let cacheHit = false;
        if (typeof firebaseDb !== 'undefined' && firebaseDb && !cacheResetMarked) {
            try {
                const doc = await firebaseDb.collection('kanji_ai_explanations').doc(kanji).get();
                const cachedText = sanitizeKanjiAiText(doc.exists ? doc.data()?.text : '');
                if (cachedText) {
                    const mergedCachedText = mergeKanjiDetailSectionsFromDataset(cachedText, datasetEntry);
                    const cachedSections = extractKanjiDetailSectionMap(mergedCachedText);
                    const cachedMeaningSection = cachedSections.get('意味の深掘り') || '';
                    const cachedIdiomsSection = cachedSections.get('代表的な熟語') || '';
                    const cachedIdiomsCount = countRepresentativeIdiomCandidates(cachedIdiomsSection);
                    if (!isMeaningSectionTooShallow(cachedMeaningSection) && cachedIdiomsCount >= 3) {
                        baseText = mergedCachedText;
                        cacheHit = true;
                    } else {
                        console.warn('AI_KANJI_DETAIL: cached explanation rejected', {
                            kanji,
                            meaningLength: cachedMeaningSection.length,
                            idiomCount: cachedIdiomsCount
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
                const generatedSections = extractKanjiDetailSectionMap(baseText);
                let currentMeaningSection = generatedSections.get('意味の深掘り') || '';
                let currentIdiomsSection = generatedSections.get('代表的な熟語') || '';
                const needsMeaningRepair = isMeaningSectionTooShallow(currentMeaningSection);
                let needsIdiomsRepair = countRepresentativeIdiomCandidates(currentIdiomsSection) < 3;

                if (needsMeaningRepair || needsIdiomsRepair) {
                    try {
                        if (needsMeaningRepair) {
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
                                        currentMeaningSection,
                                        currentIdiomsSection
                                    )
                                }),
                                signal: repairController.signal
                            });
                            clearTimeout(repairTimeoutId);

                            if (repairResponse.ok) {
                                const repairData = await repairResponse.json();
                                const repairSections = extractKanjiDetailSectionMap(repairData.text || '');
                                const repairedMeaning = sanitizeKanjiAiText(repairSections.get('意味の深掘り') || '');
                                if (repairedMeaning) {
                                    currentMeaningSection = repairedMeaning;
                                    baseText = upsertKanjiDetailSection(baseText, '意味の深掘り', repairedMeaning);
                                }
                            }
                        }

                        if (needsIdiomsRepair) {
                            if (countRepresentativeIdiomCandidates(currentIdiomsSection) < 3) {
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
                                            currentMeaningSection,
                                            currentIdiomsSection
                                        )
                                    }),
                                    signal: repairController.signal
                                });
                                clearTimeout(repairTimeoutId);

                                if (repairResponse.ok) {
                                    const repairData = await repairResponse.json();
                                    const repairSections = extractKanjiDetailSectionMap(repairData.text || '');
                                    const repairedIdiomsText = repairSections.get('代表的な熟語') || '';
                                    const mergedIdioms = mergeRepresentativeIdiomSectionText(currentIdiomsSection, repairedIdiomsText);

                                    if (mergedIdioms) {
                                        currentIdiomsSection = mergedIdioms;
                                        baseText = upsertKanjiDetailSection(baseText, '代表的な熟語', mergedIdioms);
                                    }
                                }
                            }
                        }
                    } catch (repairError) {
                        console.warn('AI_KANJI_DETAIL: base repair failed', repairError);
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
            const shouldPersistBaseText = finalIdiomsCount >= 3;

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
window.generateKanjiDetail = generateKanjiDetail;
window.canUseDailyKanjiDetailAI = canUseDailyKanjiDetailAI;
window.consumeDailyKanjiDetailUse = consumeDailyKanjiDetailUse;
window.refundDailyKanjiDetailUse = refundDailyKanjiDetailUse;
window.renderKanjiDetailText = renderKanjiDetailSections;
window.renderKanjiDetailSections = renderKanjiDetailSections;
window.resetKanjiDetailCache = resetKanjiDetailCache;
window.closeOriginModal = closeOriginModal;
window.copyOriginToClipboard = copyOriginToClipboard;

console.log("ORIGIN: Module loaded (syntax corrected)");
