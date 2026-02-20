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

    // 名乗り理由プロンプト
    let nanoriPrompt = '';
    if (currentReading) {
        nanoriPrompt = `\n\n【名乗り読み「${currentReading}」の理由】\nこの漢字「${kanji}」が名前で「${currentReading}」と読まれる理由や由来を、歴史的背景や音韻の変化を含めて説明してください。なぜ日本人はこの漢字をそう読むのか、わかりやすく教えてください。`;
    }

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
必ず実在する熟語のみを挙げてください。${nanoriPrompt}

【絶対に守るルール】
・架空の人物や存在しない著名人を絶対に書かないでください。
・確実に実在すると断言できる情報のみ記載してください。
・熟語も実在するものだけを挙げてください。不確かなら書かないでください。
`.trim();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.text || '';

        // キャッシュに保存
        if (typeof StorageBox !== 'undefined' && StorageBox.saveKanjiAiCache) {
            StorageBox.saveKanjiAiCache(kanji, aiText);
        }

        renderKanjiDetailText(resultEl, aiText, kanji, currentReading);

    } catch (err) {
        console.error("AI_KANJI_DETAIL:", err);
        resultEl.innerHTML = `
            <div class="bg-[#fef2f2] p-3 rounded-xl text-xs text-[#f28b82] mb-2">
                AI生成に失敗しました: ${err.message}
            </div>
        `;
        const regenBtnErr = document.createElement('button');
        regenBtnErr.className = 'w-full mt-2 py-3 border border-[#eee5d8] bg-[#fdfaf5] text-[#a6967a] font-bold rounded-2xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-2';
        regenBtnErr.innerHTML = '🔄 再出力する';
        regenBtnErr.onclick = () => generateKanjiDetail(kanji, currentReading);
        resultEl.appendChild(regenBtnErr);
    }
}

/**
 * AI漢字詳細テキストをパースしてDOMに描画し、再出力ボタンを追加する
 */
function renderKanjiDetailText(resultEl, aiText, kanji, currentReading) {
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

    // 再出力ボタン
    const regenBtn = document.createElement('button');
    regenBtn.className = 'w-full mt-2 py-3 border border-[#eee5d8] bg-[#fdfaf5] text-[#a6967a] font-bold rounded-2xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-2';
    regenBtn.innerHTML = '🔄 再出力する';
    regenBtn.onclick = () => generateKanjiDetail(kanji, currentReading);
    resultEl.appendChild(regenBtn);
}

// Global Exports
window.generateOrigin = generateOrigin;
window.generateKanjiDetail = generateKanjiDetail;
window.renderKanjiDetailText = renderKanjiDetailText;
window.closeOriginModal = closeOriginModal;
window.copyOriginToClipboard = copyOriginToClipboard;

console.log("ORIGIN: Module loaded (syntax corrected)");
