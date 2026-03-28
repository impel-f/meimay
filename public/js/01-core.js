/* ============================================================
   MODULE 01: CORE (V15.2)
   グローバル変数・初期化・データ読み込み
   ============================================================ */

// グローバル変数
let master = [];
let segments = [];
let currentPos = 0;
let liked = [];
let seen = new Set();
let noped = new Set(); // NOPEした漢字を記録（スタック再生成時にフィルタ）
let validReadingsSet = new Set();
let rule = 'strict';
let stack = [];
let strokeData = {};
let userTags = {}; // タグスコア管理
let currentIdx = 0;
let swipes = 0;
let gender = 'neutral';
let surnameStr = "";
let surnameReading = ""; // 苗字のふりがな（任意）
let surnameData = [];
let prioritizeFortune = false;
let savedNames = [];
let yomiSearchData = [];
let readingsData = []; // 追加: 読み(タグ付き)詳細データ
let compoundReadingsData = []; // まとめ読み候補データ
let readingSegmentRules = {
    approvedSegments: {},
    disabledSegments: []
};
let currentBuildResult = {
    fullName: "",
    reading: "",
    fortune: null,
    combination: [],
    givenName: "",
    timestamp: null
};

function normalizeReadingSegmentRuleKey(value) {
    return toHira(String(value || '').trim()).replace(/[^\u3041-\u3093\u30fc]/g, '');
}

function setReadingSegmentRules(nextRules) {
    const approvedSegments = {};
    const rawApproved = nextRules && typeof nextRules.approvedSegments === 'object'
        ? nextRules.approvedSegments
        : {};

    Object.entries(rawApproved).forEach(([segment, candidates]) => {
        const normalizedSegment = normalizeReadingSegmentRuleKey(segment);
        if (!normalizedSegment) return;
        const normalizedCandidates = Array.isArray(candidates)
            ? candidates.map(value => String(value || '').trim()).filter(Boolean)
            : [];
        if (normalizedCandidates.length > 0) {
            approvedSegments[normalizedSegment] = normalizedCandidates;
        }
    });

    const disabledSet = new Set(
        Array.isArray(nextRules?.disabledSegments)
            ? nextRules.disabledSegments
                .map(normalizeReadingSegmentRuleKey)
                .filter(Boolean)
            : []
    );

    Object.keys(approvedSegments).forEach((segment) => disabledSet.delete(segment));

    readingSegmentRules = {
        approvedSegments,
        disabledSegments: [...disabledSet]
    };

    if (typeof readingKanjiCache !== 'undefined' && readingKanjiCache && typeof readingKanjiCache.clear === 'function') {
        readingKanjiCache.clear();
    }

    console.log(
        `CORE: Loaded curated reading segment rules (${Object.keys(approvedSegments).length} approved, ${disabledSet.size} disabled)`
    );
}

function hasCuratedReadingSegmentRules() {
    return Object.keys(readingSegmentRules.approvedSegments || {}).length > 0 ||
        (readingSegmentRules.disabledSegments || []).length > 0;
}

function getCuratedReadingSegmentCandidates(segment) {
    const normalizedSegment = normalizeReadingSegmentRuleKey(segment);
    if (!normalizedSegment) return null;

    const approvedSegments = readingSegmentRules.approvedSegments || {};
    if (Object.prototype.hasOwnProperty.call(approvedSegments, normalizedSegment)) {
        return approvedSegments[normalizedSegment];
    }

    if ((readingSegmentRules.disabledSegments || []).includes(normalizedSegment)) {
        return [];
    }

    return hasCuratedReadingSegmentRules() ? [] : null;
}

/**
 * アプリ初期化
 */
window.onload = () => {
    console.log("CORE: Initializing Meimay App...");
    const statusEl = document.getElementById('status');

    // LocalStorageから同期的に復元（非同期前に実行してリロード時のデータ消散を防ぐ）
    if (typeof StorageBox !== 'undefined' && typeof StorageBox.loadAll === 'function') {
        StorageBox.loadAll();
    }

    // 漢字データの読み込み
    fetch('/data/kanji_data.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.json();
        })
        .then(data => {
            if (!data || data.length === 0) {
                throw new Error("漢字データが空です");
            }

            master = data;
            console.log("CORE: Sample kanji:", master[0]);
            console.log(`CORE: ${master.length} kanji loaded successfully`);

            // 読みデータのインデックス作成
            master.forEach(k => {
                const readings = (k['音'] + ',' + k['訓'] + ',' + k['伝統名のり'])
                    .split(/[、,，\s/]+/)
                    .map(toHira)
                    .filter(x => clean(x));
                readings.forEach(r => validReadingsSet.add(r));
            });

            console.log(`CORE: ${validReadingsSet.size} unique readings indexed`);

            // UI更新 (今日の一字)
            if (typeof initTodaysKanji === 'function') {
                initTodaysKanji();
            }

            // 四字熟語・ことわざデータの読み込み（非同期）
            fetch('/data/idioms.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(idioms => {
                    window.idiomsData = idioms;
                    console.log(`CORE: Loaded ${idioms.length} idioms/proverbs`);
                })
                .catch(err => console.warn("CORE: Failed to load idioms", err));

            // 画数データの読み込み（非同期）
            fetch('/data/stroke_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return {};
                })
                .then(strokes => {
                    strokeData = strokes;
                    console.log(`CORE: Loaded ${Object.keys(strokes).length} stroke entries`);
                })
                .catch(err => console.warn("CORE: Failed to load stroke data", err));

            // 響きから探す用データの読み込み（非同期）
            fetch('/data/yomi_search_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(yomiData => {
                    yomiSearchData = yomiData;
                    console.log(`CORE: Loaded ${yomiData.length} yomi search entries`);
                })
                .catch(err => console.warn("CORE: Failed to load yomi search data", err));

            // タグ付き読みデータの読み込み（非同期）
            fetch('/data/readings_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(rData => {
                    readingsData = rData;
                    console.log(`CORE: Loaded ${rData.length} reading entries with tags`);
                })
                .catch(err => console.warn("CORE: Failed to load readings data", err));

            fetch('/data/compound_readings_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(cData => {
                    compoundReadingsData = Array.isArray(cData) ? cData : [];
                    console.log(`CORE: Loaded ${compoundReadingsData.length} compound reading entries`);
                })
                .catch(err => console.warn("CORE: Failed to load compound reading data", err));

            fetch('/data/reading_segment_rules.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return null;
                })
                .then(ruleData => {
                    if (!ruleData) return;
                    setReadingSegmentRules(ruleData);
                })
                .catch(err => console.warn("CORE: Failed to load reading segment rules", err));
        })
        .catch(err => {
            console.error("CORE: データ読み込みエラー:", err);
            if (statusEl) {
                statusEl.innerText = `ERROR: ${err.message}`;
                statusEl.style.color = "#f28b82";
            }
            alert('漢字データの読み込みに失敗しました。\n/data/kanji_data.json を確認してください。');
        });
};

/**
 * 名字データの更新
 */
/**
 * 濁音・半濁音を清音に変換（連濁対応用）
 * が→か、ざ→さ、だ→た、ば→は、ぱ→は
 */
function toSeion(str) {
    return str
        .replace(/[がぎぐげご]/g, s => String.fromCharCode(s.charCodeAt(0) - 1))
        .replace(/[ざじずぜぞ]/g, s => String.fromCharCode(s.charCodeAt(0) - 1))
        .replace(/[だぢづでど]/g, s => String.fromCharCode(s.charCodeAt(0) - 1))
        .replace(/[ばびぶべぼ]/g, s => String.fromCharCode(s.charCodeAt(0) - 1))
        .replace(/[ぱぴぷぺぽ]/g, s => String.fromCharCode(s.charCodeAt(0) - 2));
}
/**
 * 名字データの更新
 */
function updateSurnameData() {
    const input = document.getElementById('in-surname');
    if (!input) return;

    surnameStr = input.value.trim();
    const chars = surnameStr.split('');

    surnameData = chars.map(c => {
        const found = master.find(k => k['漢字'] === c);
        let strokes = 0;
        if (strokeData[c]) {
            strokes = strokeData[c];
        } else if (found) {
            strokes = parseInt(found['画数']) || 0;
        }
        return {
            kanji: c,
            strokes: strokes
        };
    });

    console.log("CORE: Surname data updated ->", surnameData);
}

/**
 * 姓名判断優先モードの切り替え
 */
function toggleFortunePriority() {
    prioritizeFortune = !prioritizeFortune;
    const btn = document.getElementById('btn-fortune');
    if (btn) btn.classList.toggle('active', prioritizeFortune);
    console.log(`CORE: Fortune priority ${prioritizeFortune ? 'ON' : 'OFF'}`);
}

/**
 * 画面遷移（モーダル自動クローズ付き）
 */
function changeScreen(id) {
    console.log(`CORE: Screen transition -> ${id}`);

    // 開いているモーダルを全て閉じる
    const modals = document.querySelectorAll('.overlay.active');
    modals.forEach(m => m.classList.remove('active'));

    // 全画面を非表示
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    // ターゲット画面を表示
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        target.scrollTop = 0;
    } else {
        console.error(`CORE: Screen not found: ${id}`);
        return;
    }

    // フッターの表示制御（ウィザードや入力フローでは非表示にする）
    const footer = document.getElementById('bottom-nav');
    const wizardScreens = [
        'scr-wizard',
        'scr-gender',
        'scr-vibe',
        'scr-akinator'
    ];

    if (footer) {
        if (wizardScreens.includes(id)) {
            footer.classList.add('hidden');
        } else {
            footer.classList.remove('hidden');
        }
    }

    // トップ画面の場合、実績・プロファイルを更新
    if (id === 'scr-mode' && typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }

    // ナビゲーションハイライト更新
    updateNavHighlight(id);
}

/**
 * モーダルを閉じる
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * ナビゲーションハイライト更新
 */
function updateNavHighlight(screenId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active-nav'));

    const navMap = {
        'scr-mode': 'nav-home',
        'scr-main': 'nav-search',
        'scr-swipe-universal': 'nav-search',
        'scr-input-reading': 'nav-search',
        'scr-input-sound-entry': 'nav-search',
        'scr-segment': 'nav-search',
        'scr-input-nickname': 'nav-search',
        'scr-vibe': 'nav-search',
        'scr-diagnosis-input': 'nav-search',
        'scr-stock': 'nav-stock',
        'scr-build': 'nav-build',
        'scr-saved': 'nav-saved',
        'scr-history': 'nav-saved',
    };

    const navId = navMap[screenId];
    if (navId) {
        const navEl = document.getElementById(navId);
        if (navEl) navEl.classList.add('active-nav');
    }
}

/**
 * 文字列クリーニング
 */
function clean(str) {
    if (!str) return "";
    let s = str.toString().trim();
    if (/^(なし|ー|undefined|null|（なし）)$/.test(s)) return "";
    return s;
}

/**
 * カタカナ→ひらがな変換
 */
function toHira(str) {
    if (!str) return "";
    return str.toString().replace(/[\u30a1-\u30f6]/g, m =>
        String.fromCharCode(m.charCodeAt(0) - 0x60)
    );
}

/**
 * タグスコアの更新
 * @param {Array<string>} tags タグの配列
 * @param {number} delta 加算・減算値
 */
function updateTagScore(tags, delta) {
    if (!tags || !Array.isArray(tags)) return;
    tags.forEach(t => {
        if (!userTags[t]) userTags[t] = 0;
        userTags[t] += delta;
        // スコアの下限を0とする（マイナスにはならない方針）
        if (userTags[t] < 0) userTags[t] = 0;
    });
    console.log("CORE: Tag scores updated:", userTags);
}

/**
 * タグカラースタイル定義（src/constants/kanjiTags.jsから移植）
 */
const KANJI_TAG_STYLES = {
    "#希望": { bgColor: "#FEF3C7", textColor: "#92400E", borderColor: "#FDE68A" },
    "#伝統": { bgColor: "#FCE7F3", textColor: "#9D174D", borderColor: "#FBCFE8" },
    "#奏楽": { bgColor: "#EDE9FE", textColor: "#5B21B6", borderColor: "#DDD6FE" },
    "#自然": { bgColor: "#DCFCE7", textColor: "#166534", borderColor: "#BBF7D0" },
    "#品格": { bgColor: "#F3F4F6", textColor: "#374151", borderColor: "#E5E7EB" },
    "#飛躍": { bgColor: "#E0F2FE", textColor: "#0369A1", borderColor: "#BAE6FD" },
    "#慈愛": { bgColor: "#FDF2F8", textColor: "#BE185D", borderColor: "#FCE7F3" },
    "#色彩": { bgColor: "#FFEDD5", textColor: "#C2410C", borderColor: "#FED7AA" },
    "#水景": { bgColor: "#CFFAFE", textColor: "#0F766E", borderColor: "#A5F3FC" },
    "#調和": { bgColor: "#CCFBF1", textColor: "#0F766E", borderColor: "#99F6E4" },
    "#信念": { bgColor: "#E2E8F0", textColor: "#334155", borderColor: "#CBD5E1" },
    "#勇壮": { bgColor: "#FEE2E2", textColor: "#B91C1C", borderColor: "#FECACA" },
    "#天空": { bgColor: "#DBEAFE", textColor: "#1E40AF", borderColor: "#BFDBFE" },
    "#知性": { bgColor: "#E0E7FF", textColor: "#4338CA", borderColor: "#C7D2FE" },
    "#幸福": { bgColor: "#D1FAE5", textColor: "#047857", borderColor: "#A7F3D0" },
    "#力強い": { bgColor: "#DBEAFE", textColor: "#1D4ED8", borderColor: "#93C5FD" },
    "#ふんわり": { bgColor: "#FCE7F3", textColor: "#BE185D", borderColor: "#F9A8D4" },
    "#クール": { bgColor: "#E2E8F0", textColor: "#334155", borderColor: "#CBD5E1" },
    "#爽やか": { bgColor: "#DCFCE7", textColor: "#15803D", borderColor: "#86EFAC" },
    "#レトロ": { bgColor: "#FDE68A", textColor: "#92400E", borderColor: "#FCD34D" },
    "#ロング": { bgColor: "#EDE9FE", textColor: "#6D28D9", borderColor: "#C4B5FD" },
    "#自然語": { bgColor: "#D1FAE5", textColor: "#166534", borderColor: "#86EFAC" },
    "#中性的": { bgColor: "#FEF3C7", textColor: "#92400E", borderColor: "#FDE68A" },
    "#あたたかい": { bgColor: "#FFEDD5", textColor: "#C2410C", borderColor: "#FDBA74" },
    "#今風": { bgColor: "#E0E7FF", textColor: "#4338CA", borderColor: "#A5B4FC" },
    "#のびのび": { bgColor: "#CCFBF1", textColor: "#0F766E", borderColor: "#99F6E4" },
    "#華やか": { bgColor: "#FBCFE8", textColor: "#9D174D", borderColor: "#F9A8D4" },
    "#なごやか": { bgColor: "#FEF9C3", textColor: "#854D0E", borderColor: "#FDE68A" },
    "#ショート": { bgColor: "#E0F2FE", textColor: "#0369A1", borderColor: "#7DD3FC" },
    "#はつらつ": { bgColor: "#FECACA", textColor: "#B91C1C", borderColor: "#FCA5A5" },
    "#存在感": { bgColor: "#DDD6FE", textColor: "#5B21B6", borderColor: "#C4B5FD" },
    "#ひたむき": { bgColor: "#E9D5FF", textColor: "#7E22CE", borderColor: "#D8B4FE" },
    "#繊細": { bgColor: "#F5D0FE", textColor: "#A21CAF", borderColor: "#F0ABFC" },
    "#海外風": { bgColor: "#CFFAFE", textColor: "#0F766E", borderColor: "#67E8F9" }
};

function getTagStyle(tag) {
    const key = tag.startsWith("#") ? tag : "#" + tag;
    if (KANJI_TAG_STYLES[key]) return KANJI_TAG_STYLES[key];
    const match = Object.keys(KANJI_TAG_STYLES).find(k => key.includes(k));
    if (match) return KANJI_TAG_STYLES[match];
    return { bgColor: "#F3F4F6", textColor: "#4B5563", borderColor: "#E5E7EB" };
}

console.log("CORE: Module loaded (v15.3 - Added Tag Scores and Styles)");
