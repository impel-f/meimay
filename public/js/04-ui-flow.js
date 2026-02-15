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
    } else if (id === 'scr-vibe') {
        if (appMode === 'free') {
            changeScreen('scr-gender');
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
        if (appMode === 'nickname') changeScreen('scr-input-nickname');
        else changeScreen('scr-input-reading');
    }
}

/**
 * ニックネーム処理
 */
function processNickname() {
    const el = document.getElementById('in-nickname');
    let val = el.value.trim();

    if (!val) {
        alert('ニックネームを入力してください');
        return;
    }

    // ちゃん、くん、さん 等を除去
    val = val.replace(/(ちゃん|くん|さん|たん|りん)$/g, '');

    // ひらがな化
    val = toHira(val);

    if (!val) {
        alert('読みが正しく判定できませんでした');
        return;
    }

    // 入力欄にセットして計算へ (scr-input-readingのinputを利用)
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = val;

    // 直接計算へ
    calcSegments();
}

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
function showTutorial() {
    // 既に表示済みならスキップ
    if (localStorage.getItem('meimay_tutorial_shown')) return;

    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.add('active');
        localStorage.setItem('meimay_tutorial_shown', 'true');
    }
}

function closeTutorial() {
    const modal = document.getElementById('modal-tutorial');
    if (modal) {
        modal.classList.remove('active');
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

console.log("UI_FLOW: Module loaded (Wizard Edition + Tutorial)");
