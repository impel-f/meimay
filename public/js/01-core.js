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

const MEIMAY_PRODUCTION_API_ORIGIN = 'https://meimay.vercel.app';

function isNativeAppRuntime() {
    try {
        const platform = window.Capacitor && typeof window.Capacitor.getPlatform === 'function'
            ? String(window.Capacitor.getPlatform() || '').toLowerCase()
            : '';
        return platform === 'ios' || platform === 'android';
    } catch (e) {
        return false;
    }
}
window.isNativeAppRuntime = isNativeAppRuntime;

function getMeimayApiUrl(path) {
    const normalizedPath = String(path || '').startsWith('/')
        ? String(path || '')
        : `/${String(path || '')}`;
    return isNativeAppRuntime()
        ? `${MEIMAY_PRODUCTION_API_ORIGIN}${normalizedPath}`
        : normalizedPath;
}
window.getMeimayApiUrl = getMeimayApiUrl;

function formatSwipeProgressText(options = {}) {
    const toCount = (value) => {
        const count = Number(value);
        return Number.isFinite(count) ? Math.max(0, count) : 0;
    };
    const kept = toCount(options.kept);
    const superCount = Math.max(0, Math.min(kept, toCount(options.superCount)));
    const candidateCount = Math.max(0, kept - superCount);
    const parts = [`本命${superCount}件`, `候補${candidateCount}件`];
    const remaining = options.remaining;

    if (remaining !== null && remaining !== undefined && Number.isFinite(Number(remaining))) {
        parts.push(`残り${toCount(remaining)}回`);
    }

    return parts.join('・');
}

// ============================================================
// TOAST UTILITY
// ============================================================
function showToast(message, icon = '✨', onAction = null) {
    if (!document.getElementById('meimay-toast-style')) {
        const style = document.createElement('style');
        style.id = 'meimay-toast-style';
        style.textContent = `
            @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(-20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
            @keyframes toastOut { from { opacity:1; transform:translateX(-50%) translateY(0); } to { opacity:0; transform:translateX(-50%) translateY(-20px); } }
        `;
        document.head.appendChild(style);
    }

    const existing = document.getElementById('meimay-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'meimay-toast';
    toast.style.cssText = `
        position: fixed; top: calc(60px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%);
        background: rgba(93,84,68,0.95); color: white; padding: 12px 20px;
        border-radius: 16px; font-size: 13px; font-weight: 700;
        z-index: 99999; display: flex; align-items: center; gap: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); backdrop-filter: blur(12px);
        animation: toastIn 0.3s ease-out;
        width: max-content; max-width: 90vw; line-height: 1.45; text-align: center;
    `;

    const iconEl = document.createElement('span');
    iconEl.style.fontSize = '18px';
    iconEl.textContent = icon;
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    toast.appendChild(iconEl);
    toast.appendChild(messageEl);

    if (onAction) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '取り込む';
        button.style.cssText = `
            margin-left:8px; padding:4px 12px; background:rgba(255,255,255,0.2);
            border:none; color:white; border-radius:8px; font-size:11px; font-weight:900; cursor:pointer;
        `;
        button.addEventListener('click', () => {
            onAction();
            toast.remove();
        });
        toast.appendChild(button);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
        if (!toast.parentElement) return;
        toast.style.animation = 'toastOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, onAction ? 10000 : 4000);
}
window.showToast = showToast;

let _homeRenderRequest = null;
/**
 * ホーム画面の更新を予約（連打防止・GPU負荷軽減）
 */
function requestRenderHomeProfile() {
    if (_homeRenderRequest) return;
    _homeRenderRequest = requestAnimationFrame(() => {
        _homeRenderRequest = null;
        if (typeof renderHomeProfile === 'function') {
            renderHomeProfile();
        }
    });
}
window.requestRenderHomeProfile = requestRenderHomeProfile;

let yomiSearchData = [];
let readingsData = []; // 追加: 読み(タグ付き)詳細データ
let compoundReadingsData = []; // まとめ読み候補データ
let readingSegmentRules = {
    approvedSegments: {},
    disabledSegments: []
};
window.meimayDataLoadStatus = window.meimayDataLoadStatus || {
    master: 'idle',
    yomiSearchData: 'idle',
    readingsData: 'idle',
    compoundReadingsData: 'idle',
    readingSegmentRules: 'idle'
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
    return normalizeReadingComparisonValue(value);
}

function normalizeReadingComparisonValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const hira = typeof toHira === 'function' ? toHira(raw) : raw;
    return hira
        .replace(/[っッ]/g, 'つ')
        .replace(/\s+/g, '')
        .replace(/[^\u3041-\u3093\u30fc]/g, '');
}

function splitKanjiReadingEntries(value) {
    return String(value || '')
        .split(/[、,，\s/]+/)
        .map(entry => String(entry || '').trim())
        .filter(Boolean);
}

function getKanjiReadingForms(value, options = {}) {
    const includeStem = options && options.includeStem === true;
    const forms = new Set();

    splitKanjiReadingEntries(value).forEach((entry) => {
        const hira = typeof toHira === 'function' ? toHira(entry) : entry;
        const full = normalizeReadingComparisonValue(hira);
        if (full) forms.add(full);

        if (!includeStem) return;

        const stemBreaks = ['.', '（', '(']
            .map(marker => hira.indexOf(marker))
            .filter(index => index > 0);
        if (stemBreaks.length === 0) return;

        const stem = normalizeReadingComparisonValue(hira.slice(0, Math.min(...stemBreaks)));
        if (stem) forms.add(stem);
    });

    return [...forms];
}

function getKanjiReadingBuckets(item) {
    const majorSource = ((item?.['音'] || '') + ',' + (item?.['訓'] || ''));
    const minorSource = item?.['伝統名のり'] || '';
    const majorReadings = getKanjiReadingForms(majorSource);
    const minorReadings = getKanjiReadingForms(minorSource);
    const majorStrictReadings = getKanjiReadingForms(majorSource, { includeStem: false });
    const minorStrictReadings = getKanjiReadingForms(minorSource, { includeStem: false });

    return {
        majorReadings,
        minorReadings,
        allReadings: [...new Set([...majorReadings, ...minorReadings])],
        majorStrictReadings,
        minorStrictReadings,
        allStrictReadings: [...new Set([...majorStrictReadings, ...minorStrictReadings])]
    };
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

    return null;
}

/**
 * アプリ初期化
 */
window.onload = () => {
    console.log("CORE: Initializing Meimay App...");
    const statusEl = document.getElementById('status');
    if (window.meimayDataLoadStatus) {
        window.meimayDataLoadStatus.master = 'loading';
        window.meimayDataLoadStatus.yomiSearchData = 'loading';
        window.meimayDataLoadStatus.readingsData = 'loading';
        window.meimayDataLoadStatus.compoundReadingsData = 'loading';
        window.meimayDataLoadStatus.readingSegmentRules = 'loading';
    }

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
            if (window.meimayDataLoadStatus) {
                window.meimayDataLoadStatus.master = 'loaded';
            }
            console.log("CORE: Sample kanji:", master[0]);
            console.log(`CORE: ${master.length} kanji loaded successfully`);

            // 読みデータのインデックス作成
            master.forEach(k => {
                const buckets = getKanjiReadingBuckets(k);
                buckets.allStrictReadings.forEach(reading => validReadingsSet.add(reading));
            });

            console.log(`CORE: ${validReadingsSet.size} unique readings indexed`);
            if (typeof renderHomeProfile === 'function' && document.getElementById('scr-mode')) {
                renderHomeProfile();
            }

            // UI更新 (今日の一字)
            if (typeof initTodaysKanji === 'function') {
                initTodaysKanji();
            }

            if (typeof updateSurnameData === 'function') {
                updateSurnameData();
            }

            // 四字熟語・ことわざデータの読み込み（非同期）
            fetch('/data/idioms.json?v=25.01')
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
                    if (typeof updateSurnameData === 'function') {
                        updateSurnameData();
                    }
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
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.yomiSearchData = Array.isArray(yomiData) && yomiData.length > 0 ? 'loaded' : 'empty';
                    }
                    console.log(`CORE: Loaded ${yomiData.length} yomi search entries`);
                })
                .catch(err => {
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.yomiSearchData = 'failed';
                    }
                    console.warn("CORE: Failed to load yomi search data", err);
                });

            // タグ付き読みデータの読み込み（非同期）
            fetch('/data/readings_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(rData => {
                    readingsData = rData;
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.readingsData = Array.isArray(rData) && rData.length > 0 ? 'loaded' : 'empty';
                    }
                    console.log(`CORE: Loaded ${rData.length} reading entries with tags`);
                })
                .catch(err => {
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.readingsData = 'failed';
                    }
                    console.warn("CORE: Failed to load readings data", err);
                });

            fetch('/data/compound_readings_data.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return [];
                })
                .then(cData => {
                    compoundReadingsData = Array.isArray(cData) ? cData : [];
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.compoundReadingsData = compoundReadingsData.length > 0 ? 'loaded' : 'empty';
                    }
                    console.log(`CORE: Loaded ${compoundReadingsData.length} compound reading entries`);
                })
                .catch(err => {
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.compoundReadingsData = 'failed';
                    }
                    console.warn("CORE: Failed to load compound reading data", err);
                });

            fetch('/data/reading_segment_rules.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return null;
                })
                .then(ruleData => {
                    if (!ruleData) {
                        if (window.meimayDataLoadStatus) {
                            window.meimayDataLoadStatus.readingSegmentRules = 'empty';
                        }
                        return;
                    }
                    setReadingSegmentRules(ruleData);
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.readingSegmentRules = 'loaded';
                    }
                })
                .catch(err => {
                    if (window.meimayDataLoadStatus) {
                        window.meimayDataLoadStatus.readingSegmentRules = 'failed';
                    }
                    console.warn("CORE: Failed to load reading segment rules", err);
                });
        })
        .catch(err => {
            if (window.meimayDataLoadStatus) {
                window.meimayDataLoadStatus.master = 'failed';
            }
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
function resolveFortuneStrokeForChar(char, fallback = 0) {
    const key = String(char || '').trim();
    if (!key) return 0;
    const fallbackValue = parseInt(fallback, 10) || 0;
    if (strokeData && strokeData[key]) return parseInt(strokeData[key], 10) || fallbackValue;
    const found = Array.isArray(master) ? master.find(k => k['漢字'] === key) : null;
    if (found) return parseInt(found['画数'], 10) || fallbackValue;
    return fallbackValue;
}

function getFortuneSurnameData(source = surnameData, fallbackSurname = surnameStr) {
    const sourceItems = Array.isArray(source) ? source : [];
    const chars = sourceItems.length > 0
        ? sourceItems.map(item => ({
            ...item,
            kanji: item?.kanji || item?.['漢字'] || ''
        }))
        : Array.from(String(fallbackSurname || '').trim()).map(char => ({ kanji: char, strokes: 0 }));

    return chars
        .filter(item => item && String(item.kanji || '').trim())
        .map(item => {
            const kanji = String(item.kanji || '').trim();
            return {
                ...item,
                kanji,
                strokes: resolveFortuneStrokeForChar(kanji, item.strokes)
            };
        });
}
window.getFortuneSurnameData = getFortuneSurnameData;

function updateSurnameData() {
    const input = document.getElementById('in-surname');
    if (!input) return;

    surnameStr = input.value.trim();
    surnameData = getFortuneSurnameData([], surnameStr);

    console.log("CORE: Surname data updated ->", surnameData);

    if (
        typeof FortuneLogic !== 'undefined' &&
        FortuneLogic.calculate &&
        typeof currentBuildResult !== 'undefined' &&
        currentBuildResult &&
        Array.isArray(currentBuildResult.combination) &&
        currentBuildResult.combination.length > 0
    ) {
        const givArr = currentBuildResult.combination
            .map(part => ({
                kanji: part?.kanji || part?.['漢字'] || '',
                strokes: parseInt(part?.strokes ?? part?.['画数'] ?? part?.['逕ｻ謨ｰ'] ?? 0, 10) || 0
            }))
            .filter(part => part.kanji);

        if (givArr.length > 0) {
            currentBuildResult.fortune = FortuneLogic.calculate(surnameData, givArr);
        }
    }

    const fortuneModal = document.getElementById('modal-fortune-detail');
    if (fortuneModal && fortuneModal.classList.contains('active') && typeof showFortuneDetail === 'function') {
        showFortuneDetail();
    }

    if (typeof syncPairingSurnameDisplay === 'function') {
        syncPairingSurnameDisplay();
    }
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

    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === 'function' && /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName || '')) {
        try {
            activeElement.blur();
        } catch (e) { }
    }

    // 1. [最優先] 画面の表示切り替えを即座に実行
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

    // ナビゲーションハイライト更新（これは高速なので即時実行）
    updateNavHighlight(id);

    // 2. [後回し] 重いレンダリングや集計処理を非同期で実行（画面遷移をブロックしない）
    setTimeout(() => {
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

        if (typeof updateAdLayoutSpacing === 'function') {
            updateAdLayoutSpacing();
        }

        // ホーム画面の場合、実績・プロファイルを更新
        if (id === 'scr-mode') {
            requestRenderHomeProfile();
        }
        if ((id === 'scr-mode' || id === 'scr-input-reading') && typeof updateDailyRemainingDisplay === 'function') {
            updateDailyRemainingDisplay();
        }

        // 歴史画面のスクロール位置復元など
        if (id === 'scr-history' && typeof restoreHistoryScroll === 'function') {
            restoreHistoryScroll();
        }

        if (typeof maybeShowContextualCoachmark === 'function') {
            maybeShowContextualCoachmark(id);
        }
    }, 0);
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

