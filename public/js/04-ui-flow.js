/* ============================================================
   MODULE 04: UI FLOW (V14.3)
   ウィザード進行・モード管理
   ============================================================ */

let appMode = 'reading'; // reading, nickname, free, diagnosis
let selectedVibes = new Set();
// gender is defined in 01-core.js

// Vibe Data
// Vibe Data
const VIBES = [
    { id: 'none', label: 'こだわらない', icon: '⚪' },
    { id: 'nature', label: '自然・植物', icon: '🌿' },
    { id: 'flower', label: '花・華やか', icon: '🌸' },
    { id: 'sky', label: '空・天体', icon: '☀️' },
    { id: 'water', label: '海・水', icon: '💧' },
    { id: 'kindness', label: '優しさ・愛', icon: '💝' },
    { id: 'strength', label: '強さ・健康', icon: '💪' },
    { id: 'intelligence', label: '知性・才能', icon: '🎓' },
    { id: 'success', label: '成功・未来', icon: '✨' },
    { id: 'beauty', label: '美しさ', icon: '👗' },
    { id: 'tradition', label: '伝統・和', icon: '⛩️' },
    { id: 'stability', label: '安定・平和', icon: '🕊️' }
];

/**
 * モード開始
 */
function startMode(mode) {
    console.log(`UI_FLOW: Start mode ${mode}`);
    appMode = mode;

    // 診断モードの場合はイメージ等は不要（要望によりスキップ）
    if (mode === 'diagnosis') {
        changeScreen('scr-diagnosis-input');
        return;
    }

    changeScreen('scr-gender');
}

/**
 * 性別選択
 */
function selectGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender selected ${g}`);

    if (appMode === 'free') {
        // 自由選択モード: 性別 -> イメージ -> カタログ
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else {
        changeScreen('scr-input-reading');
    }
}

/**
 * イメージ画面初期化
 */
function initVibeScreen() {
    const grid = document.getElementById('vibe-grid');
    if (!grid) return;

    grid.innerHTML = '';
    selectedVibes.clear();
    selectedVibes.add('none'); // デフォルト選択

    VIBES.forEach(v => {
        const btn = document.createElement('button');
        btn.id = `vibe-btn-${v.id}`;
        btn.className = 'flex flex-col items-center justify-center p-3 bg-white/60 rounded-xl border border-transparent shadow-sm transition-all hover:bg-white active:scale-95';
        btn.innerHTML = `<div class="text-2xl mb-1">${v.icon}</div><div class="text-[10px] font-bold text-[#5d5444]">${v.label}</div>`;

        if (v.id === 'none') {
            btn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
        }

        btn.onclick = () => toggleVibe(v.id, btn);
        grid.appendChild(btn);
    });
}

/**
 * イメージ切り替え
 */
function toggleVibe(id, btn) {
    if (id === 'none') {
        // 「こだわらない」選択時 -> 他をクリアしてこれだけにする
        selectedVibes.clear();
        selectedVibes.add('none');

        // 全ボタンのスタイル更新
        VIBES.forEach(v => {
            const el = document.getElementById(`vibe-btn-${v.id}`);
            if (el) {
                if (v.id === 'none') el.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
                else el.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
            }
        });
        return;
    }

    // 他の項目選択時 -> 「こだわらない」を解除
    if (selectedVibes.has('none')) {
        selectedVibes.delete('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    if (selectedVibes.has(id)) {
        selectedVibes.delete(id);
        btn.classList.remove('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    } else {
        selectedVibes.add(id);
        btn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }

    // 全て解除されたら「こだわらない」に戻す？ 
    if (selectedVibes.size === 0) {
        selectedVibes.add('none');
        const noneBtn = document.getElementById('vibe-btn-none');
        if (noneBtn) noneBtn.classList.add('ring-2', 'ring-[#bca37f]', 'bg-[#fffbeb]');
    }
}

/**
 * イメージ確定 -> 各入力画面へ
 */
function submitVibe() {
    // グローバル変数更新
    if (selectedVibes.size > 0) {
        window.selectedImageTags = Array.from(selectedVibes);
    } else {
        window.selectedImageTags = ['none'];
    }

    console.log("UI_FLOW: Vibes set", window.selectedImageTags);

    if (appMode === 'free') {
        initFreeMode();
        changeScreen('scr-free-mode');
    } else {
        // 読み・ニックネームモード -> 苗字入力へ
        // (注: エンジン側でselectSegment後にchangeScreen('scr-vibe')するように変更が必要)
        changeScreen('scr-surname-settings');
    }
}

/**
 * 戻るボタン処理
 */
function goBack() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    const id = active.id;

    if (id === 'scr-gender') {
        changeScreen('scr-mode');
    } else if (id === 'scr-input-reading' || id === 'scr-input-nickname') {
        changeScreen('scr-gender');
    } else if (id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
    } else if (id === 'scr-tomeji-selection') {
        // Show the list again on the swipe screen
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
    } else if (id === 'scr-vibe') {
        if (appMode === 'free') {
            changeScreen('scr-gender');
        } else if (appMode === 'nickname') {
            // From vibe back to tomeji
            changeScreen('scr-tomeji-selection');
        } else {
            // 読みモードの場合、分割選択画面に戻る
            changeScreen('scr-segment');
        }
    } else if (id === 'scr-free-mode') {
        changeScreen('scr-vibe');
    } else if (id === 'scr-surname-settings') {
        // イメージ選択に戻る
        changeScreen('scr-vibe');
    } else if (id === 'scr-diagnosis-input') {
        changeScreen('scr-mode');
    } else if (id === 'scr-segment') {
        if (appMode === 'nickname') {
            // Should go back to tomeji? 
            // Usually nickname flow skips segment screen or auto-passes it. 
            // If we are here, we go back to tomeji.
            changeScreen('scr-tomeji-selection');
        }
        else changeScreen('scr-input-reading');
    }
}

/**
 * ニックネーム処理
 */
/**
 * ニックネーム処理 (V4: Universal Controller)
 */

// ==========================================
// UNIVERSAL SWIPE CONTROLLER
// ==========================================

const SwipeState = {
    mode: 'none', // 'nickname', 'base', 'tomeji'
    candidates: [],
    currentIndex: 0,
    liked: [], // Items liked in this session
    selected: [], // Items selected from the list (for multi-select)
    history: [], // For undo
    config: {} // { title, subtitle, renderCard, onNext }
};

// Common Kanji Map
const COMMON_KANJI_MAP = {
    'はる': ['春', '晴', '陽', '遥', '悠', '暖', '大'],
    'まさ': ['雅', '正', '昌', '真', '将', '政'],
    'よし': ['義', '吉', '良', '佳', '芳', '慶'],
    'たか': ['隆', '貴', '孝', '高', '尊', '崇'],
    'ひろ': ['広', '博', '弘', '寛', '大', '洋'],
    'かず': ['和', '一', '知', '数', '員'],
    'ゆ': ['結', '優', '友', '有', '悠', '由'],
    'な': ['菜', '奈', '那', '名', '凪', '南'],
    'み': ['美', '実', '未', '海', '心', '水'],
    'か': ['花', '香', '果', '佳', '華', '夏'],
    'り': ['莉', '里', '理', '梨', '璃', '利'],
    'あ': ['愛', 'あ', '亜', '安', '明'],
    'ま': ['真', '麻', '舞', '万', '茉'],
    'さ': ['咲', '沙', '紗', '彩', '早'],
    'き': ['希', '季', '稀', '紀', '喜'],
    'と': ['斗', '人', '翔', '都', '登']
};

let nicknameBaseReading = ""; // "はる"
let nicknamePosition = "prefix";

function processNickname() {
    const el = document.getElementById('in-nickname');
    let val = el.value.trim();

    if (!val) {
        alert('ニックネームを入力してください');
        return;
    }

    val = val.replace(/(ちゃん|くん|さん|たん|りん)$/g, '');
    val = toHira(val);
    if (!val) {
        alert('読みが正しく判定できませんでした');
        return;
    }

    nicknameBaseReading = val;

    const posRadios = document.getElementsByName('nickname-pos');
    let pos = 'prefix';
    for (let r of posRadios) if (r.checked) pos = r.value;
    nicknamePosition = pos;

    console.log(`FLOW: Nickname ${val}, Pos ${pos}, Gender ${gender}`);

    if (typeof generateNameCandidates !== 'function') {
        alert("Generator module not loaded.");
        return;
    }

    const candidates = generateNameCandidates(val, gender, pos);

    if (candidates.length === 0) {
        alert('候補が見つかりませんでした。別の読みを試してください。');
        return;
    }

    // Config for Nickname Swipe
    startUniversalSwipe('nickname', candidates, {
        title: '響きをひろげる',
        subtitle: `「${nicknameBaseReading}」をベースにした候補`,
        renderCard: (item) => {
            const exampleHtml = getSampleKanjiHtml(item);
            return `
                <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
                    ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
                </div>
                <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
                <div class="w-full px-6">
                     <div class="bg-[#fdfaf5] rounded-2xl p-4 border border-[#f5efe4]">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                        <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-bold">
                           ${exampleHtml}
                        </div>
                     </div>
                </div>
            `;
        },
        onNext: (selectedItems) => {
            selectedNicknames = selectedItems;
            console.log("Next: Base Kanji with", selectedItems);
            startBaseKanjiSwipe(nicknameBaseReading);
        }
    });
}


/**
 * START SWIPE
 */
function startUniversalSwipe(mode, candidates, configOverride = {}) {
    console.log(`SWIPE: Starting mode ${mode} with ${candidates.length} items`);

    // Reset State
    SwipeState.mode = mode;
    SwipeState.candidates = candidates;
    SwipeState.currentIndex = 0;
    SwipeState.liked = [];
    SwipeState.selected = [];
    SwipeState.history = [];
    SwipeState.config = configOverride;

    // UI Setup
    document.getElementById('uni-swipe-title').innerText = configOverride.title || 'スワイプ';
    document.getElementById('uni-swipe-subtitle').innerText = configOverride.subtitle || '';

    changeScreen('scr-swipe-universal');
    renderUniversalCard();
}

let selectedNicknames = [];
let selectedBaseKanjis = [];

/**
 * BASE KANJI SWIPE (Step 2)
 */
function startBaseKanjiSwipe(baseReading) {
    if (!master) return;
    const baseHira = toHira(baseReading);

    let matches = master.filter(k => {
        const arr = (k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || '');
        const splits = arr.split(/[、,，\s/]+/).map(r => toHira(r));
        return splits.includes(baseHira);
    });

    const priorities = COMMON_KANJI_MAP[baseHira] || [];
    matches.forEach(k => {
        k.priorityScore = 0;
        if (priorities.includes(k['漢字'])) k.priorityScore = 100 + (10 - priorities.indexOf(k['漢字']));
    });
    matches.sort((a, b) => b.priorityScore - a.priorityScore);

    startUniversalSwipe('base', matches, {
        title: 'ベース漢字をえらぶ',
        subtitle: `「${baseReading}」の漢字候補`,
        renderCard: (item) => {
            let placeholder = "〇";
            let mainHtml = '';
            if (nicknamePosition === 'prefix') {
                mainHtml = `<span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span><span class="text-6xl font-bold text-[#d4c5af] opacity-50">${placeholder}</span>`;
            } else {
                mainHtml = `<span class="text-6xl font-bold text-[#d4c5af] opacity-50">${placeholder}</span><span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span>`;
            }

            return `
                <div class="flex flex-col items-center gap-4">
                    <div class="flex items-end justify-center gap-2 mb-4">
                        ${mainHtml}
                    </div>
                     <div class="mt-8 px-6 text-center">
                        <p class="text-xs text-[#a6967a]">意味・イメージ</p>
                        <p class="text-sm text-[#5d5444] mt-1 font-bold">${item['意味'] || '（意味データなし）'}</p>
                    </div>
                </div>
            `;
        },
        onNext: (selectedItems) => {
            selectedBaseKanjis = selectedItems;
            startTomejiSwipe();
        }
    });
}

/**
 * TOMEJI SWIPE (Step 3 - Mixed)
 */
function startTomejiSwipe() {
    let endings = new Set();
    selectedNicknames.forEach(n => {
        if (n.reading.startsWith(nicknameBaseReading)) {
            endings.add(n.reading.substring(nicknameBaseReading.length));
        } else if (n.reading.endsWith(nicknameBaseReading)) {
            endings.add(n.reading.substring(0, n.reading.length - nicknameBaseReading.length));
        }
    });

    let mixedCandidates = [];
    endings.forEach(ending => {
        const hira = toHira(ending);
        let matches = master.filter(k => {
            const arr = (k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || '');
            const splits = arr.split(/[、,，\s/]+/).map(r => toHira(r));
            return splits.includes(hira);
        });

        const priorities = COMMON_KANJI_MAP[hira] || [];
        matches.forEach(k => {
            k.priorityScore = 0;
            if (priorities.includes(k['漢字'])) k.priorityScore = 100;
            k.targetReadings = [ending];
        });
        matches.sort((a, b) => b.priorityScore - a.priorityScore);
        mixedCandidates.push(...matches.slice(0, 10)); // Top 10 per ending
    });

    mixedCandidates.sort(() => Math.random() - 0.5); // Shuffle

    startUniversalSwipe('tomeji', mixedCandidates, {
        title: '組み合わせの漢字（止め字）',
        subtitle: '選んだ響きに合う漢字をミックスして提案',
        renderCard: (item) => {
            const readingsStr = item.targetReadings.join(',');
            const randomBase = selectedBaseKanjis[Math.floor(Math.random() * selectedBaseKanjis.length)];
            const baseChar = randomBase ? randomBase['漢字'] : '〇';

            let mainHtml = '';
            if (nicknamePosition === 'prefix') {
                mainHtml = `<span class="text-6xl font-bold text-[#d4c5af] opacity-50">${baseChar}</span><span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span>`;
            } else {
                mainHtml = `<span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span><span class="text-6xl font-bold text-[#d4c5af] opacity-50">${baseChar}</span>`;
            }

            return `
                <div class="flex flex-col items-center gap-4">
                     <div class="flex items-end justify-center gap-2 mb-4">
                        ${mainHtml}
                    </div>
                     <div class="mt-4 px-6 text-center">
                        <p class="text-xs text-[#a6967a] mb-1">読み: ${readingsStr}</p>
                        <p class="text-xs text-[#a6967a]">意味・イメージ</p>
                        <p class="text-sm text-[#5d5444] mt-1 font-bold">${item['meaning'] || item['意味'] || ''}</p>
                    </div>
                </div>
            `;
        },
        onNext: (selectedItems) => {
            buildAndShowResults(selectedBaseKanjis, selectedItems);
        }
    });
}

function buildAndShowResults(bases, endings) {
    let results = [];
    bases.forEach(baseK => {
        endings.forEach(endK => {
            const endReadings = endK.targetReadings || [];
            endReadings.forEach(r => {
                let fullReading = '';
                let fullName = '';
                if (nicknamePosition === 'prefix') {
                    fullReading = nicknameBaseReading + r;
                    fullName = baseK['漢字'] + endK['漢字'];
                } else {
                    fullReading = r + nicknameBaseReading;
                    fullName = endK['漢字'] + baseK['漢字'];
                }
                const isValidNick = selectedNicknames.some(sn => sn.reading === fullReading);
                if (isValidNick) {
                    results.push({
                        fullName: fullName,
                        reading: fullReading,
                        baseKanji: baseK,
                        endKanji: endK
                    });
                }
            });
        });
    });

    // Show in Stock directly?
    liked = [];
    // We need to adapt `liked` structure to be compatible with `scr-build` or `scr-stock`.
    // Meimay core usually uses `liked` as segments.
    // Here we have full names.
    // Let's just push to `savedNames` or show a simple result list.
    // Using Alert for now as requested by plan, or simple log.
    alert(`生成完了！ ${results.length}件の候補ができました。\n例: ${results.slice(0, 3).map(r => r.fullName + '(' + r.reading + ')').join(', ')}`);
    console.log(results);
}
// UI ACTIONS

function renderUniversalCard() {
    const container = document.getElementById('uni-swipe-container');
    container.innerHTML = `
        <div id="uni-swipe-msg" class="absolute inset-0 flex items-center justify-center text-[#bca37f] hidden z-50 bg-white/90">
             <div class="text-center">
                <p class="mb-4">チェック完了！</p>
                <button onclick="showUniversalList()" class="btn-gold px-6 py-3 shadow-md">リストを確認</button>
                 <button onclick="continueUniversalSwipe()" class="text-xs text-[#bca37f] border-b border-[#bca37f] pb-0.5 mt-4 block mx-auto">もっと見る</button>
            </div>
        </div>
    `;

    if (SwipeState.currentIndex >= SwipeState.candidates.length) {
        document.getElementById('uni-swipe-msg').classList.remove('hidden');
        return;
    }

    const item = SwipeState.candidates[SwipeState.currentIndex];
    const card = document.createElement('div');
    card.className = 'uni-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;

    // Render content
    card.innerHTML = SwipeState.config.renderCard(item);

    container.appendChild(card);

    // Physics
    initUniversalSwipePhysics(card);
}

function initUniversalSwipePhysics(card) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100;

    const onStart = (clientX, clientY) => {
        startX = clientX;
        isDragging = true;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        currentX = clientX - startX;
        const rotate = currentX * 0.08;
        card.style.transform = `translate(${currentX}px, ${Math.abs(currentX) * 0.05}px) rotate(${rotate}deg)`;

        if (currentX > 50) card.style.borderColor = '#81c995';
        else if (currentX < -50) card.style.borderColor = '#f28b82';
        else card.style.borderColor = '#ede5d8';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.borderColor = '#ede5d8';

        if (currentX > threshold) {
            universalSwipeAction('like');
        } else if (currentX < -threshold) {
            universalSwipeAction('nope');
        } else {
            card.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.transform = 'translate(0, 0) rotate(0)';
        }
        currentX = 0;
    };

    card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('mousedown', (e) => { onStart(e.clientX, e.clientY); e.preventDefault(); });
    const mM = (e) => { if (isDragging) onMove(e.clientX, e.clientY); };
    const mU = () => { if (isDragging) onEnd(); };
    window.addEventListener('mousemove', mM);
    window.addEventListener('mouseup', mU);
    card._cleanup = () => { window.removeEventListener('mousemove', mM); window.removeEventListener('mouseup', mU); };
}

function universalSwipeAction(action) {
    if (SwipeState.currentIndex >= SwipeState.candidates.length) return;

    // Update data
    const item = SwipeState.candidates[SwipeState.currentIndex];

    if (action === 'like' || action === 'super') {
        if (action === 'super') item.isSuper = true;
        SwipeState.liked.push(item);
    }

    SwipeState.history.push({ action: action, item: item });

    // Animation
    const container = document.getElementById('uni-swipe-container');
    const card = container.querySelector('.uni-card');
    if (card) {
        let x = (action === 'like' || action === 'super') ? 500 : -500;
        let r = (action === 'like' || action === 'super') ? 20 : -20;
        if (action === 'super') { x = 0; r = 0; }

        card.style.transition = 'all 0.4s ease';
        if (action === 'super') {
            card.style.transform = 'translateY(-500px) scale(1.2)';
            card.style.opacity = '0';
        } else {
            card.style.transform = `translate(${x}px, 50px) rotate(${r}deg)`;
            card.style.opacity = '0';
        }

        setTimeout(() => {
            SwipeState.currentIndex++;
            renderUniversalCard();
        }, 300);
    }
}

function undoUniversalSwipe() {
    if (SwipeState.history.length > 0) {
        const last = SwipeState.history.pop();
        SwipeState.currentIndex--;

        if (last.action === 'like' || last.action === 'super') {
            SwipeState.liked.pop(); // Remove last added
        }
        renderUniversalCard();
    }
}

function showUniversalList() {
    const list = document.getElementById('uni-liked-list');
    const grid = document.getElementById('uni-candidates-grid');
    grid.innerHTML = '';

    if (SwipeState.liked.length === 0) {
        // Show all candidates? or just Alert?
        // Alert for now
    }

    // Deduplicate?
    const unique = [...new Set(SwipeState.liked)];

    unique.forEach((item, idx) => {
        // Determine label (Kanji or Reading)
        const label = item['漢字'] || item.reading;

        const btn = document.createElement('div');
        btn.className = 'bg-[#fdfaf5] border border-[#ede5d8] rounded-xl p-3 flex items-center justify-between';

        const text = document.createElement('span');
        text.className = 'text-xl font-bold text-[#5d5444]';
        text.innerText = label;

        // Checkbox
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'w-6 h-6 accent-[#8b7e66]';
        chk.checked = true; // Default select all
        chk.onchange = (e) => {
            item._selected = e.target.checked;
        };
        item._selected = true; // Default

        btn.appendChild(text);
        btn.appendChild(chk);
        grid.appendChild(btn);
    });

    list.classList.remove('hidden');
}

function submitUniversalSelection() {
    // Filter selected
    const selected = SwipeState.liked.filter(i => i._selected);

    if (selected.length === 0) {
        alert("少なくとも1つ選んでください");
        return;
    }

    document.getElementById('uni-liked-list').classList.add('hidden');

    if (SwipeState.config.onNext) {
        SwipeState.config.onNext(selected);
    }
}

function continueUniversalSwipe() {
    document.getElementById('uni-swipe-msg').classList.add('hidden');
    alert("これ以上の候補はありません");
}

function resetUniversalSwipe() {
    SwipeState.currentIndex = 0;
    SwipeState.liked = [];
    SwipeState.history = [];
    renderUniversalCard();
    document.getElementById('uni-liked-list').classList.add('hidden');
    document.getElementById('uni-swipe-msg').classList.add('hidden');
}

function closeUniversalList() {
    document.getElementById('uni-liked-list').classList.add('hidden');
}

function showNicknameBatchLimitModal() {
    document.getElementById('nickname-swipe-msg').classList.remove('hidden');
}

function continueNicknameSwipe() {
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
    // Increment index to skip the check?? No, the index is already at 10.
    // We just render next card.
    // Wait, renderNicknameCard checks `currentSwipeIndex % 10 === 0`.
    // We need a flag to bypass this check OR just increment one temporary step?
    // No, that would skip a candidate.

    // Hack: We can just render the card and bypass the check logic by passing a flag?
    // Or cleaner: store a "lastBreakpoint" index.

    // Simple fix: increment currentSwipeIndex ?? NO. The item at index 10 hasn't been shown yet! 
    // Actually, `currentSwipeIndex` points to the NEXT item to show.
    // So if index is 10, we are about to show the 11th item (index 10).
    // So we should show the modal BEFORE showing item 10.
    // Correct.

    // To proceed, we need to allow rendering. 
    // Let's use a temporary property on the container or a global flag.
    // But easier: `currentSwipeIndex` is strictly used for "next item".
    // 10 items done means we finished indices 0-9. `currentSwipeIndex` is 10.
    // We pause here.

    // To continue, we must NOT show the modal again immediately for 10.
    // Maybe we change the condition to `currentSwipeIndex > 0 && currentSwipeIndex % 10 === 0 && !wasBatchModalShown`.

    // Let's just force render by shifting logic.
    // We will use a separate function to "force render"

    renderNicknameCardForce();
    document.getElementById('nickname-swipe-msg').classList.add('hidden');
}

function renderNicknameCardForce() {
    // Exact copy but skips the modal check
    const container = document.getElementById('nickname-swipe-container');
    const cards = container.querySelectorAll('.nickname-card');
    cards.forEach(c => c.remove());

    if (currentSwipeIndex >= generatedCandidates.length) {
        showNicknameList();
        return;
    }

    const item = generatedCandidates[currentSwipeIndex];
    const card = document.createElement('div');
    card.className = 'nickname-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;
    const exampleHtml = getSampleKanjiHtml(item);

    card.innerHTML = `
        <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
            ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
        </div>
        <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
        <div class="w-full px-6">
             <div class="bg-[#fdfaf5] rounded-2xl p-4 border border-[#f5efe4]">
                <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-bold">
                   ${exampleHtml}
                </div>
             </div>
        </div>
    `;
    container.appendChild(card);
    initNicknameCardEvents(card);
}

// 頻出漢字マッピング (Priority Boost)
const COMMON_KANJI_MAP = {
    'はる': ['春', '晴', '陽', '遥', '悠', '暖', '大'],
    'まさ': ['雅', '正', '昌', '真', '将', '政'],
    'よし': ['義', '吉', '良', '佳', '芳', '慶'],
    'たか': ['隆', '貴', '孝', '高', '尊', '崇'],
    'ひろ': ['広', '博', '弘', '寛', '大', '洋'],
    'かず': ['和', '一', '知', '数', '員'],
    'ゆ': ['結', '優', '友', '有', '悠', '由'],
    'な': ['菜', '奈', '那', '名', '凪', '南'],
    'み': ['美', '実', '未', '海', '心', '水'],
    'か': ['花', '香', '果', '佳', '華', '夏'],
    'り': ['莉', '里', '理', '梨', '璃', '利'],
    'あ': ['愛', 'あ', '亜', '安', '明'],
    'ま': ['真', '麻', '舞', '万', '茉'],
    'さ': ['咲', '沙', '紗', '彩', '早'],
    'き': ['希', '季', '稀', '紀', '喜'],
    'と': ['斗', '人', '翔', '都', '登']
};

let kanjiCandidates = [];
let kanjiSwipeIndex = 0;
let likedKanjis = []; // { kanji: '春', reading: 'はる', score: 100 }

// ... existing code ...

/**
 * 読み決定 -> ベース漢字選択画面(Swipe)へ
 */
function confirmReading(reading) {
    console.log(`FLOW: Confirmed reading ${reading} (Base: ${nicknameBaseReading})`);

    selectedReadingForTomeji = reading; // Target full reading

    changeScreen('scr-base-kanji-swipe');
    initKanjiSwipe(nicknameBaseReading);
}

function initKanjiSwipe(baseReading) {
    kanjiCandidates = [];
    kanjiSwipeIndex = 0;
    likedKanjis = [];

    const targetEl = document.getElementById('base-kanji-target-reading');
    if (targetEl) targetEl.innerText = baseReading;

    // Generate Kanji Candidates
    if (!master) return;

    const baseHira = toHira(baseReading);

    // 1. Get from Master
    let matches = master.filter(k => {
        const arr = (k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || '');
        const splits = arr.split(/[、,，\s/]+/).map(r => toHira(r));
        return splits.includes(baseHira);
    });

    // 2. Prioritize common kanji
    const priorities = COMMON_KANJI_MAP[baseHira] || [];

    matches.forEach(k => {
        k.priorityScore = 0;
        if (priorities.includes(k['漢字'])) k.priorityScore = 100 + (10 - priorities.indexOf(k['漢字'])); // Higher priority first
        // Length heuristic: shorter reading match is better? (Not relevant, reading is fixed)
    });

    // 3. Sort
    matches.sort((a, b) => b.priorityScore - a.priorityScore);

    // 4. Fill candidates
    kanjiCandidates = matches;

    if (kanjiCandidates.length === 0) {
        alert("漢字候補が見つかりませんでした");
        return;
    }

    renderKanjiCard();
    document.getElementById('kanji-liked-list').classList.add('hidden');
    document.getElementById('kanji-swipe-msg').classList.add('hidden');
}

function renderKanjiCard() {
    const container = document.getElementById('kanji-swipe-container');
    const cards = container.querySelectorAll('.kanji-card');
    cards.forEach(c => c.remove());

    if (kanjiSwipeIndex >= kanjiCandidates.length) {
        showKanjiBatchEndModal();
        return;
    }

    const item = kanjiCandidates[kanjiSwipeIndex];

    // Determine context (random Tomeji or Prefix)
    // nicknamePosition: 'prefix' (Haru-to) -> Show "Haru" + "?"
    // nicknamePosition: 'suffix' (Masa-haru) -> Show "?" + "Haru"

    const placeholder = "〇"; // Or random kanji?
    let displayHtml = "";

    if (nicknamePosition === 'prefix') {
        displayHtml = `<span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span><span class="text-6xl font-bold text-[#d4c5af] opacity-50">${placeholder}</span>`;
    } else {
        displayHtml = `<span class="text-6xl font-bold text-[#d4c5af] opacity-50">${placeholder}</span><span class="text-8xl font-black text-[#5d5444]">${item['漢字']}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'kanji-card absolute inset-4 bg-white rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center transition-transform duration-300 select-none cursor-grab active:cursor-grabbing';
    card.style.zIndex = 10;

    card.innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <div class="flex items-end justify-center gap-2 mb-4">
                ${displayHtml}
            </div>
            <div class="text-xl font-bold text-[#bca37f] tracking-widest">${selectedReadingForTomeji}</div>
            
            <div class="mt-8 px-6 text-center">
                <p class="text-xs text-[#a6967a]">意味・イメージ</p>
                <p class="text-sm text-[#5d5444] mt-1 font-bold">${item['意味'] || '（意味データなし）'}</p>
            </div>
        </div>
    `;

    container.appendChild(card);

    // Physics for Kanji Card
    initKanjiCardEvents(card);
}

// Modify initNicknameCardEvents to accept mode or create separate
function initKanjiCardEvents(card) {
    // ... Copy or reuse logic ...
    // Let's reuse `initNicknameCardEvents` but we need to know asking callback.
    // Actually, `nicknameSwipeAction` is hardcoded there.
    // Better to make `initGenericSwipe` or duplicate.
    // I will refactor `initNicknameCardEvents` to be generic later, for now duplicate to ensure speed.

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100;

    const onStart = (clientX, clientY) => {
        startX = clientX;
        isDragging = true;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        currentX = clientX - startX;
        const rotate = currentX * 0.08;
        card.style.transform = `translate(${currentX}px, ${Math.abs(currentX) * 0.05}px) rotate(${rotate}deg)`;

        if (currentX > 50) card.style.borderColor = '#81c995';
        else if (currentX < -50) card.style.borderColor = '#f28b82';
        else card.style.borderColor = '#ede5d8';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.borderColor = '#ede5d8';

        if (currentX > threshold) {
            kanjiSwipeAction('like');
        } else if (currentX < -threshold) {
            kanjiSwipeAction('nope');
        } else {
            card.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.transform = 'translate(0, 0) rotate(0)';
        }
        currentX = 0;
    };

    card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchend', onEnd);
    card.addEventListener('mousedown', (e) => { onStart(e.clientX, e.clientY); e.preventDefault(); });
    const mM = (e) => { if (isDragging) onMove(e.clientX, e.clientY); };
    const mU = () => { if (isDragging) onEnd(); };
    window.addEventListener('mousemove', mM);
    window.addEventListener('mouseup', mU);
    card._cleanup = () => { window.removeEventListener('mousemove', mM); window.removeEventListener('mouseup', mU); };
}

function kanjiSwipeAction(action) {
    if (kanjiSwipeIndex >= kanjiCandidates.length) return;
    const container = document.getElementById('kanji-swipe-container');
    const card = container.querySelector('.kanji-card');
    if (!card) return;

    let x = 0;
    let r = 0;

    if (action === 'like') {
        x = 500; r = 20;
        likedKanjis.push(kanjiCandidates[kanjiSwipeIndex]);
        kanjiActionHistory.push('like');
    } else if (action === 'super') {
        x = 0; r = 0;
        const item = kanjiCandidates[kanjiSwipeIndex];
        item.isSuper = true;
        likedKanjis.push(item);
        kanjiActionHistory.push('super');
        card.style.transition = 'all 0.4s ease';
        card.style.transform = 'translateY(-500px) scale(1.2)';
        card.style.opacity = '0';
        setTimeout(() => { kanjiSwipeIndex++; renderKanjiCard(); }, 300);
        return;
    } else { // nope
        x = -500; r = -20;
        kanjiActionHistory.push('nope');
    }

    card.style.transition = 'all 0.4s ease';
    card.style.transform = `translate(${x}px, 50px) rotate(${r}deg)`;
    card.style.opacity = '0';
    setTimeout(() => { kanjiSwipeIndex++; renderKanjiCard(); }, 300);
}

function showKanjiBatchEndModal() {
    document.getElementById('kanji-swipe-msg').classList.remove('hidden');
}

function showKanjiList() {
    const listContainer = document.getElementById('kanji-liked-list');
    const grid = document.getElementById('kanji-candidates-grid');
    grid.innerHTML = '';

    if (likedKanjis.length === 0) {
        alert("キープした漢字がありません。");
        return; // Or reset?
    }

    likedKanjis.forEach(item => {
        const btn = document.createElement('button');
        let classes = 'aspect-square rounded-xl text-3xl font-black transition-all text-center flex items-center justify-center active:scale-95 ';
        if (item.isSuper) classes += 'bg-[#fffbeb] border-2 border-[#fbbc04] text-[#5d5444] shadow-md';
        else classes += 'bg-[#fdfaf5] border border-[#ede5d8] text-[#5d5444] hover:bg-white hover:border-[#bca37f]';
        btn.className = classes;
        btn.innerText = item['漢字'];
        btn.onclick = () => decideBaseKanji(item, nicknameBaseReading);
        grid.appendChild(btn);
    });

    listContainer.classList.remove('hidden');
}

function undoNicknameSwipe() {
    if (currentSwipeIndex > 0 && nicknameActionHistory.length > 0) {
        currentSwipeIndex--;
        const lastAction = nicknameActionHistory.pop();

        // If it was like or super, remove from liked list
        if (lastAction === 'like' || lastAction === 'super') {
            likedReadings.pop();
        }

        updateNicknameCounters();
        renderNicknameCard();
    }
}

function undoKanjiSwipe() {
    if (kanjiSwipeIndex > 0 && kanjiActionHistory.length > 0) {
        kanjiSwipeIndex--;
        const lastAction = kanjiActionHistory.pop();

        if (lastAction === 'like' || lastAction === 'super') {
            likedKanjis.pop();
        }

        renderKanjiCard();
    }
}

function closeKanjiList() {
    document.getElementById('kanji-liked-list').classList.add('hidden');
}

function decideBaseKanji(kanjiObj, reading) {
    console.log("FLOW: Base Kanji decided", kanjiObj);

    // Store this decision
    // We want to lock this Kanji for the specific part of the name.
    // Segments calculation needed.
    // Example: Name "Ha-ru-to". Base "Ha-ru".
    // We lock "Ha-ru" -> "春".

    // Update global liked array to pre-fill?
    // Need to know which segment index corresponds to the base.

    // First, let's process the full reading (selectedReadingForTomeji) into segments.
    // Then find the segment(s) matching the base.

    const fullReading = selectedReadingForTomeji;
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = fullReading;

    // Trigger standard segment calculation
    calcSegments();

    // Now look at `segments` global
    // e.g. ["はる", "と"] or ["は", "る", "と"]

    // Try to match `reading` (base) to segments.
    // 1. Exact match of a segment?
    // 2. Combination of segments? (e.g. segments=["は","る"], base="はる" -> Difficult to lock 2 segments to 1 Kanji here unless we merge segments)

    // If segments don't match base reading structure, we might need to FORCE segments.
    // e.g. Base="はる", Full="はると". calcSegments might say ["は","る","と"].
    // We want ["はる","と"] if user selected '春' (read as Haru).

    // Check if the selected Kanji's reading matches the base perfectly.
    // kanjiObj.reading usually covers it.

    // Ideally, we force the segmentation to respect the base.
    // But modifying `calcSegments` is risky.

    // Simple approach:
    // If `segments` contains the base reading as one chunk, lock it.
    // If not, we just pass the info to the next screen (Main) and let user handle, or try to merge.

    // Let's iterate segments and find match
    let locked = false;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i] === reading) {
            // Found exact segment match!
            // Lock it.
            // Clear existing lock for this slot
            const existingIdx = liked.findIndex(l => l.slot === i);
            if (existingIdx > -1) liked.splice(existingIdx, 1);

            liked.push({
                ...kanjiObj,
                slot: i,
                sessionReading: uniqueId()
            });
            locked = true;
            break;
        }
    }

    if (!locked) {
        // Fallback: The segmentation didn't produce the base reading as a single chunk.
        // e.g. Base="はる", Segments=["は", "る", "と"].
        // User wants "春(はる)" + "と".
        // Use `forceSegments` logic? (Not available globally easily).
        // For now, we just proceed. User might need to re-segment manually in scr-segment if available.
        // Or we warn?
        console.warn("FLOW: Could not lock base kanji to segments automatically.", segments, reading);
    }

    // Proceed to Main Swipe (skip separate segment screen if possible, or go to it)
    // "scr-vibe" is next usually.
    changeScreen('scr-vibe');
}

function skipBaseKanji() {
    const fullReading = selectedReadingForTomeji;
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = fullReading;
    calcSegments();
    changeScreen('scr-vibe');
}

function closeNicknameList() {
    document.getElementById('nickname-liked-list').classList.add('hidden');
}

/**
 * Updated Physics for Nickname Card (mimic Main)
 */
function initNicknameCardEvents(card) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const threshold = 100; // Same as main? Main uses 120 or so.

    const onStart = (clientX, clientY) => {
        startX = clientX;
        isDragging = true;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        currentX = clientX - startX;

        // Rotation physics similar to main
        const rotate = currentX * 0.08;

        card.style.transform = `translate(${currentX}px, ${Math.abs(currentX) * 0.05}px) rotate(${rotate}deg)`;

        // Visual Feedback (Colors)
        if (currentX > 50) card.style.borderColor = '#81c995'; // LIKE
        else if (currentX < -50) card.style.borderColor = '#f28b82'; // NOPE
        else card.style.borderColor = '#ede5d8';
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.borderColor = '#ede5d8';

        if (currentX > threshold) {
            nicknameSwipeAction('like');
        } else if (currentX < -threshold) {
            nicknameSwipeAction('nope');
        } else {
            // Reset
            card.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            card.style.transform = 'translate(0, 0) rotate(0)';
        }
        currentX = 0;
    };

    // Touch
    card.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchend', onEnd);

    // Mouse
    card.addEventListener('mousedown', (e) => {
        onStart(e.clientX, e.clientY);
        e.preventDefault(); // Prevent text selection
    });

    const mouseMoveHandler = (e) => { if (isDragging) onMove(e.clientX, e.clientY); };
    const mouseUpHandler = () => {
        if (isDragging) {
            onEnd();
        }
    };

    // Bind window for mouse move/up to catch drag outside
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    // Cleanup helper (not strictly needed since cars remove, but good practice)
    card._cleanup = () => {
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('mouseup', mouseUpHandler);
    };
}

function nicknameSwipeAction(action) {
    if (currentSwipeIndex >= generatedCandidates.length) return;

    const container = document.getElementById('nickname-swipe-container');
    const card = container.querySelector('.nickname-card');
    if (!card) return;

    let x = 0;
    let r = 0;

    if (action === 'like') {
        x = 500; r = 20;
        likedReadings.push(generatedCandidates[currentSwipeIndex]);
    } else if (action === 'super') {
        x = 0; r = 0;
        // Super logic: Add to liked, maybe special flag
        const item = generatedCandidates[currentSwipeIndex];
        item.isSuper = true;
        likedReadings.push(item);

        // Fly up animation
        card.style.transition = 'all 0.4s ease';
        card.style.transform = 'translateY(-500px) scale(1.2)';
        card.style.opacity = '0';

        nicknameActionHistory.push('super'); // HISTORY

        setTimeout(() => {
            currentSwipeIndex++;
            renderNicknameCard();
        }, 300);
        return;

    } else {
        x = -500; r = -20;
    }

    nicknameActionHistory.push(action); // HISTORY

    card.style.transition = 'all 0.4s ease';
    card.style.transform = `translate(${x}px, 50px) rotate(${r}deg)`;
    card.style.opacity = '0';

    setTimeout(() => {
        currentSwipeIndex++;
        renderNicknameCard();
    }, 300);
}

/**
 * 漢字サンプルHTML生成
 */
function getSampleKanjiHtml(item) {
    if (!master) return '<span class="text-xs text-[#d4c5af]">Loading...</span>';

    // item.reading (e.g. "はると")
    const r = item.reading;
    let parts = [];

    // Simple Heuristic Segmentation
    if (r.length === 3) {
        parts = [[r.substring(0, 2), r.substring(2)]]; // Haru-to
        parts.push([r.substring(0, 1), r.substring(1)]); // Ha-ruto
    } else if (r.length === 4) {
        parts = [[r.substring(0, 2), r.substring(2)]]; // Masa-haru
    } else if (r.length === 2) {
        parts = [[r.substring(0, 1), r.substring(1)]]; // Haru
    } else {
        parts = [[r]];
    }

    // Example limit
    let count = 0;

    // Helper to find top kanji for a reading (using correct field check)
    const findKanji = (readingSegment) => {
        const target = toHira(readingSegment);

        let cands = master.filter(m => {
            const allReadings = (m['音'] || '') + ',' + (m['訓'] || '') + ',' + (m['伝統名のり'] || '');
            return toHira(allReadings).indexOf(target) > -1;
        });

        // Exact match preference
        const exacts = cands.filter(m => {
            const arr = (m['音'] || '') + ',' + (m['訓'] || '') + ',' + (m['伝統名のり'] || '');
            const splits = arr.split(/[、,，\s/]+/).map(x => toHira(x));
            return splits.includes(target);
        });

        if (exacts.length > 0) cands = exacts;

        // Sort by score if available, or just take top
        return cands.slice(0, 2).map(c => c['漢字']);
    };

    let generatedExamples = new Set();

    // Attempt to generate examples from parts
    for (let p of parts) {
        if (generatedExamples.size >= 3) break;

        let segs = p;
        if (segs.length === 1) {
            const ks = findKanji(segs[0]);
            ks.forEach(k => generatedExamples.add(k));
        } else {
            const k1s = findKanji(segs[0]);
            const k2s = findKanji(segs[1]);

            if (k1s.length > 0 && k2s.length > 0) {
                generatedExamples.add(`${k1s[0]}${k2s[0]}`);
                if (k1s[1] && k2s[1]) generatedExamples.add(`${k1s[1]}${k2s[1]}`);
            }
        }
    }

    if (generatedExamples.size === 0) return '<span class="text-xs text-[#d4c5af]">漢字例なし</span>';

    return Array.from(generatedExamples).slice(0, 3).map(ex =>
        `<span class="text-lg font-bold mx-1">${ex}</span>`
    ).join('');
}

/**
 * Helper: toKata
 */
function toKata(str) {
    if (!str) return '';
    return str.replace(/[\u3041-\u3096]/g, function (match) {
        var chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

function showNicknameList() {
    const listContainer = document.getElementById('nickname-liked-list');
    const grid = document.getElementById('nickname-candidates-grid');
    grid.innerHTML = '';

    if (likedReadings.length === 0) {
        alert("気に入った読みがありませんでした。もう一度スワイプしますか？");
        startNicknameSwipe();
        return;
    }

    likedReadings.forEach(item => {
        const btn = document.createElement('button');
        let classes = 'p-4 rounded-xl text-lg font-bold transition-all text-center flex flex-col items-center justify-center gap-1 active:scale-95 ';

        if (item.isSuper) {
            classes += 'bg-[#fffbeb] border-2 border-[#fbbc04] text-[#5d5444] shadow-md';
        } else {
            classes += 'bg-[#fdfaf5] border border-[#ede5d8] text-[#5d5444] hover:bg-white hover:border-[#bca37f]';
        }

        btn.className = classes;
        btn.innerHTML = `
            ${item.isSuper ? '<span class="text-[10px] text-[#fbbc04]">★ SUPER</span>' : ''}
            <span>${item.reading}</span>
        `;
        btn.onclick = () => confirmReading(item.reading);
        grid.appendChild(btn);
    });

    listContainer.classList.remove('hidden');
}

function decideTomeji(kanjiObj, reading) {
    selectedTomeji = { kanji: kanjiObj['漢字'], reading: reading, obj: kanjiObj };
    console.log("FLOW: Tomeji decided", selectedTomeji);
    finalizeNicknameFlow();
}

function skipTomeji() {
    selectedTomeji = null;
    finalizeNicknameFlow();
}

/**
 * ニックネームフロー完了 -> 通常フローへ合流
 */
function finalizeNicknameFlow() {
    // データセット
    // reading: selectedReadingForTomeji
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = selectedReadingForTomeji;

    // 分割計算 (calcSegments) を呼ぶ
    // ただし、最後の文字を固定するための引数を渡す必要がある
    // calcSegmentsを改造するか、あるいは segments を直接いじるか

    // 02-engine.js の calcSegments は引数なしでDOMを読む
    // まず普通に計算させる

    // Note: calcSegments is async-ish in nature? No, sync.
    // しかし segments global 変数を更新する

    calcSegments();

    // もし止め字が決まっていれば、segments の末尾に対応する liked をセットする
    if (selectedTomeji) {
        // segments配列チェック
        // 例：はると -> [は, る, と] or [はる, と]
        // 末尾が一致しているか確認
        const lastSeg = segments[segments.length - 1];
        if (lastSeg === selectedTomeji.reading) {
            // 末尾一致。liked に追加
            // liked は {漢字:..., slot: index} の形
            // slotは 0-index. 
            // Swipe画面 (loadStack) は segments[currentPos] を見る。
            // 既に liked に slot corresponding to lastSeg があれば、Swipe画面はどうなる？

            // 簡易実装: likedに突っ込む
            const slotIdx = segments.length - 1;

            // 既存の同slotのものを消す
            const existingIdx = liked.findIndex(l => l.slot === slotIdx);
            if (existingIdx > -1) liked.splice(existingIdx, 1);

            liked.push({
                ...selectedTomeji.obj,
                slot: slotIdx,
                sessionReading: uniqueId() // dummy
            });

            console.log("FLOW: Auto-liked tomeji", liked);
        } else {
            console.warn("FLOW: Segments checking failed for tomeji", lastSeg, selectedTomeji.reading);
            // 分割が合わない場合（稀だが）、無理やりは適用しない
        }
    }

    // 画面は calcSegments 内で 'scr-segment' に変わる
    // しかし、分割が1通りしかなければ自動で次に行くロジックがほしい
    // あるいは、ここで強制的に 'scr-vibe' に飛ばす？

    // ユーザー体験的には「分割確認」→「イメージ」→「スワイプ」でOK
    // ただし、止め字が決まってるなら分割画面でそれをアピールしたい（今後の課題）

    // スワイプ開始時に最後の文字が「決定済み」に見えるようにするのは 05-ui-render.js の仕事
}

// Helper uniqueId
function uniqueId() { return Math.random().toString(36).substr(2, 9); }

/**
 * GoBack Override extension
 */
const originalGoBack = window.goBack;
window.goBack = function () {
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
        return;
    }
    if (active && active.id === 'scr-tomeji-selection') {
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
        return;
    }
    originalGoBack();
};

/**
 * 自由選択モード初期化 (簡易カタログ表示)
 */
function initFreeMode() {
    const container = document.getElementById('free-catalog');
    if (!container || !master) return;

    container.innerHTML = '<div class="col-span-4 text-center text-sm">読み込み中...</div>';

    // フィルタリング（性別・イメージ）
    // loadStackのロジックを再利用するか、簡易的にフィルタ
    let list = master.filter(k => {
        // 不適切除外
        if (k['不適切フラグ']) return false;
        return true;
    });

    // 性別・イメージスコア計算 (02-engine.jsの関数利用)
    if (typeof calculateKanjiScore === 'function') {
        list.forEach(k => k.score = calculateKanjiScore(k));
        // スコア順
        list.sort((a, b) => b.score - a.score);
    }

    // 表示（上位200件くらい？）
    container.innerHTML = '';
    list.slice(0, 300).forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'aspect-square bg-white rounded-xl shadow-sm border border-[#eee5d8] flex flex-col items-center justify-center hover:border-[#bca37f] relative';
        btn.innerHTML = `
            <span class="text-2xl font-black text-[#5d5444]">${k['漢字']}</span>
            <span class="text-[8px] text-[#a6967a]">${k['画数']}画</span>
        `;

        // ストック状態チェック
        const isStocked = liked.some(l => l['漢字'] === k['漢字']);
        if (isStocked) {
            btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        }

        btn.onclick = () => toggleStockFree(k, btn);
        container.appendChild(btn);
    });

    updateFreeStockBadge();
}

/**
 * 自由選択：ストック切り替え
 */
function toggleStockFree(k, btn) {
    const idx = liked.findIndex(l => l['漢字'] === k['漢字']);
    if (idx > -1) {
        liked.splice(idx, 1);
        btn.classList.remove('bg-[#fffbeb]', 'border-[#bca37f]');
    } else {
        // 簡易オブジェクト作成
        const item = { ...k, slot: -1, sessionReading: 'FREE' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
    }
    if (typeof saveLiked === 'function') saveLiked();
    updateFreeStockBadge();
}

function updateFreeStockBadge() {
    const badge = document.getElementById('free-stock-badge');
    if (badge) {
        badge.innerText = liked.length;
        badge.classList.toggle('hidden', liked.length === 0);
    }
}

function finishFreeMode() {
    // ストック選択後、ビルド画面へ
    if (liked.length === 0) {
        if (!confirm('漢字が選択されていませんが、進みますか？')) return;
    }

    // ビルド画面を表示
    changeScreen('scr-build');
    if (typeof renderBuild === 'function') renderBuild();
}

function runDiagnosis() {
    alert('診断機能はデモ版のため現在利用できません。\n（読みと意味の解析ロジックを実装予定）');
}


/**
 * ルール設定 (Existing)
 */
function setRule(r) {
    console.log(`UI_FLOW: Rule set to ${r}`);
    rule = r;

    const bStrict = document.getElementById('btn-strict');
    const bLax = document.getElementById('btn-lax');

    if (bStrict) bStrict.classList.toggle('active', r === 'strict');
    if (bLax) bLax.classList.toggle('active', r === 'lax');
}

/**
 * スワイプモード開始 (Existing, modified)
 */
function startSwiping() {
    console.log("UI_FLOW: Starting swipe mode");

    // 名字データの確実な更新
    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }

    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.remove('hidden');

    currentPos = 0;
    swipes = 0;
    seen.clear();

    // Auto inherit
    autoInheritSameReadings();

    if (typeof loadStack === 'function') {
        loadStack();
    }
    changeScreen('scr-main');

    // 初回チュートリアル表示
    setTimeout(() => {
        showTutorial();
    }, 500);
}

/**
 * チュートリアル表示
 */
/**
 * チュートリアル制御
 */
let tutorialInterval;
let tutorialStep = 1; // 1: Swipe, 2: Detail, 3: Build

function showTutorial() {
    // 既に表示済みならスキップ (デバッグ用に一時的に無効化する場合はここをコメントアウト)
    if (localStorage.getItem('meimay_tutorial_shown_v2')) return;

    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.add('active');
        localStorage.setItem('meimay_tutorial_shown_v2', 'true'); // バージョン変えて再表示させる

        // ステップ1から開始
        tutorialStep = 1;
        updateTutorialScene();
    }
}

function nextTutorialStep() {
    tutorialStep++;
    if (tutorialStep > 3) {
        closeTutorial();
    } else {
        updateTutorialScene();
    }
}

function updateTutorialScene() {
    const modal = document.getElementById('modal-tutorial');
    if (!modal) return;

    // Dots
    [1, 2, 3].forEach(i => {
        const dot = document.getElementById(`tut-dot-${i}`);
        if (dot) dot.classList.toggle('opacity-100', i === tutorialStep);
        if (dot) dot.classList.toggle('opacity-30', i !== tutorialStep);
    });

    // Scenes
    [1, 2, 3].forEach(i => {
        const scene = document.getElementById(`tut-scene-${i}`);
        if (scene) {
            if (i === tutorialStep) scene.classList.remove('hidden');
            else scene.classList.add('hidden');
        }
    });

    // Reset Animations
    if (tutorialInterval) clearInterval(tutorialInterval);

    // Start Scene Specific Animation
    if (tutorialStep === 1) startScene1Anim();
    else if (tutorialStep === 2) startScene2Anim();
    else if (tutorialStep === 3) startScene3Anim();
}

function startScene1Anim() {
    const scene = document.getElementById('tut-scene-1');
    if (!scene) return;

    let step = 0;
    const update = () => {
        scene.classList.remove('anim-swipe-right', 'anim-swipe-left', 'anim-swipe-up');
        const s = step % 3;
        if (s === 0) scene.classList.add('anim-swipe-right');
        else if (s === 1) scene.classList.add('anim-swipe-left');
        else scene.classList.add('anim-swipe-up');
        step++;
    };
    update();
    tutorialInterval = setInterval(update, 2000);
}

function startScene2Anim() {
    const scene = document.getElementById('tut-scene-2');
    if (!scene) return;
    scene.classList.add('anim-tap');
}

function startScene3Anim() {
    const scene = document.getElementById('tut-scene-3');
    if (!scene) return;
    scene.classList.add('anim-fly');
}

function closeTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.remove('active');
        if (tutorialInterval) clearInterval(tutorialInterval);
    }
}

/**
 * 同じ読みの自動引き継ぎ (Existing)
 */
function autoInheritSameReadings() {
    if (!segments || segments.length === 0) return;
    const readingCount = {};
    segments.forEach(seg => {
        readingCount[seg] = (readingCount[seg] || 0) + 1;
    });
    Object.keys(readingCount).forEach(reading => {
        if (readingCount[reading] >= 2) {
            const firstIndex = segments.indexOf(reading);
            if (firstIndex !== -1) {
                segments.autoInheritIndices = segments.autoInheritIndices || [];
                segments.forEach((seg, idx) => {
                    if (seg === reading && idx > firstIndex) {
                        segments.autoInheritIndices.push({ from: firstIndex, to: idx, reading: reading });
                    }
                });
            }
        }
    });
}

// Expose functions to global scope
window.startMode = startMode;
window.selectGender = selectGender;
window.submitVibe = submitVibe;
window.toggleVibe = toggleVibe;
window.processNickname = processNickname;
window.initFreeMode = initFreeMode;
window.toggleStockFree = toggleStockFree;
window.finishFreeMode = finishFreeMode;
window.runDiagnosis = runDiagnosis;
window.startSwiping = startSwiping;
window.setGender = setGender;
window.setRule = setRule;
window.goBack = goBack;
window.showTutorial = showTutorial;
window.closeTutorial = closeTutorial;
window.nextTutorialStep = nextTutorialStep;
window.processNickname = processNickname;
window.universalSwipeAction = universalSwipeAction;
window.undoUniversalSwipe = undoUniversalSwipe;
window.showUniversalList = showUniversalList;
window.submitUniversalSelection = submitUniversalSelection;
window.resetUniversalSwipe = resetUniversalSwipe;
window.continueUniversalSwipe = continueUniversalSwipe;
window.closeUniversalList = closeUniversalList;
window.startUniversalSwipe = startUniversalSwipe; // debug

// CLEANUP EXPORTS
window.nicknameSwipeAction = null; // Removed
window.kanjiSwipeAction = null; // Removed

console.log("UI_FLOW: Module loaded (Phase 4: Universal Swipe & Multi-Select)");
