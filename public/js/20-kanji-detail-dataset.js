(function () {
    const DATASET_URL = '/data/kanji_detail_dataset.json?v=25.17';
    const SPECIAL_SESSION_READINGS = new Set(['FREE', 'SEARCH', 'RANKING', 'SHARED']);
    let datasetPromise = null;
    let kanjiDetailDataset = {};

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

    function getMeaningSection(kanjiRow) {
        const meaning = safeClean(kanjiRow?.['意味'] || '');
        if (!meaning) return null;
        return {
            title: '意味の深掘り',
            text: meaning
        };
    }

    function getDatasetReadingReason(entry, currentReading) {
        const reading = safeClean(currentReading);
        if (!reading || SPECIAL_SESSION_READINGS.has(reading)) return null;
        const reasonMap = entry?.readingReasons;
        if (!reasonMap || typeof reasonMap !== 'object') return null;
        const reasonText = safeClean(reasonMap[reading] || '');
        if (!reasonText) return null;
        return {
            title: `「${reading}」と読む理由`,
            text: reasonText
        };
    }

    function getExistingIdiomWordSet(kanji) {
        const words = new Set();
        if (!Array.isArray(window.idiomsData)) return words;
        window.idiomsData.forEach((item) => {
            const word = safeClean(item?.['漢字'] || '');
            if (word && word.includes(kanji)) words.add(word);
        });
        return words;
    }

    function extractIdiomWord(line) {
        return safeClean(String(line || '').split(/[（(:：]/)[0]);
    }

    function isFourCharacterIdiom(word) {
        return Array.from(word || '').length === 4;
    }

    function filterDuplicateRepresentativeIdioms(section, kanji) {
        if (!section || section.title !== '代表的な熟語') return section;
        const existingWords = getExistingIdiomWordSet(kanji);
        const lines = String(section.text || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => {
                const word = extractIdiomWord(line);
                if (!word) return false;
                if (isFourCharacterIdiom(word)) return false;
                return !existingWords.has(word);
            });
        if (!lines.length) return null;
        return {
            ...section,
            text: lines.join('\n')
        };
    }

    function buildSections(kanji, currentReading) {
        const entry = kanjiDetailDataset[kanji];
        const kanjiRow = getKanjiRow(kanji);
        const sections = [];

        if (entry && Array.isArray(entry.sections)) {
            entry.sections.forEach((section) => {
                if (!section?.title || !section?.text) return;
                const normalizedSection = {
                    title: safeClean(section.title),
                    text: safeClean(section.text)
                };
                const dedupedSection = filterDuplicateRepresentativeIdioms(normalizedSection, kanji);
                if (dedupedSection) sections.push(dedupedSection);
            });
        }

        if (!sections.some((section) => section.title === '意味の深掘り')) {
            const meaningSection = getMeaningSection(kanjiRow);
            if (meaningSection) sections.push(meaningSection);
        }

        const readingSection = getDatasetReadingReason(entry, currentReading);
        if (readingSection) sections.push(readingSection);

        if (!sections.length) {
            sections.push({
                title: '成り立ち',
                text: 'この漢字の詳細データは準備中です。'
            });
        }

        const order = ['成り立ち', '意味の深掘り', '代表的な熟語'];
        return sections.sort((a, b) => {
            const aIndex = order.indexOf(a.title);
            const bIndex = order.indexOf(b.title);
            const safeA = aIndex === -1 ? order.length : aIndex;
            const safeB = bIndex === -1 ? order.length : bIndex;
            return safeA - safeB;
        });
    }

    async function loadKanjiDetailDataset() {
        if (datasetPromise) return datasetPromise;
        datasetPromise = fetch(DATASET_URL)
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
        return datasetPromise;
    }

    function buildLegacyText(sections) {
        return sections
            .map((section) => `【${section.title}】\n${section.text}`)
            .join('\n\n');
    }

    function renderSections(resultEl, sections) {
        if (typeof renderKanjiDetailText === 'function') {
            const legacyText = buildLegacyText(sections);
            try {
                renderKanjiDetailText(resultEl, legacyText);
                return;
            } catch (error) {
                console.warn('KANJI_DETAIL_DATASET: Legacy renderer failed, using fallback', error);
            }
        }

        const iconMap = {
            '成り立ち': '📜',
            '意味の深掘り': '💡',
            '代表的な熟語': '📚'
        };

        const html = sections.map((section) => {
            const icon = iconMap[section.title] || (section.title.includes('読み') ? '🔎' : '📘');
            return `
                <div class="bg-white p-3 rounded-xl border border-[#eee5d8] shadow-sm mb-2">
                    <div class="text-xs font-bold text-[#bca37f] mb-1 flex items-center gap-1">
                        <span>${icon}</span>
                        ${section.title}
                    </div>
                    <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${section.text}</p>
                </div>
            `;
        }).join('');

        resultEl.innerHTML = html;
    }

    async function generatePreloadedKanjiDetail(kanji, currentReading) {
        const resultEl = document.getElementById('ai-kanji-result');
        if (!resultEl) return;

        resultEl.innerHTML = `
            <div class="flex items-center justify-center py-6">
                <div class="w-6 h-6 border-3 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mr-3"></div>
                <span class="text-sm text-[#7a6f5a]">情報を読み込み中...</span>
            </div>
        `;

        await loadKanjiDetailDataset();
        const sections = buildSections(kanji, currentReading);
        renderSections(resultEl, sections);

        if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveKanjiAiCache === 'function') {
            StorageBox.saveKanjiAiCache(kanji, buildLegacyText(sections));
        }
    }

    function clearLegacyResult() {
        const resultEl = document.getElementById('ai-kanji-result');
        if (!resultEl) return;
        resultEl.innerHTML = '';
    }

    const originalShowKanjiDetail = typeof window.showKanjiDetail === 'function'
        ? window.showKanjiDetail
        : null;

    if (originalShowKanjiDetail) {
        const wrappedShowKanjiDetail = async function (data) {
            const result = await originalShowKanjiDetail(data);
            clearLegacyResult();
            return result;
        };
        window.showKanjiDetail = wrappedShowKanjiDetail;
        try {
            showKanjiDetail = wrappedShowKanjiDetail;
        } catch (error) {
            console.warn('KANJI_DETAIL_DATASET: Failed to rebind showKanjiDetail', error);
        }
    }

    window.loadKanjiDetailDataset = loadKanjiDetailDataset;
    loadKanjiDetailDataset();
})();
