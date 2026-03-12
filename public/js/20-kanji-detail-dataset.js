(function () {
    const DATASET_URL = '/data/kanji_detail_dataset.json?v=25.13';
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

    function getReadingSection(kanjiRow, currentReading) {
        const reading = safeClean(currentReading);
        if (!reading || SPECIAL_SESSION_READINGS.has(reading)) return null;
        const allReadings = [
            ...splitReadings(kanjiRow?.['音']),
            ...splitReadings(kanjiRow?.['訓']),
            ...splitReadings(kanjiRow?.['名乗り・人名訓'])
        ];
        if (!allReadings.includes(reading)) return null;
        return {
            title: `「${reading}」という読み`,
            text: `アプリ内の読みデータに「${reading}」が含まれています。`
        };
    }

    function getIdiomSection(kanji) {
        if (!Array.isArray(window.idiomsData)) return null;
        const items = [];
        const seenWords = new Set();
        window.idiomsData.forEach((item) => {
            const word = safeClean(item?.['漢字'] || '');
            if (!word || !word.includes(kanji) || seenWords.has(word) || items.length >= 3) return;
            seenWords.add(word);
            items.push(`${word}：${safeClean(item?.['意味'] || '') || '意味あり'}`);
        });
        if (!items.length) return null;
        return {
            title: '用例',
            text: items.join('\n')
        };
    }

    function buildSections(kanji, currentReading) {
        const entry = kanjiDetailDataset[kanji];
        const kanjiRow = getKanjiRow(kanji);
        const sections = [];

        if (entry && Array.isArray(entry.sections)) {
            entry.sections.forEach((section) => {
                if (!section?.title || !section?.text) return;
                sections.push({
                    title: safeClean(section.title),
                    text: safeClean(section.text)
                });
            });
        }

        if (!sections.some((section) => section.title === '意味の深掘り')) {
            const meaningSection = getMeaningSection(kanjiRow);
            if (meaningSection) sections.push(meaningSection);
        }

        const readingSection = getReadingSection(kanjiRow, currentReading);
        if (readingSection) sections.push(readingSection);

        const idiomSection = getIdiomSection(kanji);
        if (idiomSection) sections.push(idiomSection);

        if (!sections.length) {
            sections.push({
                title: '成り立ち',
                text: 'この漢字の詳細データは準備中です。'
            });
        }

        return sections;
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

    function renderSections(resultEl, sections) {
        if (typeof renderKanjiDetailText === 'function') {
            const legacyText = sections
                .map((section) => `【${section.title}】\n${section.text}`)
                .join('\n\n');
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
            '用例': '📚'
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
        renderSections(resultEl, buildSections(kanji, currentReading));
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

    window.generateKanjiDetail = generatePreloadedKanjiDetail;
    try {
        generateKanjiDetail = generatePreloadedKanjiDetail;
    } catch (error) {
        console.warn('KANJI_DETAIL_DATASET: Failed to rebind generateKanjiDetail', error);
    }

    window.loadKanjiDetailDataset = loadKanjiDetailDataset;
    loadKanjiDetailDataset();
})();
