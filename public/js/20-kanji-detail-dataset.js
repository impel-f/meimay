(function () {
    const DATASET_URL = '/data/kanji_detail_dataset.json?v=25.12';
    const SPECIAL_SESSION_READINGS = new Set(['FREE', 'SEARCH', 'RANKING', 'SHARED']);
    let kanjiDetailDatasetPromise = null;
    let kanjiDetailDataset = {};

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeClean(value) {
        if (typeof clean === 'function') return clean(value);
        return String(value ?? '').trim();
    }

    function splitReadings(raw) {
        return String(raw ?? '')
            .split(/[,\s/・、]+/)
            .map((part) => safeClean(part))
            .filter(Boolean);
    }

    function getKanjiRow(kanji) {
        if (!Array.isArray(master)) return null;
        return master.find((item) => item && item['漢字'] === kanji) || null;
    }

    function getMeaningText(kanjiRow) {
        return safeClean(kanjiRow?.['意味'] || '');
    }

    function getAllReadings(kanjiRow) {
        if (!kanjiRow) return [];
        return [
            ...splitReadings(kanjiRow['音']),
            ...splitReadings(kanjiRow['訓']),
            ...splitReadings(kanjiRow['名乗り・人名訓'])
        ].filter((value, index, list) => list.indexOf(value) === index);
    }

    function getExampleIdioms(kanji) {
        if (!Array.isArray(window.idiomsData)) return [];
        const seenKeys = new Set();
        return window.idiomsData
            .filter((item) => item && String(item['漢字'] || '').includes(kanji))
            .map((item) => {
                const word = safeClean(item['漢字'] || '');
                const meaning = safeClean(item['意味'] || '');
                return { word, meaning };
            })
            .filter((item) => {
                if (!item.word || seenKeys.has(item.word)) return false;
                seenKeys.add(item.word);
                return true;
            })
            .slice(0, 3);
    }

    async function loadKanjiDetailDataset() {
        if (kanjiDetailDatasetPromise) return kanjiDetailDatasetPromise;
        kanjiDetailDatasetPromise = fetch(DATASET_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                kanjiDetailDataset = data && typeof data === 'object' ? data : {};
                return kanjiDetailDataset;
            })
            .catch((error) => {
                console.warn('KANJI_DETAIL_DATASET: Failed to load dataset', error);
                kanjiDetailDataset = {};
                return kanjiDetailDataset;
            });
        return kanjiDetailDatasetPromise;
    }

    function buildFallbackMeaningSection(kanjiRow) {
        const meaning = getMeaningText(kanjiRow);
        if (!meaning) return null;
        return {
            title: '意味の深掘り',
            text: `アプリ内の辞書データでは「${meaning}」と整理されています。`,
            sourceLabel: 'アプリ内辞書データ（外部資料未確認）'
        };
    }

    function buildFallbackReadingSection(kanjiRow, currentReading) {
        const reading = safeClean(currentReading);
        if (!reading || SPECIAL_SESSION_READINGS.has(reading)) return null;
        const allReadings = getAllReadings(kanjiRow);
        if (!allReadings.includes(reading)) return null;
        return {
            title: `名前で「${reading}」と読む資料`,
            text: `アプリ内の読みデータでは、この漢字の読み候補に「${reading}」が含まれています。ここでは、辞書データで確認できる事実だけを表示しています。`,
            sourceLabel: 'アプリ内辞書データ（外部資料未確認）'
        };
    }

    function buildFallbackIdiomSection(kanji) {
        const idioms = getExampleIdioms(kanji);
        if (!idioms.length) return null;
        return {
            title: '用例',
            text: idioms.map((item) => `${item.word}：${item.meaning || '意味データあり'}`).join('\n'),
            sourceLabel: 'public/data/idioms.json'
        };
    }

    function buildSections(kanji, currentReading) {
        const entry = kanjiDetailDataset[kanji] || null;
        const kanjiRow = getKanjiRow(kanji);
        const sections = [];

        if (entry?.sections?.length) {
            entry.sections.forEach((section) => {
                if (section?.title && section?.text) sections.push(section);
            });
        } else {
            sections.push({
                title: '成り立ち',
                text: '確認できる資料を準備中です。未確認の説明は表示しません。'
            });
        }

        if (!sections.some((section) => section.title === '意味の深掘り')) {
            const meaningSection = buildFallbackMeaningSection(kanjiRow);
            if (meaningSection) sections.push(meaningSection);
        }

        const readingSection = buildFallbackReadingSection(kanjiRow, currentReading);
        if (readingSection) sections.push(readingSection);

        const idiomSection = buildFallbackIdiomSection(kanji);
        if (idiomSection) sections.push(idiomSection);

        return sections;
    }

    function renderDatasetSections(resultEl, kanji, currentReading) {
        const sections = buildSections(kanji, currentReading);
        const html = sections.map((section) => {
            const sourceHtml = section.sourceLabel
                ? `<div class="mt-2 text-[10px] text-[#a6967a]">${section.sourceUrl
                    ? `<a href="${escapeHtml(section.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted underline-offset-2">${escapeHtml(section.sourceLabel)}</a>`
                    : escapeHtml(section.sourceLabel)}</div>`
                : '';

            return `
                <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                    <div class="text-xs font-bold text-[#bca37f] mb-1">${escapeHtml(section.title)}</div>
                    <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${escapeHtml(section.text)}</p>
                    ${sourceHtml}
                </div>
            `;
        }).join('');

        resultEl.innerHTML = html || `
            <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                <div class="text-xs font-bold text-[#bca37f] mb-1">成り立ち</div>
                <p class="text-xs text-[#5d5444] leading-relaxed">確認できる資料を準備中です。未確認の説明は表示しません。</p>
            </div>
        `;
    }

    async function generateDatasetKanjiDetail(kanji, currentReading) {
        const resultEl = document.getElementById('ai-kanji-result');
        if (!resultEl) return;

        resultEl.innerHTML = `
            <div class="flex items-center justify-center py-6">
                <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                <span class="text-sm text-[#7a6f5a]">確認済みデータを読み込んでいます...</span>
            </div>
        `;

        await loadKanjiDetailDataset();
        renderDatasetSections(resultEl, kanji, currentReading);
    }

    function restyleKanjiDetailTrigger() {
        const trigger = document.querySelector('#btn-ai-kanji-detail button');
        if (!trigger) return;
        trigger.innerHTML = '<span>📘</span> 成り立ち・意味を見る';
        trigger.className = 'w-full py-4 bg-gradient-to-r from-[#8b7e66] to-[#bca37f] text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm';
    }

    function clearLegacyAiResult() {
        const resultEl = document.getElementById('ai-kanji-result');
        if (!resultEl) return;
        resultEl.innerHTML = '';
    }

    const originalShowKanjiDetail = typeof window.showKanjiDetail === 'function'
        ? window.showKanjiDetail
        : null;

    if (originalShowKanjiDetail) {
        const wrappedShowKanjiDetail = async function wrappedShowKanjiDetail(data) {
            const result = await originalShowKanjiDetail(data);
            restyleKanjiDetailTrigger();
            clearLegacyAiResult();
            return result;
        };
        window.showKanjiDetail = wrappedShowKanjiDetail;
        try {
            showKanjiDetail = wrappedShowKanjiDetail;
        } catch (error) {
            console.warn('KANJI_DETAIL_DATASET: Failed to rebind showKanjiDetail', error);
        }
    }

    window.generateKanjiDetail = generateDatasetKanjiDetail;
    try {
        generateKanjiDetail = generateDatasetKanjiDetail;
    } catch (error) {
        console.warn('KANJI_DETAIL_DATASET: Failed to rebind generateKanjiDetail', error);
    }
    window.loadKanjiDetailDataset = loadKanjiDetailDataset;
    loadKanjiDetailDataset();
})();
