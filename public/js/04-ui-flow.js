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
 * モード開始（性別はウィザードで設定済みなのでスキップ）
 */
function startMode(mode) {
    console.log(`UI_FLOW: Start mode ${mode}`);
    appMode = mode;

    // 診断モードの場合はイメージ等は不要
    if (mode === 'diagnosis') {
        // 名字を自動入力（ウィザードで設定済み）
        const diagSurnameInput = document.getElementById('diag-surname');
        if (diagSurnameInput && surnameStr) {
            diagSurnameInput.value = surnameStr;
        }
        changeScreen('scr-diagnosis-input');
        return;
    }

    // 性別はウィザードで設定済みなので、直接各モードの入力画面へ
    if (mode === 'free') {
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (mode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else if (mode === 'sound') {
        initSoundMode();
    } else {
        // reading mode
        changeScreen('scr-input-reading');
    }
}

/**
 * 性別選択（ウィザードから設定済みだが互換性のため残す）
 */
function selectGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender selected ${g}`);

    // ウィザードで既に設定済みなので、startModeと同じルーティング
    if (appMode === 'free') {
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else if (appMode === 'sound') {
        initSoundMode();
    } else {
        changeScreen('scr-input-reading');
    }
}

/**
 * 性別設定（グローバル）
 */
function setGender(g) {
    gender = g;
    console.log(`UI_FLOW: Gender set to ${g}`);
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
 * 苗字はウィザードで設定済みなのでスキップ
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
        initFreeMode(); // startUniversalSwipe内でscr-swipe-universalに遷移する
    } else {
        // 苗字はウィザードで設定済みなので直接スワイプ開始
        startSwiping();
    }
}

/**
 * 響きから選ぶモード（Sound Mode）
 * 人気の名前読みをスワイプして、気に入った響きから漢字を選ぶ
 */
function initSoundMode() {
    console.log("UI_FLOW: initSoundMode");

    const popularNames = generatePopularNames(gender);

    startUniversalSwipe('sound', popularNames, {
        title: '響きで選ぶ',
        subtitle: '気に入った名前の響きをスワイプ',
        disableSuper: true,
        renderCard: (item) => {
            return `
                <div class="text-xs font-bold text-[#bca37f] mb-3 tracking-widest uppercase opacity-70">
                    ${item.charCount}文字 / ${item.type}
                </div>
                <div class="text-4xl font-black text-[#5d5444] mb-4 tracking-wider leading-tight" style="word-break:keep-all;overflow-wrap:break-word;">${item.reading}</div>
                <div class="text-xs text-[#a6967a] mb-4 px-4 text-center leading-relaxed">${item.desc || ''}</div>
                <div class="w-full px-4">
                    <div class="bg-[#fdfaf5] rounded-2xl p-3 border border-[#f5efe4]">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                        <div class="flex justify-center flex-wrap gap-1.5 text-[#5d5444] font-bold text-base">
                            ${item.examples ? item.examples.map(e => `<span class="px-1">${e}</span>`).join('') : '?'}
                        </div>
                    </div>
                </div>
            `;
        },
        onNext: (selectedItems) => {
            if (selectedItems.length === 0) return;

            if (selectedItems.length === 1) {
                proceedWithSoundReading(selectedItems[0].reading);
            } else {
                showNicknameReadingSelection(selectedItems.map(item => ({
                    reading: item.reading,
                    type: 'sound'
                })));
            }
        }
    });

    // AI分析ボタンをスワイプ画面に追加
    setTimeout(() => {
        const swipeScreen = document.getElementById('scr-swipe-universal');
        if (swipeScreen && !document.getElementById('btn-ai-sound-analyze')) {
            const aiBtn = document.createElement('button');
            aiBtn.id = 'btn-ai-sound-analyze';
            aiBtn.className = 'fixed bottom-20 right-4 z-[200] bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 hover:shadow-xl transition-all active:scale-95';
            aiBtn.innerHTML = '🤖 AI分析';
            aiBtn.onclick = aiAnalyzeSoundPreferences;
            swipeScreen.appendChild(aiBtn);
        }
    }, 500);
}

/**
 * 人気名前リスト生成
 */
function generatePopularNames(gender) {
    const maleNames = [
        { reading: 'はると', charCount: 3, type: '定番', examples: ['陽翔', '大翔', '遥斗'], desc: '爽やかで力強い響き' },
        { reading: 'みなと', charCount: 3, type: '定番', examples: ['湊', '港翔', '南斗'], desc: '海を感じる涼やかな響き' },
        { reading: 'そうた', charCount: 3, type: '定番', examples: ['蒼太', '颯太', '壮太'], desc: '元気で活発な響き' },
        { reading: 'ゆうと', charCount: 3, type: '定番', examples: ['悠斗', '優翔', '悠人'], desc: '穏やかで優しい響き' },
        { reading: 'りく', charCount: 2, type: '人気', examples: ['陸', '理久', '凛空'], desc: '大地のような力強さ' },
        { reading: 'あおい', charCount: 3, type: '人気', examples: ['蒼', '葵', '碧'], desc: '澄んだ空のような清らかさ' },
        { reading: 'れん', charCount: 2, type: '人気', examples: ['蓮', '廉', '煉'], desc: 'すっきりした響き' },
        { reading: 'ひなた', charCount: 3, type: '人気', examples: ['陽向', '陽太', '日向'], desc: '温かみのある響き' },
        { reading: 'かいと', charCount: 3, type: '人気', examples: ['海翔', '快斗', '凱斗'], desc: '海のように広い心' },
        { reading: 'いつき', charCount: 3, type: '人気', examples: ['樹', '一輝', '逸樹'], desc: '大きく育つ樹のよう' },
        { reading: 'そうすけ', charCount: 4, type: '古風', examples: ['蒼介', '壮介', '颯介'], desc: '頼もしい古風な響き' },
        { reading: 'こうき', charCount: 3, type: '人気', examples: ['煌稀', '光希', '晃輝'], desc: '輝く未来を感じる響き' },
        { reading: 'はるき', charCount: 3, type: '人気', examples: ['春樹', '陽樹', '遥希'], desc: '春のような爽やかさ' },
        { reading: 'ゆうま', charCount: 3, type: '人気', examples: ['悠真', '優馬', '悠麻'], desc: 'おおらかで真っ直ぐ' },
        { reading: 'あきと', charCount: 3, type: '人気', examples: ['暁斗', '明人', '秋翔'], desc: '明るく知的な響き' },
        { reading: 'たくみ', charCount: 3, type: '定番', examples: ['匠', '拓海', '巧'], desc: '職人のような器用さ' },
        { reading: 'けんと', charCount: 3, type: '定番', examples: ['健人', '賢斗', '謙翔'], desc: '健やかで強い' },
        { reading: 'りょうた', charCount: 4, type: '古風', examples: ['涼太', '遼太', '亮太'], desc: '明快で男らしい響き' },
        { reading: 'しょうた', charCount: 4, type: '定番', examples: ['翔太', '翔大', '将太'], desc: '大きく翔ける' },
        { reading: 'だいち', charCount: 3, type: '人気', examples: ['大地', '大智', '大馳'], desc: '大地のようにどっしり' },
    ];

    const femaleNames = [
        { reading: 'ひまり', charCount: 3, type: '定番', examples: ['陽葵', '日葵', '向日葵'], desc: 'ひまわりのような明るさ' },
        { reading: 'えま', charCount: 2, type: '人気', examples: ['愛麻', '恵茉', '笑愛'], desc: '愛らしい響き' },
        { reading: 'みお', charCount: 2, type: '人気', examples: ['澪', '美緒', '未央'], desc: '清らかで品のある響き' },
        { reading: 'さくら', charCount: 3, type: '定番', examples: ['桜', '咲良', '咲桜'], desc: '日本を代表する美しい響き' },
        { reading: 'あかり', charCount: 3, type: '人気', examples: ['朱莉', '明里', '灯'], desc: '光のような温かさ' },
        { reading: 'いちか', charCount: 3, type: '人気', examples: ['一花', '一華', '苺花'], desc: '唯一無二の美しさ' },
        { reading: 'ゆい', charCount: 2, type: '定番', examples: ['結', '結衣', '唯'], desc: '人と人を結ぶ響き' },
        { reading: 'めい', charCount: 2, type: '人気', examples: ['芽依', '明衣', '命'], desc: '明るく可憐な響き' },
        { reading: 'はな', charCount: 2, type: '定番', examples: ['花', '華', '葉菜'], desc: '花のように美しく' },
        { reading: 'こはる', charCount: 3, type: '人気', examples: ['小春', '心晴', '琥春'], desc: '小さな春のような温もり' },
        { reading: 'りん', charCount: 2, type: '人気', examples: ['凛', '琳', '倫'], desc: '凛とした美しさ' },
        { reading: 'つむぎ', charCount: 3, type: '人気', examples: ['紬', '紡'], desc: '丁寧に紡ぐ人生' },
        { reading: 'ほのか', charCount: 3, type: '人気', examples: ['ほのか', '穂花', '帆乃花'], desc: 'ほのかに香る上品さ' },
        { reading: 'あおい', charCount: 3, type: '人気', examples: ['葵', '碧', '蒼'], desc: '澄み渡る空のように' },
        { reading: 'かんな', charCount: 3, type: '人気', examples: ['栞奈', '柑那', '寛菜'], desc: '和の美しさ' },
        { reading: 'しおり', charCount: 3, type: '定番', examples: ['栞', '詩織', '志織'], desc: '知的で上品な響き' },
        { reading: 'ゆな', charCount: 2, type: '人気', examples: ['結菜', '由奈', '優菜'], desc: '優しく柔らかな響き' },
        { reading: 'みゆ', charCount: 2, type: '人気', examples: ['美結', '未優', '心結'], desc: '美しく結ばれる' },
        { reading: 'かほ', charCount: 2, type: '人気', examples: ['花歩', '夏穂', '佳帆'], desc: '花のような穏やかさ' },
        { reading: 'ことは', charCount: 3, type: '人気', examples: ['琴葉', '言葉', '琴羽'], desc: '琴の音のような美しさ' },
    ];

    const neutralNames = [...maleNames.slice(0, 10), ...femaleNames.slice(0, 10)];

    let nameList;
    if (gender === 'male') nameList = maleNames;
    else if (gender === 'female') nameList = femaleNames;
    else nameList = neutralNames;

    // シャッフル（ただしスコアベースでやや偏りを持たせる）
    for (let i = nameList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nameList[i], nameList[j]] = [nameList[j], nameList[i]];
    }

    return nameList;
}

function proceedWithSoundReading(reading) {
    console.log("Sound mode: Proceeding with reading", reading);
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;
    calcSegments();
}

/**
 * 戻るボタン処理（性別・苗字画面はスキップ済み）
 */
function goBack() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    const id = active.id;

    if (id === 'scr-gender') {
        changeScreen('scr-mode');
    } else if (id === 'scr-input-reading' || id === 'scr-input-nickname') {
        changeScreen('scr-mode');
    } else if (id === 'scr-nickname-swipe') {
        changeScreen('scr-input-nickname');
    } else if (id === 'scr-tomeji-selection') {
        document.getElementById('nickname-liked-list').classList.remove('hidden');
        changeScreen('scr-nickname-swipe');
    } else if (id === 'scr-vibe') {
        if (appMode === 'free') {
            changeScreen('scr-mode');
        } else {
            changeScreen('scr-segment');
        }
    } else if (id === 'scr-free-mode') {
        changeScreen('scr-vibe');
    } else if (id === 'scr-diagnosis-input') {
        changeScreen('scr-mode');
    } else if (id === 'scr-segment') {
        changeScreen('scr-input-reading');
    } else if (id === 'scr-saved' || id === 'scr-history') {
        changeScreen('scr-mode');
    } else if (id === 'scr-swipe-universal') {
        // スワイプ画面からの戻り：モードに応じて分岐
        if (appMode === 'sound') {
            changeScreen('scr-mode');
        } else if (appMode === 'free') {
            changeScreen('scr-vibe');
        } else if (appMode === 'nickname') {
            changeScreen('scr-input-nickname');
        } else {
            changeScreen('scr-mode');
        }
        // AIボタンをクリーンアップ
        const aiBtn = document.getElementById('btn-ai-sound-analyze');
        if (aiBtn) aiBtn.remove();
        const aiFreeBtn = document.getElementById('btn-ai-free-learn');
        if (aiFreeBtn) aiFreeBtn.remove();
    } else if (id === 'scr-kanji-search' || id === 'scr-akinator') {
        changeScreen('scr-mode');
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

    // Step 1: 読み方をスワイプで選ぶ（複数OK）
    startUniversalSwipe('nickname', candidates, {
        title: '響きをひろげる',
        subtitle: `「${nicknameBaseReading}」をベースにした候補`,
        disableSuper: true,
        renderCard: (item) => {
            return `
                <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
                    ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
                </div>
                <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
                <div class="text-xs text-[#a6967a] px-4 text-center leading-relaxed">
                    ${item.type === 'original' ? 'そのままの読み' : (item.type === 'prefix' ? '後ろに続く候補' : '読みを広げた候補')}
                </div>
            `;
        },
        onNext: (selectedItems) => {
            selectedNicknames = selectedItems;
            console.log("Nickname: Selected readings", selectedItems.map(i => i.reading));

            if (selectedItems.length === 0) return;

            // 全て読みストックに追加 → 読みストック画面へ
            selectedItems.forEach(item => {
                addReadingToStock(item.reading, nicknameBaseReading);
            });

            showToast(`${selectedItems.length}件の読みを読みストックに保存しました`);
            if (typeof openStock === 'function') openStock('reading');
        }
    });
}

/**
 * ニックネーム：複数読みの選択画面（1つ選んで残りはストックへ）
 */
function showNicknameReadingSelectionWithStock(items) {
    const container = document.getElementById('uni-candidates-grid');
    const list = document.getElementById('uni-liked-list');
    if (!container || !list) return;

    container.innerHTML = '';

    const title = document.getElementById('uni-list-title');
    const desc = document.getElementById('uni-list-desc');
    if (title) title.innerText = '1つ選んでください';
    if (desc) desc.innerText = '選んだ読みの漢字を探します。残りは読みストックに保存されます。';

    items.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'bg-[#fdfaf5] border-2 border-[#bca37f] rounded-xl p-4 text-center cursor-pointer hover:bg-white transition-all active:scale-95';
        btn.innerHTML = `<div class="text-xl font-black text-[#5d5444]">${item.reading}</div>`;
        btn.onclick = () => {
            list.classList.add('hidden');
            // 選ばれなかったものをストックに追加
            const others = items.filter(i => i.reading !== item.reading);
            others.forEach(o => addReadingToStock(o.reading));
            if (others.length > 0) {
                showToast(`${others.length}件の読みをストックに保存しました`);
            }
            // 選んだ1つで漢字探しへ
            proceedWithNicknameReading(item.reading);
        };
        container.appendChild(btn);
    });

    list.classList.remove('hidden');
}

/**
 * showNicknameReadingSelection (互換性維持)
 */
function showNicknameReadingSelection(items) {
    showNicknameReadingSelectionWithStock(items);
}

/**
 * ニックネーム：選んだ読みで通常スワイプフローに合流
 */
function proceedWithNicknameReading(reading) {
    console.log("Nickname: Proceeding with reading", reading);

    // 読みをin-nameに設定
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = reading;

    // 分割計算
    calcSegments();

    // イメージ選択に遷移（calcSegmentsがscr-segmentに遷移する）
    // その後のフローは通常のreading modeと同じ
}


/**
 * START SWIPE
 */
function startUniversalSwipe(mode, candidates, configOverride = {}) {
    console.log(`SWIPE: Starting mode ${mode} with ${candidates.length} items`);

    // AIボタンのクリーンアップ（前のモードから残っている場合）
    const aiSoundBtn = document.getElementById('btn-ai-sound-analyze');
    if (aiSoundBtn) aiSoundBtn.remove();
    const aiFreeBtn = document.getElementById('btn-ai-free-learn');
    if (aiFreeBtn) aiFreeBtn.remove();

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

    // スーパーライクボタンの表示/非表示
    const superBtn = document.querySelector('#scr-swipe-universal button[onclick="universalSwipeAction(\'super\')"]');
    if (superBtn) {
        superBtn.style.display = configOverride.disableSuper ? 'none' : '';
    }

    renderUniversalCard();
}

let selectedNicknames = [];
let selectedBaseKanjis = [];

/**
 * BASE KANJI SWIPE (Step 2)
 */
// REMOVED startBaseKanjiSwipe
// REMOVED startTomejiSwipe


// REMOVED buildAndShowResults

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

    // disableSuper対応
    if (action === 'super' && SwipeState.config.disableSuper) {
        action = 'like';
    }

    // Update data
    const item = SwipeState.candidates[SwipeState.currentIndex];

    if (action === 'like' || action === 'super') {
        if (action === 'super') item.isSuper = true;
        SwipeState.liked.push(item);
        // onLikeコールバック（自由モード等で即座にストックに追加）
        if (SwipeState.config.onLike) {
            SwipeState.config.onLike(item);
        }
    }

    // AI: 好みの音パターン学習（nickname / sound モード共通）
    if (SwipeState.mode === 'nickname' || SwipeState.mode === 'sound') {
        learnSoundPreference(item, action);
    }

    SwipeState.history.push({ action: action, item: item });

    // 10スワイプごとにチェック
    if (SwipeState.history.length > 0 && SwipeState.history.length % 10 === 0) {
        showUniversalSwipeCheckpoint();
    }

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
        grid.innerHTML = '<div class="text-center text-sm text-[#a6967a] py-6">候補がまだありません</div>';
        list.classList.remove('hidden');
        return;
    }

    // 読み/漢字キーで重複排除（最初に出現したものを残す）
    const seenKeys = new Set();
    const unique = [];
    SwipeState.liked.forEach(item => {
        const key = item['漢字'] || item.reading;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            unique.push(item);
        }
    });

    // タイトル更新
    const title = document.getElementById('uni-list-title');
    const desc = document.getElementById('uni-list-desc');
    if (title) title.innerText = `候補リスト（${unique.length}件）`;
    if (desc) desc.innerText = 'チェックを外すと候補から除外されます';

    unique.forEach((item, idx) => {
        const label = item['漢字'] || item.reading;

        const btn = document.createElement('div');
        btn.className = 'bg-[#fdfaf5] border border-[#ede5d8] rounded-xl p-3 flex items-center justify-between';

        const text = document.createElement('span');
        text.className = 'text-xl font-bold text-[#5d5444]';
        text.innerText = label;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'w-6 h-6 accent-[#8b7e66] flex-shrink-0';
        chk.checked = true;
        chk.onchange = (e) => {
            item._selected = e.target.checked;
            btn.style.opacity = e.target.checked ? '1' : '0.4';
        };
        item._selected = true;

        btn.appendChild(text);
        btn.appendChild(chk);
        grid.appendChild(btn);
    });

    list.classList.remove('hidden');
}

function submitUniversalSelection() {
    // 重複排除後のユニークリストからチェック済みのみ取得
    const seenKeys = new Set();
    const unique = [];
    SwipeState.liked.forEach(item => {
        const key = item['漢字'] || item.reading;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            unique.push(item);
        }
    });
    const selected = unique.filter(i => i._selected);

    if (selected.length === 0) {
        alert("少なくとも1つ選んでください");
        return;
    }

    // SwipeState.likedも同期（未チェックは除外）
    SwipeState.liked = selected;

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

    card.innerHTML = `
        <div class="text-xs font-bold text-[#bca37f] mb-6 tracking-widest uppercase opacity-70">
            ${item.type === 'original' ? 'Original' : (item.type === 'prefix' ? 'Suffix Match' : 'Expansion')}
        </div>
        <div class="text-5xl font-black text-[#5d5444] mb-8 tracking-wider">${item.reading}</div>
        <div class="text-xs text-[#a6967a] px-4 text-center leading-relaxed">
            ${item.type === 'original' ? 'そのままの読み' : (item.type === 'prefix' ? '後ろに続く候補' : '読みを広げた候補')}
        </div>
    `;
    container.appendChild(card);
    initNicknameCardEvents(card);
}

// ==========================================
// LEGACY CODE REMOVED (Universal Config Applied)
// ==========================================


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
 * 自由選択モード初期化（読みモードと同じスワイプロジック使用）
 */
let freeAIRound = 0;

function initFreeMode() {
    if (!master || master.length === 0) return;

    // フィルタリング
    let list = master.filter(k => {
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return false;
        return true;
    });

    // イメージタグフィルター
    if (typeof applyImageTagFilter === 'function') {
        list = applyImageTagFilter(list);
    }

    // スコア計算＆ソート
    if (typeof calculateKanjiScore === 'function') {
        list.forEach(k => k.score = calculateKanjiScore(k));
        list.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    // 既にストック済みは除外
    list = list.filter(k => !liked.some(l => l['漢字'] === k['漢字']));

    // ユニバーサルスワイプ形式に変換
    const swipeItems = list.slice(0, 100).map(k => ({
        ...k,
        reading: k['漢字'],
        id: k['漢字'],
        _kanjiData: k
    }));

    freeAIRound = 0;

    startUniversalSwipe('free', swipeItems, {
        title: '自由に選ぶ',
        subtitle: '気に入った漢字をスワイプ',
        renderCard: (item) => {
            const data = item._kanjiData || item;
            const meaning = clean(data['意味']);
            const shortMeaning = meaning.length > 50 ? meaning.substring(0, 50) + '...' : meaning;
            const unifiedTags = getUnifiedTags((data['名前のイメージ'] || '') + ',' + (data['分類'] || ''));
            const readings = [data['音'], data['訓'], data['伝統名のり']]
                .filter(x => clean(x))
                .join(',')
                .split(/[、,，\s/]+/)
                .filter(x => clean(x))
                .slice(0, 4);

            return `
                <div class="flex gap-2 mb-2 flex-wrap justify-center">
                    ${unifiedTags.map(t => `<span class="px-3 py-1 bg-white/80 text-[#8b7e66] rounded-full text-xs font-bold">#${t}</span>`).join(' ')}
                </div>
                <div class="text-[80px] font-black text-[#5d5444] leading-none mb-2">${data['漢字']}</div>
                <div class="text-[#bca37f] font-black text-lg mb-2">${data['画数']}画</div>
                <div class="flex gap-2 mb-3 flex-wrap justify-center">
                    ${readings.map(r => `<span class="px-2 py-1 bg-white/60 rounded-lg text-xs font-bold text-[#7a6f5a]">${r}</span>`).join(' ')}
                </div>
                <div class="w-full max-w-xs bg-white/70 rounded-2xl px-3 py-2 shadow-sm">
                    <p class="text-xs leading-relaxed text-[#7a6f5a] text-center line-clamp-2">${shortMeaning || '意味情報なし'}</p>
                </div>
            `;
        },
        onLike: (item) => {
            const data = item._kanjiData || item;
            const existing = liked.find(l => l['漢字'] === data['漢字']);
            if (!existing) {
                liked.push({ ...data, slot: -1, sessionReading: 'FREE' });
                if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
            }
        },
        onNext: (selectedItems) => {
            // 自由組み立て画面へ
            changeScreen('scr-build');
            renderFreeBuild();
        }
    });

    // AI学習ボタンを追加
    setTimeout(() => {
        const swipeScreen = document.getElementById('scr-swipe-universal');
        if (swipeScreen && !document.getElementById('btn-ai-free-learn')) {
            const aiBtn = document.createElement('button');
            aiBtn.id = 'btn-ai-free-learn';
            aiBtn.className = 'fixed bottom-20 right-4 z-[200] bg-gradient-to-r from-[#bca37f] to-[#8b7e66] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 hover:shadow-xl transition-all active:scale-95';
            aiBtn.innerHTML = '🤖 AI提案';
            aiBtn.onclick = aiSuggestFreeKanji;
            swipeScreen.appendChild(aiBtn);
        }
    }, 500);
}

function finishFreeMode() {
    const freeItems = liked.filter(l => l.sessionReading === 'FREE');
    if (freeItems.length === 0) {
        if (!confirm('漢字が選択されていませんが、進みますか？')) return;
    }
    changeScreen('scr-build');
    renderFreeBuild();
}

/**
 * 自由組み立てビルド画面
 */
function renderFreeBuild() {
    const container = document.getElementById('build-selection');
    if (!container) return;

    const freeItems = liked.filter(l => l.sessionReading === 'FREE');

    container.innerHTML = `
        <div class="mb-6">
            <p class="text-sm text-[#7a6f5a] mb-4 text-center">ストックした漢字を自由に組み合わせて名前を作れます。<br>タップして順番に選んでください。</p>
            <div class="flex flex-wrap gap-3 justify-center mb-6" id="free-build-pool">
                ${freeItems.map(item => `
                    <button onclick="toggleFreeBuildPiece('${item['漢字']}')"
                            class="free-build-btn w-16 h-16 bg-white rounded-xl border-2 border-[#eee5d8] flex flex-col items-center justify-center hover:border-[#bca37f] transition-all active:scale-95"
                            data-kanji="${item['漢字']}">
                        <span class="text-2xl font-black text-[#5d5444]">${item['漢字']}</span>
                        <span class="text-[8px] text-[#a6967a]">${item['画数']}画</span>
                    </button>
                `).join('')}
            </div>

            <div class="text-center mb-4">
                <p class="text-xs text-[#a6967a] mb-2">選んだ順：</p>
                <div id="free-build-preview" class="text-4xl font-black text-[#5d5444] min-h-[48px] tracking-wider">
                    ─
                </div>
            </div>

            <div class="flex gap-3 justify-center">
                <button onclick="clearFreeBuild()" class="px-6 py-3 border border-[#d4c5af] rounded-2xl text-sm text-[#a6967a] hover:bg-[#fdfaf5]">クリア</button>
                <button onclick="executeFreeBuild()" class="px-8 py-3 bg-[#bca37f] text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg">この名前で決定</button>
            </div>
        </div>
    `;
}

let freeBuildOrder = [];

function toggleFreeBuildPiece(kanji) {
    const idx = freeBuildOrder.indexOf(kanji);
    if (idx > -1) {
        freeBuildOrder.splice(idx, 1);
    } else {
        freeBuildOrder.push(kanji);
    }
    updateFreeBuildPreview();
}

function updateFreeBuildPreview() {
    const preview = document.getElementById('free-build-preview');
    if (preview) {
        preview.innerText = freeBuildOrder.length > 0 ? freeBuildOrder.join('') : '─';
    }

    // ボタンのスタイル更新
    document.querySelectorAll('.free-build-btn').forEach(btn => {
        const k = btn.getAttribute('data-kanji');
        const order = freeBuildOrder.indexOf(k);
        if (order > -1) {
            btn.classList.add('border-[#bca37f]', 'bg-[#fffbeb]');
            btn.classList.remove('border-[#eee5d8]', 'bg-white');
        } else {
            btn.classList.remove('border-[#bca37f]', 'bg-[#fffbeb]');
            btn.classList.add('border-[#eee5d8]', 'bg-white');
        }
    });
}

function clearFreeBuild() {
    freeBuildOrder = [];
    updateFreeBuildPreview();
}

function executeFreeBuild() {
    if (freeBuildOrder.length === 0) {
        alert('漢字を1つ以上選んでください');
        return;
    }

    const givenName = freeBuildOrder.join('');

    // ビルド結果を生成
    const pieces = freeBuildOrder.map(k => {
        const found = master.find(m => m['漢字'] === k);
        return found || { '漢字': k, '画数': 0 };
    });

    const givArr = pieces.map(p => ({
        kanji: p['漢字'],
        strokes: parseInt(p['画数']) || 0
    }));

    let fortune = null;
    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
        const surArr = surnameData && surnameData.length > 0 ? surnameData : [{ kanji: '', strokes: 1 }];
        fortune = FortuneLogic.calculate(surArr, givArr);
    }

    currentBuildResult = {
        fullName: surnameStr + givenName,
        reading: '',
        fortune: fortune,
        combination: pieces,
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    // segments は使わないのでダミーを設定
    segments = freeBuildOrder;

    renderBuildResult();
}

function runDiagnosis() {
    const surnameInput = document.getElementById('diag-surname');
    const nameInput = document.getElementById('diag-name');

    const surname = surnameInput ? surnameInput.value.trim() : '';
    const givenName = nameInput ? nameInput.value.trim() : '';

    if (!givenName) {
        alert('名前（漢字）を入力してください');
        return;
    }

    // 名字の画数データを構築
    const surChars = surname.split('');
    const surArr = surChars.map(c => {
        const found = master.find(k => k['漢字'] === c);
        return {
            kanji: c,
            strokes: found ? (parseInt(found['画数']) || 0) : 0
        };
    });

    // 名前の画数データを構築
    const givChars = givenName.split('');
    const givArr = givChars.map(c => {
        const found = master.find(k => k['漢字'] === c);
        return {
            kanji: c,
            strokes: found ? (parseInt(found['画数']) || 0) : 0
        };
    });

    // 画数が取得できないものがあれば警告
    const unknownSur = surArr.filter(s => s.strokes === 0 && s.kanji);
    const unknownGiv = givArr.filter(g => g.strokes === 0);
    if (unknownGiv.length > 0) {
        const unknownChars = [...unknownSur, ...unknownGiv].filter(x => x.strokes === 0).map(x => x.kanji);
        if (unknownChars.length > 0) {
            alert(`以下の文字の画数データが見つかりません：${unknownChars.join('、')}\n正確な診断ができない可能性があります。`);
        }
    }

    if (typeof FortuneLogic === 'undefined' || !FortuneLogic.calculate) {
        alert('姓名判断モジュールが読み込まれていません');
        return;
    }

    // 仮の名字がない場合
    if (surArr.length === 0) {
        surArr.push({ kanji: '', strokes: 0 });
    }

    const fortune = FortuneLogic.calculate(surArr, givArr);
    if (!fortune) {
        alert('診断結果を計算できませんでした');
        return;
    }

    // ビルド結果に格納して表示
    surnameStr = surname;
    surnameData = surArr;
    currentBuildResult = {
        fullName: surname + givenName,
        reading: '',
        fortune: fortune,
        combination: givArr.map(g => {
            const found = master.find(k => k['漢字'] === g.kanji);
            return found || { '漢字': g.kanji, '画数': g.strokes };
        }),
        givenName: givenName,
        timestamp: new Date().toISOString()
    };

    // 姓名判断詳細モーダルを表示
    if (typeof showFortuneDetail === 'function') {
        showFortuneDetail();
    }
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

// ==========================================
// 読み方引き継ぎフロー
// ==========================================

/**
 * 同じ読み方スロットにストック済み漢字がある候補を探す
 */
function findInheritCandidates() {
    if (!segments || segments.length === 0) return [];

    const currentReading = segments.join('');
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    const candidates = [];

    segments.forEach((seg, slotIdx) => {
        const inheritItems = liked.filter(item => {
            if (!item.sessionReading || item.sessionReading === currentReading) return false;
            if (item.sessionReading === 'FREE' || item.sessionReading === 'SEARCH') return false;
            if (item.slot !== slotIdx) return false;
            const itemSegs = readingToSegments[item.sessionReading];
            if (!itemSegs) return false;
            return itemSegs[slotIdx] === seg;
        });

        // 現セッションにまだない漢字のみ
        const newItems = inheritItems.filter(item =>
            !liked.some(l =>
                l['漢字'] === item['漢字'] &&
                l.slot === slotIdx &&
                l.sessionReading === currentReading
            )
        );

        if (newItems.length > 0) {
            candidates.push({ slot: slotIdx, segReading: seg, items: newItems });
        }
    });

    return candidates;
}

/**
 * 引き継ぎ候補を liked[] に追加
 */
function doInheritKanji(candidates) {
    const currentReading = segments.join('');
    candidates.forEach(c => {
        c.items.forEach(item => {
            const exists = liked.some(l =>
                l['漢字'] === item['漢字'] &&
                l.slot === c.slot &&
                l.sessionReading === currentReading
            );
            if (!exists) {
                liked.push({ ...item, slot: c.slot, sessionReading: currentReading });
            }
        });
    });
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }
}

let _inheritCallback = null;

/**
 * 引き継ぎモーダルのボタンアクション（HTML onclick から呼ばれる）
 */
function inheritModalAction(action) {
    const modal = document.getElementById('modal-inherit');
    if (modal) modal.classList.remove('active');
    if (_inheritCallback) {
        const cb = _inheritCallback;
        _inheritCallback = null;
        cb(action);
    }
}

/**
 * 引き継ぎ確認モーダルを表示
 */
function showInheritModal(segReading, kanjiList, callback) {
    const modal = document.getElementById('modal-inherit');
    if (!modal) { callback('skip'); return; }

    const title = document.getElementById('inherit-modal-title');
    const body = document.getElementById('inherit-modal-body');

    if (title) title.textContent = `「${segReading}」の漢字`;
    if (body) body.innerHTML =
        `<span class="font-bold text-[#bca37f] text-lg">${kanjiList}</span><br><br>` +
        `がすでにストックされています。<br>追加で選びますか？`;

    _inheritCallback = callback;
    modal.classList.add('active');
}

/**
 * 引き継ぎ候補をモーダルで順番に確認し、完了後に onDone(startPos) を呼ぶ
 */
function processInheritCandidates(candidates, index, answers, onDone) {
    if (index >= candidates.length) {
        // 全候補を引き継ぎ
        doInheritKanji(candidates);

        // "追加で選ぶ" が最初にあったスロットを開始位置にする
        const addIdx = answers.findIndex(a => a === 'add');
        if (addIdx >= 0) {
            onDone(candidates[addIdx].slot);
        } else {
            // 全スキップ → 引き継いでいないスロットから開始
            const inheritedSlots = new Set(candidates.map(c => c.slot));
            let startPos = 0;
            while (inheritedSlots.has(startPos) && startPos < segments.length) {
                startPos++;
            }
            if (startPos >= segments.length) {
                // 全スロット引き継ぎ済み → ビルド画面へ
                showToast('全ての漢字を引き継ぎました');
                if (typeof openBuild === 'function') openBuild();
            } else {
                onDone(startPos);
            }
        }
        return;
    }

    const c = candidates[index];
    const kanjiList = [...new Set(c.items.map(i => i['漢字']))].join('・');
    showInheritModal(c.segReading, kanjiList, (action) => {
        answers.push(action);
        processInheritCandidates(candidates, index + 1, answers, onDone);
    });
}

// autoInheritSameReadings は processInheritCandidates に統合済み（互換用空定義）
function autoInheritSameReadings() { }

/**
 * スワイプモード開始 (Existing, modified)
 */
function startSwiping() {
    console.log("UI_FLOW: Starting swipe mode");

    if (typeof updateSurnameData === 'function') {
        updateSurnameData();
    }

    currentPos = 0;
    swipes = 0;
    seen.clear();

    const candidates = findInheritCandidates();

    function beginSwiping(startPos) {
        currentPos = startPos;
        if (typeof loadStack === 'function') loadStack();
        changeScreen('scr-main');
        setTimeout(() => showTutorial(), 500);
    }

    if (candidates.length > 0) {
        processInheritCandidates(candidates, 0, [], beginSwiping);
    } else {
        beginSwiping(0);
    }
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

// ==========================================
// 読みストック機能（ニックネーム元グルーピング対応）
// ==========================================

const READING_STOCK_KEY = 'meimay_reading_stock';

function getReadingStock() {
    try {
        const data = localStorage.getItem(READING_STOCK_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveReadingStock(stock) {
    try {
        localStorage.setItem(READING_STOCK_KEY, JSON.stringify(stock));
    } catch (e) {
        console.error("STOCK: Failed to save reading stock", e);
    }
}

function addReadingToStock(reading, baseNickname) {
    const stock = getReadingStock();
    if (!stock.some(s => s.reading === reading)) {
        stock.push({
            reading: reading,
            baseNickname: baseNickname || nicknameBaseReading || '',
            addedAt: new Date().toISOString()
        });
        saveReadingStock(stock);
        console.log("STOCK: Added reading to stock:", reading, "from:", baseNickname);
    }
}

function removeReadingFromStock(reading) {
    let stock = getReadingStock();
    stock = stock.filter(s => s.reading !== reading);
    saveReadingStock(stock);
    console.log("STOCK: Removed reading from stock:", reading);
}

function removeCompletedReadingFromStock(reading) {
    if (!confirm(`「${reading}」のストックと、この読みで選んだ全ての漢字を削除しますか？`)) return;

    // 1. liked[] から関連する漢字を削除
    const beforeCount = liked.length;
    liked = liked.filter(item => item.sessionReading !== reading);
    const afterCount = liked.length;

    // 2. pending stock からも削除 (あれば)
    removeReadingFromStock(reading);

    // 3. 保存
    if (typeof StorageBox !== 'undefined') StorageBox.saveAll();

    // 4. クラウド同期
    if (typeof MeimaySync !== 'undefined') MeimaySync.uploadData();

    console.log(`STOCK: Removed completed reading "${reading}". Liked items: ${beforeCount} -> ${afterCount}`);
    showToast(`「${reading}」を削除しました`, '🗑️');

    // 5. 表示更新
    renderReadingStockSection();
}

/**
 * 読みストックのUI描画
 * - 完了済み読み（liked[] のsessionReadingから導出）: ビルドへ / 追加ボタン
 * - 未選択の読み（READING_STOCK_KEY）: 漢字を探すボタン
 */
function renderReadingStockSection() {
    const pendingStock = getReadingStock();
    const section = document.getElementById('reading-stock-section');
    if (!section) return;

    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const readingToSegments = {};
    history.forEach(h => { readingToSegments[h.reading] = h.segments; });

    // liked[] から完了済み読みを導出（FREE/SEARCH/slot<0 を除外）
    const completedReadings = [...new Set(
        liked
            .filter(item =>
                item.sessionReading &&
                item.sessionReading !== 'FREE' &&
                item.sessionReading !== 'SEARCH' &&
                item.slot >= 0
            )
            .map(item => item.sessionReading)
    )];

    // 未選択の読みから完了済みを除外
    const pendingOnly = pendingStock.filter(s => !completedReadings.includes(s.reading));

    const hasContent = completedReadings.length > 0 || pendingOnly.length > 0;
    const emptyMsg = document.getElementById('reading-stock-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', hasContent);

    if (!hasContent) {
        section.innerHTML = '';
        return;
    }

    let html = '';

    // 完了済み読み
    if (completedReadings.length > 0) {
        html += `<div class="mb-6">
            <div class="text-xs font-black text-[#bca37f] mb-3 tracking-wider uppercase">漢字を選んだ読み</div>
            <div class="space-y-2">`;

        completedReadings.forEach(reading => {
            const kanjiCount = liked.filter(i => i.sessionReading === reading && i.slot >= 0).length;
            const segs = readingToSegments[reading];
            const display = segs ? segs.join('/') : reading;
            html += `
                <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center gap-3 hover:border-[#bca37f] transition-all relative">
                    <div class="flex-1 min-w-0">
                        <div class="text-lg font-black text-[#5d5444]">${display}</div>
                        <div class="text-[9px] text-[#a6967a]">${kanjiCount}個の漢字</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openBuildFromReading('${reading}')"
                            class="text-xs font-bold text-white bg-[#bca37f] px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-[#a8906c] transition-all active:scale-95">
                            ビルドへ →
                        </button>
                        <button onclick="addMoreForReading('${reading}')"
                            class="text-xs font-bold text-[#8b7e66] border border-[#d4c5af] px-3 py-1.5 rounded-full whitespace-nowrap hover:border-[#bca37f] transition-all active:scale-95">
                            + 追加
                        </button>
                    </div>
                    <button onclick="removeCompletedReadingFromStock('${reading}')" 
                        class="absolute -top-2 -right-2 w-6 h-6 bg-white border border-[#eee5d8] text-[#d4c5af] rounded-full flex items-center justify-center text-xs shadow-sm hover:text-[#f28b82] hover:border-[#f28b82] transition-all active:scale-90">✕</button>
                </div>`;
        });

        html += `</div></div>`;
    }

    // 未選択の読み（pending）
    if (pendingOnly.length > 0) {
        const groups = {};
        pendingOnly.forEach(s => {
            const key = s.baseNickname || 'その他';
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });

        html += `<div class="mb-5">
            <div class="text-xs font-black text-[#a6967a] mb-3 tracking-wider uppercase">未選択の読み</div>`;

        Object.keys(groups).forEach(nickname => {
            const items = groups[nickname];
            html += `<div class="mb-3">
                <div class="text-[10px] text-[#bca37f] mb-1">「${nickname}」より</div>
                <div class="grid grid-cols-2 gap-2">
                    ${items.map(s => `
                        <div class="bg-white border border-[#ede5d8] rounded-xl p-3 flex items-center justify-between hover:border-[#bca37f] transition-all">
                            <button onclick="startReadingFromStock('${s.reading}')" class="flex-1 text-left active:scale-95 transition-transform">
                                <div class="text-lg font-black text-[#5d5444]">${s.reading}</div>
                                <div class="text-[9px] text-[#bca37f]">漢字を探す →</div>
                            </button>
                            <button onclick="removeReadingFromStock('${s.reading}');renderReadingStockSection()" class="text-[#d4c5af] text-sm ml-1 p-1 rounded-full hover:bg-[#fef2f2] hover:text-[#f28b82]">✕</button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    section.innerHTML = html;
}

/**
 * 特定の読みでビルド画面を開く
 */
function openBuildFromReading(reading) {
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const entry = history.find(h => h.reading === reading);
    if (entry && entry.segments) {
        segments = entry.segments;
        const nameInput = document.getElementById('in-name');
        if (nameInput) nameInput.value = reading;
    }
    if (typeof openBuild === 'function') openBuild();
}

/**
 * 特定の読みで漢字追加（スワイプ画面へ）
 */
function addMoreForReading(reading) {
    const history = typeof getReadingHistory === 'function' ? getReadingHistory() : [];
    const entry = history.find(h => h.reading === reading);
    if (entry && entry.segments) {
        segments = entry.segments;
        const nameInput = document.getElementById('in-name');
        if (nameInput) nameInput.value = reading;
    }
    if (typeof updateSurnameData === 'function') updateSurnameData();
    currentPos = 0;
    swipes = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

/**
 * 読みストックから漢字探しへ
 */
function startReadingFromStock(reading) {
    console.log("STOCK: Starting kanji search from stock reading:", reading);
    removeReadingFromStock(reading);
    appMode = 'nickname';
    proceedWithNicknameReading(reading);
}

// ==========================================
// 複数読み漢字選択フロー（共通prefix + suffix順次スワイプ）
// ==========================================

let nicknameKanjiQueue = []; // 処理する読みのキュー
let nicknameKanjiQueueIndex = 0;
let nicknameSharedPrefix = ''; // 共有する先頭部分
let nicknameSharedPrefixLiked = []; // 先頭部分の選択済み漢字

/**
 * 複数読みの漢字選択フローを開始
 */
function startMultiReadingKanjiFlow(readings) {
    if (readings.length === 0) return;

    // 共通prefix算出
    nicknameSharedPrefix = findCommonPrefix(readings.map(r => r.reading || r));
    const readingStrings = readings.map(r => r.reading || r);

    // 各読みのsuffix部分を算出
    nicknameKanjiQueue = readingStrings.map(r => ({
        reading: r,
        suffix: r.substring(nicknameSharedPrefix.length)
    }));
    nicknameKanjiQueueIndex = 0;
    nicknameSharedPrefixLiked = [];

    console.log("MULTI: Starting flow, prefix:", nicknameSharedPrefix, "queue:", nicknameKanjiQueue);

    // まず先頭部分（共通prefix）の漢字を選ぶ
    // 最初の読み全体でcalcSegmentsを実行
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = readingStrings[0];
    calcSegments();

    // startSwiping相当の処理
    if (typeof updateSurnameData === 'function') updateSurnameData();
    currentPos = 0;
    swipes = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');
}

/**
 * 共通prefixの算出
 */
function findCommonPrefix(strings) {
    if (strings.length === 0) return '';
    if (strings.length === 1) {
        // 1つの場合はそのまま（prefixは読み全体）
        return strings[0];
    }
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (strings[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

/**
 * 次のsuffix読みに進む（10-choiceモーダルから呼ばれる）
 */
function advanceNicknameKanjiQueue() {
    nicknameKanjiQueueIndex++;

    if (nicknameKanjiQueueIndex >= nicknameKanjiQueue.length) {
        // 全読み完了 → ストック画面へ
        console.log("MULTI: All readings complete");
        nicknameKanjiQueue = [];
        if (typeof openStock === 'function') openStock('kanji');
        return;
    }

    const next = nicknameKanjiQueue[nicknameKanjiQueueIndex];
    console.log("MULTI: Advancing to next suffix:", next.suffix, "reading:", next.reading);

    // 次の読みでsegments設定
    const nameInput = document.getElementById('in-name');
    if (nameInput) nameInput.value = next.reading;
    calcSegments();

    // 先頭スロットは共有 → 自動コピー
    if (nicknameSharedPrefixLiked.length > 0 && segments.length > 1) {
        nicknameSharedPrefixLiked.forEach(k => {
            const exists = liked.some(l => l['漢字'] === k['漢字'] && l.slot === 0 && l.sessionReading === next.reading);
            if (!exists) {
                liked.push({ ...k, slot: 0, sessionReading: next.reading });
            }
        });
    }

    // slot 1から開始（prefix部分はスキップ）
    currentPos = segments.length > 1 ? 1 : 0;
    swipes = 0;
    currentIdx = 0;
    seen.clear();
    if (typeof loadStack === 'function') loadStack();
    changeScreen('scr-main');

    showToast(`「${next.reading}」の漢字を選びます（${nicknameKanjiQueueIndex + 1}/${nicknameKanjiQueue.length}）`);
}

/**
 * 現在ニックネーム漢字キューが有効か
 */
function isNicknameKanjiQueueActive() {
    return nicknameKanjiQueue.length > 0;
}

// ==========================================
// AI候補調整（好みの音パターンで並び替え）
// ==========================================

let soundPreferenceData = { liked: [], noped: [] };

/**
 * スワイプ結果から好みの音パターンを学習
 */
function learnSoundPreference(item, action) {
    if (action === 'like' || action === 'super') {
        soundPreferenceData.liked.push(item.reading);
    } else if (action === 'nope') {
        soundPreferenceData.noped.push(item.reading);
    }
}

/**
 * AI候補リオーダー：好みの音パターンに基づいてスコア調整
 * nickname / sound 両方で使用
 */
function aiReorderCandidates(candidates) {
    if (soundPreferenceData.liked.length < 3) return candidates;

    // 好みの音パターン分析
    const likedEndings = soundPreferenceData.liked.map(r => r.slice(-2));
    const nopedEndings = soundPreferenceData.noped.map(r => r.slice(-2));
    const likedVowels = soundPreferenceData.liked.map(r => getVowelPattern(r));

    // エンディング頻度カウント
    const endingScore = {};
    likedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) + 2; });
    nopedEndings.forEach(e => { endingScore[e] = (endingScore[e] || 0) - 1; });

    // 母音パターン頻度
    const vowelScore = {};
    likedVowels.forEach(v => { vowelScore[v] = (vowelScore[v] || 0) + 1; });

    // スコア付与して並び替え
    return candidates.map(c => {
        let boost = 0;
        const ending = (c.reading || '').slice(-2);
        const vowel = getVowelPattern(c.reading || '');
        boost += (endingScore[ending] || 0) * 10;
        boost += (vowelScore[vowel] || 0) * 5;
        return { ...c, _aiBoost: boost };
    }).sort((a, b) => (b.score + (b._aiBoost || 0)) - (a.score + (a._aiBoost || 0)));
}

function getVowelPattern(reading) {
    if (!reading) return '';
    const vowelMap = {
        'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
        'か': 'a', 'き': 'i', 'く': 'u', 'け': 'e', 'こ': 'o',
        'さ': 'a', 'し': 'i', 'す': 'u', 'せ': 'e', 'そ': 'o',
        'た': 'a', 'ち': 'i', 'つ': 'u', 'て': 'e', 'と': 'o',
        'な': 'a', 'に': 'i', 'ぬ': 'u', 'ね': 'e', 'の': 'o',
        'は': 'a', 'ひ': 'i', 'ふ': 'u', 'へ': 'e', 'ほ': 'o',
        'ま': 'a', 'み': 'i', 'む': 'u', 'め': 'e', 'も': 'o',
        'や': 'a', 'ゆ': 'u', 'よ': 'o',
        'ら': 'a', 'り': 'i', 'る': 'u', 'れ': 'e', 'ろ': 'o',
        'わ': 'a', 'ん': 'n',
        'が': 'a', 'ぎ': 'i', 'ぐ': 'u', 'げ': 'e', 'ご': 'o',
        'ざ': 'a', 'じ': 'i', 'ず': 'u', 'ぜ': 'e', 'ぞ': 'o',
        'だ': 'a', 'ぢ': 'i', 'づ': 'u', 'で': 'e', 'ど': 'o',
        'ば': 'a', 'び': 'i', 'ぶ': 'u', 'べ': 'e', 'ぼ': 'o',
        'ぱ': 'a', 'ぴ': 'i', 'ぷ': 'u', 'ぺ': 'e', 'ぽ': 'o'
    };
    return reading.split('').map(c => vowelMap[c] || '').join('');
}

// ==========================================
// トースト・チェックポイント・探すボタン
// ==========================================

function showToast(message) {
    const existing = document.getElementById('meimay-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'meimay-toast';
    toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[10000] bg-[#5d5444] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg transition-all';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    toast.innerText = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showUniversalSwipeCheckpoint() {
    const likedCount = SwipeState.liked.length;
    const totalSwipes = SwipeState.history.length;

    const modal = document.getElementById('modal-choice');
    const msg = document.getElementById('choice-message');
    const btn = document.getElementById('choice-main-btn');

    if (!modal) return;

    if (msg) {
        msg.innerHTML = `
            <div class="mb-4">
                <span class="text-2xl font-black text-[#bca37f]">${totalSwipes}枚</span>
                <span class="text-sm">スワイプしました</span>
            </div>
            <p class="text-sm text-[#7a6f5a] leading-relaxed">
                <b class="text-[#5d5444]">${likedCount}件</b>を候補に追加済み。<br>
                候補リストを確認しますか？
            </p>
        `;
    }

    if (btn) {
        btn.innerText = '候補リストを見る →';
        btn.onclick = () => {
            modal.classList.remove('active');
            showUniversalList();
        };
    }

    modal.classList.add('active');
}

function navSearchAction() {
    if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else {
        changeScreen('scr-main');
        if (typeof updateSwipeMainState === 'function') updateSwipeMainState();
    }
}

// Expose functions to global scope
window.navSearchAction = navSearchAction;
window.startMode = startMode;
window.selectGender = selectGender;
window.submitVibe = submitVibe;
window.toggleVibe = toggleVibe;
window.processNickname = processNickname;
window.initFreeMode = initFreeMode;
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
window.startUniversalSwipe = startUniversalSwipe;
window.showNicknameReadingSelection = showNicknameReadingSelection;
window.showNicknameReadingSelectionWithStock = showNicknameReadingSelectionWithStock;
window.proceedWithNicknameReading = proceedWithNicknameReading;
window.freeSwipeAction = freeSwipeAction;
window.toggleFreeBuildPiece = toggleFreeBuildPiece;
window.clearFreeBuild = clearFreeBuild;
window.executeFreeBuild = executeFreeBuild;
window.renderFreeBuild = renderFreeBuild;
window.getReadingStock = getReadingStock;
window.addReadingToStock = addReadingToStock;
window.removeReadingFromStock = removeReadingFromStock;
window.renderReadingStockSection = renderReadingStockSection;
window.startReadingFromStock = startReadingFromStock;
window.openBuildFromReading = openBuildFromReading;
window.addMoreForReading = addMoreForReading;
window.inheritModalAction = inheritModalAction;
window.showToast = showToast;
window.showUniversalSwipeCheckpoint = showUniversalSwipeCheckpoint;
window.startMultiReadingKanjiFlow = startMultiReadingKanjiFlow;
window.advanceNicknameKanjiQueue = advanceNicknameKanjiQueue;
window.isNicknameKanjiQueueActive = isNicknameKanjiQueueActive;
window.aiReorderCandidates = aiReorderCandidates;
window.learnSoundPreference = learnSoundPreference;

/**
 * ============================================================
 * 漢字検索・フィルター機能（V2 - 読み/画数/分類フィルター）
 * ============================================================
 */
let searchStrokeFilter = ''; // '', '1-5', '6-10', '11-15', '16-20', '21+'
let searchClassFilter = '';  // '', '自然', '強さ', '優しさ', etc.
let searchReadingFilter = ''; // text input for reading filter

function openKanjiSearch() {
    changeScreen('scr-kanji-search');
    // Reset filters
    searchStrokeFilter = '';
    searchClassFilter = '';
    searchReadingFilter = '';
    const input = document.getElementById('kanji-search-input');
    if (input) input.value = '';
    renderSearchFilters();
    // Show initial message instead of loading all kanji
    const container = document.getElementById('kanji-search-results');
    if (container) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">読み・漢字・意味で検索するか、<br>フィルターを選択してください</div>';
    }
}

function renderSearchFilters() {
    // Stroke count filters
    const strokeContainer = document.getElementById('search-stroke-filters');
    if (strokeContainer) {
        const strokes = [
            { val: '', label: '全て' },
            { val: '1-5', label: '1-5画' },
            { val: '6-10', label: '6-10画' },
            { val: '11-15', label: '11-15画' },
            { val: '16-20', label: '16-20画' },
            { val: '21+', label: '21画+' }
        ];
        strokeContainer.innerHTML = strokes.map(s => `
            <button onclick="setStrokeFilter('${s.val}')"
                    class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                    ${searchStrokeFilter === s.val ? 'bg-[#bca37f] text-white' : 'bg-white border border-[#eee5d8] text-[#7a6f5a]'}">
                ${s.label}
            </button>
        `).join('');
    }

    // Classification filters
    const classContainer = document.getElementById('search-class-filters');
    if (classContainer) {
        const classes = [
            { val: '', label: '全て', icon: '✨' },
            { val: 'nature', label: '自然', icon: '🌿' },
            { val: 'light', label: '光・明', icon: '☀️' },
            { val: 'water', label: '水・海', icon: '🌊' },
            { val: 'strength', label: '力・健', icon: '💪' },
            { val: 'kindness', label: '愛・優', icon: '💗' },
            { val: 'wisdom', label: '知・才', icon: '📚' },
            { val: 'beauty', label: '美・華', icon: '🌸' },
            { val: 'tradition', label: '伝統・和', icon: '⛩️' }
        ];
        classContainer.innerHTML = classes.map(c => `
            <button onclick="setClassFilter('${c.val}')"
                    class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                    ${searchClassFilter === c.val ? 'bg-[#bca37f] text-white' : 'bg-white border border-[#eee5d8] text-[#7a6f5a]'}">
                ${c.icon} ${c.label}
            </button>
        `).join('');
    }
}

function setStrokeFilter(val) {
    searchStrokeFilter = val;
    renderSearchFilters();
    executeKanjiSearch();
}

function setClassFilter(val) {
    searchClassFilter = val;
    renderSearchFilters();
    executeKanjiSearch();
}

function executeKanjiSearch() {
    const input = document.getElementById('kanji-search-input');
    const container = document.getElementById('kanji-search-results');
    if (!container) return;

    // masterが未ロードの場合
    if (!master || master.length === 0) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">漢字データを読み込み中です...</div>';
        return;
    }

    const query = input ? toHira(input.value.trim()) : '';
    const rawQuery = input ? input.value.trim() : '';

    // フィルターが何も設定されていない場合はメッセージ表示
    if (!query && !rawQuery && !searchStrokeFilter && !searchClassFilter) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">読み・漢字・意味で検索するか、<br>フィルターを選択してください</div>';
        return;
    }

    let results = master.filter(k => {
        // 不適切フラグチェック
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') return false;

        // テキスト検索（読み完全一致・漢字・意味）
        if (query || rawQuery) {
            const allReadings = ((k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || ''))
                .split(/[、,，\s/]+/)
                .map(x => toHira(x).replace(/[^ぁ-ん]/g, ''))
                .filter(x => x);

            // 読みは完全一致のみ
            const matchReading = allReadings.some(r => r === query);
            const matchKanji = k['漢字'] === rawQuery;
            const matchMeaning = rawQuery.length >= 2 && (k['意味'] || '').includes(rawQuery);

            if (!matchReading && !matchKanji && !matchMeaning) return false;
        }

        // 画数フィルター
        if (searchStrokeFilter) {
            const strokes = parseInt(k['画数']) || 0;
            if (searchStrokeFilter === '1-5' && (strokes < 1 || strokes > 5)) return false;
            if (searchStrokeFilter === '6-10' && (strokes < 6 || strokes > 10)) return false;
            if (searchStrokeFilter === '11-15' && (strokes < 11 || strokes > 15)) return false;
            if (searchStrokeFilter === '16-20' && (strokes < 16 || strokes > 20)) return false;
            if (searchStrokeFilter === '21+' && strokes < 21) return false;
        }

        // 分類フィルター
        if (searchClassFilter) {
            const classKeywords = {
                'nature': ['自然', '植物', '樹木', '草', '森', '木', '緑', '山', '花', '葉'],
                'light': ['明るさ', '輝き', '晴れ', '光', '陽', '太陽', '明', '輝', '照', '煌'],
                'water': ['海', '水', '川', '波', '流れ', '清', '洋', '源', '泉', '湖', '河'],
                'strength': ['強さ', '力', '剛健', '勇敢', '勇気', '壮大', '武', '豪', '剛', '健'],
                'kindness': ['優しさ', '慈愛', '愛情', '思いやり', '温かさ', '心', '愛', '恵', '慈', '仁'],
                'wisdom': ['知性', '賢さ', '才能', '優秀', '学問', '智', '理', '聡', '哲', '賢'],
                'beauty': ['美', '麗', '艶', '華', '彩', '綾', '雅', '麗しい'],
                'tradition': ['伝統', '古風', '和', '雅', '古典', '歴史', '典', '礼']
            };

            const combined = (k['名前のイメージ'] || '') + (k['意味'] || '') + (k['分類'] || '') + (k['漢字'] || '');
            const keywords = classKeywords[searchClassFilter] || [];
            const matches = keywords.some(kw => combined.includes(kw));
            if (!matches) return false;
        }

        return true;
    });

    // スコア順ソート
    if (typeof calculateKanjiScore === 'function') {
        results.forEach(k => k.score = calculateKanjiScore(k));
        results.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else {
        // スコア関数がない場合は画数でソート
        results.sort((a, b) => (parseInt(a['画数']) || 0) - (parseInt(b['画数']) || 0));
    }

    // 表示
    if (results.length === 0) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">該当する漢字がありません</div>';
        return;
    }

    container.innerHTML = '';

    // 結果件数
    const countDiv = document.createElement('div');
    countDiv.className = 'col-span-4 text-center text-[10px] text-[#a6967a] py-2';
    countDiv.innerText = `${results.length}件${results.length > 200 ? '（上位200件表示）' : ''}`;
    container.appendChild(countDiv);

    results.slice(0, 200).forEach(k => {
        const isStocked = liked.some(l => l['漢字'] === k['漢字']);
        const strokes = parseInt(k['画数']) || '?';
        const readings = ((k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || ''))
            .split(/[、,，\s/]+/)
            .filter(x => clean(x))
            .slice(0, 2);
        const btn = document.createElement('button');
        btn.className = `aspect-square bg-white rounded-xl shadow-sm border flex flex-col items-center justify-center hover:border-[#bca37f] relative transition-all active:scale-95
            ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'}`;
        btn.innerHTML = `
            <span class="text-2xl font-black text-[#5d5444]">${k['漢字']}</span>
            <span class="text-[8px] text-[#a6967a]">${strokes}画</span>
            <span class="text-[7px] text-[#bca37f] truncate w-full text-center px-0.5">${readings.join(',')}</span>
            ${isStocked ? '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>' : ''}
        `;
        // タップで漢字詳細を表示
        btn.onclick = () => {
            if (typeof showKanjiDetail === 'function') showKanjiDetail(k);
            else toggleSearchStock(k, btn);
        };
        container.appendChild(btn);
    });
}

function toggleSearchStock(k, btn) {
    const idx = liked.findIndex(l => l['漢字'] === k['漢字']);
    if (idx > -1) {
        liked.splice(idx, 1);
        btn.classList.remove('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.add('border-[#eee5d8]');
        const heart = btn.querySelector('.absolute');
        if (heart) heart.remove();
    } else {
        const item = { ...k, slot: -1, sessionReading: 'SEARCH' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.remove('border-[#eee5d8]');
        if (!btn.querySelector('.absolute')) {
            btn.insertAdjacentHTML('beforeend', '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>');
        }
    }
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
}

/**
 * ============================================================
 * AI響き分析（Sound Mode Enhancement）
 * ============================================================
 */
let soundAnalysisLiked = [];
let soundAnalysisNoped = [];

function aiAnalyzeSoundPreferences() {
    if (SwipeState.liked.length < 3) {
        alert('AI分析には3つ以上の「いいね」が必要です');
        return;
    }

    soundAnalysisLiked = SwipeState.liked.map(i => i.reading);
    soundAnalysisNoped = SwipeState.history.filter(h => h.action === 'nope').map(h => h.item.reading);

    // AI分析画面を表示
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md animate-fade-in" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-center py-8">
                <div class="text-[10px] font-black text-[#bca37f] mb-6 tracking-widest uppercase">AI Sound Analysis</div>
                <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
                <p class="text-sm font-bold text-[#5d5444] mb-2">好みを分析しています...</p>
                <div id="ai-sound-progress" class="text-xs text-[#a6967a] space-y-1 mt-4">
                    <p class="animate-pulse">好きな響きのパターンを解析中...</p>
                </div>
            </div>
        </div>
    `;

    // プログレス更新
    setTimeout(() => {
        const prog = document.getElementById('ai-sound-progress');
        if (prog) prog.innerHTML += '<p class="animate-pulse">音の傾向を分析中...</p>';
    }, 1000);
    setTimeout(() => {
        const prog = document.getElementById('ai-sound-progress');
        if (prog) prog.innerHTML += '<p class="animate-pulse">類似する名前を生成中...</p>';
    }, 2000);

    // AIに分析依頼
    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';
    const prompt = `
日本の赤ちゃんの名前（${genderLabel}）の響きの好みを分析して、新しい候補を提案してください。

【好きな響き】
${soundAnalysisLiked.join('、')}

${soundAnalysisNoped.length > 0 ? `【好みでない響き】\n${soundAnalysisNoped.join('、')}` : ''}

【回答形式（厳守）】
まず【分析】タグで、好みの傾向を3行程度で分析してください（音の特徴、文字数の傾向、音の柔らかさ/力強さなど）。

次に【候補】タグで、分析に基づいて${gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : ''}の新しい名前の読みを10個、以下の形式で1行ずつ提案してください：
読み|文字数|特徴の一言説明

例：
そうすけ|4|力強く古風な響き

【注意】好きな響きと重複しない新しい候補を出してください。
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const aiText = data.text || '';
            parseAndShowAISoundResults(aiText);
        })
        .catch(err => {
            console.error("AI_SOUND:", err);
            modal.innerHTML = `
            <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <div class="text-center py-8">
                    <p class="text-sm text-[#f28b82] mb-4">AI分析に失敗しました</p>
                    <p class="text-xs text-[#a6967a]">${err.message}</p>
                    <button onclick="closeAISoundModal()" class="btn-gold mt-6 py-3 px-8">閉じる</button>
                </div>
            </div>
        `;
        });
}

function parseAndShowAISoundResults(aiText) {
    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    // 分析テキストを抽出
    let analysis = '';
    let candidates = [];

    const analysisMatch = aiText.match(/【分析】([\s\S]*?)(?=【候補】|$)/);
    if (analysisMatch) analysis = analysisMatch[1].trim();

    const candidatesMatch = aiText.match(/【候補】([\s\S]*?)$/);
    if (candidatesMatch) {
        const lines = candidatesMatch[1].trim().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 2) {
                candidates.push({
                    reading: parts[0].replace(/[・、。]/g, ''),
                    charCount: parts[1] || '',
                    desc: parts[2] || ''
                });
            }
        });
    }

    // フォールバック：候補が取れなかった場合はテキスト全体から読みを抽出
    if (candidates.length === 0) {
        const namePattern = /([ぁ-ん]{2,6})/g;
        let match;
        const seen = new Set(soundAnalysisLiked);
        while ((match = namePattern.exec(aiText)) !== null) {
            if (!seen.has(match[1]) && candidates.length < 10) {
                candidates.push({ reading: match[1], charCount: String(match[1].length), desc: '' });
                seen.add(match[1]);
            }
        }
    }

    modal.innerHTML = `
        <div class="detail-sheet max-w-md max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase text-center">AI Analysis Result</div>

            ${analysis ? `
                <div class="bg-[#fdfaf5] border border-[#eee5d8] rounded-2xl p-4 mb-6">
                    <p class="text-xs font-bold text-[#8b7e66] mb-2">あなたの好みの傾向</p>
                    <p class="text-xs text-[#5d5444] leading-relaxed whitespace-pre-wrap">${analysis}</p>
                </div>
            ` : ''}

            <p class="text-xs font-bold text-[#8b7e66] mb-3">AIおすすめの響き（${candidates.length}件）</p>
            <div class="space-y-2 mb-6" id="ai-sound-candidates">
                ${candidates.map((c, i) => `
                    <div class="flex items-center gap-3 bg-white rounded-xl border border-[#eee5d8] p-3 transition-all hover:border-[#bca37f]">
                        <div class="flex-1">
                            <div class="text-lg font-black text-[#5d5444]">${c.reading}</div>
                            <div class="text-[10px] text-[#a6967a]">${c.charCount}文字 ${c.desc ? '・ ' + c.desc : ''}</div>
                        </div>
                        <button onclick="useAISoundReading('${c.reading}', this)"
                                class="px-3 py-1.5 bg-[#bca37f] text-white rounded-full text-xs font-bold hover:bg-[#8b7e66] transition-all active:scale-95">
                            この読みで探す
                        </button>
                    </div>
                `).join('')}
            </div>

            <button onclick="closeAISoundModal()" class="btn-gold py-4 w-full">閉じる</button>
        </div>
    `;
}

function useAISoundReading(reading, btn) {
    closeAISoundModal();
    proceedWithSoundReading(reading);
}

function closeAISoundModal() {
    const modal = document.getElementById('modal-ai-sound');
    if (modal) modal.classList.remove('active');
}

/**
 * AI自由モード提案
 */
function aiSuggestFreeKanji() {
    const freeLiked = liked.filter(l => l.sessionReading === 'FREE');
    if (freeLiked.length < 2) {
        alert('AI提案には2つ以上のストックが必要です');
        return;
    }

    const modal = document.getElementById('modal-ai-sound');
    if (!modal) return;

    modal.classList.add('active');
    modal.innerHTML = `
        <div class="detail-sheet max-w-md animate-fade-in" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
            <div class="text-center py-8">
                <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
                <p class="text-sm font-bold text-[#5d5444] mb-2">好みの漢字を分析中...</p>
            </div>
        </div>
    `;

    const likedKanji = freeLiked.map(l => `${l['漢字']}（${clean(l['意味']).substring(0, 15)}）`).join('、');
    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';

    const prompt = `
${genderLabel}の名前に使う漢字を提案してください。

【ユーザーが気に入った漢字】
${likedKanji}

以下の形式で、上記の傾向に合う新しい漢字を10個提案してください。
ユーザーが既に選んだ漢字と重複しないこと。
実在する常用漢字または人名用漢字のみ使用してください。

【回答形式（厳守）】
1行に1つ、以下の形式で：
漢字|画数|簡単な意味の説明（10文字以内）
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const lines = (data.text || '').split('\n').filter(l => l.includes('|'));
            const suggestions = lines.map(l => {
                const parts = l.split('|').map(p => p.trim());
                return { kanji: parts[0], strokes: parts[1], desc: parts[2] || '' };
            }).filter(s => s.kanji && s.kanji.length === 1);

            modal.innerHTML = `
            <div class="detail-sheet max-w-md max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <div class="text-[10px] font-black text-[#bca37f] mb-4 tracking-widest uppercase text-center">AI Kanji Suggestion</div>
                <p class="text-xs text-[#8b7e66] font-bold mb-3">あなたの好みに近い漢字（${suggestions.length}件）</p>
                <div class="space-y-2 mb-6">
                    ${suggestions.map(s => {
                const inMaster = master.find(m => m['漢字'] === s.kanji);
                const isStocked = liked.some(l => l['漢字'] === s.kanji);
                return `
                        <div class="flex items-center gap-3 bg-white rounded-xl border ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'} p-3">
                            <div class="text-3xl font-black text-[#5d5444] w-12 text-center">${s.kanji}</div>
                            <div class="flex-1">
                                <div class="text-xs text-[#a6967a]">${s.strokes || ''}画 ・ ${s.desc}</div>
                            </div>
                            <button onclick="stockAISuggestion('${s.kanji}', this)"
                                class="px-3 py-1.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82]' : 'bg-[#bca37f] text-white'} rounded-full text-xs font-bold transition-all active:scale-95">
                                ${isStocked ? '解除' : 'ストック'}
                            </button>
                        </div>
                        `;
            }).join('')}
                </div>
                <button onclick="closeAISoundModal()" class="btn-gold py-4 w-full">閉じる</button>
            </div>
        `;
        })
        .catch(err => {
            modal.innerHTML = `
            <div class="detail-sheet max-w-md" onclick="event.stopPropagation()">
                <button class="modal-close-btn" onclick="closeAISoundModal()">✕</button>
                <p class="text-sm text-[#f28b82] text-center py-8">AI提案に失敗しました</p>
            </div>
        `;
        });
}

function stockAISuggestion(kanji, btn) {
    const idx = liked.findIndex(l => l['漢字'] === kanji);
    if (idx > -1) {
        liked.splice(idx, 1);
        btn.innerText = 'ストック';
        btn.className = 'px-3 py-1.5 bg-[#bca37f] text-white rounded-full text-xs font-bold transition-all active:scale-95';
        btn.closest('.flex').classList.remove('border-[#bca37f]', 'bg-[#fffbeb]');
        btn.closest('.flex').classList.add('border-[#eee5d8]');
    } else {
        const found = master.find(m => m['漢字'] === kanji);
        if (found) {
            liked.push({ ...found, slot: -1, sessionReading: 'FREE' });
        }
        btn.innerText = '解除';
        btn.className = 'px-3 py-1.5 bg-[#fef2f2] text-[#f28b82] rounded-full text-xs font-bold transition-all active:scale-95';
        btn.closest('.flex').classList.add('border-[#bca37f]', 'bg-[#fffbeb]');
        btn.closest('.flex').classList.remove('border-[#eee5d8]');
    }
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
}

/**
 * ============================================================
 * アキネーター風AI漢字提案
 * ============================================================
 */
let akinatorAnswers = [];
let akinatorStep = 0;

const akinatorQuestions = [
    { q: 'どんな印象の名前がいいですか？', options: ['力強い', 'やさしい', '知的', '華やか'] },
    { q: '自然を連想するなら？', options: ['空・光', '水・海', '山・大地', '花・植物'] },
    { q: '名前に込めたい願いは？', options: ['健康・長寿', '成功・繁栄', '愛・絆', '自由・冒険'] },
    { q: '音の響きは？', options: ['柔らかい音', '力強い音', '古風な響き', 'モダンな響き'] },
    { q: '画数の好みは？', options: ['少ない(1-8画)', '普通(9-14画)', '多い(15画以上)', 'こだわりなし'] }
];

function openAkinator() {
    akinatorAnswers = [];
    akinatorStep = 0;
    renderAkinatorStep();
    changeScreen('scr-akinator');
}

function renderAkinatorStep() {
    const container = document.getElementById('akinator-content');
    if (!container) return;

    if (akinatorStep >= akinatorQuestions.length) {
        // 全質問回答済み→AI分析
        executeAkinatorAI();
        return;
    }

    const q = akinatorQuestions[akinatorStep];
    const progress = ((akinatorStep + 1) / akinatorQuestions.length * 100).toFixed(0);

    container.innerHTML = `
        <div class="text-center mb-8">
            <div class="w-full bg-[#eee5d8] rounded-full h-2 mb-4">
                <div class="bg-[#bca37f] h-2 rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
            <p class="text-[10px] text-[#a6967a] mb-1">質問 ${akinatorStep + 1} / ${akinatorQuestions.length}</p>
        </div>
        <h3 class="text-lg font-bold text-[#5d5444] text-center mb-8">${q.q}</h3>
        <div class="grid grid-cols-2 gap-3">
            ${q.options.map((opt, i) => `
                <button onclick="answerAkinator('${opt}')"
                    class="p-4 bg-white rounded-2xl border-2 border-[#eee5d8] text-sm font-bold text-[#5d5444] hover:border-[#bca37f] hover:bg-[#fffbeb] transition-all active:scale-95">
                    ${opt}
                </button>
            `).join('')}
        </div>
        ${akinatorStep > 0 ? `<button onclick="akinatorBack()" class="mt-6 text-xs text-[#a6967a] mx-auto block">← 前の質問に戻る</button>` : ''}
    `;
}

function answerAkinator(answer) {
    akinatorAnswers[akinatorStep] = answer;
    akinatorStep++;
    renderAkinatorStep();
}

function akinatorBack() {
    if (akinatorStep > 0) {
        akinatorStep--;
        renderAkinatorStep();
    }
}

function executeAkinatorAI() {
    const container = document.getElementById('akinator-content');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <div class="w-12 h-12 border-4 border-[#eee5d8] border-t-[#bca37f] rounded-full animate-spin mx-auto mb-6"></div>
            <p class="text-sm font-bold text-[#5d5444] mb-2">AIがおすすめ漢字を選んでいます...</p>
            <div class="text-xs text-[#a6967a] space-y-1 mt-4">
                <p class="animate-pulse">回答を分析中...</p>
            </div>
        </div>
    `;

    const genderLabel = gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '中性的';
    const answersText = akinatorQuestions.map((q, i) => `${q.q} → ${akinatorAnswers[i]}`).join('\n');

    const prompt = `
${genderLabel}の赤ちゃんの名前に使う漢字を提案してください。

【ユーザーの好み】
${answersText}

【回答ルール - 厳守】
- 実在する常用漢字または人名用漢字のみ使用
- 架空の漢字や存在しない読みは絶対に出さない
- 各漢字は実際にその読み方・画数で使われるものだけ

以下の形式で10個の漢字を提案してください：

【おすすめ】タグの後、1行1つずつ：
漢字|読み例|画数|おすすめ理由（15文字以内）

例：
陽|はる、ひなた|12|明るく温かい印象
`.trim();

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
        .then(res => res.json())
        .then(data => {
            const text = data.text || '';
            const lines = text.split('\n').filter(l => l.includes('|'));
            const suggestions = lines.map(l => {
                const parts = l.split('|').map(p => p.trim());
                return { kanji: parts[0], reading: parts[1] || '', strokes: parts[2] || '', desc: parts[3] || '' };
            }).filter(s => s.kanji && s.kanji.length === 1);

            container.innerHTML = `
            <div class="text-center mb-6">
                <div class="text-[10px] font-black text-[#bca37f] tracking-widest uppercase mb-2">AI Recommendation</div>
                <p class="text-sm text-[#5d5444] font-bold">あなたにおすすめの漢字</p>
            </div>
            <div class="space-y-2 mb-6">
                ${suggestions.map(s => {
                const inMaster = master.find(m => m['漢字'] === s.kanji);
                const isStocked = liked.some(l => l['漢字'] === s.kanji);
                return `
                    <div class="flex items-center gap-3 bg-white rounded-xl border ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'} p-3">
                        <div class="text-3xl font-black text-[#5d5444] w-12 text-center">${s.kanji}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-[#5d5444]">${s.reading}</div>
                            <div class="text-[10px] text-[#a6967a]">${s.strokes}画 ・ ${s.desc}</div>
                        </div>
                        <button onclick="stockAISuggestion('${s.kanji}', this)"
                            class="shrink-0 px-3 py-1.5 ${isStocked ? 'bg-[#fef2f2] text-[#f28b82]' : 'bg-[#bca37f] text-white'} rounded-full text-xs font-bold transition-all active:scale-95">
                            ${isStocked ? '解除' : 'ストック'}
                        </button>
                    </div>
                    `;
            }).join('')}
            </div>
            <div class="flex gap-3">
                <button onclick="akinatorStep=0;akinatorAnswers=[];renderAkinatorStep()" class="flex-1 py-3 border border-[#d4c5af] rounded-2xl text-sm text-[#a6967a] font-bold">もう一度</button>
                <button onclick="changeScreen('scr-mode')" class="flex-1 py-3 bg-[#bca37f] text-white rounded-2xl font-bold text-sm">ホームへ</button>
            </div>
        `;
        })
        .catch(err => {
            container.innerHTML = `<p class="text-sm text-[#f28b82] text-center py-8">AI提案に失敗しました: ${err.message}</p>
            <button onclick="changeScreen('scr-mode')" class="btn-gold py-3 w-full mt-4">ホームへ</button>`;
        });
}

window.openKanjiSearch = openKanjiSearch;
window.initSoundMode = initSoundMode;
window.proceedWithSoundReading = proceedWithSoundReading;
window.setStrokeFilter = setStrokeFilter;
window.setClassFilter = setClassFilter;
window.executeKanjiSearch = executeKanjiSearch;
window.toggleSearchStock = toggleSearchStock;
window.aiAnalyzeSoundPreferences = aiAnalyzeSoundPreferences;
window.closeAISoundModal = closeAISoundModal;
window.useAISoundReading = useAISoundReading;
window.aiSuggestFreeKanji = aiSuggestFreeKanji;
window.stockAISuggestion = stockAISuggestion;
window.openAkinator = openAkinator;
window.answerAkinator = answerAkinator;
window.akinatorBack = akinatorBack;
window.renderAkinatorStep = renderAkinatorStep;

console.log("UI_FLOW: Module loaded (V19 - Free Swipe, AI Learning, Akinator)");
