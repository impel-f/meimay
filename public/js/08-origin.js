/**
 * ============================================================
 * MODULE 08: AI NAME ORIGIN GENERATOR (V13.1 - フォールバック版)
 * ============================================================
 */

async function generateOrigin() {
    if (!currentBuildResult || !currentBuildResult.givenName) {
        alert('名前が決定されていません');
        return;
    }

    const { givenName, combination } = currentBuildResult;
    console.log("ORIGIN_START: AI由来生成開始");

    const modal = document.getElementById('modal-origin');
    if (!modal) return;
    
    modal.classList.add('active');
    modal.innerHTML = \`
        <div class="detail-sheet animate-fade-in flex flex-col items-center">
            <div class="text-[10px] font-black text-[#bca37f] mb-8 tracking-widest opacity-60 uppercase">AI Writing Service</div>
            <div class="flex flex-col items-center py-20 text-center">
                <div class="w-10 h-10 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mb-6"></div>
                <p class="text-[12px] font-bold text-[#7a6f5a] leading-loose">
                    「\${givenName}」の由来を<br>生成しています。
                </p>
            </div>
        </div>
    \`;

    const originDetails = combination.map(c => {
        const src = (typeof liked !== 'undefined') ? liked.find(l => l['漢字'] === c['漢字']) : null;
        return \`【\${c['漢字']}】：\${src ? src['意味'] : "良い意味"}\`;
    }).join('\\n');

    const prompt = \`
名前「\${givenName}」の由来を、以下の漢字データのみを使って、漢字の意味を生かして100文字から150文字程度で簡潔に作成してください。
【禁止事項】
・「生命の誕生は～」「親の愛は～」などの前置きは一切不要。
・名字についての言及、名字との響きについての解説も一切書かないでください。
【作成ルール】
・提示された漢字の意味に直結した、一人の人間としての成長や願いを直球で書いてください。
【漢字データ】
\${originDetails}
    \`.trim();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(\`API疎通エラー (Status: \${response.status})\`);

        const data = await response.json();
        const aiText = data.text || '由来を生成できませんでした。';

        currentBuildResult.origin = aiText;
        if (typeof savedNames !== 'undefined') {
            const index = savedNames.findIndex(n => n.fullName === currentBuildResult.fullName);
            if (index !== -1) {
                savedNames[index].origin = aiText;
                if (typeof StorageBox !== 'undefined') StorageBox.saveSavedNames();
                console.log("ORIGIN: 保存済みデータの由来を更新しました。");
            }
        }

        renderAIOriginResult(givenName, aiText);

    } catch (err) {
        console.error("AI_FAILURE:", err);
        
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
        \`「\${givenName}」という名前には、\${meanings.map(m => \`「\${m}\」\`).join('、')}という漢字の意味が込められています。この名前を持つ子が、それぞれの漢字が示すように、\${meanings[0]}を大切にし、心豊かに成長してほしいという願いが込められています。\`,
        
        \`\${givenName}。\${combination.length}つの漢字それぞれに、深い意味が込められています。\${meanings.map((m, i) => \`\${i+1}文字目の「\${combination[i]['漢字']}」は\${m}を表し\`).join('、')}ます。これらが組み合わさることで、唯一無二の名前が生まれました。\`,
        
        \`この名前を選んだ理由は明確です。\${meanings.map((m, i) => \`「\${combination[i]['漢字']}」には\${m}という意味があり\`).join('、')}、これらすべてが「\${givenName}」という名前に込められた願いを表しています。\`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
}

function renderAIOriginResult(givenName, text, isFallback = false) {
    const modal = document.getElementById('modal-origin');
    if (!modal) return;
    modal.innerHTML = \`
        <div class="detail-sheet animate-fade-in flex flex-col items-center max-w-[420px]">
            <div class="text-[10px] font-black text-[#bca37f] mb-8 tracking-widest opacity-60 uppercase">
                \${isFallback ? 'Template Origin' : 'The Origin Story'}
            </div>
            <div class="text-6xl font-black text-[#5d5444] mb-10 tracking-tight">\${givenName}</div>
            <div class="w-full bg-[#fdfaf5] border border-[#eee5d8] rounded-[40px] p-8 mb-10 shadow-inner overflow-y-auto max-h-[50vh] no-scrollbar">
                <p class="text-[14px] leading-relaxed text-[#5d5444] font-bold whitespace-pre-wrap">\${text}</p>
            </div>
            \${isFallback ? \`
                <p class="text-xs text-[#a6967a] mb-4 text-center">
                    ⚠️ AIサービスが利用できないため、テンプレートで生成しました
                </p>
            \` : ''}
            <div class="flex flex-col gap-3 w-full">
                <button onclick="copyOriginToClipboard()" class="w-full py-5 bg-[#5d5444] text-white rounded-[35px] font-black uppercase tracking-widest active:scale-95 transition-transform">📋 由来をコピー</button>
                <button onclick="closeOriginModal()" class="w-full py-5 bg-white border border-[#eee5d8] rounded-[35px] text-[#a6967a] font-black uppercase tracking-widest">閉じる</button>
            </div>
        </div>
    \`;
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

window.generateOrigin = generateOrigin;
window.closeOriginModal = closeOriginModal;
window.copyOriginToClipboard = copyOriginToClipboard;

console.log("ORIGIN: Module loaded (with fallback)");
