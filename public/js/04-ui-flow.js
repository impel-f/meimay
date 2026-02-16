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
        // 自由選択モード: 性別 -> イメージ -> スワイプカタログ
        initVibeScreen();
        changeScreen('scr-vibe');
    } else if (appMode === 'nickname') {
        changeScreen('scr-input-nickname');
    } else if (appMode === 'sound') {
        // 響きから選ぶ: 性別 -> 読みスワイプ -> 漢字スワイプ
        initSoundMode();
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
 * 響きから選ぶモード（Sound Mode）
 * 人気の名前読みをスワイプして、気に入った響きから漢字を選ぶ
 */
function initSoundMode() {
    console.log("UI_FLOW: initSoundMode");

    // 人気名前リストを生成（性別ベース）
    const popularNames = generatePopularNames(gender);

    startUniversalSwipe('sound', popularNames, {
        title: '響きで選ぶ',
        subtitle: '気に入った名前の響きをスワイプ',
        renderCard: (item) => {
            return `
                <div class="text-xs font-bold text-[#bca37f] mb-4 tracking-widest uppercase opacity-70">
                    ${item.charCount}文字 ・ ${item.type}
                </div>
                <div class="text-5xl font-black text-[#5d5444] mb-6 tracking-wider">${item.reading}</div>
                <div class="text-sm text-[#a6967a] mb-6">${item.desc || ''}</div>
                <div class="w-full px-6">
                    <div class="bg-[#fdfaf5] rounded-2xl p-3 border border-[#f5efe4]">
                        <p class="text-[10px] text-[#a6967a] text-center mb-2 font-bold">漢字の組み合わせ例</p>
                        <div class="flex justify-center flex-wrap gap-2 text-[#5d5444] font-bold text-lg">
                            ${item.examples ? item.examples.map(e => `<span>${e}</span>`).join('') : '?'}
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
                // 複数選択時 → 選択画面
                showNicknameReadingSelection(selectedItems.map(item => ({
                    reading: item.reading,
                    type: 'sound'
                })));
            }
        }
    });
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

    // Step 1: 読み方をスワイプで選ぶ（複数OK）
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
            console.log("Nickname: Selected readings", selectedItems.map(i => i.reading));

            if (selectedItems.length === 0) return;

            if (selectedItems.length === 1) {
                // 1つだけ選択 → そのまま通常フローへ
                proceedWithNicknameReading(selectedItems[0].reading);
            } else {
                // 複数選択 → 読み方選択画面を表示
                showNicknameReadingSelection(selectedItems);
            }
        }
    });
}

/**
 * ニックネーム：複数読みの選択画面
 */
function showNicknameReadingSelection(items) {
    const container = document.getElementById('uni-candidates-grid');
    const list = document.getElementById('uni-liked-list');
    if (!container || !list) return;

    container.innerHTML = '';

    const title = document.getElementById('uni-list-title');
    const desc = document.getElementById('uni-list-desc');
    if (title) title.innerText = '読みを選んでください';
    if (desc) desc.innerText = '選んだ読みごとに漢字をスワイプで選びます';

    items.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'bg-[#fdfaf5] border-2 border-[#bca37f] rounded-xl p-4 text-center cursor-pointer hover:bg-white transition-all active:scale-95';
        btn.innerHTML = `<div class="text-xl font-black text-[#5d5444]">${item.reading}</div>`;
        btn.onclick = () => {
            list.classList.add('hidden');
            proceedWithNicknameReading(item.reading);
        };
        container.appendChild(btn);
    });

    list.classList.remove('hidden');
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
 * 自由選択モード初期化（スワイプ＋自由組み立て対応）
 */
let freeStack = [];
let freeIdx = 0;
let freeLiked = [];

function initFreeMode() {
    const container = document.getElementById('free-catalog');
    if (!container || !master) return;

    // フィルタリング（性別・イメージ）
    let list = master.filter(k => {
        if (k['不適切フラグ']) return false;
        return true;
    });

    // イメージタグフィルター
    if (typeof applyImageTagFilter === 'function') {
        list = applyImageTagFilter(list);
    }

    // 性別・イメージスコア計算
    if (typeof calculateKanjiScore === 'function') {
        list.forEach(k => k.score = calculateKanjiScore(k));
        if (k => k.imagePriority === 1) {
            list.forEach(k => {
                if (k.imagePriority === 1) k.score += 1500;
            });
        }
        list.sort((a, b) => {
            const pa = a.imagePriority || 2;
            const pb = b.imagePriority || 2;
            if (pa !== pb) return pa - pb;
            return b.score - a.score;
        });
    }

    // 既にストック済みの漢字は除外
    list = list.filter(k => !liked.some(l => l['漢字'] === k['漢字']));

    // スワイプ用にスタックを設定
    freeStack = list;
    freeIdx = 0;
    freeLiked = liked.filter(l => l.sessionReading === 'FREE');

    renderFreeSwipeCard(container);
    updateFreeStockBadge();
}

function renderFreeSwipeCard(container) {
    if (!container) container = document.getElementById('free-catalog');
    if (!container) return;

    container.innerHTML = '';
    container.className = 'relative flex-1 min-h-[400px]';

    if (freeIdx >= freeStack.length) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-center">
                <div>
                    <p class="text-[#bca37f] font-bold text-lg mb-4">全ての候補を見ました！</p>
                    <p class="text-sm text-[#a6967a] mb-6">ストックした漢字で名前を作りましょう</p>
                </div>
            </div>
        `;
        return;
    }

    const data = freeStack[freeIdx];
    const meaning = clean(data['意味']);
    const shortMeaning = meaning.length > 50 ? meaning.substring(0, 50) + '...' : meaning;
    const unifiedTags = getUnifiedTags((data['名前のイメージ'] || '') + ',' + (data['分類'] || ''));
    const bgGradient = getGradientFromTags(unifiedTags);

    const readings = [data['音'], data['訓'], data['伝統名のり']]
        .filter(x => clean(x))
        .join(',')
        .split(/[、,，\s/]+/)
        .filter(x => clean(x))
        .slice(0, 4);

    const card = document.createElement('div');
    card.className = 'absolute inset-2 rounded-3xl shadow-lg border border-[#ede5d8] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none';
    card.style.background = bgGradient;
    card.style.zIndex = 10;

    card.innerHTML = `
        <div class="flex gap-2 mb-2 flex-wrap justify-center">
            ${unifiedTags.map(t => `<span class="px-3 py-1 bg-white/80 text-[#8b7e66] rounded-full text-xs font-bold">#${t}</span>`).join(' ')}
        </div>
        <div class="text-[80px] font-black text-[#5d5444] leading-none mb-2">${data['漢字']}</div>
        <div class="text-[#bca37f] font-black text-lg mb-2">${data['画数']}画</div>
        <div class="flex gap-2 mb-3 flex-wrap justify-center">
            ${readings.map(r => `<span class="px-2 py-1 bg-white/60 rounded-lg text-xs font-bold text-[#7a6f5a]">${r}</span>`).join(' ')}
        </div>
        <div class="w-full max-w-xs bg-white/70 rounded-2xl px-3 py-2 shadow-sm mx-4">
            <p class="text-xs leading-relaxed text-[#7a6f5a] text-center line-clamp-2">${shortMeaning || '意味情報なし'}</p>
        </div>
    `;

    // スワイプ物理演算（簡易版）
    let startX = 0, curX = 0, isDragging = false;

    card.addEventListener('pointerdown', e => {
        startX = e.clientX;
        isDragging = true;
        card.style.transition = 'none';
        card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', e => {
        if (!isDragging) return;
        curX = e.clientX - startX;
        const rotate = curX / 15;
        card.style.transform = `translate3d(${curX}px, ${Math.abs(curX) * 0.05}px, 0) rotate(${rotate}deg)`;
        if (curX > 50) card.style.borderColor = '#81c995';
        else if (curX < -50) card.style.borderColor = '#f28b82';
        else card.style.borderColor = '#ede5d8';
    });

    card.addEventListener('pointerup', e => {
        if (!isDragging) return;
        isDragging = false;
        card.releasePointerCapture(e.pointerId);

        if (Math.abs(curX) < 10) {
            // タップ → 詳細表示
            if (typeof showDetailByData === 'function') showDetailByData(data);
            card.style.transition = 'transform 0.3s';
            card.style.transform = '';
            card.style.borderColor = '#ede5d8';
        } else if (curX > 100) {
            // LIKE
            freeSwipeAction('like', data, card);
        } else if (curX < -100) {
            // NOPE
            freeSwipeAction('nope', data, card);
        } else {
            card.style.transition = 'transform 0.3s';
            card.style.transform = '';
            card.style.borderColor = '#ede5d8';
        }
        curX = 0;
    });

    container.appendChild(card);
}

function freeSwipeAction(dir, data, card) {
    const x = dir === 'like' ? 500 : -500;
    const r = dir === 'like' ? 20 : -20;
    card.style.transition = 'all 0.4s ease';
    card.style.transform = `translate(${x}px, 50px) rotate(${r}deg)`;
    card.style.opacity = '0';

    if (dir === 'like') {
        const item = { ...data, slot: -1, sessionReading: 'FREE' };
        liked.push(item);
        if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
    }

    setTimeout(() => {
        freeIdx++;
        const container = document.getElementById('free-catalog');
        renderFreeSwipeCard(container);
        updateFreeStockBadge();
    }, 300);
}

function updateFreeStockBadge() {
    const badge = document.getElementById('free-stock-badge');
    if (badge) {
        const freeCount = liked.filter(l => l.sessionReading === 'FREE').length;
        badge.innerText = freeCount;
        badge.classList.toggle('hidden', freeCount === 0);
    }
}

function finishFreeMode() {
    const freeItems = liked.filter(l => l.sessionReading === 'FREE');
    if (freeItems.length === 0) {
        if (!confirm('漢字が選択されていませんが、進みますか？')) return;
    }

    // 自由組み立て画面へ
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
window.startUniversalSwipe = startUniversalSwipe;
window.showNicknameReadingSelection = showNicknameReadingSelection;
window.proceedWithNicknameReading = proceedWithNicknameReading;
window.freeSwipeAction = freeSwipeAction;
window.toggleFreeBuildPiece = toggleFreeBuildPiece;
window.clearFreeBuild = clearFreeBuild;
window.executeFreeBuild = executeFreeBuild;
window.renderFreeBuild = renderFreeBuild;

/**
 * ============================================================
 * 漢字検索・フィルター機能
 * ============================================================
 */
let searchSelectedTags = new Set();

function openKanjiSearch() {
    changeScreen('scr-kanji-search');
    renderSearchTags();
    executeKanjiSearch();
}

function renderSearchTags() {
    const container = document.getElementById('kanji-search-tags');
    if (!container) return;

    const tags = [
        { id: 'none', label: '全て', icon: '✨' },
        { id: 'nature', label: '自然', icon: '🌿' },
        { id: 'brightness', label: '明るさ', icon: '☀️' },
        { id: 'water', label: '水', icon: '🌊' },
        { id: 'strength', label: '力強さ', icon: '💪' },
        { id: 'kindness', label: '優しさ', icon: '💗' },
        { id: 'intelligence', label: '知性', icon: '📚' },
        { id: 'beauty', label: '美しさ', icon: '✨' },
        { id: 'tradition', label: '伝統', icon: '🎎' },
        { id: 'elegance', label: '品格', icon: '👑' },
    ];

    container.innerHTML = tags.map(tag => `
        <button onclick="toggleSearchTag('${tag.id}')"
                class="search-tag-btn shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                ${searchSelectedTags.has(tag.id) || (searchSelectedTags.size === 0 && tag.id === 'none')
                    ? 'bg-[#bca37f] text-white' : 'bg-white border border-[#eee5d8] text-[#7a6f5a]'}"
                data-tag="${tag.id}">
            ${tag.icon} ${tag.label}
        </button>
    `).join('');
}

function toggleSearchTag(tagId) {
    if (tagId === 'none') {
        searchSelectedTags.clear();
    } else {
        if (searchSelectedTags.has(tagId)) {
            searchSelectedTags.delete(tagId);
        } else {
            searchSelectedTags.add(tagId);
        }
    }
    renderSearchTags();
    executeKanjiSearch();
}

function executeKanjiSearch() {
    const input = document.getElementById('kanji-search-input');
    const container = document.getElementById('kanji-search-results');
    if (!container || !master) return;

    const query = input ? toHira(input.value.trim()) : '';
    const rawQuery = input ? input.value.trim() : '';

    let results = master.filter(k => {
        if (k['不適切フラグ']) return false;

        // テキスト検索
        if (query || rawQuery) {
            const allReadings = ((k['音'] || '') + ',' + (k['訓'] || '') + ',' + (k['伝統名のり'] || ''))
                .split(/[、,，\s/]+/)
                .map(x => toHira(x));

            const matchReading = allReadings.some(r => r.includes(query));
            const matchKanji = k['漢字'] === rawQuery;
            const matchMeaning = (k['意味'] || '').includes(rawQuery);
            const matchImage = (k['名前のイメージ'] || '').includes(rawQuery);

            if (!matchReading && !matchKanji && !matchMeaning && !matchImage) return false;
        }

        // タグフィルター
        if (searchSelectedTags.size > 0) {
            const tagKeywords = {
                'nature': ['自然', '植物', '樹木', '草', '森', '木', '緑'],
                'brightness': ['明るさ', '輝き', '晴れ', '朗らか', '光', '陽', '太陽'],
                'water': ['海', '水', '川', '波', '流れ', '清らか', '洋', '源'],
                'strength': ['強さ', '力', '剛健', '勇敢', '勇気', '壮大', '武'],
                'kindness': ['優しさ', '慈愛', '愛情', '思いやり', '温かさ', '心', '愛', '恵'],
                'intelligence': ['知性', '賢さ', '才能', '優秀', '学問', '智恵', '理', '聡'],
                'beauty': ['美', '麗しい', '艶やか', '華麗', '美しい', '彩', '綾'],
                'tradition': ['伝統', '古風', '和', '雅', '古典', '歴史'],
                'elegance': ['品格', '高貴', '気品', '上品', '優雅']
            };

            const combined = (k['名前のイメージ'] || '') + (k['意味'] || '') + (k['分類'] || '');
            const matchesTag = Array.from(searchSelectedTags).some(tagId => {
                const keywords = tagKeywords[tagId] || [];
                return keywords.some(kw => combined.includes(kw));
            });

            if (!matchesTag) return false;
        }

        return true;
    });

    // スコア順
    if (typeof calculateKanjiScore === 'function') {
        results.forEach(k => k.score = calculateKanjiScore(k));
        results.sort((a, b) => b.score - a.score);
    }

    // 表示
    if (results.length === 0) {
        container.innerHTML = '<div class="col-span-4 text-center text-sm text-[#a6967a] py-10">該当する漢字がありません</div>';
        return;
    }

    container.innerHTML = '';
    results.slice(0, 200).forEach(k => {
        const isStocked = liked.some(l => l['漢字'] === k['漢字']);
        const btn = document.createElement('button');
        btn.className = `aspect-square bg-white rounded-xl shadow-sm border flex flex-col items-center justify-center hover:border-[#bca37f] relative transition-all active:scale-95
            ${isStocked ? 'border-[#bca37f] bg-[#fffbeb]' : 'border-[#eee5d8]'}`;
        btn.innerHTML = `
            <span class="text-2xl font-black text-[#5d5444]">${k['漢字']}</span>
            <span class="text-[8px] text-[#a6967a]">${k['画数']}画</span>
            ${isStocked ? '<span class="absolute top-0.5 right-0.5 text-[8px]">❤️</span>' : ''}
        `;
        btn.onclick = () => toggleSearchStock(k, btn);
        container.appendChild(btn);
    });

    // 結果件数
    const countDiv = document.createElement('div');
    countDiv.className = 'col-span-4 text-center text-[10px] text-[#a6967a] py-2';
    countDiv.innerText = `${results.length}件${results.length > 200 ? '（上位200件表示）' : ''}`;
    container.prepend(countDiv);
}

function toggleSearchStock(k, btn) {
    const idx = liked.findIndex(l => l['漢字'] === k['漢字']);
    if (idx > -1) {
        liked.splice(idx, 1);
        btn.classList.remove('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.add('border-[#eee5d8]');
        btn.querySelector('span:last-child')?.remove();
    } else {
        const item = { ...k, slot: -1, sessionReading: 'SEARCH' };
        liked.push(item);
        btn.classList.add('bg-[#fffbeb]', 'border-[#bca37f]');
        btn.classList.remove('border-[#eee5d8]');
    }
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
}

window.openKanjiSearch = openKanjiSearch;
window.initSoundMode = initSoundMode;
window.proceedWithSoundReading = proceedWithSoundReading;
window.toggleSearchTag = toggleSearchTag;
window.executeKanjiSearch = executeKanjiSearch;
window.toggleSearchStock = toggleSearchStock;

console.log("UI_FLOW: Module loaded (Phase 6: Search, Sound Mode, Enhanced Features)");
