/* V1 hydrate adapter for multi-child workspaces. */
(function () {
    const ROOT_KEY = 'meimay_state_v2';
    const ROOT_VERSION = 2;
    const SHARED_KANJI_SESSION = 'SHARED_LIBRARY';
    const IMPORTED_KANJI_SESSION = 'INHERITED_LIBRARY';
    const KANJI_KEY = '\u6f22\u5b57';
    const SCREEN_HOST_SELECTORS = {
        'scr-mode': '#scr-mode .home-screen-shell',
        'scr-input-reading': '#scr-input-reading .w-full.max-w-sm',
        'scr-stock': '#scr-stock .w-full.max-w-md',
        'scr-build': '#build-header-sticky',
        'scr-settings': '#settings-screen-content',
        'scr-saved': '#scr-saved .w-full.max-w-md',
        'scr-history': '#scr-history .w-full.max-w-md'
    };
    const KNOWN_SCREENS = Object.keys(SCREEN_HOST_SELECTORS);
    const JAPANESE_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const MAX_BIRTH_ORDER = 10;
    const MAX_MULTIPLE_CHILDREN = 5;
    const MULTIPLE_CHILD_LABELS = ['ひとりめ', 'ふたりめ', 'さんにんめ', 'よにんめ', 'ごにんめ'];

    function cloneData(value, fallback) {
        if (value === undefined) return cloneFallback(fallback);
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return cloneFallback(fallback);
        }
    }

    function cloneFallback(fallback) {
        if (fallback === undefined) return undefined;
        try {
            return JSON.parse(JSON.stringify(fallback));
        } catch (error) {
            return fallback;
        }
    }

    function parseComparableTime(value) {
        const time = new Date(String(value || '').trim() || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function normalizeDeletedChildrenMap(value) {
        const next = {};
        if (!value) return next;

        const assignDeletedAt = (childId, deletedAt = '') => {
            const safeId = String(childId || '').trim();
            if (!safeId) return;
            next[safeId] = String(deletedAt || '').trim();
        };

        if (Array.isArray(value)) {
            value.forEach((entry) => {
                if (!entry) return;
                if (typeof entry === 'string' || typeof entry === 'number') {
                    assignDeletedAt(entry, '');
                    return;
                }
                assignDeletedAt(
                    entry?.id || entry?.childId || entry?.meta?.id || '',
                    entry?.deletedAt || entry?.removedAt || entry?.updatedAt || entry?.createdAt || ''
                );
            });
            return next;
        }

        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, entry]) => {
                if (typeof entry === 'string' || typeof entry === 'number') {
                    assignDeletedAt(key, entry);
                    return;
                }
                assignDeletedAt(
                    key || entry?.id || entry?.childId || '',
                    entry?.deletedAt || entry?.removedAt || entry?.updatedAt || entry?.createdAt || ''
                );
            });
        }

        return next;
    }

    function mergeDeletedChildrenMaps(localMap = {}, remoteMap = {}) {
        const merged = normalizeDeletedChildrenMap(localMap);
        const incoming = normalizeDeletedChildrenMap(remoteMap);
        Object.entries(incoming).forEach(([childId, deletedAt]) => {
            const existingAt = merged[childId];
            if (!existingAt) {
                merged[childId] = deletedAt;
                return;
            }
            if (parseComparableTime(deletedAt) > parseComparableTime(existingAt)) {
                merged[childId] = deletedAt;
            }
        });
        return merged;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeGenderValue(value) {
        const raw = String(value || '').trim().toLowerCase();
        return raw === 'male' || raw === 'female' ? raw : 'neutral';
    }

    function normalizeTwinSuffix(value) {
        return String(value || '').trim().toUpperCase();
    }

    function multipleIndexToSuffix(index) {
        const safeIndex = normalizeNonNegativeInteger(index, 0);
        let value = safeIndex + 1;
        let suffix = '';
        while (value > 0) {
            const digit = (value - 1) % 26;
            suffix = String.fromCharCode(65 + digit) + suffix;
            value = Math.floor((value - 1) / 26);
        }
        return suffix;
    }

    function multipleSuffixToIndex(value) {
        const raw = normalizeTwinSuffix(value);
        if (!raw || !/^[A-Z]+$/.test(raw)) return null;
        let next = 0;
        for (let i = 0; i < raw.length; i += 1) {
            next = (next * 26) + (raw.charCodeAt(i) - 64);
        }
        return next > 0 ? next - 1 : null;
    }

    function normalizeTwinIndex(value, suffix = '') {
        if (value === null || value === undefined || value === '') {
            return multipleSuffixToIndex(suffix);
        }
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed >= 0) return parsed;
        return multipleSuffixToIndex(value);
    }

    function normalizeMultipleCount(value, fallback = null) {
        const parsed = parseInt(value, 10);
        const fallbackParsed = parseInt(fallback, 10);
        const candidate = Number.isFinite(parsed) ? parsed : fallbackParsed;
        if (!Number.isFinite(candidate)) return null;
        return Math.max(2, Math.min(MAX_MULTIPLE_CHILDREN, candidate));
    }

    function normalizePositiveInteger(value, fallback = 1) {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    function normalizeNonNegativeInteger(value, fallback = 0) {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    function getNowIso() {
        return new Date().toISOString();
    }

    function getGenderLabel(gender) {
        return gender === 'male' ? '男の子' : gender === 'female' ? '女の子' : '指定なし';
    }

    function getJapaneseOrderLabel(order) {
        const safeOrder = normalizePositiveInteger(order, 1);
        if (safeOrder < JAPANESE_NUMERALS.length) return `第${JAPANESE_NUMERALS[safeOrder]}子`;
        return `第${safeOrder}子`;
    }

    function getMultipleGroupLabel(count) {
        const safeCount = normalizeMultipleCount(count, 2) || 2;
        const labels = {
            2: '双子',
            3: '三つ子',
            4: '四つ子',
            5: '五つ子'
        };
        return labels[safeCount] || `${safeCount}つ子`;
    }

    function getMultiplePositionLabel(index) {
        const safeIndex = normalizeNonNegativeInteger(index, 0);
        return MULTIPLE_CHILD_LABELS[safeIndex] || `${safeIndex + 1}人目`;
    }

    function buildDisplayLabel(order, twinIndex = null, multipleCount = null) {
        const baseLabel = getJapaneseOrderLabel(order);
        const normalizedTwinIndex = normalizeTwinIndex(twinIndex);
        if (normalizedTwinIndex === null) return baseLabel;
        const safeCount = normalizeMultipleCount(multipleCount, Math.max(normalizedTwinIndex + 1, 2));
        return `${getJapaneseOrderLabel(normalizePositiveInteger(order, 1) + normalizedTwinIndex)}（${getMultipleGroupLabel(safeCount)}）`;
    }

    function getWorkspaceSavedCombinationKey(item) {
        if (!item) return '';
        if (Array.isArray(item.combination) && item.combination.length > 0) {
            return item.combination.map((part) => part?.['漢字'] || part?.kanji || '').join('').trim();
        }
        return Array.isArray(item.combinationKeys)
            ? item.combinationKeys.join('').trim()
            : '';
    }

    function getWorkspaceSavedGivenName(item) {
        if (!item) return '';
        const direct = String(item.givenName || '').trim();
        if (direct) return direct;
        const combinationKey = getWorkspaceSavedCombinationKey(item);
        if (combinationKey) return combinationKey;
        const fullName = String(item.fullName || '').trim();
        if (!fullName) return '';
        const parts = fullName.split(/\s+/).filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 1] : fullName;
    }

    function getWorkspaceSavedGivenReading(item) {
        if (!item) return '';
        const direct = String(item.givenReading || item.givenNameReading || '').trim();
        const reading = direct || String(item.reading || '').trim();
        if (!reading) return '';
        const parts = reading.split(/\s+/).filter(Boolean);
        const target = parts.length > 1 ? parts[parts.length - 1] : reading;
        return (typeof toHira === 'function' ? toHira(target) : target).replace(/\s+/g, '');
    }

    function buildWorkspaceSavedKey(item) {
        if (!item) return '';
        const combinationKey = getWorkspaceSavedCombinationKey(item);
        const givenName = getWorkspaceSavedGivenName(item) || combinationKey;
        const givenReading = getWorkspaceSavedGivenReading(item) || givenName;
        return `${givenName}::${combinationKey}::${givenReading}`.trim();
    }

    function getSavedItemWorkspaceChildId(item) {
        return String(item?.workspaceChildId || item?.meimayChildId || item?.childWorkspaceId || '').trim();
    }

    function stampSavedItemWorkspaceChild(item, childId) {
        const safeChildId = String(childId || '').trim();
        const next = cloneData(item, null);
        if (!next || !safeChildId) return next;
        next.workspaceChildId = safeChildId;
        next.meimayChildId = safeChildId;
        return next;
    }

    function canonicalizeWorkspaceSavedKey(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const parts = raw.split('::');
        if (parts.length < 2) return raw;
        const rawName = String(parts[0] || '').trim();
        const combinationKey = String(parts[1] || '').trim();
        const rawReading = String(parts.slice(2).join('::') || '').trim();
        const nameParts = rawName.split(/\s+/).filter(Boolean);
        const readingParts = rawReading.split(/\s+/).filter(Boolean);
        const givenName = rawName || combinationKey || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : rawName);
        const readingTarget = readingParts.length > 1 ? readingParts[readingParts.length - 1] : rawReading;
        const givenReading = (typeof toHira === 'function' ? toHira(readingTarget) : readingTarget).replace(/\s+/g, '');
        return `${givenName || combinationKey}::${combinationKey}::${givenReading || givenName || combinationKey}`.trim();
    }

    function normalizeWorkspaceSavedCanvasState(state = {}) {
        const blank = state?.blank === true;
        const ownKey = blank ? '' : canonicalizeWorkspaceSavedKey(state?.ownKey);
        const partnerKey = blank ? '' : canonicalizeWorkspaceSavedKey(state?.partnerKey);
        let selectedSource = blank
            ? ''
            : (state?.selectedSource === 'partner' ? 'partner' : (state?.selectedSource === 'own' ? 'own' : ''));
        let selectedKey = blank ? '' : canonicalizeWorkspaceSavedKey(state?.selectedKey);
        if (!selectedKey) {
            selectedKey = selectedSource === 'partner'
                ? partnerKey
                : (selectedSource === 'own' ? ownKey : '');
        }
        if (!selectedSource && selectedKey) {
            if (selectedKey === partnerKey && selectedKey !== ownKey) {
                selectedSource = 'partner';
            } else if (selectedKey === ownKey && selectedKey !== partnerKey) {
                selectedSource = 'own';
            }
        }
        return {
            blank,
            ownKey,
            partnerKey,
            selectedKey,
            selectedSource,
            selectedAt: blank ? '' : String(state?.selectedAt || '').trim()
        };
    }

    function getSavedNameLabel(item) {
        return String(getWorkspaceSavedGivenName(item) || item?.fullName || '').trim();
    }

    function getSavedCanvasStateSnapshot() {
        const blankFlag = typeof window !== 'undefined' && (
            window.__meimaySavedCanvasBlank === true ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('meimay_saved_canvas_blank') === '1')
        );
        if (blankFlag) {
            return { blank: true, ownKey: '', partnerKey: '', selectedKey: '', selectedSource: '', selectedAt: '' };
        }
        const ownKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string'
            ? window.__meimaySavedCanvasOwnKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');
        const partnerKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasPartnerKey === 'string'
            ? window.__meimaySavedCanvasPartnerKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_partner_key') || '') : '');
        const selectedKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedKey === 'string'
            ? window.__meimaySavedCanvasSelectedKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_key') || '') : '');
        const selectedSource = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedSource === 'string'
            ? window.__meimaySavedCanvasSelectedSource
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_source') || '') : '');
        const selectedAt = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedAt === 'string'
            ? window.__meimaySavedCanvasSelectedAt
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_at') || '') : '');
        return normalizeWorkspaceSavedCanvasState({ blank: blankFlag, ownKey, partnerKey, selectedKey, selectedSource, selectedAt });
    }

    function setSavedCanvasStateSnapshot(state = {}) {
        const normalizedState = normalizeWorkspaceSavedCanvasState(state);
        const blank = normalizedState.blank;
        const ownKey = normalizedState.ownKey;
        const partnerKey = normalizedState.partnerKey;
        const selectedKey = normalizedState.selectedKey;
        const selectedSource = normalizedState.selectedSource;
        const selectedAt = normalizedState.selectedAt;
        if (typeof window !== 'undefined') {
            window.__meimaySavedCanvasBlank = blank;
            window.__meimaySavedCanvasOwnKey = ownKey;
            window.__meimaySavedCanvasPartnerKey = partnerKey;
            window.__meimaySavedCanvasSelectedKey = selectedKey;
            window.__meimaySavedCanvasSelectedSource = selectedSource;
            window.__meimaySavedCanvasSelectedAt = selectedAt;
        }
        try {
            if (blank) localStorage.setItem('meimay_saved_canvas_blank', '1');
            else localStorage.removeItem('meimay_saved_canvas_blank');
            if (ownKey) localStorage.setItem('meimay_saved_canvas_own_key', ownKey);
            else localStorage.removeItem('meimay_saved_canvas_own_key');
            if (partnerKey) localStorage.setItem('meimay_saved_canvas_partner_key', partnerKey);
            else localStorage.removeItem('meimay_saved_canvas_partner_key');
            if (selectedKey) localStorage.setItem('meimay_saved_canvas_selected_key', selectedKey);
            else localStorage.removeItem('meimay_saved_canvas_selected_key');
            if (selectedSource) localStorage.setItem('meimay_saved_canvas_selected_source', selectedSource);
            else localStorage.removeItem('meimay_saved_canvas_selected_source');
            if (selectedAt) localStorage.setItem('meimay_saved_canvas_selected_at', selectedAt);
            else localStorage.removeItem('meimay_saved_canvas_selected_at');
        } catch (error) {
            console.warn('CHILD_WORKSPACES: saved canvas state sync failed', error);
        }
        return { blank, ownKey, partnerKey, selectedKey, selectedSource, selectedAt };
    }

    if (typeof window !== 'undefined') {
        window.getMeimaySavedCanvasState = getSavedCanvasStateSnapshot;
        window.setMeimaySavedCanvasState = setSavedCanvasStateSnapshot;
    }

    function getGenderEmoji(gender) {
        return gender === 'male' ? '👦' : gender === 'female' ? '👧' : '👶';
    }

    function hasChildWorkspaceData(state) {
        return !!state && typeof state === 'object' && (
            (state.children && typeof state.children === 'object' && Object.keys(state.children).length > 0)
            || (state.deletedChildren && typeof state.deletedChildren === 'object' && Object.keys(state.deletedChildren).length > 0)
            || (Array.isArray(state.deletedChildIds) && state.deletedChildIds.length > 0)
            || String(state.activeChildId || '').trim()
            || state.updatedAt
            || state.createdAt
        );
    }

    function getChildWorkspaceSlotKey(child) {
        const meta = child?.meta || child || {};
        const birthOrder = normalizePositiveInteger(meta.birthOrder, 1);
        const rawTwinIndex = meta.birthGroupIndex ?? meta.twinIndex ?? meta.multipleIndex ?? null;
        const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
            ? null
            : normalizeNonNegativeInteger(rawTwinIndex, 0);
        return `${birthOrder}:${twinIndex === null ? 'n' : twinIndex}`;
    }

    function getChildWorkspaceSlotKeyFromParts(birthOrder, twinIndex = null) {
        const safeBirthOrder = normalizePositiveInteger(birthOrder, 1);
        const normalizedTwinIndex = normalizeTwinIndex(twinIndex);
        return `${safeBirthOrder}:${normalizedTwinIndex === null ? 'n' : normalizedTwinIndex}`;
    }

    function getChildWorkspaceDateText(child) {
        const value = String(child?.meta?.dueDate || child?.meta?.birthDate || '').trim();
        return formatChildWorkspaceDateText(value);
    }

    function formatChildWorkspaceDateText(value) {
        const raw = String(value || '').trim();
        if (!raw) return '未設定';
        const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!match) return raw;
        const year = match[1];
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        return `${year}年${month}月${day}日`;
    }

    function getChildWorkspaceOwnerLabel(child, fallback = '第一子') {
        if (!child) return fallback;
        return child.meta?.displayLabel || fallback;
    }

    function buildChildWorkspaceSummaryLine(child) {
        if (!child) return '未設定';
        return `${getGenderLabel(child.meta?.gender)} ・ 予定日 ${getChildWorkspaceDateText(child)}`;
    }

    function readJsonArray(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function getKanjiValue(item) {
        return String(item?.[KANJI_KEY] || item?.kanji || '').trim();
    }

    function findMasterKanjiItem(kanji) {
        if (!kanji || !Array.isArray(master)) return null;
        return master.find((entry) => getKanjiValue(entry) === kanji) || null;
    }

    function filterRemovedLikedItems(items, removalSource = null) {
        if (typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function') {
            return StorageBox._filterRemovedLikedItems(items, removalSource);
        }
        return Array.isArray(items) ? items.filter(Boolean) : [];
    }

    function createBlankBuildResult() {
        return {
            fullName: '',
            reading: '',
            fortune: null,
            combination: [],
            givenName: '',
            timestamp: null
        };
    }

    function createBlankChildDraft() {
        return {
            segments: [],
            currentPos: 0,
            currentIdx: 0,
            swipes: 0,
            buildMode: 'reading',
            selectedPieces: [],
            currentBuildResult: createBlankBuildResult(),
            compoundFlow: null,
            readingInputValue: '',
            fbChoices: [],
            fbChoicesUseMark: {},
            shownFbSlots: 1,
            fbSelectedReading: null,
            fbSelectedReadingSource: 'auto',
            currentFbRecommendedReadings: [],
            excludedKanjiFromBuild: []
        };
    }

    function createBlankChildLibraries() {
        return {
            readingStock: [],
            kanjiStock: [],
            savedNames: [],
            readingHistory: [],
            hiddenReadings: [],
            noped: []
        };
    }

    function createBlankFamilyState() {
        return {
            surnameDefault: { kanji: '', reading: '' },
            preferenceModel: {
                userTags: {},
                soundPreferenceData: { liked: [], noped: [] }
            },
            sharedLibraries: {
                readingStock: [],
                kanjiStock: []
            },
            partnerChildLinks: {},
            appSettings: {
                shareMode: 'auto',
                showInappropriateKanji: false
            }
        };
    }

    const MeimayChildWorkspaces = {
        root: null,
        initialized: false,
        _persistenceLocked: false,
        _styleInstalled: false,
        _wrapped: false,
        _partnerAlignmentAutoTimer: null,
        _partnerAlignmentAutoShownKey: '',

        install() {
            if (this._wrapped) return;
            this._wrapped = true;
            this.installStyles();
            this.wrapOnload();
            this.wrapPersistenceHooks();
            this.wrapRenderHooks();
        },

        init() {
            if (this.initialized) {
                this.renderSwitchers();
                return;
            }
            this.root = this.loadOrMigrateRoot();
            this.initialized = true;
            this.applyActiveChildToGlobals({ reason: 'init' });
            this.renderSwitchers();
            this.refreshVisibleUI('init');
            if (typeof updatePairingUI === 'function') updatePairingUI();
            window.addEventListener('beforeunload', () => this.persistActiveChildSnapshot('beforeunload'));
            setInterval(() => this.persistActiveChildSnapshot('interval'), 15000);
        },

        installStyles() {
            if (this._styleInstalled) return;
            this._styleInstalled = true;
            const style = document.createElement('style');
            style.id = 'meimay-child-workspaces-style';
            style.textContent = `
                .meimay-child-header-btn{display:inline-flex;align-items:center;justify-content:center;max-width:min(46vw, 160px);min-width:86px;padding:9px 14px;border:1px solid #d4c5af;border-radius:9999px;background:#fff;color:#5d5444;font-size:11px;font-weight:900;line-height:1.1;box-shadow:0 8px 18px -20px rgba(123,104,83,.28);transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
                .meimay-child-header-btn:active{transform:scale(.97)}
                .meimay-child-switcher{display:none}
                .meimay-child-switcher.compact{display:none}
                .meimay-child-switcher-header{display:none}
                .meimay-child-switcher-title,.meimay-child-switcher-subtitle,.meimay-child-switcher-meta,.meimay-child-chip-row,.meimay-child-chip,.meimay-child-chip-add,.meimay-child-chip-sub{display:none}
                .meimay-child-inline-btn,.meimay-child-modal-btn{border:1px solid #eadfce;background:#fff;color:#5d5444;border-radius:9999px;font-weight:750;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease,color .15s ease;padding:8px 12px;font-size:11px}
                .meimay-child-modal-btn{min-height:48px;padding:12px 16px;font-size:14px}
                .meimay-child-inline-btn:active,.meimay-child-modal-btn:active{transform:scale(.97)}
                .meimay-child-modal-overlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:clamp(12px,3vw,24px);background:rgba(49,38,24,.36);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
                .meimay-child-modal-sheet{width:min(440px,100%);max-height:min(86vh,760px);overflow-y:auto;border-radius:22px;background:#fffdf8;border:1px solid rgba(221,214,203,.9);box-shadow:0 24px 60px rgba(54,45,34,.2);padding:24px 18px calc(18px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px}
                .meimay-child-modal-header{position:relative;display:flex;flex-direction:column;gap:0}
                .meimay-child-modal-topbar{position:sticky;top:0;z-index:6;display:flex;justify-content:flex-end;align-items:flex-start;height:36px;padding:0;background:transparent}
                .meimay-child-modal-close{position:relative;width:36px;height:36px;border-radius:9999px;border:1px solid #eadfce;background:#fff;color:#7a6f5a;font-size:20px;font-weight:850;line-height:1;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s ease,box-shadow .15s ease,background .15s ease;z-index:2}
                .meimay-child-modal-close:active{transform:scale(.95)}
                .meimay-child-modal-copy{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;width:100%;box-sizing:border-box;margin-top:-36px;padding:2px 44px 0}
                .meimay-child-modal-title{color:#4f4536;font-size:18px;font-weight:800;line-height:1.35;text-align:center}
                .meimay-child-modal-desc{display:none}
                .meimay-child-modal-section{margin-top:0;padding:14px;border:1px solid rgba(229,219,203,.86);border-radius:18px;background:linear-gradient(180deg,#fffaf2 0%,#fffdf8 100%)}
                .meimay-child-copy-panel{margin-top:12px;padding:14px;border:1px solid rgba(229,219,203,.86);border-radius:16px;background:rgba(255,255,255,.92);display:grid;gap:12px}
                .meimay-child-copy-panel .meimay-child-field{margin-top:0}
                .meimay-child-step-label{display:none}
                .meimay-child-modal-section-title{color:#4f4536;font-size:14px;font-weight:850;letter-spacing:0}
                .meimay-child-modal-stack{display:grid;gap:12px;margin-top:12px}
                .meimay-child-card{position:relative;margin-top:0;padding:14px;border:1px solid #eadfce;border-radius:16px;background:#fffdf8;box-shadow:0 10px 24px -22px rgba(74,58,37,.34);overflow:hidden}
                .meimay-child-card.active{background:#fff8e8;border-color:#d4b887;box-shadow:0 12px 26px -21px rgba(157,120,57,.42)}
                .meimay-child-card.active:before{content:"";position:absolute;left:0;top:13px;bottom:13px;width:4px;border-radius:0 9999px 9999px 0;background:#c79a52}
                .meimay-child-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
                .meimay-child-card-title{color:#3f372d;font-size:15px;font-weight:850;line-height:1.35}
                .meimay-child-card-meta{margin-top:4px;color:#81715d;font-size:11px;font-weight:700;line-height:1.45}
                .meimay-child-partner-presence{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 9px;border:1px solid #d6dfcb;border-radius:9999px;background:#f5fbf1;color:#55745c;font-size:10px;font-weight:900;line-height:1.2}
                .meimay-child-partner-presence.away{border-color:#eadfce;background:#fff8e8;color:#8a6425}
                .meimay-child-partner-presence-dot{width:6px;height:6px;border-radius:9999px;background:#70a76d;flex:0 0 auto}
                .meimay-child-partner-presence.away .meimay-child-partner-presence-dot{background:#c49b5b}
                .meimay-child-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:9999px;background:#fff5de;color:#a27d47;font-size:10px;font-weight:750}
                .meimay-child-current-status{display:flex;align-items:center;justify-content:center;min-height:44px;border:1px solid #e5c98f;border-radius:9999px;background:#fff2ce;color:#8a6425;font-size:13px;font-weight:900}
                .meimay-child-card-actions,.meimay-child-shared-actions,.meimay-child-editor-actions{display:flex;flex-direction:column;gap:8px;margin-top:12px}
                .meimay-child-manager-edit{min-width:96px;min-height:40px;padding:9px 13px;border-color:#e2d3bd;background:#fff;color:#5d5444;font-size:12px;font-weight:800;box-shadow:0 8px 18px -18px rgba(74,58,37,.38)}
                .meimay-child-manager-switch{min-height:46px;border-color:#a98755;background:#a98755;color:#fff;box-shadow:0 12px 24px -18px rgba(136,96,45,.58)}
                .meimay-child-manager-switch:active{box-shadow:0 8px 16px -16px rgba(136,96,45,.58)}
                .meimay-child-add-action{min-height:46px;border-color:#d2bd9d;background:#fffaf2;color:#5d5444}
                .meimay-child-editor-actions{position:static;padding-top:12px}
                .meimay-child-editor-current{padding:13px 14px;border:1px solid #eadfce;border-radius:16px;background:#fff8e8}
                .meimay-child-editor-current-kicker{color:#b58a4d;font-size:10px;font-weight:900;letter-spacing:.12em}
                .meimay-child-editor-current-title{margin-top:4px;color:#3f372d;font-size:17px;font-weight:900;line-height:1.35}
                .meimay-child-editor-current-meta{margin-top:4px;color:#81715d;font-size:11px;font-weight:750}
                .meimay-child-editor-field{margin-top:0;padding:13px;border:1px solid #eadfce;border-radius:16px;background:#fff}
                .meimay-child-editor-field .meimay-child-field-label{margin-bottom:8px;color:#6f6657;font-size:11px;font-weight:900}
                .meimay-child-editor-field .meimay-child-multiple-toggle{margin-top:12px;padding:11px 0 0;border:0;border-top:1px solid #f0e5d5;border-radius:0;background:transparent}
                .meimay-child-save-action{border-color:#9f7a48;background:#9f7a48;color:#fff;font-weight:900;box-shadow:0 12px 24px -18px rgba(136,96,45,.58)}
                .meimay-child-field{margin-top:14px}
                .meimay-child-field-label{display:block;margin-bottom:7px;color:#6f6657;font-size:12px;font-weight:750}
                .meimay-child-input,.meimay-child-select{width:100%;padding:12px 14px;border:1px solid #eadfce;border-radius:14px;background:#fff;color:#4f4536;font-size:14px;font-weight:650;outline:none}
                .meimay-child-input:focus,.meimay-child-select:focus{border-color:#bca37f}
                .meimay-child-input:disabled,.meimay-child-select:disabled{background:#f7f0e6;color:#9d8f78;border-color:#eadfce;opacity:1}
                .meimay-child-field-hint{margin-top:6px;color:#a6967a;font-size:10px;line-height:1.45}
                .meimay-child-multiple-toggle{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #eadfce;border-radius:14px;background:#fff;color:#4f4536}
                .meimay-child-multiple-toggle input{width:18px;height:18px;margin-top:2px;accent-color:#b9965b;flex:0 0 auto}
                .meimay-child-multiple-title{display:block;color:#4f4536;font-size:12px;font-weight:850;line-height:1.35}
                .meimay-child-multiple-desc{display:block;margin-top:2px;color:#8b7e66;font-size:10px;font-weight:700;line-height:1.45}
                .meimay-child-multiple-area{margin-top:10px}
                .meimay-child-multiple-area[hidden]{display:none}
                .meimay-child-multiple-grid{display:grid;grid-template-columns:1fr;gap:10px}
                @media(max-width:420px){.meimay-child-multiple-grid{grid-template-columns:1fr}}
                .meimay-child-partner-note{margin-top:8px;display:flex;align-items:center;justify-content:center;width:100%;min-height:22px;padding:4px 10px;border-radius:9999px;background:#fff5de;color:#a27d47;font-size:10px;font-weight:900;letter-spacing:.04em;text-align:center;white-space:nowrap;box-sizing:border-box}
                .meimay-child-radio-grid{display:grid;gap:8px;margin-top:10px}
                .meimay-child-radio-option{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #eadfce;border-radius:14px;background:#fff;cursor:pointer}
                .meimay-child-radio-option.selected{border-color:#bca37f;background:#fff9ec}
                .meimay-child-radio-option input{margin-top:2px}
                .meimay-child-radio-title{color:#4f4536;font-size:14px;font-weight:700}
                .meimay-child-radio-desc{margin-top:3px;color:#8b7e66;font-size:12px;line-height:1.45}
                .meimay-child-gender-grid,.meimay-child-toggle-grid{display:grid;gap:8px;margin-top:10px}
                .meimay-child-gender-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
                .meimay-child-gender-btn,.meimay-child-toggle-btn{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:12px 14px;border:1px solid #eadfce;border-radius:14px;background:#fff;color:#4f4536;font-size:14px;font-weight:700;text-align:left}
                .meimay-child-gender-btn{justify-content:center;min-height:48px;padding:12px 8px;text-align:center}
                .meimay-child-gender-btn.selected{border-color:#bca37f;background:#fff9ec}
                .meimay-child-toggle-btn{min-height:48px;border-color:#e5d6c0;background:#fffdf8;box-shadow:inset 0 0 0 1px rgba(255,255,255,.75)}
                .meimay-child-toggle-btn.selected{border-color:#9f7a48;background:#fff7e7;box-shadow:inset 0 0 0 2px rgba(159,122,72,.28)}
                .meimay-child-toggle-main{display:flex;align-items:center;gap:8px;min-width:0}
                .meimay-child-toggle-check{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid #d9c8ad;border-radius:9999px;background:#fff;color:transparent;font-size:12px;font-weight:900;line-height:1;flex:0 0 auto}
                .meimay-child-toggle-btn.selected .meimay-child-toggle-check{border-color:#9f7a48;background:#9f7a48;color:#fff}
                .meimay-child-toggle-count{color:#a6967a;font-size:11px;font-weight:800}
                .meimay-child-toggle-btn.selected .meimay-child-toggle-count{color:#7a5a2c}
                .meimay-child-copy-source-note{display:flex;align-items:center;min-height:48px;padding:12px 14px;border:1px solid #eadfce;border-radius:14px;background:#fffaf2;color:#4f4536;font-size:14px;font-weight:800;line-height:1.45}
                .meimay-child-copy-source-note.muted{background:#f8f2e9;color:#9a8c75}
                .meimay-child-danger{border-color:#f5c8c8;background:#fff6f6;color:#c45d5d}
                .meimay-child-leave{border-color:#f0e0b8;background:#fffbf0;color:#a87c30}
                .meimay-child-accept{border-color:#b8d8c8;background:#f0faf4;color:#2e7d57}
                .meimay-partner-child-card{border:2px dashed #c8ddb8;background:rgba(220,245,220,0.28)}
                .mcw-partner-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:8px;background:linear-gradient(135deg,#6b9e7c,#4a7a8e);color:#fff;font-size:10px;font-weight:900;letter-spacing:0.02em;vertical-align:middle;margin-left:5px}
                .meimay-child-gender-btn.partner-picked{border-color:#6b9e7c;background:rgba(107,158,124,0.09);position:relative}
                .meimay-child-gender-btn.partner-picked.selected{border-color:#6b9e7c;background:rgba(107,158,124,0.14)}
                .meimay-child-align-note{padding:12px 14px;border-radius:16px;background:#fff8e8;border:1px solid #eadfce;color:#7a6542;font-size:12px;font-weight:750;line-height:1.55}
                .meimay-child-align-pair-card{padding:14px;border:1px solid rgba(229,219,203,.95);border-radius:16px;background:#fff}
                .meimay-child-align-pair-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
                .meimay-child-align-pair-title{color:#4f4536;font-size:18px;font-weight:900;line-height:1.3}
                .meimay-child-align-pair-desc{margin-top:7px;color:#7d725f;font-size:12px;font-weight:750;line-height:1.55}
                .meimay-child-align-summary{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
                .meimay-child-align-summary span{display:inline-flex;align-items:center;gap:4px;border-radius:9999px;background:#fff8e8;border:1px solid #eadfce;color:#6f604c;padding:6px 9px;font-size:11px;font-weight:900;line-height:1.25}
                .meimay-child-align-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
                .meimay-child-align-person{padding:10px;border:1px solid #eadfce;border-radius:14px;background:#fffdf8}
                .meimay-child-align-owner{color:#b9965b;font-size:10px;font-weight:900;letter-spacing:0}
                .meimay-child-align-title{margin-top:4px;color:#4f4536;font-size:14px;font-weight:850}
                .meimay-child-align-meta{margin-top:5px;color:#7d725f;font-size:12px;font-weight:750;line-height:1.45}
                .meimay-child-align-issues{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
                .meimay-child-align-issues span{display:inline-flex;align-items:center;border-radius:9999px;background:#fff2e2;color:#a76d35;padding:4px 8px;font-size:10px;font-weight:900}
                .meimay-child-align-resolve{display:grid;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #f0e7da}
                .meimay-child-align-resolve-title{color:#5d5444;font-size:12px;font-weight:900}
                .meimay-child-align-resolve-row{display:grid;gap:6px}
                .meimay-child-align-resolve-label{color:#8b7e66;font-size:11px;font-weight:900}
                .meimay-child-align-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
                .meimay-child-align-choice{position:relative;display:block}
                .meimay-child-align-choice input{position:absolute;opacity:0;pointer-events:none}
                .meimay-child-align-choice-body{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;min-height:56px;padding:9px 10px;border:1px solid #eadfce;border-radius:14px;background:#fff;color:#4f4536}
                .meimay-child-align-choice input:checked + .meimay-child-align-choice-body{border-color:#8abca2;background:#eefaf3;box-shadow:inset 0 0 0 1px rgba(46,125,87,.2)}
                .meimay-child-align-choice-source{font-size:11px;font-weight:900;color:#9a7d4f;line-height:1.35}
                .meimay-child-align-choice-value{font-size:14px;font-weight:900;color:#4f4536;line-height:1.35;text-align:left}
                .meimay-child-align-pick-list{display:grid;gap:8px;margin-top:10px}
                .meimay-child-align-pick{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #eadfce;border-radius:14px;background:#fff;text-align:left;color:#4f4536;font-weight:850}
                .meimay-child-align-pick.selected{border-color:#bca37f;background:#fff8e8}
                .meimay-child-align-pick small{color:#8b7e66;font-size:10px;font-weight:750;text-align:right}
                .meimay-child-partner-link-status{padding:12px 14px;border-radius:16px;border:1px solid #eadfce;background:#fffaf2;color:#5d5444}
                .meimay-child-partner-link-kicker{color:#b9965b;font-size:10px;font-weight:900;letter-spacing:.1em}
                .meimay-child-partner-link-title{margin-top:4px;color:#4f4536;font-size:14px;font-weight:850;line-height:1.45}
                .meimay-child-partner-link-desc{margin-top:5px;color:#8b7e66;font-size:11px;font-weight:750;line-height:1.55}
            `;
            document.head.appendChild(style);
        },

        wrapOnload() {
            const previousOnload = window.onload;
            window.onload = async (...args) => {
                try {
                    if (typeof previousOnload === 'function') {
                        await previousOnload.apply(window, args);
                    }
                } finally {
                    setTimeout(() => this.init(), 0);
                }
            };
        },

        wrapPersistenceHooks() {
            if (typeof StorageBox !== 'undefined') {
                this.wrapStorageMethod('loadAll');
                this.wrapStorageMethod('saveAll');
                this.wrapStorageMethod('saveLiked');
                this.wrapStorageMethod('saveSavedNames');
            }
             this.wrapNamedFunction('saveSettings');
            this.wrapNamedFunction('saveReadingStock');
            this.wrapNamedFunction('executeSaveWithMessage');
            this.wrapNamedFunction('deleteSavedName');
            this.wrapNamedFunction('deleteSavedNameBySourceIndex');
            this.wrapNamedFunction('setSavedMainCandidate');
            this.wrapNamedFunction('votePartnerSavedName');
            this.wrapNamedFunction('likePartnerSavedName');
            this.wrapNamedFunction('clearReadingHistory');
        },

        wrapStorageMethod(methodName) {
            if (!StorageBox || typeof StorageBox[methodName] !== 'function') return;
            const original = StorageBox[methodName].bind(StorageBox);
            StorageBox[methodName] = (...args) => {
                const result = original(...args);
                if (!this.initialized) return result;
                if (methodName === 'loadAll') {
                    this.persistActiveChildSnapshot('storage-load');
                    this.renderSwitchers();
                } else {
                    this.persistActiveChildSnapshot(methodName);
                }
                return result;
            };
        },

        wrapNamedFunction(functionName) {
            if (typeof window[functionName] !== 'function') return;
            const original = window[functionName];
            const manager = this;
            const wrapped = function (...args) {
                const result = original.apply(this, args);
                if (manager.initialized) {
                    manager.persistActiveChildSnapshot(functionName);
                    manager.renderSwitchers();
                    if (functionName === 'saveSettings') manager.decorateSettingsChildManagementCard();
                }
                return result;
            };
            window[functionName] = wrapped;
            try {
                eval(`${functionName} = window.${functionName}`);
            } catch (error) { }
        },

        wrapRenderHooks() {
            this.wrapRenderFunction('renderBuildSelection', () => this.renderSwitchers(['scr-build']));
            this.wrapRenderFunction('renderSettingsScreen', () => {
                this.renderSwitchers(['scr-settings']);
                this.decorateSettingsChildManagementCard();
            });
            this.wrapRenderFunction('changeScreen', (screenId) => {
                this.renderSwitchers(screenId ? [screenId] : undefined);
                if (screenId === 'scr-settings') this.decorateSettingsChildManagementCard();
            });
        },

        wrapRenderFunction(functionName, afterRender) {
            if (typeof window[functionName] !== 'function') return;
            const original = window[functionName];
            const wrapped = (...args) => {
                const result = original.apply(window, args);
                if (this.initialized) afterRender.apply(this, args);
                return result;
            };
            window[functionName] = wrapped;
            try {
                eval(`${functionName} = window.${functionName}`);
            } catch (error) { }
        },

        normalizeFamily(family, options = {}) {
            const base = createBlankFamilyState();
            return {
                surnameDefault: {
                    kanji: String(family?.surnameDefault?.kanji || '').trim(),
                    reading: String(family?.surnameDefault?.reading || '').trim()
                },
                preferenceModel: {
                    userTags: cloneData(family?.preferenceModel?.userTags, {}),
                    soundPreferenceData: cloneData(family?.preferenceModel?.soundPreferenceData, base.preferenceModel.soundPreferenceData)
                },
                sharedLibraries: {
                    readingStock: this.normalizeReadingLibrary(family?.sharedLibraries?.readingStock),
                    kanjiStock: this.normalizeKanjiLibrary(family?.sharedLibraries?.kanjiStock, {
                        genericOnly: true,
                        likedRemovalSource: options.likedRemovalSource
                    })
                },
                partnerChildLinks: family?.partnerChildLinks && typeof family.partnerChildLinks === 'object'
                    ? cloneData(family.partnerChildLinks, {})
                    : {},
                appSettings: {
                    shareMode: String(family?.appSettings?.shareMode || base.appSettings.shareMode).trim() || 'auto',
                    showInappropriateKanji: family?.appSettings?.showInappropriateKanji === true
                }
            };
        },

        normalizeChildRecord(childId, childRecord, fallbackBirthOrder = 1, options = {}) {
            const safeId = String(childRecord?.meta?.id || childId || '').trim();
            if (!safeId) return null;
            const rawMultipleIndex = childRecord?.meta?.multipleIndex ?? childRecord?.meta?.twinIndex ?? null;
            const twinSuffix = normalizeTwinSuffix(childRecord?.meta?.twinSuffix || childRecord?.meta?.multipleSuffix || (rawMultipleIndex !== null && rawMultipleIndex !== undefined ? multipleIndexToSuffix(rawMultipleIndex) : ''));
            const twinIndex = normalizeTwinIndex(rawMultipleIndex, twinSuffix);
            const birthOrder = normalizePositiveInteger(childRecord?.meta?.birthOrder, fallbackBirthOrder);
            const multipleCount = twinIndex === null
                ? null
                : normalizeMultipleCount(
                    childRecord?.meta?.birthGroupSize ?? childRecord?.meta?.multipleCount ?? childRecord?.meta?.twinCount,
                    Math.max(twinIndex + 1, 2)
                );
            const createdAt = String(childRecord?.meta?.createdAt || getNowIso());
            const updatedAt = String(childRecord?.meta?.updatedAt || createdAt);
            const birthGroupId = String(childRecord?.meta?.birthGroupId || childRecord?.meta?.twinGroupId || (twinIndex === null ? '' : `bg_${birthOrder}`)).trim() || null;
            const draft = { ...createBlankChildDraft(), ...cloneData(childRecord?.draft, {}) };
            draft.savedCanvas = normalizeWorkspaceSavedCanvasState(draft.savedCanvas || {});
            return {
                meta: {
                    id: safeId,
                    birthOrder,
                    displayLabel: buildDisplayLabel(birthOrder, twinIndex, multipleCount),
                    gender: normalizeGenderValue(childRecord?.meta?.gender),
                    birthGroupId,
                    birthGroupIndex: twinIndex,
                    birthGroupSize: multipleCount,
                    multipleCount,
                    twinGroupId: birthGroupId,
                    twinIndex,
                    twinCount: multipleCount,
                    createdAt,
                    updatedAt,
                    dueDate: String(childRecord?.meta?.dueDate || childRecord?.meta?.birthDate || '').trim(),
                    birthDate: ''
                },
                prefs: {
                    rule: String(childRecord?.prefs?.rule || 'strict').trim() || 'strict',
                    prioritizeFortune: childRecord?.prefs?.prioritizeFortune === true,
                    imageTags: Array.isArray(childRecord?.prefs?.imageTags) && childRecord.prefs.imageTags.length > 0 ? cloneData(childRecord.prefs.imageTags, ['none']) : ['none']
                },
                draft,
                libraries: {
                    readingStock: this.normalizeReadingLibrary(childRecord?.libraries?.readingStock),
                    kanjiStock: this.normalizeKanjiLibrary(childRecord?.libraries?.kanjiStock, {
                        likedRemovalSource: options.likedRemovalSource
                    }),
                    savedNames: this.normalizeSavedLibrary(childRecord?.libraries?.savedNames, { childId: safeId }),
                    readingHistory: cloneData(childRecord?.libraries?.readingHistory, []),
                    hiddenReadings: cloneData(childRecord?.libraries?.hiddenReadings, []),
                    noped: cloneData(childRecord?.libraries?.noped, [])
                }
            };
        },

        buildDefaultChildRecord(childId, birthOrder) {
            return {
                meta: {
                    id: childId,
                    birthOrder,
                    displayLabel: buildDisplayLabel(birthOrder, null),
                    gender: 'neutral',
                    birthGroupId: null,
                    birthGroupIndex: null,
                    twinGroupId: null,
                    twinIndex: null,
                    dueDate: '',
                    birthDate: '',
                    createdAt: getNowIso(),
                    updatedAt: getNowIso()
                },
                prefs: { rule: 'strict', prioritizeFortune: false, imageTags: ['none'] },
                draft: createBlankChildDraft(),
                libraries: createBlankChildLibraries()
            };
        },

        normalizeRoot(root, options = {}) {
            const deletedChildren = normalizeDeletedChildrenMap(root?.deletedChildren || root?.deletedChildIds || {});
            const next = {
                version: ROOT_VERSION,
                activeChildId: String(root?.activeChildId || '').trim(),
                childOrder: Array.isArray(root?.childOrder) ? root.childOrder.map((id) => String(id || '').trim()).filter(Boolean) : [],
                family: this.normalizeFamily(root?.family, options),
                children: {},
                deletedChildren,
                createdAt: String(root?.createdAt || getNowIso()),
                updatedAt: String(root?.updatedAt || getNowIso())
            };
            Object.entries(root?.children || {}).forEach(([childId, childRecord], index) => {
                const normalized = this.normalizeChildRecord(childId, childRecord, index + 1, options);
                if (normalized && !Object.prototype.hasOwnProperty.call(deletedChildren, normalized.meta.id)) next.children[normalized.meta.id] = normalized;
            });
            if (Object.keys(next.children).length === 0) {
                const fallback = this.buildDefaultChildRecord('child_1', 1);
                next.children[fallback.meta.id] = fallback;
                next.childOrder = [fallback.meta.id];
                next.activeChildId = fallback.meta.id;
            }
            next.childOrder = this.buildOrderedChildIds(next);
            if (!next.activeChildId || !next.children[next.activeChildId]) next.activeChildId = next.childOrder[0];
            return next;
        },

        loadOrMigrateRoot() {
            const raw = localStorage.getItem(ROOT_KEY);
            if (raw) {
                try {
                    const normalized = this.repairRootFromLegacyGlobals(this.normalizeRoot(JSON.parse(raw)));
                    this.saveRoot(normalized, { skipRemoteSync: true });
                    return normalized;
                } catch (error) {
                    console.warn('CHILD_WORKSPACES: root parse failed, migrating', error);
                }
            }
            const migrated = this.buildRootFromLegacyGlobals();
            this.saveRoot(migrated, { skipRemoteSync: true });
            return migrated;
        },

        repairRootFromLegacyGlobals(root) {
            const normalized = this.normalizeRoot(root);
            const activeChildId = String(normalized?.activeChildId || '').trim();
            const activeChild = activeChildId ? normalized.children?.[activeChildId] : null;
            if (!activeChild) return normalized;

            const localSnapshot = this.captureCurrentChildRecord(activeChild.meta || {});
            const hasRootData = (
                Array.isArray(activeChild.libraries?.readingStock) && activeChild.libraries.readingStock.length > 0
            ) || (
                Array.isArray(activeChild.libraries?.kanjiStock) && activeChild.libraries.kanjiStock.length > 0
            ) || (
                Array.isArray(activeChild.libraries?.savedNames) && activeChild.libraries.savedNames.length > 0
            );
            const hasLegacyData = (
                Array.isArray(localSnapshot.libraries?.readingStock) && localSnapshot.libraries.readingStock.length > 0
            ) || (
                Array.isArray(localSnapshot.libraries?.kanjiStock) && localSnapshot.libraries.kanjiStock.length > 0
            ) || (
                Array.isArray(localSnapshot.libraries?.savedNames) && localSnapshot.libraries.savedNames.length > 0
            );

            if (hasRootData || !hasLegacyData) return normalized;

            normalized.children[activeChildId] = localSnapshot;
            normalized.updatedAt = getNowIso();
            return normalized;
        },

        mergeRootState(localState = null, remoteState = null, options = {}) {
            const localRoot = hasChildWorkspaceData(localState) ? this.normalizeRoot(localState) : null;
            const remoteRoot = hasChildWorkspaceData(remoteState) ? this.normalizeRoot(remoteState) : null;
            const structureOnly = options?.structureOnly === true;
            if (!localRoot && !remoteRoot) return this.normalizeRoot({});
            if (!localRoot) return remoteRoot;
            if (!remoteRoot) return localRoot;
            const mergedDeletedChildren = mergeDeletedChildrenMaps(localRoot.deletedChildren, remoteRoot.deletedChildren);
            const mergedChildrenBySlot = new Map();
            const remotePreferred = parseComparableTime(remoteRoot.updatedAt || remoteRoot.createdAt) >= parseComparableTime(localRoot.updatedAt || localRoot.createdAt);

            const cloneStructureOnlyChild = (child) => {
                if (!child || typeof child !== 'object') return null;
                return {
                    meta: cloneData(child.meta, {}),
                    prefs: cloneData(child.prefs, { rule: 'strict', prioritizeFortune: false, imageTags: ['none'] }),
                    draft: createBlankChildDraft(),
                    libraries: createBlankChildLibraries()
                };
            };

            const mergeChildSlotRecords = (baseChild, incomingChild, preferIncoming = false) => {
                if (!baseChild) {
                    return structureOnly
                        ? cloneStructureOnlyChild(incomingChild)
                        : cloneData(incomingChild, null);
                }
                if (!incomingChild) return cloneData(baseChild, null);

                const baseClone = cloneData(baseChild, null);
                const incomingClone = cloneData(incomingChild, null);
                const mergedClone = cloneData(baseClone, null);
                const baseLibraries = baseClone?.libraries || createBlankChildLibraries();
                const incomingLibraries = incomingClone?.libraries || createBlankChildLibraries();

                mergedClone.meta = {
                    ...cloneData(baseClone.meta, {}),
                    ...(preferIncoming ? {
                        gender: normalizeGenderValue(incomingClone?.meta?.gender || baseClone?.meta?.gender),
                        birthGroupId: incomingClone?.meta?.birthGroupId || incomingClone?.meta?.twinGroupId || baseClone?.meta?.birthGroupId || baseClone?.meta?.twinGroupId || null,
                        birthGroupIndex: incomingClone?.meta?.birthGroupIndex ?? incomingClone?.meta?.twinIndex ?? baseClone?.meta?.birthGroupIndex ?? baseClone?.meta?.twinIndex ?? null,
                        twinGroupId: incomingClone?.meta?.twinGroupId || incomingClone?.meta?.birthGroupId || baseClone?.meta?.twinGroupId || baseClone?.meta?.birthGroupId || null,
                        twinIndex: incomingClone?.meta?.twinIndex ?? incomingClone?.meta?.birthGroupIndex ?? baseClone?.meta?.twinIndex ?? baseClone?.meta?.birthGroupIndex ?? null,
                        dueDate: incomingClone?.meta?.dueDate || baseClone?.meta?.dueDate || ''
                    } : {}),
                    updatedAt: String(
                        preferIncoming
                            ? (incomingClone?.meta?.updatedAt || incomingClone?.meta?.createdAt || baseClone?.meta?.updatedAt || baseClone?.meta?.createdAt || getNowIso())
                            : (baseClone?.meta?.updatedAt || baseClone?.meta?.createdAt || incomingClone?.meta?.updatedAt || incomingClone?.meta?.createdAt || getNowIso())
                    )
                };
                mergedClone.prefs = preferIncoming
                    ? cloneData({ ...cloneData(baseClone.prefs, {}), ...cloneData(incomingClone.prefs, {}) }, {})
                    : cloneData({ ...cloneData(incomingClone.prefs, {}), ...cloneData(baseClone.prefs, {}) }, {});
                mergedClone.draft = structureOnly
                    ? cloneData(baseClone.draft, createBlankChildDraft())
                    : (preferIncoming 
                        ? cloneData(incomingClone.draft, cloneData(baseClone.draft, createBlankChildDraft()))
                        : cloneData(baseClone.draft, cloneData(incomingClone.draft, createBlankChildDraft())));
                mergedClone.libraries = {
                    readingStock: structureOnly
                        ? cloneData(baseLibraries.readingStock, [])
                        : this.mergeReadingLibraries(baseLibraries.readingStock, incomingLibraries.readingStock).items,
                    kanjiStock: structureOnly
                        ? cloneData(baseLibraries.kanjiStock, [])
                        : this.mergeKanjiLibraries(baseLibraries.kanjiStock, incomingLibraries.kanjiStock, {
                            sourceChildId: incomingClone?.meta?.id || '',
                            sourceLabel: incomingClone?.meta?.displayLabel || ''
                        }).items,
                    savedNames: structureOnly
                        ? cloneData(baseLibraries.savedNames, [])
                        : this.mergeSavedLibraries(baseLibraries.savedNames, incomingLibraries.savedNames, {
                            sourceChildId: incomingClone?.meta?.id || '',
                            sourceLabel: incomingClone?.meta?.displayLabel || ''
                        }).items,
                    readingHistory: cloneData(baseLibraries.readingHistory, []),
                    hiddenReadings: cloneData(baseLibraries.hiddenReadings, []),
                    noped: cloneData(baseLibraries.noped, [])
                };
                return mergedClone;
            };

            const upsertChild = (child, preferRemote = false) => {
                if (!child || typeof child !== 'object') return;
                const childId = String(child?.meta?.id || '').trim();
                if (!childId || Object.prototype.hasOwnProperty.call(mergedDeletedChildren, childId)) return;
                const childClone = cloneData(child, null);
                const slotKey = getChildWorkspaceSlotKey(childClone);
                const existing = mergedChildrenBySlot.get(slotKey);
                if (!existing) {
                    mergedChildrenBySlot.set(slotKey, childClone);
                    return;
                }
                const existingTime = parseComparableTime(existing?.meta?.updatedAt || existing?.meta?.createdAt);
                const incomingTime = parseComparableTime(childClone?.meta?.updatedAt || childClone?.meta?.createdAt);
                mergedChildrenBySlot.set(
                    slotKey,
                    mergeChildSlotRecords(existing, childClone, incomingTime > existingTime || (incomingTime === existingTime && preferRemote))
                );
            };

            Object.values(localRoot.children || {}).forEach((child) => upsertChild(child, false));
            Object.values(remoteRoot.children || {}).forEach((child) => upsertChild(child, true));

            const mergedChildren = {};
            mergedChildrenBySlot.forEach((child) => {
                const childId = String(child?.meta?.id || '').trim();
                if (childId) mergedChildren[childId] = child;
            });

            const preferredRoot = remotePreferred ? remoteRoot : localRoot;
            const merged = {
                version: Math.max(
                    normalizePositiveInteger(localRoot.version, 0),
                    normalizePositiveInteger(remoteRoot.version, 0),
                    ROOT_VERSION
                ),
                activeChildId: '',
                childOrder: [],
                family: cloneData((structureOnly ? localRoot.family : preferredRoot.family) || createBlankFamilyState(), createBlankFamilyState()),
                children: mergedChildren,
                deletedChildren: mergedDeletedChildren,
                createdAt: String(preferredRoot.createdAt || localRoot.createdAt || remoteRoot.createdAt || getNowIso()),
                updatedAt: String(preferredRoot.updatedAt || localRoot.updatedAt || remoteRoot.updatedAt || getNowIso())
            };

            merged.childOrder = this.buildOrderedChildIds(merged);
            const preferredActiveSlotKey = [
                localRoot.activeChildId && localRoot.children?.[localRoot.activeChildId]
                    ? getChildWorkspaceSlotKey(localRoot.children[localRoot.activeChildId])
                    : '',
                remoteRoot.activeChildId && remoteRoot.children?.[remoteRoot.activeChildId]
                    ? getChildWorkspaceSlotKey(remoteRoot.children[remoteRoot.activeChildId])
                    : ''
            ].find((slotKey) => slotKey && mergedChildrenBySlot.has(slotKey));
            merged.activeChildId = structureOnly
                ? ((localRoot.activeChildId && merged.children?.[localRoot.activeChildId]) ? localRoot.activeChildId : (merged.childOrder[0] || ''))
                : (preferredActiveSlotKey
                    ? String(mergedChildrenBySlot.get(preferredActiveSlotKey)?.meta?.id || '').trim()
                    : (merged.childOrder[0] || ''));
            return this.normalizeRoot(merged);
        },

        buildRootFromLegacyGlobals() {
            const childId = 'child_1';
            const wizardData = (typeof WizardData !== 'undefined' && WizardData && typeof WizardData.get === 'function' && typeof WizardData.isCompleted === 'function' && WizardData.isCompleted())
                ? (WizardData.get() || {})
                : {};
            const child = this.captureCurrentChildRecord({
                id: childId,
                birthOrder: normalizePositiveInteger(wizardData.birthOrder, 1),
                gender: normalizeGenderValue(
                    wizardData.gender || (typeof gender !== 'undefined' ? gender : 'neutral')
                ),
                birthGroupId: null,
                birthGroupIndex: null,
                twinGroupId: null,
                twinIndex: null,
                dueDate: String(wizardData.dueDate || wizardData.birthDate || '').trim(),
                birthDate: '',
                createdAt: getNowIso(),
                updatedAt: getNowIso()
            });
            return {
                version: ROOT_VERSION,
                activeChildId: childId,
                childOrder: [childId],
                family: this.captureCurrentFamilyState(),
                deletedChildren: {},
                children: { [childId]: child },
                createdAt: getNowIso(),
                updatedAt: getNowIso()
            };
        },

        captureCurrentFamilyState() {
            return this.normalizeFamily({
                surnameDefault: {
                    kanji: typeof surnameStr !== 'undefined' ? surnameStr : '',
                    reading: typeof surnameReading !== 'undefined' ? surnameReading : ''
                },
                preferenceModel: {
                    userTags: typeof userTags !== 'undefined' ? userTags : {},
                    soundPreferenceData: typeof soundPreferenceData !== 'undefined' ? soundPreferenceData : { liked: [], noped: [] }
                },
                sharedLibraries: this.root?.family?.sharedLibraries || createBlankFamilyState().sharedLibraries,
                partnerChildLinks: this.root?.family?.partnerChildLinks || {},
                appSettings: {
                    shareMode: typeof shareMode !== 'undefined' ? shareMode : 'auto',
                    showInappropriateKanji: typeof showInappropriateKanji !== 'undefined' ? showInappropriateKanji === true : false
                }
            });
        },

        captureCurrentChildRecord(existingMeta = {}) {
            const draftReadingInput = document.getElementById('in-name');
            const compoundFlow = typeof window.getCompoundBuildFlow === 'function' ? window.getCompoundBuildFlow() : (window.meimayCompoundBuildFlow || null);
            const birthGroupIndex = existingMeta.birthGroupIndex ?? existingMeta.twinIndex ?? null;
            const birthGroupSize = birthGroupIndex === null
                ? null
                : normalizeMultipleCount(
                    existingMeta.birthGroupSize ?? existingMeta.multipleCount ?? existingMeta.twinCount,
                    Math.max(normalizeTwinIndex(birthGroupIndex) + 1, 2)
                );
            const savedCanvas = getSavedCanvasStateSnapshot();
            const savedCanvasDraft = savedCanvas.blank || savedCanvas.ownKey || savedCanvas.partnerKey || savedCanvas.selectedKey
                ? {
                    blank: savedCanvas.blank === true,
                    ownKey: String(savedCanvas.ownKey || '').trim(),
                    partnerKey: String(savedCanvas.partnerKey || '').trim(),
                    selectedKey: String(savedCanvas.selectedKey || '').trim(),
                    selectedSource: String(savedCanvas.selectedSource || '').trim(),
                    selectedAt: String(savedCanvas.selectedAt || '').trim()
                }
                : null;
            return {
                meta: {
                    id: String(existingMeta.id || '').trim(),
                    birthOrder: normalizePositiveInteger(existingMeta.birthOrder, 1),
                    displayLabel: buildDisplayLabel(existingMeta.birthOrder, birthGroupIndex, birthGroupSize),
                    gender: normalizeGenderValue(typeof gender !== 'undefined' ? gender : existingMeta.gender),
                    birthGroupId: existingMeta.birthGroupId || existingMeta.twinGroupId || (birthGroupIndex === null ? null : `bg_${normalizePositiveInteger(existingMeta.birthOrder, 1)}`),
                    birthGroupIndex,
                    birthGroupSize,
                    multipleCount: birthGroupSize,
                    twinGroupId: existingMeta.twinGroupId || existingMeta.birthGroupId || (birthGroupIndex === null ? null : `bg_${normalizePositiveInteger(existingMeta.birthOrder, 1)}`),
                    twinIndex: birthGroupIndex,
                    twinCount: birthGroupSize,
                    createdAt: existingMeta.createdAt || getNowIso(),
                    updatedAt: getNowIso(),
                    dueDate: String(existingMeta.dueDate || existingMeta.birthDate || '').trim(),
                    birthDate: ''
                },
                prefs: {
                    rule: typeof rule !== 'undefined' ? rule : 'strict',
                    prioritizeFortune: typeof prioritizeFortune !== 'undefined' ? prioritizeFortune === true : false,
                    imageTags: typeof selectedImageTags !== 'undefined' ? cloneData(selectedImageTags, ['none']) : ['none']
                },
                draft: {
                    segments: typeof segments !== 'undefined' ? cloneData(segments, []) : [],
                    currentPos: typeof currentPos !== 'undefined' ? normalizeNonNegativeInteger(currentPos, 0) : 0,
                    currentIdx: typeof currentIdx !== 'undefined' ? normalizeNonNegativeInteger(currentIdx, 0) : 0,
                    swipes: typeof swipes !== 'undefined' ? normalizeNonNegativeInteger(swipes, 0) : 0,
                    buildMode: typeof buildMode !== 'undefined' && buildMode === 'free' ? 'free' : 'reading',
                    selectedPieces: typeof selectedPieces !== 'undefined' ? cloneData(selectedPieces, []) : [],
                    currentBuildResult: typeof currentBuildResult !== 'undefined' ? cloneData(currentBuildResult, createBlankBuildResult()) : createBlankBuildResult(),
                    compoundFlow: cloneData(compoundFlow, null),
                    readingInputValue: draftReadingInput && typeof draftReadingInput.value === 'string' ? draftReadingInput.value.trim() : '',
                    fbChoices: typeof fbChoices !== 'undefined' ? cloneData(fbChoices, []) : [],
                    fbChoicesUseMark: typeof fbChoicesUseMark !== 'undefined' ? cloneData(fbChoicesUseMark, {}) : {},
                    shownFbSlots: typeof shownFbSlots !== 'undefined' ? normalizePositiveInteger(shownFbSlots, 1) : 1,
                    fbSelectedReading: typeof fbSelectedReading !== 'undefined' ? fbSelectedReading || null : null,
                    fbSelectedReadingSource: typeof fbSelectedReadingSource !== 'undefined' ? String(fbSelectedReadingSource || 'auto') : 'auto',
                    currentFbRecommendedReadings: typeof currentFbRecommendedReadings !== 'undefined' ? cloneData(currentFbRecommendedReadings, []) : [],
                    excludedKanjiFromBuild: typeof excludedKanjiFromBuild !== 'undefined' ? cloneData(excludedKanjiFromBuild, []) : [],
                    ...(savedCanvasDraft ? { savedCanvas: savedCanvasDraft } : {})
                },
                libraries: {
                    readingStock: this.normalizeReadingLibrary(typeof getReadingStock === 'function' ? getReadingStock() : readJsonArray('meimay_reading_stock')),
                    kanjiStock: this.normalizeKanjiLibrary(typeof liked !== 'undefined' ? liked : []),
                    savedNames: this.normalizeSavedLibrary(typeof savedNames !== 'undefined' ? savedNames : (typeof getSavedNames === 'function' ? getSavedNames() : []), { childId: String(existingMeta.id || '').trim() }),
                    readingHistory: cloneData(typeof getReadingHistory === 'function' ? getReadingHistory() : readJsonArray('meimay_reading_history'), []),
                    hiddenReadings: cloneData(readJsonArray('meimay_hidden_readings'), []),
                    noped: typeof noped !== 'undefined' ? cloneData(Array.from(noped), []) : []
                }
            };
        },

        buildOrderedChildIds(root) {
            const childMap = root?.children || {};
            const deletedChildren = normalizeDeletedChildrenMap(root?.deletedChildren || root?.deletedChildIds || {});
            const knownIds = Object.keys(childMap).filter((id) => !Object.prototype.hasOwnProperty.call(deletedChildren, id));
            const ordered = Array.isArray(root?.childOrder) ? root.childOrder.filter((id) => knownIds.includes(id)) : [];
            const missing = knownIds.filter((id) => !ordered.includes(id));
            return [...ordered, ...missing].sort((leftId, rightId) => {
                const left = childMap[leftId];
                const right = childMap[rightId];
                const leftOrder = normalizePositiveInteger(left?.meta?.birthOrder, 999);
                const rightOrder = normalizePositiveInteger(right?.meta?.birthOrder, 999);
                if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                const leftTwin = left?.meta?.birthGroupIndex ?? left?.meta?.twinIndex;
                const rightTwin = right?.meta?.birthGroupIndex ?? right?.meta?.twinIndex;
                if (leftTwin === null && rightTwin !== null) return -1;
                if (leftTwin !== null && rightTwin === null) return 1;
                if (leftTwin !== rightTwin) return normalizeNonNegativeInteger(leftTwin, 0) - normalizeNonNegativeInteger(rightTwin, 0);
                return new Date(left?.meta?.createdAt || 0).getTime() - new Date(right?.meta?.createdAt || 0).getTime();
            });
        },

        getChildById(childId) {
            const safeId = String(childId || '').trim();
            if (!safeId) return null;
            if (this.isChildDeleted(safeId)) return null;
            return this.root?.children?.[safeId] || null;
        },

        getDeletedChildMap(root = this.root) {
            return normalizeDeletedChildrenMap(root?.deletedChildren || root?.deletedChildIds || {});
        },

        isChildDeleted(childId, root = this.root) {
            const safeId = String(childId || '').trim();
            if (!safeId) return false;
            const deletedMap = this.getDeletedChildMap(root);
            return Object.prototype.hasOwnProperty.call(deletedMap, safeId);
        },

        getActiveChild() {
            return this.getChildById(this.root?.activeChildId);
        },

        getActiveChildId() {
            return String(this.root?.activeChildId || '').trim();
        },

        getActiveSavedNames() {
            const child = this.getActiveChild();
            const childId = String(child?.meta?.id || this.getActiveChildId()).trim();
            return this.normalizeSavedLibrary(child?.libraries?.savedNames || [], { childId });
        },

        normalizeReadingLibrary(items) {
            const source = Array.isArray(items) ? items : [];
            const normalized = source.map((item) => {
                if (!item) return null;
                const hydrated = typeof window !== 'undefined'
                    && window.MeimayFirestorePayload
                    && typeof window.MeimayFirestorePayload.hydrateReadingStockItem === 'function'
                    ? window.MeimayFirestorePayload.hydrateReadingStockItem(item)
                    : item;
                if (typeof normalizeReadingStockItem === 'function') {
                    return normalizeReadingStockItem(hydrated);
                }
                const reading = String(hydrated?.reading || hydrated?.sessionReading || '').trim();
                if (!reading) return null;
                return {
                    ...cloneData(hydrated, {}),
                    id: String(hydrated?.id || `${reading}::${(hydrated?.segments || []).join('/')}`),
                    reading,
                    segments: Array.isArray(hydrated?.segments) ? cloneData(hydrated.segments, []) : [],
                    gender: normalizeGenderValue(hydrated?.gender)
                };
            }).filter(Boolean);
            return this.mergeReadingLibraries([], normalized).items;
        },

        normalizeKanjiLibrary(items, options = {}) {
            const source = filterRemovedLikedItems(Array.isArray(items) ? items : [], options.likedRemovalSource);
            const next = source.map((item) => {
                const kanji = getKanjiValue(item);
                if (!kanji) return null;
                const masterItem = findMasterKanjiItem(kanji);
                return {
                    ...(masterItem || {}),
                    ...cloneData(item, {}),
                    [KANJI_KEY]: kanji,
                    kanji,
                    slot: options.genericOnly ? -1 : (Number.isFinite(Number(item?.slot)) ? Number(item.slot) : -1),
                    sessionReading: options.genericOnly ? (item?.sessionReading || SHARED_KANJI_SESSION) : (item?.sessionReading || ''),
                    gender: normalizeGenderValue(item?.gender || masterItem?.gender || 'neutral')
                };
            }).filter(Boolean);
            if (options.genericOnly) {
                return this.mergeKanjiLibraries([], next, {
                    sourceChildId: 'family',
                    sourceLabel: '家族共通',
                    genericOnly: true,
                    likedRemovalSource: options.likedRemovalSource
                }).items;
            }
            return cloneData(next, []);
        },

        normalizeSavedLibrary(items, options = {}) {
            const source = Array.isArray(items) ? items : [];
            const ownerChildId = String(options.childId || '').trim();
            const hydrated = source.map((item) => (
                typeof window !== 'undefined'
                    && window.MeimayFirestorePayload
                    && typeof window.MeimayFirestorePayload.hydrateSavedItem === 'function'
                    ? window.MeimayFirestorePayload.hydrateSavedItem(item)
                    : item
            )).filter((item) => {
                if (!item) return false;
                const itemChildId = getSavedItemWorkspaceChildId(item);
                return !ownerChildId || !itemChildId || itemChildId === ownerChildId;
            }).map((item) => ownerChildId ? stampSavedItemWorkspaceChild(item, ownerChildId) : item);
            return this.mergeSavedLibraries([], hydrated, ownerChildId ? { targetChildId: ownerChildId } : {}).items;
        },

        mergeReadingLibraries(targetItems = [], sourceItems = []) {
            const merged = cloneData(targetItems, []);
            const seenKeys = new Set(merged.map((item) => this.getReadingItemKey(item)).filter(Boolean));
            (Array.isArray(sourceItems) ? sourceItems : []).forEach((item) => {
                const normalized = typeof normalizeReadingStockItem === 'function' ? normalizeReadingStockItem(item) : cloneData(item, null);
                if (!normalized) return;
                const key = this.getReadingItemKey(normalized);
                if (!key || seenKeys.has(key)) return;
                seenKeys.add(key);
                merged.push(normalized);
            });
            return { items: merged };
        },

        mergeKanjiLibraries(targetItems = [], sourceItems = [], options = {}) {
            const merged = cloneData(filterRemovedLikedItems(targetItems, options.likedRemovalSource), []);
            const existingKanji = new Set(
                merged.map((item) => getKanjiValue(item)).filter(Boolean)
            );
            let addedCount = 0;
            filterRemovedLikedItems(sourceItems, options.likedRemovalSource).forEach((item) => {
                const kanji = getKanjiValue(item);
                if (!kanji || existingKanji.has(kanji)) return;
                const masterItem = findMasterKanjiItem(kanji);
                merged.push({
                    ...(masterItem || {}),
                    ...cloneData(item, {}),
                    [KANJI_KEY]: kanji,
                    kanji,
                    slot: -1,
                    sessionReading: options.genericOnly ? SHARED_KANJI_SESSION : IMPORTED_KANJI_SESSION,
                    gender: normalizeGenderValue(item?.gender || masterItem?.gender || 'neutral'),
                    importedFromChildId: options.sourceChildId || '',
                    importedFromChildLabel: options.sourceLabel || ''
                });
                existingKanji.add(kanji);
                addedCount += 1;
            });
            return { items: merged, addedCount };
        },

        mergeSavedLibraries(targetItems = [], sourceItems = [], options = {}) {
            const merged = cloneData(targetItems, []);
            const seenKeys = new Set(merged.map((item) => this.getSavedItemKey(item)).filter(Boolean));
            let addedCount = 0;
            (Array.isArray(sourceItems) ? sourceItems : []).forEach((item) => {
                if (item?.fromPartner === true) return;
                let normalized = cloneData(item, null);
                if (!normalized) return;
                const key = this.getSavedItemKey(normalized);
                if (!key || seenKeys.has(key)) return;
                seenKeys.add(key);
                normalized.copiedFromChildId = options.sourceChildId || '';
                normalized.copiedFromChildLabel = options.sourceLabel || '';
                if (options.targetChildId) {
                    normalized = stampSavedItemWorkspaceChild(normalized, options.targetChildId);
                }
                merged.push(normalized);
                addedCount += 1;
            });
            return { items: merged, addedCount };
        },

        cloneKanjiStockForChildCopy(items = [], options = {}) {
            const keepSessionReading = options?.keepSessionReading === true;
            return cloneData(Array.isArray(items) ? items : [], []).map((item) => {
                const next = cloneData(item, {});
                const sessionReading = String(next.sessionReading || '').trim();
                const importedFromChildId = String(next.importedFromChildId || '').trim();
                const isImportedSource = sessionReading === IMPORTED_KANJI_SESSION
                    || sessionReading === SHARED_KANJI_SESSION
                    || importedFromChildId.length > 0
                    || next.fromPartner === true;
                const shouldResetToFree = !keepSessionReading
                    || isImportedSource
                    || sessionReading === 'SEARCH'
                    || !Number.isFinite(Number(next.slot))
                    || Number(next.slot) < 0;
                const cloned = {
                    ...next,
                    fromPartner: false,
                    partnerName: '',
                    partnerAlsoPicked: false,
                    partnerSuper: false,
                    importedFromChildId: '',
                    importedFromChildLabel: ''
                };
                if (shouldResetToFree) {
                    cloned.sessionReading = 'FREE';
                    cloned.slot = -1;
                    cloned.sessionSegments = [];
                    cloned.sessionDisplaySegments = [];
                }
                return cloned;
            });
        },

        getReadingItemKey(item) {
            if (!item) return '';
            const reading = String(item.reading || item.sessionReading || '').trim();
            const segmentsKey = Array.isArray(item.segments) ? item.segments.filter(Boolean).join('/') : '';
            if (typeof getReadingStockKey === 'function') {
                return String(getReadingStockKey(reading, item.segments || []) || `${reading}::${segmentsKey}`).trim();
            }
            return `${reading}::${segmentsKey}`;
        },

        getSavedItemKey(item) {
            return buildWorkspaceSavedKey(item);
        },

        persistActiveChildSnapshot(reason = 'manual') {
            if (typeof isMeimayAppDataDeletionInProgress === 'function' && isMeimayAppDataDeletionInProgress()) return;
            if (!this.initialized || this._persistenceLocked || !this.root) return;
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            activeChild.meta.updatedAt = getNowIso();
            activeChild.meta.gender = normalizeGenderValue(typeof gender !== 'undefined' ? gender : activeChild.meta.gender);
            this.root.children[activeChild.meta.id] = this.captureCurrentChildRecord(activeChild.meta);
            this.root.family = this.captureCurrentFamilyState();
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            const shouldSkipSync = (reason === 'storage-load' || reason === 'interval' || (typeof MeimayShare !== 'undefined' && MeimayShare._restoreInFlight));
            this.saveRoot(this.root, { 
                skipRemoteSync: shouldSkipSync,
                reason: reason
            });
        },

        applyActiveChildToGlobals(options = {}) {
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            const family = this.root?.family || createBlankFamilyState();
            const child = this.normalizeChildRecord(activeChild.meta.id, activeChild);
            const draft = { ...createBlankChildDraft(), ...cloneData(child.draft, {}) };
            const nextSavedCanvas = normalizeWorkspaceSavedCanvasState(child?.draft?.savedCanvas || {});
            if (!nextSavedCanvas.selectedKey) {
                const source = nextSavedCanvas.selectedSource === 'partner'
                    ? 'partner'
                    : (nextSavedCanvas.selectedSource === 'own' ? 'own' : (nextSavedCanvas.partnerKey && !nextSavedCanvas.ownKey ? 'partner' : 'own'));
                nextSavedCanvas.selectedSource = source;
                nextSavedCanvas.selectedKey = source === 'partner'
                    ? nextSavedCanvas.partnerKey
                    : nextSavedCanvas.ownKey;
            }
            this._persistenceLocked = true;
            try {
                if (typeof surnameStr !== 'undefined') surnameStr = family.surnameDefault.kanji || '';
                if (typeof surnameReading !== 'undefined') surnameReading = family.surnameDefault.reading || '';
                if (typeof surnameData !== 'undefined') surnameData = [];
                if (typeof gender !== 'undefined') gender = child.meta.gender || 'neutral';
                if (typeof rule !== 'undefined') rule = child.prefs.rule || 'strict';
                if (typeof prioritizeFortune !== 'undefined') prioritizeFortune = child.prefs.prioritizeFortune === true;
                if (typeof selectedImageTags !== 'undefined') selectedImageTags = cloneData(child.prefs.imageTags, ['none']);
                if (typeof segments !== 'undefined') segments = cloneData(draft.segments, []);
                if (typeof liked !== 'undefined') liked = cloneData(filterRemovedLikedItems(child.libraries.kanjiStock), []);
                if (typeof savedNames !== 'undefined') savedNames = cloneData(child.libraries.savedNames, []);
                if (typeof userTags !== 'undefined') userTags = cloneData(family.preferenceModel.userTags, {});
                if (typeof noped !== 'undefined') noped = new Set(cloneData(child.libraries.noped, []));
                if (typeof currentPos !== 'undefined') currentPos = normalizeNonNegativeInteger(draft.currentPos, 0);
                if (typeof currentIdx !== 'undefined') currentIdx = normalizeNonNegativeInteger(draft.currentIdx, 0);
                if (typeof swipes !== 'undefined') swipes = normalizeNonNegativeInteger(draft.swipes, 0);
                if (typeof selectedPieces !== 'undefined') selectedPieces = cloneData(draft.selectedPieces, []);
                if (typeof buildMode !== 'undefined') buildMode = draft.buildMode === 'free' ? 'free' : 'reading';
                if (typeof fbChoices !== 'undefined') fbChoices = cloneData(draft.fbChoices, []);
                if (typeof fbChoicesUseMark !== 'undefined') fbChoicesUseMark = cloneData(draft.fbChoicesUseMark, {});
                if (typeof shownFbSlots !== 'undefined') shownFbSlots = normalizePositiveInteger(draft.shownFbSlots, 1);
                if (typeof fbSelectedReading !== 'undefined') fbSelectedReading = draft.fbSelectedReading || null;
                window.fbSelectedReadingSource = draft.fbSelectedReadingSource || 'auto';
                if (typeof currentFbRecommendedReadings !== 'undefined') currentFbRecommendedReadings = cloneData(draft.currentFbRecommendedReadings, []);
                if (typeof excludedKanjiFromBuild !== 'undefined') excludedKanjiFromBuild = cloneData(draft.excludedKanjiFromBuild, []);
                if (typeof currentBuildResult !== 'undefined') currentBuildResult = cloneData(draft.currentBuildResult, createBlankBuildResult());
                if (typeof shareMode !== 'undefined') shareMode = family.appSettings.shareMode || 'auto';
                if (typeof showInappropriateKanji !== 'undefined') showInappropriateKanji = family.appSettings.showInappropriateKanji === true;
                if (typeof soundPreferenceData !== 'undefined') soundPreferenceData = cloneData(family.preferenceModel.soundPreferenceData, { liked: [], noped: [] });
                if (typeof seen !== 'undefined') {
                    seen = new Set((Array.isArray(liked) ? liked : []).map((item) => getKanjiValue(item)).filter(Boolean));
                }
                if (typeof window.setCompoundBuildFlow === 'function') {
                    if (draft.compoundFlow) window.setCompoundBuildFlow(cloneData(draft.compoundFlow, null));
                    else if (typeof window.clearCompoundBuildFlow === 'function') window.clearCompoundBuildFlow();
                }
                if (typeof window.setMeimaySavedCanvasState === 'function') {
                    window.setMeimaySavedCanvasState(nextSavedCanvas);
                } else {
                    setSavedCanvasStateSnapshot(nextSavedCanvas);
                }
                this.syncVisibleInputs(draft, family);
                this.syncVisibleControls(child);
                this.syncLegacyLocalStorage(child, family);
            } finally {
                this._persistenceLocked = false;
            }
        },

        syncLegacyLocalStorage(child, family) {
            try {
                if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveLiked === 'function') {
                    StorageBox.saveLiked();
                } else if (typeof StorageBox !== 'undefined' && typeof StorageBox._persistLikedState === 'function') {
                    StorageBox._persistLikedState(child.libraries.kanjiStock || []);
                }
                if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveSavedNames === 'function') {
                    StorageBox.saveSavedNames();
                } else {
                    localStorage.setItem('meimay_saved', JSON.stringify(child.libraries.savedNames || []));
                    if ((child.libraries.savedNames || []).length === 0) {
                        localStorage.setItem('meimay_saved_cleared_at', new Date().toISOString());
                    } else {
                        localStorage.removeItem('meimay_saved_cleared_at');
                    }
                }
                localStorage.setItem('naming_app_surname', JSON.stringify({ str: family.surnameDefault.kanji || '', data: typeof surnameData !== 'undefined' ? cloneData(surnameData, []) : [], reading: family.surnameDefault.reading || '' }));
                localStorage.setItem('naming_app_segments', JSON.stringify(child.draft.segments || []));
                localStorage.setItem('naming_app_settings', JSON.stringify({ gender: child.meta.gender || 'neutral', rule: child.prefs.rule || 'strict', prioritizeFortune: child.prefs.prioritizeFortune === true }));
                localStorage.setItem('meimay_user_tags', JSON.stringify(family.preferenceModel.userTags || {}));
                localStorage.setItem('meimay_noped', JSON.stringify(child.libraries.noped || []));
                localStorage.setItem('meimay_sound_preferences', JSON.stringify(family.preferenceModel.soundPreferenceData || { liked: [], noped: [] }));
                localStorage.setItem('meimay_reading_stock', JSON.stringify(child.libraries.readingStock || []));
                localStorage.setItem('meimay_reading_history', JSON.stringify(child.libraries.readingHistory || []));
                localStorage.setItem('meimay_hidden_readings', JSON.stringify(child.libraries.hiddenReadings || []));
                localStorage.setItem('meimay_settings', JSON.stringify({
                    surname: family.surnameDefault.kanji || '',
                    surnameReading: family.surnameDefault.reading || '',
                    gender: child.meta.gender || 'neutral',
                    imageTags: child.prefs.imageTags || ['none'],
                    rule: child.prefs.rule || 'strict',
                    prioritizeFortune: child.prefs.prioritizeFortune === true,
                    segments: child.draft.segments || [],
                    shareMode: family.appSettings.shareMode || 'auto',
                    showInappropriateKanji: family.appSettings.showInappropriateKanji === true
                }));
            } catch (error) {
                console.warn('CHILD_WORKSPACES: legacy sync failed', error);
            }
        },

        syncVisibleInputs(draft, family) {
            const surnameInput = document.getElementById('in-surname');
            if (surnameInput) surnameInput.value = family.surnameDefault.kanji || '';
            const diagSurnameInput = document.getElementById('diag-surname');
            if (diagSurnameInput) diagSurnameInput.value = family.surnameDefault.kanji || '';
            const readingInput = document.getElementById('in-name');
            if (readingInput) readingInput.value = draft.readingInputValue || '';
        },

        syncVisibleControls(child) {
            if (typeof setGender === 'function') setGender(child.meta.gender || 'neutral');
            if (typeof setRule === 'function') setRule(child.prefs.rule || 'strict');
            const fortuneBtn = document.getElementById('btn-fortune');
            if (fortuneBtn) fortuneBtn.classList.toggle('active', child.prefs.prioritizeFortune === true);
            if (typeof updateSurnameData === 'function') updateSurnameData();
        },

        getChildLabel(childId) {
            const child = this.getChildById(childId);
            return child?.meta?.displayLabel || '第一子';
        },

        getFormattedChildLabel(childId) {
            const child = this.getChildById(childId);
            if (!child) return '第一子';
            const baseLabel = child.meta.displayLabel || '第一子';
            const emoji = getGenderEmoji(child.meta.gender);
            const matchedName = this.getMatchedNameForChild(childId);
            return matchedName ? `${baseLabel}${emoji}：${matchedName}` : `${baseLabel}${emoji}`;
        },

        getMatchedNameForChild(childId) {
            const child = this.getChildById(childId);
            if (!child) return null;
            const savedCanvas = child.draft?.savedCanvas;
            if (!savedCanvas || savedCanvas.blank) return null;
            
            const ownKey = canonicalizeWorkspaceSavedKey(savedCanvas.ownKey);
            const partnerKey = canonicalizeWorkspaceSavedKey(savedCanvas.partnerKey);
            
            if (ownKey && partnerKey && ownKey === partnerKey) {
                const parts = ownKey.split('::');
                return String(parts[0] || '').trim();
            }
            return null;
        },

        getSummaryLibrariesForChild(childId) {
            const child = this.getChildById(childId);
            if (!child) return {};
            if (this.root?.activeChildId === childId) {
                const liveRecord = this.captureCurrentChildRecord(child.meta);
                return liveRecord?.libraries || child.libraries || {};
            }
            return child.libraries || {};
        },

        summarizeChildLibraries(libraries = {}) {
            const readingItems = this.normalizeReadingLibrary(libraries?.readingStock);
            const kanjiItems = this.normalizeKanjiLibrary(libraries?.kanjiStock, { likedRemovalSource: 'child-summary' });
            const savedItems = this.normalizeSavedLibrary(libraries?.savedNames).filter((item) => item?.fromPartner !== true);
            return {
                readingCount: readingItems.length,
                kanjiCount: new Set(kanjiItems.map((item) => getKanjiValue(item)).filter(Boolean)).size,
                savedCount: savedItems.length
            };
        },

        getChildSummary(childId) {
            const child = this.getChildById(childId);
            if (!child) return { readingCount: 0, kanjiCount: 0, savedCount: 0 };
            return this.summarizeChildLibraries(this.getSummaryLibrariesForChild(childId));
        },

        resolveMergedGender(localGender, partnerGender) {
            const l = normalizeGenderValue(localGender);
            const p = normalizeGenderValue(partnerGender);
            if (l === p) return l;
            if (l === 'neutral') return p;
            if (p === 'neutral') return l;
            // Male vs Female conflict
            return 'neutral';
        },

        getPairedChildSummary(childId) {
            const child = this.getChildById(childId);
            if (!child) return null;

            const partnerChild = this.getPartnerChildForChild(child);
            if (!partnerChild) return null;

            const ownReadingKeys = new Set(
                (child.libraries?.readingStock || [])
                    .map((item) => this.getReadingItemKey(item))
                    .filter(Boolean)
            );
            const partnerReadingKeys = new Set(
                (partnerChild.libraries?.readingStock || [])
                    .map((item) => this.getReadingItemKey(item))
                    .filter(Boolean)
            );
            const matchedReadingCount = Array.from(ownReadingKeys).filter((key) => partnerReadingKeys.has(key)).length;

            const ownKanjiSet = new Set((child.libraries?.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean));
            const partnerKanjiSet = new Set((partnerChild.libraries?.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean));

            const buildSavedKey = (item) => {
                if (!item) return '';
                const pairInsights = typeof window !== 'undefined' ? window.MeimayPartnerInsights : null;
                if (pairInsights && typeof pairInsights.buildSavedMatchKey === 'function') {
                    return String(pairInsights.buildSavedMatchKey(item) || '').trim();
                }
                return this.getSavedItemKey(item);
            };

            const ownSavedKeys = new Set(
                (child.libraries?.savedNames || [])
                    .filter((item) => item?.fromPartner !== true)
                    .map((item) => buildSavedKey(item))
                    .filter(Boolean)
            );
            const partnerSavedKeys = new Set(
                (partnerChild.libraries?.savedNames || [])
                    .filter((item) => item?.fromPartner !== true)
                    .map((item) => buildSavedKey(item))
                    .filter(Boolean)
            );

            return {
                readingCount: ownReadingKeys.size + partnerReadingKeys.size - matchedReadingCount,
                kanjiCount: new Set([...ownKanjiSet, ...partnerKanjiSet]).size,
                savedCount: new Set([...ownSavedKeys, ...partnerSavedKeys]).size,
                summaryLabel: 'ふたりで集めた候補'
            };
        },

        getCurrentFamilySurnameDraft() {
            const wizard = (typeof WizardData !== 'undefined' && WizardData && typeof WizardData.get === 'function')
                ? (WizardData.get() || {})
                : {};
            return {
                kanji: String((typeof surnameStr !== 'undefined' ? surnameStr : wizard.surname || wizard.surnameStr || '') || '').trim(),
                reading: String((typeof surnameReading !== 'undefined' ? surnameReading : wizard.surnameReading || '') || '').trim()
            };
        },

        getDisplayChildSummary(childId) {
            const isPaired = typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode;
            if (isPaired) {
                const pairedSummary = this.getPairedChildSummary(childId);
                if (pairedSummary) return pairedSummary;
            }
            const localSummary = this.getChildSummary(childId);
            return { ...localSummary, summaryLabel: '' };
        },
        getSharedSummary() {
            const shared = this.root?.family?.sharedLibraries || createBlankFamilyState().sharedLibraries;
            return {
                readingCount: Array.isArray(shared.readingStock) ? shared.readingStock.length : 0,
                kanjiCount: new Set((shared.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean)).size
            };
        },

        renderSwitchers() {
            if (!this.initialized || !this.root) return;
            
            // 縺吶∋縺ｦ縺ｮ繧ｹ繧､繝繧√繝｣繧ｯ繝ｪ繧｢                document.querySelectorAll('.meimay-child-switcher').forEach((node) => node.remove());
            
            KNOWN_SCREENS.forEach((screenId) => {
                const host = document.querySelector(SCREEN_HOST_SELECTORS[screenId]);
                if (!host) return;
                const element = document.createElement('div');
                element.className = `meimay-child-switcher${screenId === 'scr-build' || screenId === 'scr-settings' ? ' compact' : ''}`;
                element.dataset.screenId = screenId;
                element.innerHTML = this.buildSwitcherMarkup(screenId);
                host.prepend(element);
            });
            
            // 繝倥ャ繝繝ｼ繝懊ち繝ｳ縺ｮ譖ｴ譁
            this.updateHeaderChildButton();
            
            // 險ｭ螳夂判髱｢縺ｮ繧ｫ繝ｼ繝峨ョ繧ｳ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ
            this.decorateSettingsChildManagementCard();
        },

        buildSwitcherMarkup(screenId) {
            const activeChild = this.getActiveChild();
            const activeId = activeChild?.meta?.id || '';
            const activeLabel = activeChild?.meta?.displayLabel || '第一子';
            const matchedName = this.getMatchedNameForChild(activeId);
            const emoji = getGenderEmoji(activeChild?.meta?.gender);
            
            const activeGender = getGenderLabel(activeChild?.meta?.gender || 'neutral');
            const summary = this.getDisplayChildSummary(activeId);
            const childButtons = this.buildOrderedChildIds(this.root).map((childId) => {
                const child = this.getChildById(childId);
                const childSummary = this.getDisplayChildSummary(childId);
                const label = this.getFormattedChildLabel(childId);
                return `
                    <button type="button" onclick="MeimayChildWorkspaces.switchChild('${escapeHtml(childId)}')" class="meimay-child-chip${childId === this.root.activeChildId ? ' active' : ''}">
                        ${escapeHtml(label)}
                        <span class="meimay-child-chip-sub">${escapeHtml(getGenderLabel(child.meta.gender))} ・ 読み ${childSummary.readingCount} / 漢字 ${childSummary.kanjiCount} / 保存 ${childSummary.savedCount}</span>
                    </button>
                `;
            }).join('');
            
            const titleHtml = this.getFormattedChildLabel(activeId) + (matchedName ? '' : ' を進行中');
                
            return `
                <div class="meimay-child-switcher-header">
                    <div>
                        <div class="meimay-child-switcher-title">${titleHtml}</div>
                        <div class="meimay-child-switcher-subtitle">${escapeHtml(activeGender)} ・ 読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}</div>
                    </div>
                    <button type="button" class="meimay-child-inline-btn" onclick="MeimayChildWorkspaces.openManagerModal()">子ども管理</button>
                </div>
                <div class="meimay-child-chip-row">${childButtons}<button type="button" class="meimay-child-chip-add" onclick="MeimayChildWorkspaces.openChildModal('create')">＋ 追加</button></div>
                ${screenId === 'scr-mode' ? '<div class="meimay-child-switcher-meta">切り替えると今の作業状態を自動保存して、次の子どもの候補へ切り替えます。</div>' : ''}
            `;
        },


        refreshVisibleUI(reason = 'refresh') {
            const activeScreen = document.querySelector('.screen.active')?.id || '';
            if (activeScreen === 'scr-mode' && typeof renderHomeProfile === 'function') renderHomeProfile();
            if (activeScreen === 'scr-settings' && typeof renderSettingsScreen === 'function') renderSettingsScreen();
            if (activeScreen === 'scr-build' && typeof renderBuildSelection === 'function') renderBuildSelection();
            if (activeScreen === 'scr-saved' && typeof renderSavedScreen === 'function') renderSavedScreen();
            if (activeScreen === 'scr-history' && typeof renderHistoryScreen === 'function') renderHistoryScreen();
            if (activeScreen === 'scr-stock') {
                if (typeof currentStockTab !== 'undefined' && currentStockTab === 'reading' && typeof renderReadingStockSectionVisible === 'function') renderReadingStockSectionVisible();
                else if (typeof renderStock === 'function') renderStock();
            }
            if (activeScreen === 'scr-input-reading' && typeof initReadingStockPicker === 'function') initReadingStockPicker();
            this.renderSwitchers();
            if (activeScreen === 'scr-settings') this.decorateSettingsChildManagementCard();
        },

        switchChild(childId) {
            if (!this.root || !this.getChildById(childId) || this.root.activeChildId === childId) return;
            const activeScreen = document.querySelector('.screen.active')?.id || '';
            const shouldConfirm = activeScreen === 'scr-main' || activeScreen === 'scr-swipe-universal';
            if (shouldConfirm && !confirm('今の作業状態を保存して切り替えます。続けますか？')) return;
            this.persistActiveChildSnapshot('switch-away');
            this.root.activeChildId = childId;
            this.saveRoot(this.root);
            this.applyActiveChildToGlobals({ reason: 'switch' });
            this.closeManagerModal();
            this.refreshVisibleUI('switch');
            this.renderSwitchers();
            this.notify(`${this.getChildLabel(childId)} に切り替えました`, '✓');
        },

        generateChildId() {
            return `child_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        },

        getSuggestedBirthOrder() {
            return this.buildOrderedChildIds(this.root).reduce((max, childId) => {
                const child = this.getChildById(childId);
                return Math.max(max, normalizePositiveInteger(child?.meta?.birthOrder, 1));
            }, 0) + 1;
        },

        isDisplayLabelTaken(displayLabel, excludedChildId = null) {
            return this.buildOrderedChildIds(this.root).some((childId) => {
                if (excludedChildId && childId === excludedChildId) return false;
                const child = this.getChildById(childId);
                return child?.meta?.displayLabel === displayLabel;
            });
        },

        buildChildRecordForCreate(options = {}) {
            const id = String(options.id || this.generateChildId());
            const birthOrder = normalizePositiveInteger(options.birthOrder, this.getSuggestedBirthOrder());
            const twinIndex = normalizeTwinIndex(options.multipleIndex ?? options.twinIndex ?? null);
            const multipleCount = twinIndex === null
                ? null
                : normalizeMultipleCount(
                    options.birthGroupSize ?? options.multipleCount ?? options.twinCount,
                    Math.max(twinIndex + 1, 2)
                );
            const genderValue = normalizeGenderValue(options.gender || 'neutral');
            const activeChild = this.getActiveChild();
            const prefs = cloneData(activeChild?.prefs, {
                rule: typeof rule !== 'undefined' ? rule : 'strict',
                prioritizeFortune: typeof prioritizeFortune !== 'undefined' ? prioritizeFortune === true : false,
                imageTags: typeof selectedImageTags !== 'undefined' ? cloneData(selectedImageTags, ['none']) : ['none']
            });
            return {
                meta: {
                    id,
                    birthOrder,
                    displayLabel: buildDisplayLabel(birthOrder, twinIndex, multipleCount),
                    gender: genderValue,
                    birthGroupId: twinIndex === null ? null : `bg_${birthOrder}`,
                    birthGroupIndex: twinIndex,
                    birthGroupSize: multipleCount,
                    multipleCount,
                    twinGroupId: twinIndex === null ? null : `bg_${birthOrder}`,
                    twinIndex,
                    twinCount: multipleCount,
                    createdAt: getNowIso(),
                    updatedAt: getNowIso(),
                    dueDate: String(options.dueDate || ''),
                    birthDate: ''
                },
                prefs: {
                    rule: String(prefs.rule || 'strict'),
                    prioritizeFortune: prefs.prioritizeFortune === true,
                    imageTags: Array.isArray(prefs.imageTags) && prefs.imageTags.length > 0 ? cloneData(prefs.imageTags, ['none']) : ['none']
                },
                draft: createBlankChildDraft(),
                libraries: this.buildInitialLibrariesForCreate(options.startMode, options.sourceChildId, options.copySections, id)
            };
        },





        syncChildModalDeleteButtonState() {
            const deleteButton = document.querySelector('#meimay-child-editor-modal .meimay-child-danger');
            if (!deleteButton) return;
            const canDelete = this.buildOrderedChildIds(this.root).length > 1;
            deleteButton.hidden = !canDelete;
            deleteButton.disabled = !canDelete;
            deleteButton.title = canDelete ? '' : '最後の1人は削除できません';
            deleteButton.setAttribute('aria-disabled', canDelete ? 'false' : 'true');
        },

        copyAllFromChild(sourceChildId) {
            const sourceChild = this.getChildById(sourceChildId);
            const activeChild = this.getActiveChild();
            if (!sourceChild || !activeChild || sourceChildId === activeChild.meta.id) return;
            this.persistActiveChildSnapshot('before-copy-child');
            const target = this.getActiveChild();
            target.libraries.readingStock = this.mergeReadingLibraries(target.libraries.readingStock, sourceChild.libraries.readingStock).items;
            target.libraries.kanjiStock = this.mergeKanjiLibraries(target.libraries.kanjiStock, sourceChild.libraries.kanjiStock, { sourceChildId, sourceLabel: sourceChild.meta.displayLabel }).items;
            target.libraries.savedNames = this.mergeSavedLibraries(target.libraries.savedNames, sourceChild.libraries.savedNames, {
                sourceChildId,
                sourceLabel: sourceChild.meta.displayLabel,
                targetChildId: target.meta.id
            }).items;
            target.meta.updatedAt = getNowIso();
            this.saveRoot(this.root);
            this.applyActiveChildToGlobals({ reason: 'copy-child' });
            this.refreshVisibleUI('copy-child');
            this.closeManagerModal();
            this.notify(`${sourceChild.meta.displayLabel} の候補を引き継ぎました`, '✓');
        },

        applySharedLibrariesToActiveChild() {
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            this.persistActiveChildSnapshot('before-apply-shared');
            const shared = this.root?.family?.sharedLibraries || createBlankFamilyState().sharedLibraries;
            activeChild.libraries.readingStock = this.mergeReadingLibraries(activeChild.libraries.readingStock, shared.readingStock).items;
            activeChild.libraries.kanjiStock = this.mergeKanjiLibraries(activeChild.libraries.kanjiStock, shared.kanjiStock, { sourceChildId: 'family', sourceLabel: '家族共通' }).items;
            activeChild.meta.updatedAt = getNowIso();
            this.saveRoot(this.root);
            this.applyActiveChildToGlobals({ reason: 'apply-shared' });
            this.refreshVisibleUI('apply-shared');
            this.closeManagerModal();
            this.notify('家族共通の素材を取り込みました', '✓');
        },

        promoteActiveReadingsToShared() {
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            this.persistActiveChildSnapshot('before-promote-readings');
            this.root.family.sharedLibraries.readingStock = this.mergeReadingLibraries(this.root.family.sharedLibraries.readingStock, activeChild.libraries.readingStock).items;
            this.saveRoot(this.root);
            this.closeManagerModal();
            this.openManagerModal();
            this.renderSwitchers();
            this.notify('今の読みを家族共通へ追加しました', '✓');
        },

        promoteActiveKanjiToShared() {
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            this.persistActiveChildSnapshot('before-promote-kanji');
            this.root.family.sharedLibraries.kanjiStock = this.mergeKanjiLibraries(this.root.family.sharedLibraries.kanjiStock, activeChild.libraries.kanjiStock, { sourceChildId: activeChild.meta.id, sourceLabel: activeChild.meta.displayLabel, genericOnly: true }).items;
            this.saveRoot(this.root);
            this.closeManagerModal();
            this.openManagerModal();
            this.renderSwitchers();
            this.notify('今の漢字を家族共通へ追加しました', '✓');
        },

        deleteChild(childId) {
            if (!this.root || !this.getChildById(childId)) return;
            if (this.buildOrderedChildIds(this.root).length <= 1) {
                this.notify('最後の1人は削除できません。', '!');
                return;
            }
            const child = this.getChildById(childId);
            // パートナーが作った子は削除不可（離脱のみ）
            if (child?.meta?.createdByPartner) {
                this.notify('パートナーが追加した子は削除できません。「参加をやめる」で離脱してください。', '!');
                return;
            }
            if (!confirm(`${child.meta.displayLabel} を削除しますか？ この子の読み・漢字・保存候補は消えます。`)) return;
            this.persistActiveChildSnapshot('before-delete-child');
            this.root.deletedChildren = mergeDeletedChildrenMaps(this.root.deletedChildren, {
                [childId]: getNowIso()
            });
            delete this.root.children[childId];
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            if (this.root.activeChildId === childId) this.root.activeChildId = this.root.childOrder[0];
            this.saveRoot(this.root);
            this.closeChildModal();
            this.closeManagerModal();
            this.applyActiveChildToGlobals({ reason: 'delete-child' });
            this.refreshVisibleUI('delete-child');
            this.notify('子どもを削除しました', '✓');
        },

        // パートナーが作った子の「参加をやめる」（ライブラリは残して非アクティブ化）
        leavePartnerChild(childId) {
            if (!this.root || !this.getChildById(childId)) return;
            const child = this.getChildById(childId);
            if (!child?.meta?.createdByPartner) return;
            if (this.buildOrderedChildIds(this.root).length <= 1) {
                this.notify('最後の1人は離脱できません。', '!');
                return;
            }
            const label = child.meta.displayLabel || '子ども';
            if (!confirm(`${label} の参加をやめますか？ また「参加する」ボタンで参加できます。`)) return;
            this.persistActiveChildSnapshot('before-leave-partner-child');
            // 子を削除リストへ（パートナーが再送信すれば再参加可能にする）
            this.root.deletedChildren = mergeDeletedChildrenMaps(this.root.deletedChildren, {
                [childId]: getNowIso()
            });
            delete this.root.children[childId];
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            if (this.root.activeChildId === childId) this.root.activeChildId = this.root.childOrder[0];
            this.saveRoot(this.root);
            this.closeChildModal();
            this.closeManagerModal();
            this.applyActiveChildToGlobals({ reason: 'leave-partner-child' });
            this.refreshVisibleUI('leave-partner-child');
            this.notify(`${label} から離脱しました`, '✓');
        },

        // パートナーが追加した子で、自分側にまだない子のリストを返す
        getUnacceptedPartnerChildren() {
            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) return [];
            const ownSlotKeys = new Set(
                this.buildOrderedChildIds(this.root)
                    .map((id) => getChildWorkspaceSlotKey(this.getChildById(id)))
                    .filter(Boolean)
            );
            return Object.values(partnerRoot.children || {}).filter((partnerChild) => {
                const slotKey = getChildWorkspaceSlotKey(partnerChild);
                return slotKey && !ownSlotKeys.has(slotKey);
            });
        },

        // パートナーの子を自分の名づけ帳に追加（ライブラリは空でスタート）
        acceptPartnerChild(partnerChildSlotKey, options = {}) {
            if (!partnerChildSlotKey || !this.root) return;
            const partnerRoot = this.getPartnerWorkspaceRoot();
            const partnerChild = Object.values(partnerRoot?.children || {}).find(
                (c) => getChildWorkspaceSlotKey(c) === partnerChildSlotKey
            );
            if (!partnerChild) {
                this.notify('パートナーの子どもが見つかりませんでした。', '!');
                return;
            }
            const partnerSlotKey = getChildWorkspaceSlotKey(partnerChild);
            const partnerTwinIndex = normalizeTwinIndex(partnerChild.meta?.birthGroupIndex ?? partnerChild.meta?.twinIndex ?? null);
            const partnerMultipleCount = partnerTwinIndex === null
                ? null
                : normalizeMultipleCount(
                    partnerChild.meta?.birthGroupSize ?? partnerChild.meta?.multipleCount ?? partnerChild.meta?.twinCount,
                    Math.max(partnerTwinIndex + 1, 2)
                );
            let birthOrder = normalizePositiveInteger(partnerChild.meta?.birthOrder, 1);
            let twinIndex = partnerTwinIndex;
            let multipleCount = partnerMultipleCount;
            if (this.isBirthOrderTaken(birthOrder)) {
                if (partnerTwinIndex !== null && !this.isChildWorkspaceSlotTaken(partnerSlotKey)) {
                    twinIndex = partnerTwinIndex;
                } else if (options.allowNextBirthOrder === true) {
                    birthOrder = this.getSuggestedBirthOrder();
                    twinIndex = null;
                    multipleCount = null;
                } else {
                    this.notify('その生まれ順はすでに使われています。', '!');
                    return;
                }
            }
            const newId = `child_${Date.now()}`;
            const newChild = {
                meta: {
                    id: newId,
                    birthOrder,
                    displayLabel: buildDisplayLabel(birthOrder, twinIndex, multipleCount),
                    gender: normalizeGenderValue(partnerChild.meta?.gender || 'neutral'),
                    birthGroupId: twinIndex === null ? null : (partnerChild.meta?.birthGroupId || `bg_${birthOrder}`),
                    birthGroupIndex: twinIndex,
                    birthGroupSize: multipleCount,
                    multipleCount,
                    twinGroupId: twinIndex === null ? null : (partnerChild.meta?.twinGroupId || partnerChild.meta?.birthGroupId || `bg_${birthOrder}`),
                    twinIndex,
                    twinCount: multipleCount,
                    createdAt: getNowIso(),
                    updatedAt: getNowIso(),
                    dueDate: partnerChild.meta?.dueDate || partnerChild.meta?.birthDate || '',
                    birthDate: '',
                    createdByPartner: true // パートナーが作ったフラグ
                },
                prefs: {
                    rule: typeof rule !== 'undefined' ? rule : 'strict',
                    prioritizeFortune: false,
                    imageTags: ['none']
                },
                draft: {},
                libraries: {
                    kanjiStock: [],
                    readingStock: [],
                    savedNames: [],
                    readingHistory: [],
                    hiddenReadings: [],
                    noped: []
                }
            };
            this.persistActiveChildSnapshot('before-accept-partner-child');
            this.root.children[newId] = newChild;
            if (options.linkPartnerChild === true) {
                const links = this.getPartnerChildLinks();
                links[newId] = {
                    status: 'linked',
                    partnerChildId: String(partnerChild.meta?.id || '').trim(),
                    partnerSlotKey: getChildWorkspaceSlotKey(partnerChild),
                    partnerLabel: getChildWorkspaceOwnerLabel(partnerChild, 'パートナーの子'),
                    confirmedAt: getNowIso(),
                    updatedAt: getNowIso()
                };
            }
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            this.saveRoot(this.root);
            this.closeManagerModal();
            this.switchChild(newId);
            this.refreshVisibleUI('accept-partner-child');
            const label = newChild.meta.displayLabel;
            this.notify(`${label} に参加しました`, '✓');
        },

        notify(message, icon = '✓') {
            if (typeof showToast === 'function') showToast(message, icon);
            else alert(message);
        },

        getRootSnapshot() {
            return cloneData(this.root, null);
        },

        applyRemoteRootSnapshot(snapshot, options = {}) {
            if (!snapshot) return false;
            if (!this.root) {
                this.root = this.loadOrMigrateRoot();
            }
            const merged = this.mergeRootState(this.root, snapshot, options);
            this.root = merged;
            this.saveRoot(merged, { skipRemoteSync: true });
            if (this.initialized) {
                this.applyActiveChildToGlobals({ reason: options.reason || 'remote-root' });
                this.renderSwitchers();
                this.decorateSettingsChildManagementCard();
                this.refreshVisibleUI(options.reason || 'remote-root');
                this.updateChildModalPartnerSelectionHint();
            }
            return true;
        },

        /* 繝代・繝医リ繝ｼ縺ｮ譛ｬ蜻ｽ驕ｸ謚槭ｒ繝ｪ繧｢繝ｫ繧ｿ繧､繝縺ｧ蜿榊ｰ */
        applyPartnerRootSnapshot(partnerSnapshot, options = {}) {
            if (!partnerSnapshot || !this.root) return false;
            
            let snapshot = partnerSnapshot;
            if (typeof snapshot === 'string') {
                try {
                    snapshot = JSON.parse(snapshot);
                } catch (e) {
                    console.warn('CHILD_WORKSPACES: Failed to parse partner snapshot', e);
                    return false;
                }
            }
            if (typeof snapshot !== 'object') return false;

            let changed = false;
            const partnerChildren = snapshot.children || {};
            
            // 明示的にそろえた名づけ帳だけ、パートナーの本命選択を取り込む。
            // 性別や予定日は自動上書きせず、名づけ帳の確認画面でユーザーに判断してもらう。
            Object.values(this.root.children || {}).forEach((localChild) => {
                const partnerChild = this.getPartnerChildForChild(localChild);
                if (!partnerChild) return;
                
                const partnerSelectedKey = extractSavedCanvasOwnKeyFromWorkspaceState(partnerChild);
                if (localChild.draft?.savedCanvas) {
                    if (localChild.draft.savedCanvas.partnerKey !== partnerSelectedKey) {
                        localChild.draft.savedCanvas.partnerKey = partnerSelectedKey;
                        changed = true;
                    }
                } else if (partnerSelectedKey) {
                    if (!localChild.draft) localChild.draft = createBlankChildDraft();
                    localChild.draft.savedCanvas = normalizeWorkspaceSavedCanvasState({ partnerKey: partnerSelectedKey });
                    changed = true;
                }
            });
            
            if (changed) {
                this.saveRoot(this.root, { reason: 'partner-status-sync', skipRemoteSync: true });
                this.applyActiveChildToGlobals({ reason: 'partner-status-sync' });
                this.refreshVisibleUI('partner-status-sync');
            }
            this.refreshOpenManagerModal();
            this.schedulePartnerAlignmentAutoOpen(options.reason || 'partner-root');
            return changed;
        },

        saveRoot(root = this.root, options = {}) {
            if (!root) return;
            
            // 復元中、あるいは送信中、あるいは明示的なスキップ指定がある場合は同期しない
            const isRestoring = typeof MeimayShare !== 'undefined' && MeimayShare._restoreInFlight;
            const isSyncing = typeof MeimayPairing !== 'undefined' && MeimayPairing._syncInProgress;
            const skipSync = !!options.skipRemoteSync || isRestoring || isSyncing;

            const nextRoot = root;
            nextRoot.updatedAt = getNowIso();
            if (!nextRoot.createdAt) nextRoot.createdAt = nextRoot.updatedAt;
            localStorage.setItem(ROOT_KEY, JSON.stringify(root));

            if (!skipSync) {
                if (typeof window.MeimayUserBackup !== 'undefined' && window.MeimayUserBackup && typeof window.MeimayUserBackup.scheduleSync === 'function') {
                    window.MeimayUserBackup.scheduleSync(options.reason || 'child-root-save');
                }
                if (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && typeof MeimayPairing._autoSyncDebounced === 'function') {
                    MeimayPairing._autoSyncDebounced(options.reason || 'child-root-save');
                }
            }
        },




        updateHeaderChildButton() {
            const slot = document.getElementById('top-bar-child-button-slot');
            const existingButton = document.getElementById('top-bar-child-button');
            const wizardCompleted = typeof WizardData !== 'undefined'
                && WizardData
                && typeof WizardData.isCompleted === 'function'
                && WizardData.isCompleted();
            const activeScreenId = document.querySelector('.screen.active')?.id || '';
            const shouldShow = this.initialized && !!this.root && wizardCompleted && activeScreenId !== 'scr-wizard';
            if (!shouldShow) {
                if (existingButton) existingButton.remove();
                if (slot) slot.replaceChildren();
                return;
            }

            let button = existingButton;
            if (!button) {
                button = document.createElement('button');
                button.id = 'top-bar-child-button';
                button.type = 'button';
                button.className = 'absolute right-4 top-1/2 inline-flex h-[28px] max-w-[44vw] -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full border border-[#d8c7b0] bg-[linear-gradient(180deg,#fffdf8_0%,#f4eadb_100%)] px-3 text-[10px] font-black leading-none text-[#6a4a2f] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_3px_10px_rgba(109,78,51,0.08)] transition-all active:scale-95';
                button.addEventListener('click', () => {
                    if (window.MeimayChildWorkspaces && typeof MeimayChildWorkspaces.openManagerModal === 'function') {
                        MeimayChildWorkspaces.openManagerModal();
                    }
                });
            }

            if (slot && button.parentElement !== slot) {
                slot.replaceChildren(button);
            } else if (!button.parentElement) {
                const topBar = document.getElementById('top-bar');
                if (topBar) topBar.appendChild(button);
            }

            const activeChild = this.getActiveChild();
            const label = activeChild ? this.getFormattedChildLabel(activeChild.meta.id) : '第一子';
            button.textContent = label;
            button.title = label;
            button.setAttribute('aria-label', label);
        },

        applyWizardSelection(options = {}) {
            if (!this.root) {
                this.root = this.loadOrMigrateRoot();
            }
            if (!this.root) return false;

            const activeChild = this.getActiveChild();
            if (!activeChild) return false;

            const nextBirthOrder = normalizePositiveInteger(options.birthOrder, activeChild.meta.birthOrder || 1);
            const nextGender = normalizeGenderValue(options.gender || activeChild.meta.gender || 'neutral');
            const hasDateOption = Object.prototype.hasOwnProperty.call(options, 'dueDate')
                || Object.prototype.hasOwnProperty.call(options, 'birthDate');
            const nextDueDate = hasDateOption
                ? String(options.dueDate || options.birthDate || '').trim()
                : String(activeChild.meta.dueDate || activeChild.meta.birthDate || '').trim();

            activeChild.meta.birthOrder = nextBirthOrder;
            activeChild.meta.displayLabel = buildDisplayLabel(nextBirthOrder, activeChild.meta.birthGroupIndex, activeChild.meta.birthGroupSize ?? activeChild.meta.multipleCount ?? activeChild.meta.twinCount);
            activeChild.meta.gender = nextGender;
            activeChild.meta.dueDate = nextDueDate;
            activeChild.meta.birthDate = '';
            activeChild.meta.birthGroupId = activeChild.meta.birthGroupIndex === null ? null : `bg_${nextBirthOrder}`;
            activeChild.meta.twinGroupId = activeChild.meta.birthGroupId;
            activeChild.meta.updatedAt = getNowIso();

            if (typeof gender !== 'undefined') gender = nextGender;

            if (this.initialized) {
                this.persistActiveChildSnapshot('wizard-selection');
                this.renderSwitchers();
                this.refreshVisibleUI('wizard-selection');
            } else {
                this.saveRoot(this.root, { reason: 'wizard-selection' });
            }
            return true;
        },

        getReservedBirthOrdersForChild(child) {
            const order = normalizePositiveInteger(child?.meta?.birthOrder, 0);
            if (order <= 0) return [];
            const rawTwinIndex = child?.meta?.birthGroupIndex ?? child?.meta?.twinIndex ?? child?.meta?.multipleIndex ?? null;
            const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                ? null
                : normalizeTwinIndex(rawTwinIndex);
            if (twinIndex === null) return [order];
            const count = normalizeMultipleCount(
                child?.meta?.birthGroupSize ?? child?.meta?.multipleCount ?? child?.meta?.twinCount,
                Math.max(twinIndex + 1, 2)
            );
            return Array.from({ length: count }, (_, index) => order + index);
        },

        getAvailableBirthOrders(excludedChildId = null) {
            const taken = new Set();
            this.buildOrderedChildIds(this.root).forEach((childId) => {
                if (excludedChildId && childId === excludedChildId) return;
                const child = this.getChildById(childId);
                this.getReservedBirthOrdersForChild(child).forEach((order) => {
                    if (order >= 1) taken.add(order);
                });
            });
            const available = [];
            for (let order = 1; order <= MAX_BIRTH_ORDER; order += 1) {
                if (!taken.has(order)) available.push(order);
            }
            return available;
        },

        getSuggestedBirthOrder() {
            return this.getAvailableBirthOrders()[0] || 1;
        },

        isBirthOrderTaken(order, excludedChildId = null) {
            const safeOrder = normalizePositiveInteger(order, 0);
            if (safeOrder <= 0) return false;
            return this.buildOrderedChildIds(this.root).some((childId) => {
                if (excludedChildId && childId === excludedChildId) return false;
                const child = this.getChildById(childId);
                return this.getReservedBirthOrdersForChild(child).includes(safeOrder);
            });
        },

        findBirthOrderRangeConflict(startOrder, count = 1, excludedChildId = null, options = {}) {
            const safeStart = normalizePositiveInteger(startOrder, 1);
            const safeCount = Math.max(1, normalizeNonNegativeInteger(count, 1));
            const requested = new Set(Array.from({ length: safeCount }, (_, index) => safeStart + index));
            const allowSingletonAtStart = options.allowSingletonAtStart === true;
            for (const childId of this.buildOrderedChildIds(this.root)) {
                if (excludedChildId && childId === excludedChildId) continue;
                const child = this.getChildById(childId);
                if (!child) continue;
                const childOrder = normalizePositiveInteger(child.meta?.birthOrder, 0);
                const rawTwinIndex = child.meta?.birthGroupIndex ?? child.meta?.twinIndex ?? child.meta?.multipleIndex ?? null;
                const childTwinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                    ? null
                    : normalizeTwinIndex(rawTwinIndex);
                if (childTwinIndex !== null && childOrder === safeStart) continue;
                if (allowSingletonAtStart && childTwinIndex === null && childOrder === safeStart) continue;
                const hasConflict = this.getReservedBirthOrdersForChild(child).some((order) => requested.has(order));
                if (hasConflict) return child;
            }
            return null;
        },

        isChildWorkspaceSlotTaken(slotKey, excludedChildId = null) {
            const safeSlotKey = String(slotKey || '').trim();
            if (!safeSlotKey) return false;
            return this.buildOrderedChildIds(this.root).some((childId) => {
                if (excludedChildId && childId === excludedChildId) return false;
                const child = this.getChildById(childId);
                return getChildWorkspaceSlotKey(child) === safeSlotKey;
            });
        },

        findChildIdByBirthSlot(birthOrder, twinIndex = null, excludedChildId = null) {
            const slotKey = getChildWorkspaceSlotKeyFromParts(birthOrder, twinIndex);
            return this.buildOrderedChildIds(this.root).find((childId) => {
                if (excludedChildId && childId === excludedChildId) return false;
                const child = this.getChildById(childId);
                return getChildWorkspaceSlotKey(child) === slotKey;
            }) || null;
        },

        getExistingMultipleGroupSizeForBirthOrder(order) {
            const safeOrder = normalizePositiveInteger(order, 0);
            if (safeOrder <= 0) return null;
            let maxIndex = -1;
            this.buildOrderedChildIds(this.root).forEach((childId) => {
                const child = this.getChildById(childId);
                if (!child || normalizePositiveInteger(child?.meta?.birthOrder, 0) !== safeOrder) return;
                const rawTwinIndex = child.meta?.birthGroupIndex ?? child.meta?.twinIndex ?? child.meta?.multipleIndex ?? null;
                const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                    ? null
                    : normalizeTwinIndex(rawTwinIndex);
                if (twinIndex === null) return;
                const declaredCount = normalizeMultipleCount(
                    child.meta?.birthGroupSize ?? child.meta?.multipleCount ?? child.meta?.twinCount,
                    null
                );
                maxIndex = Math.max(maxIndex, twinIndex, declaredCount ? declaredCount - 1 : -1);
            });
            return maxIndex >= 0 ? normalizeMultipleCount(maxIndex + 1, 2) : null;
        },

        getExistingMultipleGroupDateForBirthOrder(order, excludedChildId = null) {
            const safeOrder = normalizePositiveInteger(order, 0);
            if (safeOrder <= 0) return '';
            for (const childId of this.buildOrderedChildIds(this.root)) {
                if (excludedChildId && childId === excludedChildId) continue;
                const child = this.getChildById(childId);
                if (!child || normalizePositiveInteger(child?.meta?.birthOrder, 0) !== safeOrder) continue;
                const rawTwinIndex = child.meta?.birthGroupIndex ?? child.meta?.twinIndex ?? child.meta?.multipleIndex ?? null;
                const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                    ? null
                    : normalizeTwinIndex(rawTwinIndex);
                if (twinIndex === null) continue;
                const dateValue = String(child.meta?.dueDate || child.meta?.birthDate || '').trim();
                if (dateValue) return dateValue;
            }
            return '';
        },

        getSingletonChildForBirthOrder(order, excludedChildId = null) {
            const safeOrder = normalizePositiveInteger(order, 0);
            if (safeOrder <= 0) return null;
            const singletonId = this.buildOrderedChildIds(this.root).find((childId) => {
                if (excludedChildId && childId === excludedChildId) return false;
                const child = this.getChildById(childId);
                if (!child || normalizePositiveInteger(child?.meta?.birthOrder, 0) !== safeOrder) return false;
                const rawTwinIndex = child.meta?.birthGroupIndex ?? child.meta?.twinIndex ?? child.meta?.multipleIndex ?? null;
                return rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === '';
            });
            return singletonId ? this.getChildById(singletonId) : null;
        },

        promoteSingletonChildToMultipleBase(order, twinIndex = null, excludedChildId = null, multipleCount = null) {
            if (normalizeTwinIndex(twinIndex) === null) return false;
            const safeOrder = normalizePositiveInteger(order, 1);
            const child = this.getSingletonChildForBirthOrder(safeOrder, excludedChildId);
            if (!child) return false;
            const safeCount = normalizeMultipleCount(multipleCount, 2);
            child.meta.birthGroupId = child.meta.birthGroupId || `bg_${safeOrder}`;
            child.meta.birthGroupIndex = 0;
            child.meta.birthGroupSize = safeCount;
            child.meta.multipleCount = safeCount;
            child.meta.twinGroupId = child.meta.twinGroupId || child.meta.birthGroupId;
            child.meta.twinIndex = 0;
            child.meta.twinCount = safeCount;
            child.meta.displayLabel = buildDisplayLabel(safeOrder, 0, safeCount);
            child.meta.updatedAt = getNowIso();
            return true;
        },

        validateChildSlotSelection(birthOrder, twinIndex = null, excludedChildId = null, multipleCount = null) {
            const safeOrder = normalizePositiveInteger(birthOrder, 1);
            const normalizedTwinIndex = normalizeTwinIndex(twinIndex);
            const slotKey = getChildWorkspaceSlotKeyFromParts(safeOrder, normalizedTwinIndex);
            const rangeCount = normalizedTwinIndex === null
                ? 1
                : normalizeMultipleCount(multipleCount, Math.max(normalizedTwinIndex + 1, 2));

            if (this.isChildWorkspaceSlotTaken(slotKey, excludedChildId)) {
                return { ok: false, message: '同じ名づけ帳があります。多胎の区分を変えてください。' };
            }

            const rangeConflict = this.findBirthOrderRangeConflict(safeOrder, rangeCount, excludedChildId, {
                allowSingletonAtStart: normalizedTwinIndex !== null
            });
            if (rangeConflict) {
                return {
                    ok: false,
                    message: normalizedTwinIndex === null
                        ? 'その生まれ順はすでに使われています。'
                        : '人数分の生まれ順がほかの名づけ帳と重なっています。開始する生まれ順を変えてください。'
                };
            }

            const singletonChild = this.getSingletonChildForBirthOrder(safeOrder, excludedChildId);
            if (singletonChild && normalizedTwinIndex === 0) {
                return { ok: false, message: '既存の名づけ帳がひとりめに使われます。追加する場合は、ふたりめ以降を選んでください。' };
            }

            return { ok: true };
        },

        canAddChildWorkspace() {
            return this.buildOrderedChildIds(this.root).length < (MAX_BIRTH_ORDER * MAX_MULTIPLE_CHILDREN);
        },

        buildBirthOrderOptions(selectedOrder, excludedChildId = null, options = {}) {
            const includeTaken = options.includeTaken === true;
            const availableOrders = this.getAvailableBirthOrders(excludedChildId);
            const safeSelected = normalizePositiveInteger(selectedOrder, 0);
            if (availableOrders.length === 0 && !excludedChildId) {
                if (includeTaken) {
                    return Array.from({ length: MAX_BIRTH_ORDER }, (_, index) => index + 1)
                        .map((order) => `<option value="${order}"${safeSelected === order ? ' selected' : ''}>${escapeHtml(getJapaneseOrderLabel(order))}</option>`)
                        .join('');
                }
                if (safeSelected > 0) {
                    return `<option value="${safeSelected}" selected>${escapeHtml(getJapaneseOrderLabel(safeSelected))}</option>`;
                }
                return '<option value="" disabled selected>追加できる順番がありません</option>';
            }
            const orderOptions = includeTaken
                ? Array.from({ length: MAX_BIRTH_ORDER }, (_, index) => index + 1)
                : Array.from(new Set([
                    ...availableOrders,
                    ...(safeSelected > 0 ? [safeSelected] : [])
                ])).sort((left, right) => left - right);
            return orderOptions.map((order) => {
                const isSelected = safeSelected === order;
                return `<option value="${order}"${isSelected ? ' selected' : ''}>${escapeHtml(getJapaneseOrderLabel(order))}</option>`;
            }).join('');
        },

        buildMultipleCountOptions(selectedCount = 2) {
            const normalizedCount = normalizeMultipleCount(selectedCount, 2);
            const labels = {
                2: '2人（双子）',
                3: '3人（三つ子）',
                4: '4人（四つ子）',
                5: '5人（五つ子）'
            };
            const options = [];
            for (let count = 2; count <= MAX_MULTIPLE_CHILDREN; count += 1) {
                options.push(`<option value="${count}"${normalizedCount === count ? ' selected' : ''}>${escapeHtml(labels[count] || `${count}人`)}</option>`);
            }
            return options.join('');
        },

        getSuggestedMultipleIndexForBirthOrder(order, excludedChildId = null) {
            const safeOrder = normalizePositiveInteger(order, 1);
            const startIndex = this.getSingletonChildForBirthOrder(safeOrder, excludedChildId) ? 1 : 0;
            for (let index = startIndex; index < MAX_MULTIPLE_CHILDREN; index += 1) {
                const slotKey = getChildWorkspaceSlotKeyFromParts(safeOrder, index);
                if (!this.isChildWorkspaceSlotTaken(slotKey, excludedChildId)) {
                    return index;
                }
            }
            return startIndex;
        },

        getIncompleteMultipleGroupSuggestion(preferredChildId = '') {
            const preferredId = String(preferredChildId || '').trim();
            const orderedIds = this.buildOrderedChildIds(this.root);
            const candidateIds = [
                ...(preferredId && orderedIds.includes(preferredId) ? [preferredId] : []),
                ...orderedIds.filter((childId) => childId !== preferredId)
            ];

            for (const childId of candidateIds) {
                const child = this.getChildById(childId);
                if (!child) continue;
                const birthOrder = normalizePositiveInteger(child.meta?.birthOrder, 0);
                if (birthOrder <= 0) continue;
                const rawTwinIndex = child.meta?.birthGroupIndex ?? child.meta?.twinIndex ?? child.meta?.multipleIndex ?? null;
                const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                    ? null
                    : normalizeTwinIndex(rawTwinIndex);
                if (twinIndex === null) continue;
                const multipleCount = normalizeMultipleCount(
                    child.meta?.birthGroupSize ?? child.meta?.multipleCount ?? child.meta?.twinCount,
                    Math.max(twinIndex + 1, 2)
                );
                for (let index = 0; index < multipleCount; index += 1) {
                    if (!this.findChildIdByBirthSlot(birthOrder, index)) {
                        return { birthOrder, multipleIndex: index, multipleCount };
                    }
                }
            }

            return null;
        },

        ensureMultipleGroupSiblings(options = {}) {
            const birthOrder = normalizePositiveInteger(options.birthOrder, 1);
            const multipleCount = normalizeMultipleCount(options.multipleCount, 2);
            const dueDate = String(options.dueDate || '').trim();
            const gendersByIndex = options.gendersByIndex && typeof options.gendersByIndex === 'object'
                ? options.gendersByIndex
                : {};
            const groupId = `bg_${birthOrder}`;
            let createdCount = 0;
            let updatedCount = 0;

            for (let index = 0; index < multipleCount; index += 1) {
                let slotId = this.findChildIdByBirthSlot(birthOrder, index);
                if (!slotId && index === 0) {
                    this.promoteSingletonChildToMultipleBase(birthOrder, 0, null, multipleCount);
                    slotId = this.findChildIdByBirthSlot(birthOrder, index);
                }

                if (slotId) {
                    const child = this.getChildById(slotId);
                    if (!child) continue;
                    const shouldUpdateDate = !!dueDate && !String(child.meta?.dueDate || child.meta?.birthDate || '').trim();
                    child.meta.birthOrder = birthOrder;
                    child.meta.birthGroupId = groupId;
                    child.meta.birthGroupIndex = index;
                    child.meta.birthGroupSize = multipleCount;
                    child.meta.multipleCount = multipleCount;
                    child.meta.twinGroupId = groupId;
                    child.meta.twinIndex = index;
                    child.meta.twinCount = multipleCount;
                    child.meta.displayLabel = buildDisplayLabel(birthOrder, index, multipleCount);
                    if (Object.prototype.hasOwnProperty.call(gendersByIndex, index)) {
                        child.meta.gender = normalizeGenderValue(gendersByIndex[index]);
                    }
                    if (shouldUpdateDate) {
                        child.meta.dueDate = dueDate;
                        child.meta.birthDate = '';
                    }
                    child.meta.updatedAt = getNowIso();
                    updatedCount += 1;
                    continue;
                }

                const nextId = this.generateChildId();
                this.root.children[nextId] = this.buildChildRecordForCreate({
                    id: nextId,
                    birthOrder,
                    multipleIndex: index,
                    multipleCount,
                    gender: Object.prototype.hasOwnProperty.call(gendersByIndex, index)
                        ? normalizeGenderValue(gendersByIndex[index])
                        : 'neutral',
                    dueDate,
                    startMode: 'blank'
                });
                createdCount += 1;
            }

            return { createdCount, updatedCount };
        },

        buildMultipleAutoCreateNotice(multipleCount, createdCount = 0) {
            const safeCreatedCount = normalizeNonNegativeInteger(createdCount, 0);
            if (safeCreatedCount <= 0) return '';
            const groupLabel = getMultipleGroupLabel(multipleCount);
            return safeCreatedCount === 1
                ? `${groupLabel}のもう一人も追加しました`
                : `${groupLabel}の残り${safeCreatedCount}人も追加しました`;
        },

        updateChildModalMultipleVisibility(refreshSuggestion = false) {
            const enabled = document.getElementById('mcw-child-multiple-enabled')?.checked === true;
            const area = document.getElementById('mcw-child-multiple-area');
            const select = document.getElementById('mcw-child-multiple-order');
            const countSelect = document.getElementById('mcw-child-multiple-count');
            const baseOrderInput = document.getElementById('mcw-child-multiple-base-order');
            const indexInput = document.getElementById('mcw-child-multiple-index-override');
            const countLockedInput = document.getElementById('mcw-child-multiple-count-locked');
            const modeInput = document.getElementById('mcw-child-modal-mode');
            const hint = document.getElementById('mcw-child-multiple-hint');
            if (area) area.hidden = !enabled;
            if (!enabled || !select) return;

            const displayBirthOrder = normalizePositiveInteger(document.getElementById('mcw-child-order')?.value, 1);
            const excludedChildId = document.getElementById('mcw-child-id')?.value || '';
            const baseOrderRaw = normalizePositiveInteger(baseOrderInput?.value, 0);
            const indexRaw = normalizeTwinIndex(indexInput?.value ?? null);
            const overrideMatchesDisplay = baseOrderRaw > 0
                && indexRaw !== null
                && (baseOrderRaw + indexRaw) === displayBirthOrder;
            const countLocked = String(countLockedInput?.value || '') === '1' && overrideMatchesDisplay;
            if (countSelect) countSelect.disabled = countLocked;
            let birthOrder = overrideMatchesDisplay ? baseOrderRaw : displayBirthOrder;
            let selectedIndex = overrideMatchesDisplay
                ? indexRaw
                : this.getSuggestedMultipleIndexForBirthOrder(birthOrder, excludedChildId);
            const existingCount = this.getExistingMultipleGroupSizeForBirthOrder(birthOrder);
            const countValue = refreshSuggestion ? '' : countSelect?.value;
            let multipleCount = normalizeMultipleCount(
                countValue,
                Math.max(existingCount || 2, selectedIndex + 1, 2)
            );
            if (selectedIndex >= multipleCount) {
                selectedIndex = Math.max(0, multipleCount - 1);
                birthOrder = displayBirthOrder - selectedIndex;
                if (birthOrder <= 0) {
                    birthOrder = displayBirthOrder;
                    selectedIndex = 0;
                }
            }
            if (!overrideMatchesDisplay && selectedIndex > 0 && (birthOrder + selectedIndex) !== displayBirthOrder) {
                selectedIndex = 0;
                birthOrder = displayBirthOrder;
            }
            if (countSelect) countSelect.value = String(multipleCount);
            select.value = String(selectedIndex + 1);
            if (baseOrderInput) baseOrderInput.value = String(birthOrder);
            if (indexInput) indexInput.value = String(selectedIndex);
            if (hint) {
                const groupLabel = getMultipleGroupLabel(multipleCount);
                hint.textContent = String(modeInput?.value || '') === 'edit'
                    ? `${groupLabel}として設定しています。予定日・誕生日は同じ日付を使います。`
                    : selectedIndex > 0
                    ? `${getJapaneseOrderLabel(birthOrder)}と${groupLabel}として追加します。予定日・誕生日は同じ日付を使います。`
                    : `${groupLabel}として追加します。予定日・誕生日は同じ日付を使います。`;
            }
            const existingDate = this.getExistingMultipleGroupDateForBirthOrder(birthOrder, excludedChildId);
            const dateInput = document.getElementById('mcw-child-date-value');
            if (existingDate && dateInput && !String(dateInput.value || '').trim()) {
                dateInput.value = existingDate;
            }
            if (refreshSuggestion || !String(select.value || '').trim()) {
                select.value = String(selectedIndex + 1);
            }
        },

        getSelectedChildModalMultipleSlot() {
            const displayBirthOrder = normalizePositiveInteger(document.getElementById('mcw-child-order')?.value, 1);
            const multipleEnabled = document.getElementById('mcw-child-multiple-enabled')?.checked === true;
            if (!multipleEnabled) {
                return { birthOrder: displayBirthOrder, twinIndex: null, multipleCount: null };
            }

            const multipleCount = normalizeMultipleCount(document.getElementById('mcw-child-multiple-count')?.value, 2);
            const baseOrder = normalizePositiveInteger(document.getElementById('mcw-child-multiple-base-order')?.value, 0);
            const overrideIndex = normalizeTwinIndex(document.getElementById('mcw-child-multiple-index-override')?.value ?? null);
            const canUseOverride = baseOrder > 0
                && overrideIndex !== null
                && overrideIndex < multipleCount
                && (baseOrder + overrideIndex) === displayBirthOrder;

            if (canUseOverride) {
                return { birthOrder: baseOrder, twinIndex: overrideIndex, multipleCount };
            }

            return { birthOrder: displayBirthOrder, twinIndex: 0, multipleCount };
        },

        getSelectedChildModalGender() {
            return normalizeGenderValue(document.getElementById('mcw-child-gender')?.value || 'neutral');
        },

        selectChildModalGender(genderValue) {
            const normalized = normalizeGenderValue(genderValue);
            const hidden = document.getElementById('mcw-child-gender');
            if (hidden) hidden.value = normalized;
            document.querySelectorAll('[data-child-modal-gender]').forEach((button) => {
                button.classList.toggle('selected', button.dataset.childModalGender === normalized);
                button.setAttribute('aria-pressed', button.dataset.childModalGender === normalized ? 'true' : 'false');
            });
            this.updateChildModalPartnerSelectionHint();
        },

        buildChildModalGenderButtons(selectedGender = 'neutral', partnerGender = null) {
            const buttons = [
                { value: 'male', label: '男の子' },
                { value: 'female', label: '女の子' },
                { value: 'neutral', label: '指定なし' }
            ];
            const normalized = normalizeGenderValue(selectedGender);
            const partnerNormalized = normalizeGenderValue(partnerGender);
            return buttons.map((item) => {
                const isSelected = item.value === normalized;
                const isPartnerPicked = partnerNormalized !== 'neutral' && item.value === partnerNormalized;
                return `<button type="button" class="meimay-child-gender-btn${isSelected ? ' selected' : ''}${isPartnerPicked ? ' partner-picked' : ''}" data-child-modal-gender="${item.value}" aria-pressed="${isSelected ? 'true' : 'false'}" onclick="MeimayChildWorkspaces.selectChildModalGender('${item.value}')">
                    <span class="meimay-child-gender-label">${escapeHtml(item.label)}</span>
                </button>`;
            }).join('');
        },

        getPartnerWorkspaceRoot() {
            const snapshot = typeof MeimayShare !== 'undefined' && MeimayShare ? MeimayShare.partnerSnapshot || null : null;
            const candidates = [
                snapshot?.meimayStateV2,
                snapshot?.partnerUserBackup?.meimayStateV2,
                snapshot?.partnerUserBackup?.childWorkspaceStateV2,
                snapshot?.backup?.meimayStateV2,
                snapshot?.backup?.childWorkspaceStateV2,
                snapshot?.meimayBackup?.meimayStateV2,
                snapshot?.meimayBackup?.childWorkspaceStateV2
            ];
            const rawRoot = candidates.find((state) => hasChildWorkspaceData(state));
            const likedRemovalSource = Array.isArray(snapshot?.likedRemoved) && snapshot.likedRemoved.length > 0
                ? snapshot.likedRemoved
                : (Array.isArray(snapshot?.partnerUserBackup?.likedRemoved) && snapshot.partnerUserBackup.likedRemoved.length > 0
                    ? snapshot.partnerUserBackup.likedRemoved
                    : (Array.isArray(snapshot?.backup?.likedRemoved) && snapshot.backup.likedRemoved.length > 0
                        ? snapshot.backup.likedRemoved
                        : (Array.isArray(snapshot?.meimayBackup?.likedRemoved) ? snapshot.meimayBackup.likedRemoved : [])));
            return rawRoot ? this.normalizeRoot(rawRoot, { likedRemovalSource }) : null;
        },

        getPartnerChildLinks() {
            if (!this.root) return {};
            if (!this.root.family) this.root.family = createBlankFamilyState();
            if (!this.root.family.partnerChildLinks || typeof this.root.family.partnerChildLinks !== 'object') {
                this.root.family.partnerChildLinks = {};
            }
            return this.root.family.partnerChildLinks;
        },

        getPartnerChildLink(childId) {
            const safeId = String(childId || '').trim();
            if (!safeId) return null;
            const link = this.getPartnerChildLinks()[safeId];
            return link && typeof link === 'object' ? link : null;
        },

        getLinkedPartnerChildForChild(child) {
            const localChildId = String(child?.meta?.id || '').trim();
            if (!localChildId) return null;
            const link = this.getPartnerChildLink(localChildId);
            if (!link || link.status !== 'linked') return null;

            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) return null;

            const partnerChildId = String(link.partnerChildId || '').trim();
            if (partnerChildId && partnerRoot.children?.[partnerChildId]) {
                return partnerRoot.children[partnerChildId];
            }

            const partnerSlotKey = String(link.partnerSlotKey || '').trim();
            if (partnerSlotKey) {
                return Object.values(partnerRoot.children || {}).find((childRecord) =>
                    getChildWorkspaceSlotKey(childRecord) === partnerSlotKey
                ) || null;
            }

            return null;
        },

        isPartnerChildLinkConfirmed(child, partnerChild = null) {
            const localChildId = String(child?.meta?.id || '').trim();
            if (!localChildId) return false;
            const link = this.getPartnerChildLink(localChildId);
            if (!link || link.status !== 'linked') return false;
            if (!partnerChild) return true;

            const linkedId = String(link.partnerChildId || '').trim();
            const linkedSlot = String(link.partnerSlotKey || '').trim();
            const partnerId = String(partnerChild?.meta?.id || '').trim();
            const partnerSlot = getChildWorkspaceSlotKey(partnerChild);
            return (!!linkedId && linkedId === partnerId) || (!!linkedSlot && linkedSlot === partnerSlot);
        },

        getDefaultPartnerChildForAlignment() {
            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) return null;
            const activePartnerId = String(partnerRoot.activeChildId || '').trim();
            if (activePartnerId && partnerRoot.children?.[activePartnerId]) {
                return partnerRoot.children[activePartnerId];
            }
            const orderedIds = this.buildOrderedChildIds(partnerRoot);
            return orderedIds.length > 0 ? partnerRoot.children?.[orderedIds[0]] || null : null;
        },

        getLocalChildBySlotKey(slotKey) {
            const safeSlotKey = String(slotKey || '').trim();
            if (!safeSlotKey || !this.root) return null;
            return Object.values(this.root.children || {}).find((child) => getChildWorkspaceSlotKey(child) === safeSlotKey) || null;
        },

        buildPartnerAlignmentRows() {
            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!this.root || !partnerRoot) return [];
            return this.buildOrderedChildIds(partnerRoot).map((partnerChildId) => {
                const partnerChild = partnerRoot.children?.[partnerChildId];
                if (!partnerChild) return null;
                const slotKey = getChildWorkspaceSlotKey(partnerChild);
                const localChild = this.getLocalChildBySlotKey(slotKey);
                const linked = !!(localChild && this.isPartnerChildLinkConfirmed(localChild, partnerChild));
                const issues = localChild
                    ? this.getPartnerAlignmentIssues(localChild, partnerChild, { allowDifferentSlot: true })
                    : [];
                return {
                    slotKey,
                    localChild,
                    partnerChild,
                    linked,
                    issues,
                    missingLocal: !localChild
                };
            }).filter(Boolean);
        },

        getPartnerAlignmentIssues(localChild, partnerChild, options = {}) {
            if (!localChild || !partnerChild) return [];
            const issues = [];
            const localSlot = getChildWorkspaceSlotKey(localChild);
            const partnerSlot = getChildWorkspaceSlotKey(partnerChild);
            if (localSlot !== partnerSlot && options.allowDifferentSlot !== true) {
                issues.push('別の子として対応づけます');
            }

            const localGender = normalizeGenderValue(localChild.meta?.gender);
            const partnerGender = normalizeGenderValue(partnerChild.meta?.gender);
            if (localGender !== partnerGender && localGender !== 'neutral' && partnerGender !== 'neutral') {
                issues.push('性別の設定が違います');
            }

            const localDate = String(localChild.meta?.dueDate || localChild.meta?.birthDate || '').trim();
            const partnerDate = String(partnerChild.meta?.dueDate || partnerChild.meta?.birthDate || '').trim();
            if (localDate !== partnerDate && (localDate || partnerDate)) {
                issues.push('予定日・誕生日が違います');
            }

            return issues;
        },

        getPartnerAlignmentState(localChildId = '') {
            const inRoom = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
            const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.partnerUid;
            if (!this.initialized || !this.root || !inRoom || !hasPartner) {
                return { available: false, needsReview: false, reason: 'not-linked' };
            }

            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) {
                return { available: false, needsReview: false, reason: 'partner-loading' };
            }

            const safeLocalChildId = String(localChildId || '').trim();
            const localChild = safeLocalChildId ? this.getChildById(safeLocalChildId) : this.getActiveChild();
            const linkedPartnerChild = this.getLinkedPartnerChildForChild(localChild);
            const partnerChild = linkedPartnerChild
                || this.getPartnerChildBySlotKey(getChildWorkspaceSlotKey(localChild));
            const localCount = this.buildOrderedChildIds(this.root).length;
            const partnerCount = this.buildOrderedChildIds(partnerRoot).length;
            const linked = !!(localChild && this.isPartnerChildLinkConfirmed(localChild, partnerChild));
            const issues = this.getPartnerAlignmentIssues(localChild, partnerChild, { allowDifferentSlot: linked });
            const unacceptedPartnerChildren = this.getUnacceptedPartnerChildren();
            const rows = this.buildPartnerAlignmentRows();
            const needsReview = rows.some((row) => row.missingLocal || !row.linked || row.issues.length > 0);

            return {
                available: true,
                needsReview,
                linked,
                issues,
                rows,
                localChild,
                partnerChild,
                localCount,
                partnerCount,
                unacceptedCount: unacceptedPartnerChildren.length
            };
        },

        isPartnerAlignmentReviewRequired() {
            const state = this.getPartnerAlignmentState();
            return !!state.needsReview;
        },

        schedulePartnerAlignmentAutoOpen(reason = 'partner-sync') {
            if (!this.initialized || !this.root) return false;
            const state = this.getPartnerAlignmentState();
            if (!state.available || !state.needsReview) return false;
            const roomCode = typeof MeimayPairing !== 'undefined' && MeimayPairing ? String(MeimayPairing.roomCode || '').trim() : '';
            const partnerUid = typeof MeimayPairing !== 'undefined' && MeimayPairing ? String(MeimayPairing.partnerUid || '').trim() : '';
            const autoKey = `${roomCode || 'room'}:${partnerUid || 'partner'}`;
            if (this._partnerAlignmentAutoShownKey === autoKey) return false;
            try {
                const storageKey = `meimay_child_alignment_auto_${autoKey}`;
                if (sessionStorage.getItem(storageKey)) return false;
                sessionStorage.setItem(storageKey, getNowIso());
            } catch (_) {}
            this._partnerAlignmentAutoShownKey = autoKey;
            if (this._partnerAlignmentAutoTimer) {
                clearTimeout(this._partnerAlignmentAutoTimer);
            }
            this._partnerAlignmentAutoTimer = setTimeout(() => {
                this._partnerAlignmentAutoTimer = null;
                const latest = this.getPartnerAlignmentState();
                if (!latest.available || !latest.needsReview) return;
                if (document.querySelector('.overlay.active, .meimay-child-modal-overlay')) {
                    return;
                }
                this.openPartnerAlignmentModal();
            }, reason === 'partner-joined' ? 700 : 450);
            return true;
        },

        renderPartnerAlignmentCard() {
            const state = this.getPartnerAlignmentState();
            if (!state.available) return '';
            if (!state.needsReview) return '';

            const issueText = state.issues.length > 0
                ? state.issues.join(' / ')
                : '連携後に一度だけ確認します';

            return `
                <button type="button" onclick="MeimayChildWorkspaces.openPartnerAlignmentModal()"
                    class="w-full rounded-2xl border border-[#dfc596] bg-[#fff8e8] px-3 py-3 text-left transition-transform active:scale-[0.98]">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[12px] font-black text-[#5d5444]">パートナーと名づけ帳を確認</div>
                            <div class="mt-1 text-[10px] font-bold leading-relaxed text-[#9a7d4f]">${escapeHtml(issueText)}</div>
                        </div>
                        <span class="shrink-0 rounded-full bg-[#b9965b] px-2.5 py-1 text-[10px] font-black text-white">確認</span>
                    </div>
                </button>
            `;
        },

        buildPartnerAlignmentPersonSummary(child, ownerLabel) {
            const title = getChildWorkspaceOwnerLabel(child, ownerLabel);
            return `
                <div class="meimay-child-align-person">
                    <div class="meimay-child-align-owner">${escapeHtml(ownerLabel)}</div>
                    <div class="meimay-child-align-title">${escapeHtml(title)}${getGenderEmoji(child?.meta?.gender)}</div>
                    <div class="meimay-child-align-meta">${escapeHtml(getGenderLabel(child?.meta?.gender))}</div>
                    <div class="meimay-child-align-meta">予定日 ${escapeHtml(getChildWorkspaceDateText(child))}</div>
                </div>
            `;
        },

        buildPartnerAlignmentChoice(sectionKey, source, label, value, checked = false) {
            const safeSectionKey = String(sectionKey || '').trim();
            const safeSource = source === 'partner' ? 'partner' : 'local';
            const sourceLabel = safeSource === 'partner' ? '相手の設定' : '今の設定';
            return `
                <label class="meimay-child-align-choice">
                    <input type="radio" name="mcw-align-${escapeHtml(safeSectionKey)}-source" value="${safeSource}" ${checked ? 'checked' : ''}>
                    <span class="meimay-child-align-choice-body">
                        <span class="meimay-child-align-choice-source">${escapeHtml(label || sourceLabel)}</span>
                        <span class="meimay-child-align-choice-value">${escapeHtml(value)}</span>
                    </span>
                </label>
            `;
        },

        buildPartnerAlignmentResolutionControls(localChild, partnerChild) {
            const rows = [];
            const choiceSuffix = String(localChild?.meta?.id || getChildWorkspaceSlotKey(localChild) || 'active').trim();
            const localGender = normalizeGenderValue(localChild?.meta?.gender);
            const partnerGender = normalizeGenderValue(partnerChild?.meta?.gender);
            if (localGender !== partnerGender) {
                rows.push(`
                    <div class="meimay-child-align-resolve-row">
                        <div class="meimay-child-align-resolve-label">性別</div>
                        <div class="meimay-child-align-choice-grid">
                            ${this.buildPartnerAlignmentChoice(`gender-${choiceSuffix}`, 'local', '今の設定', getGenderLabel(localGender), true)}
                            ${this.buildPartnerAlignmentChoice(`gender-${choiceSuffix}`, 'partner', '相手の設定', getGenderLabel(partnerGender))}
                        </div>
                    </div>
                `);
            }

            const localDate = String(localChild?.meta?.dueDate || localChild?.meta?.birthDate || '').trim();
            const partnerDate = String(partnerChild?.meta?.dueDate || partnerChild?.meta?.birthDate || '').trim();
            if (localDate !== partnerDate) {
                rows.push(`
                    <div class="meimay-child-align-resolve-row">
                        <div class="meimay-child-align-resolve-label">予定日・誕生日</div>
                        <div class="meimay-child-align-choice-grid">
                            ${this.buildPartnerAlignmentChoice(`date-${choiceSuffix}`, 'local', '今の設定', formatChildWorkspaceDateText(localDate), true)}
                            ${this.buildPartnerAlignmentChoice(`date-${choiceSuffix}`, 'partner', '相手の設定', formatChildWorkspaceDateText(partnerDate))}
                        </div>
                    </div>
                `);
            }

            if (rows.length === 0) return '';
            return `
                <div class="meimay-child-align-resolve">
                    <div class="meimay-child-align-resolve-title">違うところをそろえる</div>
                    ${rows.join('')}
                </div>
            `;
        },

        buildPartnerAlignmentPairCard(localChild, partnerChild, options = {}) {
            const title = getChildWorkspaceOwnerLabel(localChild, 'この子');
            const issueList = Array.isArray(options.issues) ? options.issues : [];
            const issueHtml = issueList.length > 0
                ? `<div class="meimay-child-align-issues">${issueList.map((issue) => `<span>${escapeHtml(issue)}</span>`).join('')}</div>`
                : '';
            const linked = options.linked === true;
            const canConfirm = !linked || issueList.length > 0;
            const localChildId = String(localChild?.meta?.id || '').trim();
            const partnerSlotKey = getChildWorkspaceSlotKey(partnerChild);
            const desc = issueList.length > 0
                ? '同じ生まれ順の名づけ帳ですが、設定が違います。必要なところだけ選んでそろえます。'
                : '性別と予定日・誕生日は一致しています。このまま一緒に進められます。';
            return `
                <div class="meimay-child-align-pair-card">
                    <div class="meimay-child-align-pair-head">
                        <div class="meimay-child-align-pair-title">${escapeHtml(title)}</div>
                        ${issueHtml}
                    </div>
                    ${issueList.length === 0 ? `<div class="meimay-child-align-summary">
                        <span>${getGenderEmoji(localChild?.meta?.gender) || '⚪'} ${escapeHtml(getGenderLabel(localChild?.meta?.gender))}</span>
                        <span>📅 ${escapeHtml(getChildWorkspaceDateText(localChild))}</span>
                    </div>` : ''}
                    <div class="meimay-child-align-pair-desc">${escapeHtml(desc)}</div>
                    ${this.buildPartnerAlignmentResolutionControls(localChild, partnerChild)}
                    <div class="meimay-child-card-actions" style="margin-top:12px">
                        ${canConfirm
                            ? `<button type="button" class="meimay-child-modal-btn meimay-child-accept" onclick="MeimayChildWorkspaces.confirmPartnerChildLink('${escapeHtml(partnerSlotKey)}', '${escapeHtml(localChildId)}')">${issueList.length > 0 ? 'この内容でそろえる' : 'このまま一緒に進める'}</button>`
                            : '<div class="meimay-child-current-status">確認済み</div>'}
                    </div>
                </div>
            `;
        },

        buildPartnerAlignmentSeparateCard(partnerChild) {
            const title = getChildWorkspaceOwnerLabel(partnerChild, 'パートナーの子');
            const slotKey = getChildWorkspaceSlotKey(partnerChild);
            return `
                <div class="meimay-child-align-pair-card">
                    <div class="meimay-child-align-pair-head">
                        <div class="meimay-child-align-pair-title">${escapeHtml(title)}${getGenderEmoji(partnerChild?.meta?.gender)}</div>
                        <div class="meimay-child-align-issues"><span>別の子として追加</span></div>
                    </div>
                    <div class="meimay-child-align-summary">
                        <span>${getGenderEmoji(partnerChild?.meta?.gender) || '⚪'} ${escapeHtml(getGenderLabel(partnerChild?.meta?.gender))}</span>
                        <span>📅 ${escapeHtml(getChildWorkspaceDateText(partnerChild))}</span>
                    </div>
                    <div class="meimay-child-align-pair-desc">この端末にはまだない生まれ順です。第一子と第二子などは混ぜず、別の名づけ帳として追加します。</div>
                    <div class="meimay-child-card-actions" style="margin-top:12px">
                        <button type="button" class="meimay-child-modal-btn meimay-child-accept" onclick="MeimayChildWorkspaces.addPartnerChildAsSeparate('${escapeHtml(slotKey)}')">この子を追加する</button>
                    </div>
                </div>
            `;
        },

        openPartnerAlignmentModal(partnerChildSlotKey = '', localChildId = '') {
            const state = this.getPartnerAlignmentState(localChildId);
            if (!state.available) {
                this.notify('パートナーの名づけ帳を読み込み中です。少し待ってからもう一度開いてください。', 'i');
                return;
            }

            const rows = this.buildPartnerAlignmentRows();
            const cards = rows.map((row) => {
                if (row.missingLocal) return this.buildPartnerAlignmentSeparateCard(row.partnerChild);
                return this.buildPartnerAlignmentPairCard(row.localChild, row.partnerChild, {
                    issues: row.issues,
                    linked: row.linked
                });
            }).join('');
            const allClear = rows.length > 0 && rows.every((row) => !row.missingLocal && row.linked && row.issues.length === 0);
            const note = allClear
                ? '性別や予定日・誕生日は一致しています。'
                : '同じ生まれ順は一緒に使う名づけ帳として確認します。第一子と第二子など、生まれ順が違うものは別の名づけ帳として扱います。';

            this.closePartnerAlignmentModal();
            const modal = document.createElement('div');
            modal.id = 'meimay-child-align-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closePartnerAlignmentModal();
            };

            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <div class="meimay-child-modal-header">
                        <div class="meimay-child-modal-topbar">
                            <button type="button" class="meimay-child-modal-close" aria-label="閉じる" onclick="MeimayChildWorkspaces.closePartnerAlignmentModal()">×</button>
                        </div>
                        <div class="meimay-child-modal-copy">
                            <div class="meimay-child-modal-title">名づけ帳を確認</div>
                        </div>
                    </div>
                    <div class="meimay-child-align-note">
                        ${escapeHtml(note)}
                    </div>
                    ${cards || '<div class="meimay-child-align-note">パートナー側の名づけ帳を読み込み中です。</div>'}
                    <div class="meimay-child-editor-actions">
                        <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.closePartnerAlignmentModal(); MeimayChildWorkspaces.openManagerModal();">名づけ帳管理で確認</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        },

        closePartnerAlignmentModal() {
            document.getElementById('meimay-child-align-modal')?.remove();
        },

        getPartnerAlignmentChoiceSource(sectionKey) {
            const safeKey = String(sectionKey || '').trim();
            if (!safeKey) return 'local';
            const input = document.querySelector(`input[name="mcw-align-${safeKey}-source"]:checked`);
            return input?.value === 'partner' ? 'partner' : 'local';
        },

        applyPartnerAlignmentChoices(localChild, partnerChild) {
            if (!localChild || !partnerChild) return false;
            let changed = false;
            const choiceSuffix = String(localChild?.meta?.id || getChildWorkspaceSlotKey(localChild) || 'active').trim();

            if (this.getPartnerAlignmentChoiceSource(`gender-${choiceSuffix}`) === 'partner') {
                const nextGender = normalizeGenderValue(partnerChild.meta?.gender);
                if (normalizeGenderValue(localChild.meta?.gender) !== nextGender) {
                    localChild.meta.gender = nextGender;
                    changed = true;
                }
            }

            if (this.getPartnerAlignmentChoiceSource(`date-${choiceSuffix}`) === 'partner') {
                const nextDate = String(partnerChild.meta?.dueDate || partnerChild.meta?.birthDate || '').trim();
                const currentDate = String(localChild.meta?.dueDate || localChild.meta?.birthDate || '').trim();
                if (currentDate !== nextDate) {
                    localChild.meta.dueDate = nextDate;
                    localChild.meta.birthDate = '';
                    changed = true;
                }
            }

            if (changed) {
                localChild.meta.updatedAt = getNowIso();
            }
            return changed;
        },

        confirmPartnerChildLink(partnerChildSlotKey, localChildId = '') {
            const safeLocalChildId = String(localChildId || '').trim();
            const localChild = safeLocalChildId ? this.getChildById(safeLocalChildId) : this.getActiveChild();
            const partnerChild = this.getPartnerChildBySlotKey(partnerChildSlotKey);
            if (!localChild || !partnerChild) {
                this.notify('名づけ帳を確認できませんでした。', '!');
                return;
            }
            if (getChildWorkspaceSlotKey(localChild) !== getChildWorkspaceSlotKey(partnerChild)) {
                this.addPartnerChildAsSeparate(partnerChildSlotKey);
                return;
            }

            this.applyPartnerAlignmentChoices(localChild, partnerChild);
            const remainingIssues = this.getPartnerAlignmentIssues(localChild, partnerChild, { allowDifferentSlot: true });
            const links = this.getPartnerChildLinks();
            links[localChild.meta.id] = {
                status: 'linked',
                partnerChildId: String(partnerChild.meta?.id || '').trim(),
                partnerSlotKey: getChildWorkspaceSlotKey(partnerChild),
                partnerLabel: getChildWorkspaceOwnerLabel(partnerChild, 'パートナーの子'),
                confirmedAt: getNowIso(),
                updatedAt: getNowIso()
            };
            this.root.updatedAt = getNowIso();
            this.saveRoot(this.root, { reason: 'partner-child-link' });
            this.closePartnerAlignmentModal();
            this.closeChildModal();
            if (typeof updatePairingUI === 'function') updatePairingUI();
            this.refreshVisibleUI('partner-child-link');
            this.notify(
                remainingIssues.length > 0
                    ? 'まだ違いがあります。相手側にも確認が出ます'
                    : 'パートナーと同じ名づけ帳としてそろえました',
                remainingIssues.length > 0 ? 'i' : '✓'
            );
        },

        addPartnerChildAsSeparate(partnerChildSlotKey) {
            this.acceptPartnerChild(partnerChildSlotKey, {
                allowNextBirthOrder: true,
                linkPartnerChild: true
            });
            this.closePartnerAlignmentModal();
            if (typeof updatePairingUI === 'function') updatePairingUI();
        },

        clearPartnerSavedCanvasForChild(child) {
            if (!child?.draft?.savedCanvas) return false;
            const current = normalizeWorkspaceSavedCanvasState(child.draft.savedCanvas);
            const selectedWasPartner = current.selectedSource === 'partner'
                || (!!current.partnerKey && current.selectedKey === current.partnerKey && current.partnerKey !== current.ownKey);
            child.draft.savedCanvas = normalizeWorkspaceSavedCanvasState({
                blank: current.blank,
                ownKey: current.ownKey,
                partnerKey: '',
                selectedKey: selectedWasPartner ? current.ownKey : current.selectedKey,
                selectedSource: selectedWasPartner ? (current.ownKey ? 'own' : '') : current.selectedSource,
                selectedAt: selectedWasPartner ? '' : current.selectedAt
            });
            return true;
        },

        unlinkPartnerChildLink(childId = '') {
            const safeChildId = String(childId || this.root?.activeChildId || '').trim();
            const child = safeChildId ? this.getChildById(safeChildId) : null;
            if (!child) {
                this.notify('名づけ帳を確認できませんでした。', '!');
                return;
            }

            const links = this.getPartnerChildLinks();
            if (Object.prototype.hasOwnProperty.call(links, safeChildId)) {
                delete links[safeChildId];
            }
            this.clearPartnerSavedCanvasForChild(child);
            this.root.updatedAt = getNowIso();
            this.saveRoot(this.root, { reason: 'partner-child-unlink' });
            if (safeChildId === this.root.activeChildId) {
                this.applyActiveChildToGlobals({ reason: 'partner-child-unlink' });
            }
            this.closeChildModal();
            if (typeof updatePairingUI === 'function') updatePairingUI();
            this.refreshVisibleUI('partner-child-unlink');
            this.notify('この組み合わせを解除しました', '✓');
        },

        buildChildPartnerLinkSection(child) {
            if (!child) return '';
            const inRoom = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
            const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.partnerUid;
            if (!inRoom || !hasPartner) return '';

            const safeChildId = String(child.meta?.id || '').trim();
            const partnerRoot = this.getPartnerWorkspaceRoot();
            const link = this.getPartnerChildLink(safeChildId);
            const linkedPartnerChild = this.getLinkedPartnerChildForChild(child);
            const candidatePartnerChild = linkedPartnerChild
                || this.getPartnerChildBySlotKey(getChildWorkspaceSlotKey(child));
            const linked = !!(candidatePartnerChild && this.isPartnerChildLinkConfirmed(child, candidatePartnerChild));
            const issues = candidatePartnerChild ? this.getPartnerAlignmentIssues(child, candidatePartnerChild, { allowDifferentSlot: linked }) : [];
            const partnerLabel = candidatePartnerChild
                ? `${getChildWorkspaceOwnerLabel(candidatePartnerChild, 'パートナーの子')}${getGenderEmoji(candidatePartnerChild.meta?.gender)}`
                : '読み込み中';
            const localLabel = `${getChildWorkspaceOwnerLabel(child, 'この子')}${getGenderEmoji(child.meta?.gender)}`;
            const statusLabel = !partnerRoot ? '読み込み中' : (linked ? '確認済み' : '');
            const statusHtml = statusLabel
                ? `<div class="meimay-child-partner-link-kicker">${escapeHtml(statusLabel)}</div>`
                : '';
            const title = linked
                ? `${localLabel} ↔ ${partnerLabel}`
                : '一緒に進める子を確認できます';
            const desc = linked
                ? '相手側の別の名づけ帳に変更できます。解除しても、自分の候補や保存名は残ります。'
                : 'どの子の名づけを一緒に進めるかを選びます。性別や予定日は自動では上書きしません。';
            const issueHtml = issues.length > 0
                ? `<div class="meimay-child-align-issues">${issues.map((issue) => `<span>${escapeHtml(issue)}</span>`).join('')}</div>`
                : '';
            const canOpen = !!partnerRoot;
            const openButtonLabel = linked ? '一緒に進める子を変更' : '一緒に進める子を確認';
            const openButton = `<button type="button" class="meimay-child-modal-btn" ${canOpen ? `onclick="MeimayChildWorkspaces.openPartnerAlignmentModal('', '${escapeHtml(safeChildId)}')"` : 'disabled'}>${openButtonLabel}</button>`;
            const unlinkButton = link
                ? `<button type="button" class="meimay-child-modal-btn meimay-child-leave" onclick="MeimayChildWorkspaces.unlinkPartnerChildLink('${escapeHtml(safeChildId)}')">この組み合わせを解除</button>`
                : '';

            return `
                <div class="meimay-child-modal-section">
                    <div class="meimay-child-modal-section-title">パートナーと一緒に進める子</div>
                    <div class="meimay-child-partner-link-status">
                        ${statusHtml}
                        <div class="meimay-child-partner-link-title">${escapeHtml(title)}</div>
                        <div class="meimay-child-partner-link-desc">${escapeHtml(desc)}</div>
                        ${issueHtml}
                    </div>
                    <div class="meimay-child-card-actions">
                        ${openButton}
                        ${unlinkButton}
                    </div>
                </div>
            `;
        },

        getPartnerChildBySlotKey(slotKey) {
            const safeSlotKey = String(slotKey || '').trim();
            if (!safeSlotKey) return null;
            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) return null;
            return Object.values(partnerRoot.children || {}).find((child) => getChildWorkspaceSlotKey(child) === safeSlotKey) || null;
        },

        getPartnerChildForChild(child) {
            if (!child) return null;
            const linkedPartnerChild = this.getLinkedPartnerChildForChild(child);
            if (linkedPartnerChild) return linkedPartnerChild;

            const partnerChild = this.getPartnerChildBySlotKey(getChildWorkspaceSlotKey(child));
            if (!partnerChild) return null;
            if (!this.isPartnerChildLinkConfirmed(child, partnerChild)) return null;
            return partnerChild;
        },

        updateChildModalPartnerSelectionHint() {
            const note = document.getElementById('mcw-child-partner-gender-note');
            if (note) {
                note.hidden = true;
                note.textContent = '';
            }
        },

        getSelectedChildModalDateInfo() {
            return {
                dueDate: document.getElementById('mcw-child-date-value')?.value || ''
            };
        },

        getSelectedChildModalStartMode() {
            return document.querySelector('input[name="mcw-start-mode"]:checked')?.value || 'blank';
        },

        getSelectedChildModalCopySourceId() {
            return document.getElementById('mcw-child-copy-source')?.value || '';
        },

        getSelectedChildModalCopySections() {
            const selected = new Set();
            document.querySelectorAll('[data-copy-section].selected').forEach((button) => {
                selected.add(String(button.dataset.copySection || '').trim());
            });
            return selected;
        },

        getChildCopySummary(childId) {
            const child = this.getChildById(childId);
            if (!child) {
                return { readingCount: 0, kanjiCount: 0, savedCount: 0 };
            }
            return this.summarizeChildLibraries(this.getSummaryLibrariesForChild(childId));
        },

        getManagerChildTitle(childId) {
            return this.getFormattedChildLabel(childId);
        },

        getPartnerPresenceName() {
            const insights = typeof window !== 'undefined' ? window.MeimayPartnerInsights : null;
            const snapshot = typeof MeimayShare !== 'undefined' && MeimayShare ? MeimayShare.partnerSnapshot || null : null;
            const candidates = [
                insights && typeof insights.getPartnerDisplayName === 'function' ? insights.getPartnerDisplayName() : '',
                typeof getPartnerRoleLabel === 'function' ? getPartnerRoleLabel(snapshot?.role) : '',
                snapshot?.displayName,
                snapshot?.username,
                snapshot?.nickname
            ];
            const name = candidates.map((value) => String(value || '').trim()).find(Boolean) || 'パートナー';
            return name.length > 12 ? `${name.slice(0, 12)}…` : name;
        },

        getPartnerActiveChild(partnerRoot = null) {
            const root = partnerRoot || this.getPartnerWorkspaceRoot();
            if (!root) return null;
            const activePartnerId = String(root.activeChildId || '').trim();
            if (activePartnerId && root.children?.[activePartnerId]) {
                return root.children[activePartnerId];
            }
            return null;
        },

        isSamePartnerChild(leftChild, rightChild) {
            if (!leftChild || !rightChild) return false;
            const leftId = String(leftChild.meta?.id || '').trim();
            const rightId = String(rightChild.meta?.id || '').trim();
            if (leftId && rightId && leftId === rightId) return true;
            return getChildWorkspaceSlotKey(leftChild) === getChildWorkspaceSlotKey(rightChild);
        },

        doesPartnerActiveChildMatchLocal(localChild, partnerChild) {
            if (!localChild || !partnerChild) return false;
            const linkedPartnerChild = this.getLinkedPartnerChildForChild(localChild);
            if (linkedPartnerChild && this.isSamePartnerChild(linkedPartnerChild, partnerChild)) {
                return true;
            }
            return getChildWorkspaceSlotKey(localChild) === getChildWorkspaceSlotKey(partnerChild);
        },

        getLocalChildForPartnerActiveChild(partnerChild) {
            if (!partnerChild || !this.root) return null;
            return Object.values(this.root.children || {}).find((localChild) =>
                this.doesPartnerActiveChildMatchLocal(localChild, partnerChild)
            ) || null;
        },

        getPartnerPresenceForChild(child) {
            if (!child || !this.root) return null;
            const inRoom = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
            const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.partnerUid;
            if (!inRoom || !hasPartner) return null;

            const partnerRoot = this.getPartnerWorkspaceRoot();
            const partnerActiveChild = this.getPartnerActiveChild(partnerRoot);
            if (!partnerActiveChild || !this.doesPartnerActiveChildMatchLocal(child, partnerActiveChild)) return null;

            const partnerName = this.getPartnerPresenceName();
            const isLocalActive = String(child.meta?.id || '').trim() === String(this.root.activeChildId || '').trim();
            return {
                kind: isLocalActive ? 'same' : 'viewing',
                text: isLocalActive ? `${partnerName}も選択中` : `${partnerName}が選択中`
            };
        },

        getPartnerPresenceForPartnerChild(partnerChild) {
            const inRoom = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
            const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.partnerUid;
            if (!partnerChild || !inRoom || !hasPartner) return null;
            const partnerActiveChild = this.getPartnerActiveChild();
            if (!this.isSamePartnerChild(partnerChild, partnerActiveChild)) return null;
            return {
                kind: 'viewing',
                text: `${this.getPartnerPresenceName()}が選択中`
            };
        },

        buildPartnerPresenceBadge(presence) {
            if (!presence || !presence.text) return '';
            const className = presence.kind === 'away' ? 'meimay-child-partner-presence away' : 'meimay-child-partner-presence';
            return `<div class="${className}"><span class="meimay-child-partner-presence-dot" aria-hidden="true"></span>${escapeHtml(presence.text)}</div>`;
        },

        getManagerChildPartnerSummary(child) {
            if (!child) return '';
            const inRoom = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
            const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.partnerUid;
            if (!inRoom || !hasPartner) return '';
            const partnerRoot = this.getPartnerWorkspaceRoot();
            if (!partnerRoot) return '';
            const linkedPartnerChild = this.getLinkedPartnerChildForChild(child);
            if (linkedPartnerChild && this.isPartnerChildLinkConfirmed(child, linkedPartnerChild)) {
                return `パートナー：${getChildWorkspaceOwnerLabel(linkedPartnerChild, '相手の子')}${getGenderEmoji(linkedPartnerChild.meta?.gender)}`;
            }
            return '';
        },

        getCopySourceChildIds(excludedChildId = '') {
            return this.buildOrderedChildIds(this.root).filter((id) => id !== excludedChildId);
        },

        getDefaultCopySourceId(childIds = []) {
            return this.root?.activeChildId && childIds.includes(this.root.activeChildId)
                ? this.root.activeChildId
                : childIds[0] || '';
        },

        buildCopySourceOptions(excludedChildId = '', selectedSourceId = '') {
            const childIds = this.getCopySourceChildIds(excludedChildId);
            if (childIds.length === 0) {
                return '<option value="">引き継げる子がいません</option>';
            }
            const defaultSourceId = selectedSourceId && childIds.includes(selectedSourceId)
                ? selectedSourceId
                : this.getDefaultCopySourceId(childIds);
            return childIds.map((childId) => {
                const label = this.getFormattedChildLabel(childId);
                return `<option value="${escapeHtml(childId)}"${childId === defaultSourceId ? ' selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('');
        },

        buildCopySourceControl(excludedChildId = '', selectedSourceId = '') {
            const childIds = this.getCopySourceChildIds(excludedChildId);
            if (childIds.length === 0) {
                return `
                    <div class="meimay-child-field">
                        <input type="hidden" id="mcw-child-copy-source" value="">
                        <div class="meimay-child-copy-source-note muted">引き継げる子がいません</div>
                    </div>
                `;
            }
            const defaultSourceId = selectedSourceId && childIds.includes(selectedSourceId)
                ? selectedSourceId
                : this.getDefaultCopySourceId(childIds);
            if (childIds.length === 1) {
                return `
                    <div class="meimay-child-field">
                        <input type="hidden" id="mcw-child-copy-source" value="${escapeHtml(defaultSourceId)}">
                        <div class="meimay-child-copy-source-note">${escapeHtml(this.getFormattedChildLabel(defaultSourceId))}から引き継ぎます</div>
                    </div>
                `;
            }
            return `
                <div class="meimay-child-field">
                    <label class="meimay-child-field-label" for="mcw-child-copy-source">どの子から引き継ぎますか</label>
                    <select id="mcw-child-copy-source" class="meimay-child-select" onchange="MeimayChildWorkspaces.updateChildModalStartModeVisibility()">${this.buildCopySourceOptions(excludedChildId, defaultSourceId)}</select>
                </div>
            `;
        },

        buildCopySectionButtons(selectedSections = ['reading', 'kanji', 'saved'], sourceChildId = '') {
            const selected = new Set(Array.isArray(selectedSections) ? selectedSections : []);
            const summary = this.getDisplayChildSummary(sourceChildId);
            const sections = [
                { key: 'reading', label: '読み', count: `${summary.readingCount}件` },
                { key: 'kanji', label: '漢字', count: `${summary.kanjiCount}字` },
                { key: 'saved', label: '保存した名前', count: `${summary.savedCount}件` }
            ];
            return sections.map((section) => {
                const isSelected = selected.has(section.key);
                return `
                    <button type="button" class="meimay-child-toggle-btn${isSelected ? ' selected' : ''}" data-copy-section="${section.key}" aria-pressed="${isSelected ? 'true' : 'false'}" onclick="MeimayChildWorkspaces.toggleChildModalCopySection('${section.key}')">
                        <span class="meimay-child-toggle-main">
                            <span class="meimay-child-toggle-check" aria-hidden="true">✓</span>
                            <span>${escapeHtml(section.label)}</span>
                        </span>
                        <span class="meimay-child-toggle-count" data-copy-section-count="${section.key}">${escapeHtml(section.count)}</span>
                    </button>
                `;
            }).join('');
        },

        updateChildModalCopySummary() {
            const sourceChildId = this.getSelectedChildModalCopySourceId();
            const summary = this.getDisplayChildSummary(sourceChildId);
            const counts = {
                reading: `${summary.readingCount}件`,
                kanji: `${summary.kanjiCount}字`,
                saved: `${summary.savedCount}件`
            };
            Object.entries(counts).forEach(([section, value]) => {
                document.querySelectorAll(`[data-copy-section-count="${section}"]`).forEach((node) => {
                    node.textContent = value;
                });
            });
        },

        toggleChildModalCopySection(section) {
            const button = document.querySelector(`[data-copy-section="${section}"]`);
            if (!button) return;
            const isSelected = button.classList.toggle('selected');
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        },

        updateChildModalStartModeVisibility() {
            const mode = this.getSelectedChildModalStartMode();
            const copyArea = document.getElementById('mcw-child-copy-area');
            if (copyArea) copyArea.style.display = mode === 'copy' ? 'block' : 'none';
            document.querySelectorAll('[data-start-mode]').forEach((label) => {
                label.classList.toggle('selected', String(label.dataset.startMode || '') === mode);
            });
            this.updateChildModalCopySummary();
        },

        buildManagerChildCard(childId) {
            const child = this.getChildById(childId);
            if (!child) return '';
            const summary = this.getDisplayChildSummary(childId);
            const isActive = childId === this.root?.activeChildId;
            const title = escapeHtml(this.getManagerChildTitle(childId) || child.meta?.displayLabel || '第一子');
            const counts = `読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}`;
            const partnerSummary = this.getManagerChildPartnerSummary(child);
            const partnerPresence = this.getPartnerPresenceForChild(child);
            const editButton = `<button type="button" class="meimay-child-modal-btn meimay-child-manager-edit" onclick="MeimayChildWorkspaces.openChildModal('edit', '${escapeHtml(childId)}')">設定を編集</button>`;
            const switchButton = `<button type="button" class="meimay-child-modal-btn meimay-child-manager-switch" onclick="MeimayChildWorkspaces.switchChild('${escapeHtml(childId)}')">切り替える</button>`;
            return `
                <div class="meimay-child-card${isActive ? ' active' : ''}">
                    <div class="meimay-child-card-head">
                        <div>
                            <div class="meimay-child-card-title">${title}</div>
                            <div class="meimay-child-card-meta">${escapeHtml(counts)}</div>
                            ${partnerSummary ? `<div class="meimay-child-card-meta">${escapeHtml(partnerSummary)}</div>` : ''}
                            ${this.buildPartnerPresenceBadge(partnerPresence)}
                        </div>
                        ${editButton}
                    </div>
                    <div class="meimay-child-card-actions">
                        ${isActive ? '<div class="meimay-child-current-status">編集中</div>' : switchButton}
                    </div>
                </div>
            `;
        },

        refreshOpenManagerModal() {
            if (!this.root) return;
            const modal = document.getElementById('meimay-child-manager-modal');
            if (!modal) return;
            const stack = modal.querySelector('[data-child-manager-card-stack]');
            if (stack) {
                stack.innerHTML = this.buildOrderedChildIds(this.root).map((childId) => this.buildManagerChildCard(childId)).join('');
            }
        },

        openManagerModal() {
            if (!this.initialized) return;
            this.persistActiveChildSnapshot('open-manager');
            this.closeManagerModal();
            this.closeChildModal();
            const modal = document.createElement('div');
            modal.id = 'meimay-child-manager-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closeManagerModal();
            };
            const childCards = this.buildOrderedChildIds(this.root).map((childId) => this.buildManagerChildCard(childId)).join('');
            const canAddMore = this.canAddChildWorkspace();

            // パートナーの未承認子を表示
            const unacceptedPartnerChildren = typeof MeimayPairing !== 'undefined' && MeimayPairing.partnerUid
                ? this.getUnacceptedPartnerChildren()
                : [];
            const partnerChildrenHtml = unacceptedPartnerChildren.length > 0
                ? `<div class="meimay-child-modal-section">
                    <div class="meimay-child-modal-section-title">パートナーが追加した子</div>
                    <div class="meimay-child-modal-desc" style="margin-bottom:8px">参加すると一緒に候補を探せます</div>
                    <div class="meimay-child-modal-stack">
                        ${unacceptedPartnerChildren.map((partnerChild) => {
                            const slotKey = getChildWorkspaceSlotKey(partnerChild);
                            const genderVal = partnerChild.meta?.gender;
                            const genderEmoji = genderVal === 'male' ? '👦' : genderVal === 'female' ? '👧' : '👶';
                            const label = (partnerChild.meta?.displayLabel || '第一子') + genderEmoji;
                            const partnerPresence = this.getPartnerPresenceForPartnerChild(partnerChild);
                            return `<div class="meimay-child-card meimay-partner-child-card">
                                <div class="meimay-child-card-head" style="justify-content:space-between;align-items:center;">
                                    <div>
                                        <div class="meimay-child-card-title" style="margin:0;">${escapeHtml(label)}</div>
                                        ${this.buildPartnerPresenceBadge(partnerPresence)}
                                    </div>
                                    <span class="mcw-partner-badge" style="flex-shrink:0;">パートナーが追加</span>
                                </div>
                                <div class="meimay-child-card-actions">
                                    <button type="button" class="meimay-child-modal-btn meimay-child-accept" onclick="MeimayChildWorkspaces.acceptPartnerChild('${escapeHtml(slotKey)}')">参加する</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`
                : '';

            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <div class="meimay-child-modal-header">
                        <div class="meimay-child-modal-topbar">
                            <button type="button" class="meimay-child-modal-close" aria-label="閉じる" onclick="MeimayChildWorkspaces.closeManagerModal()">×</button>
                        </div>
                        <div class="meimay-child-modal-copy">
                            <div class="meimay-child-modal-title">名づけ帳管理</div>
                            <div class="meimay-child-modal-desc">進める子の切り替えや、新しい子の追加ができます</div>
                        </div>
                    </div>
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">進める子を切り替える</div>
                        <div class="meimay-child-modal-stack" data-child-manager-card-stack>${childCards}</div>
                    </div>
                    ${partnerChildrenHtml}
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">新しい子を追加</div>
                        <div class="meimay-child-card-actions" style="margin-top:12px">
                            <button type="button" class="meimay-child-modal-btn meimay-child-add-action" onclick="MeimayChildWorkspaces.openChildModal('create')" ${canAddMore ? '' : 'disabled'}>＋ 追加する</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        },

        closeManagerModal() {
            document.getElementById('meimay-child-manager-modal')?.remove();
        },

        openChildModal(mode = 'create', childId = null) {
            this.closeChildModal();
            const isEdit = mode === 'edit' && childId;
            const child = isEdit ? this.getChildById(childId) : null;
            if (isEdit && !child) return;

            const selectedGender = isEdit
                ? normalizeGenderValue(child?.meta?.gender)
                : normalizeGenderValue(typeof gender !== 'undefined' ? gender : 'neutral');
            const incompleteMultipleSuggestion = isEdit
                ? null
                : this.getIncompleteMultipleGroupSuggestion(this.root?.activeChildId);
            const selectedInternalOrder = isEdit
                ? normalizePositiveInteger(child?.meta?.birthOrder, this.getSuggestedBirthOrder())
                : (incompleteMultipleSuggestion?.birthOrder || this.getSuggestedBirthOrder());
            const selectedMultipleIndex = isEdit
                ? normalizeTwinIndex(child?.meta?.birthGroupIndex ?? child?.meta?.twinIndex ?? null)
                : (incompleteMultipleSuggestion ? incompleteMultipleSuggestion.multipleIndex : null);
            const multipleChecked = selectedMultipleIndex !== null;
            const selectedOrder = multipleChecked
                ? selectedInternalOrder + selectedMultipleIndex
                : selectedInternalOrder;
            const selectedMultipleForOptions = multipleChecked
                ? selectedMultipleIndex
                : this.getSuggestedMultipleIndexForBirthOrder(selectedInternalOrder, isEdit ? childId : null);
            const selectedMultipleCount = multipleChecked
                ? (isEdit
                    ? normalizeMultipleCount(
                        child?.meta?.birthGroupSize ?? child?.meta?.multipleCount ?? child?.meta?.twinCount,
                        Math.max(this.getExistingMultipleGroupSizeForBirthOrder(selectedInternalOrder) || 2, selectedMultipleForOptions + 1, 2)
                    )
                    : normalizeMultipleCount(
                        incompleteMultipleSuggestion?.multipleCount ?? this.getExistingMultipleGroupSizeForBirthOrder(selectedInternalOrder),
                        Math.max(selectedMultipleForOptions + 1, 2)
                    ))
                : normalizeMultipleCount(this.getExistingMultipleGroupSizeForBirthOrder(selectedInternalOrder), 2);
            const selectedGroupLabel = getMultipleGroupLabel(selectedMultipleCount);
            const selectedMultipleHint = isEdit
                ? `${selectedGroupLabel}として設定しています。予定日・誕生日は同じ日付を使います。`
                : selectedMultipleIndex !== null && selectedMultipleIndex > 0
                    ? `${getJapaneseOrderLabel(selectedInternalOrder)}と${selectedGroupLabel}として追加します。予定日・誕生日は同じ日付を使います。`
                    : `${selectedGroupLabel}として追加します。予定日・誕生日は同じ日付を使います。`;
            const multipleCountLocked = !isEdit && !!incompleteMultipleSuggestion;
            const copySourceIds = this.getCopySourceChildIds();
            const selectedSourceId = this.getDefaultCopySourceId(copySourceIds);
            const defaultSections = ['reading', 'kanji', 'saved'];
            const showDeleteButton = isEdit && this.buildOrderedChildIds(this.root).length > 1 && !child?.meta?.createdByPartner;
            const showLeaveButton = isEdit && !!child?.meta?.createdByPartner;
            const modal = document.createElement('div');
            modal.id = 'meimay-child-editor-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closeChildModal();
            };
            const savedDueDate = isEdit ? (child?.meta?.dueDate || child?.meta?.birthDate || '') : '';
            const editSummary = isEdit ? this.getDisplayChildSummary(childId) : null;
            const editSummaryLabel = editSummary
                ? `読み ${editSummary.readingCount} / 漢字 ${editSummary.kanjiCount} / 保存 ${editSummary.savedCount}`
                : '';
            const editChildLabel = isEdit ? (this.getManagerChildTitle(childId) || child?.meta?.displayLabel || '第一子') : '';
            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <div class="meimay-child-modal-header">
                        <div class="meimay-child-modal-topbar">
                            <button type="button" class="meimay-child-modal-close" aria-label="閉じる" onclick="MeimayChildWorkspaces.closeChildModal()">×</button>
                        </div>
                        <div class="meimay-child-modal-copy">
                            <div class="meimay-child-modal-title">${isEdit ? '子どもの設定' : '新しい子を追加'}</div>
                        </div>
                    </div>
                    ${isEdit ? `
                        <div class="meimay-child-editor-current">
                            <div class="meimay-child-editor-current-kicker">編集中</div>
                            <div class="meimay-child-editor-current-title">${escapeHtml(editChildLabel)}</div>
                            <div class="meimay-child-editor-current-meta">${escapeHtml(editSummaryLabel)}</div>
                        </div>
                    ` : ''}
                    <input type="hidden" id="mcw-child-gender" value="${escapeHtml(selectedGender)}">
                    <input type="hidden" id="mcw-child-id" value="${escapeHtml(isEdit ? childId : '')}">
                    <input type="hidden" id="mcw-child-modal-mode" value="${isEdit ? 'edit' : 'create'}">
                    <input type="hidden" id="mcw-child-multiple-base-order" value="${escapeHtml(multipleChecked ? selectedInternalOrder : '')}">
                    <input type="hidden" id="mcw-child-multiple-index-override" value="${escapeHtml(selectedMultipleIndex ?? '')}">
                    <input type="hidden" id="mcw-child-multiple-count-locked" value="${multipleCountLocked ? '1' : ''}">
                    <input type="hidden" id="mcw-child-multiple-order" value="${escapeHtml((selectedMultipleForOptions ?? 0) + 1)}">
                    <div class="meimay-child-field meimay-child-editor-field">
                        <div class="meimay-child-step-label">STEP 1</div>
                        <label class="meimay-child-field-label" for="mcw-child-order">生まれ順</label>
                        <select id="mcw-child-order" class="wiz-birth-order-select meimay-child-select" onchange="MeimayChildWorkspaces.updateChildModalMultipleVisibility(true)">${this.buildBirthOrderOptions(selectedOrder, isEdit ? childId : null)}</select>
                        <label class="meimay-child-multiple-toggle" for="mcw-child-multiple-enabled">
                            <input type="checkbox" id="mcw-child-multiple-enabled" ${multipleChecked ? 'checked' : ''} onchange="MeimayChildWorkspaces.updateChildModalMultipleVisibility(true)">
                            <span>
                                <span class="meimay-child-multiple-title">双子・三つ子などの場合</span>
                                <span class="meimay-child-multiple-desc">双子・三つ子などの場合だけ選びます。</span>
                            </span>
                        </label>
                        <div id="mcw-child-multiple-area" class="meimay-child-multiple-area" ${multipleChecked ? '' : 'hidden'}>
                            <div class="meimay-child-multiple-grid">
                                <div>
                                    <label class="meimay-child-field-label" for="mcw-child-multiple-count">何人ですか</label>
                                    <select id="mcw-child-multiple-count" class="meimay-child-select" onchange="MeimayChildWorkspaces.updateChildModalMultipleVisibility(false)" ${multipleCountLocked ? 'disabled' : ''}>${this.buildMultipleCountOptions(selectedMultipleCount)}</select>
                                </div>
                            </div>
                            <div id="mcw-child-multiple-hint" class="meimay-child-field-hint">${escapeHtml(selectedMultipleHint)}</div>
                        </div>
                    </div>
                    <div id="mcw-child-single-gender-field" class="meimay-child-field meimay-child-editor-field">
                        <div class="meimay-child-step-label">STEP 2</div>
                        <label class="meimay-child-field-label">性別</label>
                        <div class="wiz-baby-gender-grid meimay-child-gender-grid">${this.buildChildModalGenderButtons(selectedGender, isEdit ? (this.getPartnerChildForChild(child)?.meta?.gender || null) : null)}</div>
                    </div>
                    <div class="meimay-child-field meimay-child-editor-field">
                        <div class="meimay-child-step-label">STEP 3</div>
                        <label class="meimay-child-field-label" for="mcw-child-date-value">予定日・誕生日</label>
                        <input type="date" id="mcw-child-date-value" class="meimay-child-select" style="width:100%;" value="${escapeHtml(savedDueDate)}" placeholder="未定">
                        <div class="meimay-child-field-hint">未定の場合は空欄のままにしてください</div>
                    </div>
                    ${isEdit ? this.buildChildPartnerLinkSection(child) : ''}
                    ${isEdit ? '' : `
                        <div class="meimay-child-field">
                            <div class="meimay-child-step-label">STEP 4</div>
                            <label class="meimay-child-field-label">はじめ方</label>
                            <div class="meimay-child-radio-grid">
                                <label class="meimay-child-radio-option" data-start-mode="blank">
                                    <input type="radio" name="mcw-start-mode" value="blank" checked onchange="MeimayChildWorkspaces.updateChildModalStartModeVisibility()">
                                    <div>
                                        <div class="meimay-child-radio-title">まっさらから始める</div>
                                        <div class="meimay-child-radio-desc">読み・漢字・保存候補を空にしてはじめます。</div>
                                    </div>
                                </label>
                                <label class="meimay-child-radio-option" data-start-mode="copy">
                                    <input type="radio" name="mcw-start-mode" value="copy" onchange="MeimayChildWorkspaces.updateChildModalStartModeVisibility()">
                                    <div>
                                        <div class="meimay-child-radio-title">ほかの子の候補を引き継ぐ</div>
                                        <div class="meimay-child-radio-desc">読み・漢字・保存候補を引き継いで始めます。</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div id="mcw-child-copy-area" style="display:none">
                            <div class="meimay-child-copy-panel">
                                ${this.buildCopySourceControl('', selectedSourceId)}
                                <div class="meimay-child-field">
                                    <label class="meimay-child-field-label">引き継ぐ内容（複数選択）</label>
                                    <div class="meimay-child-toggle-grid">${this.buildCopySectionButtons(defaultSections, selectedSourceId)}</div>
                                </div>
                            </div>
                        </div>
                    `}
                    <div class="meimay-child-editor-actions">
                        <button type="button" class="meimay-child-modal-btn meimay-child-save-action" onclick="MeimayChildWorkspaces.saveChildModal('${isEdit ? 'edit' : 'create'}', ${isEdit ? `'${escapeHtml(childId)}'` : 'null'})">保存</button>
                        ${showDeleteButton ? `<button type="button" class="meimay-child-modal-btn meimay-child-danger" onclick="MeimayChildWorkspaces.deleteChild('${escapeHtml(childId)}')">削除</button>` : ''}
                        ${showLeaveButton ? `<button type="button" class="meimay-child-modal-btn meimay-child-leave" onclick="MeimayChildWorkspaces.leavePartnerChild('${escapeHtml(childId)}')">参加をやめる</button>` : ''}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            this.syncChildModalDeleteButtonState();
            this.selectChildModalGender(selectedGender);
            this.updateChildModalMultipleVisibility(false);
            this.updateChildModalStartModeVisibility();
            this.updateChildModalCopySummary();
            this.updateChildModalPartnerSelectionHint();
        },
        closeChildModal() {
            document.getElementById('meimay-child-editor-modal')?.remove();
        },

        saveChildModal(mode = 'create', childId = null) {
            const multipleSlot = this.getSelectedChildModalMultipleSlot();
            const birthOrder = multipleSlot.birthOrder;
            const twinIndex = multipleSlot.twinIndex;
            const multipleCount = multipleSlot.multipleCount;
            const multipleEnabled = twinIndex !== null;
            if (multipleEnabled && (twinIndex === null || twinIndex >= multipleCount)) {
                this.notify('人数を確認してください。', '!');
                return;
            }
            const genderValue = this.getSelectedChildModalGender();
            const multipleGenders = twinIndex === null
                ? {}
                : { [twinIndex]: genderValue };
            const selectedGenderValue = twinIndex === null
                ? genderValue
                : normalizeGenderValue(multipleGenders[twinIndex] || genderValue);
            const displayLabel = buildDisplayLabel(birthOrder, twinIndex, multipleCount);
            const existingGroupDate = twinIndex === null ? '' : this.getExistingMultipleGroupDateForBirthOrder(birthOrder, mode === 'edit' ? childId : null);
            const slotValidation = this.validateChildSlotSelection(birthOrder, twinIndex, mode === 'edit' ? childId : null, multipleCount);
            if (!slotValidation.ok) {
                this.notify(slotValidation.message, '!');
                return;
            }

            if (mode === 'edit' && childId) {
                if (this.isDisplayLabelTaken(displayLabel, childId)) {
                    this.notify('同じ表示ラベルの子どもがいます。多胎なら、どの子かを変えてください。', '!');
                    return;
                }
                
                // 1. まず現在の作業状態をバックアップ（この際、Active Child のオブジェクトが作り替えられる可能性がある）
                this.persistActiveChildSnapshot('before-edit-child');
                this.promoteSingletonChildToMultipleBase(birthOrder, twinIndex, childId, multipleCount);
                
                // 2. 作り替えられた可能性があるため、最新の参照を取得し直す
                const child = this.getChildById(childId);
                if (!child) return;

                // 3. メタデータを更新
                child.meta.birthOrder = birthOrder;
                child.meta.birthGroupIndex = twinIndex;
                child.meta.twinIndex = twinIndex;
                child.meta.birthGroupId = twinIndex === null ? null : `bg_${birthOrder}`;
                child.meta.birthGroupSize = twinIndex === null ? null : multipleCount;
                child.meta.multipleCount = child.meta.birthGroupSize;
                child.meta.twinGroupId = child.meta.birthGroupId;
                child.meta.displayLabel = displayLabel;
                child.meta.gender = selectedGenderValue;
                const dateInfo = this.getSelectedChildModalDateInfo();
                const effectiveDueDate = dateInfo.dueDate || existingGroupDate;
                child.meta.dueDate = effectiveDueDate;
                child.meta.birthDate = '';
                child.meta.twinCount = child.meta.birthGroupSize;
                child.meta.updatedAt = getNowIso();
                const editGroupSync = twinIndex === null
                    ? null
                    : this.ensureMultipleGroupSiblings({ birthOrder, multipleCount, dueDate: effectiveDueDate, gendersByIndex: multipleGenders });

                // 4. 重要: 保存 (saveRoot) する前にグローバル変数を更新する！
                // これにより、saveRoot がフックされて再度 Snapshot が走っても、正しい値が読み込まれるようになる
                if (childId === this.root.activeChildId) {
                    this.applyActiveChildToGlobals({ reason: 'edit-child-sync' });
                }

                // 5. 最終的な状態を保存
                this.root.childOrder = this.buildOrderedChildIds(this.root);
                this.saveRoot(this.root);

                this.closeChildModal();
                this.closeManagerModal();
                this.refreshVisibleUI('edit-child');
                this.renderSwitchers();
                const editAutoNotice = this.buildMultipleAutoCreateNotice(multipleCount, editGroupSync?.createdCount || 0);
                this.notify(editAutoNotice ? `子どもの設定を更新しました。${editAutoNotice}` : '子どもの設定を更新しました', '✓');
                return;
            }

            const startMode = this.getSelectedChildModalStartMode();
            const sourceChildId = this.getSelectedChildModalCopySourceId();
            const copySections = Array.from(this.getSelectedChildModalCopySections());
            if (startMode === 'copy' && (!sourceChildId || !this.getChildById(sourceChildId))) {
                this.notify('引き継ぐ子を選んでください。', '!');
                return;
            }

            this.persistActiveChildSnapshot('before-create-child');
            this.promoteSingletonChildToMultipleBase(birthOrder, twinIndex, null, multipleCount);
            const nextId = this.generateChildId();
            const createDateInfo = this.getSelectedChildModalDateInfo();
            const createEffectiveDueDate = createDateInfo.dueDate || existingGroupDate;
            this.root.children[nextId] = this.buildChildRecordForCreate({
                id: nextId,
                birthOrder,
                multipleIndex: twinIndex,
                multipleCount,
                gender: selectedGenderValue,
                dueDate: createEffectiveDueDate,
                startMode,
                sourceChildId,
                copySections
            });
            const createGroupSync = twinIndex === null
                ? null
                : this.ensureMultipleGroupSiblings({ birthOrder, multipleCount, dueDate: createEffectiveDueDate, gendersByIndex: multipleGenders });
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            this.root.activeChildId = nextId;
            this.saveRoot(this.root);
            this.closeChildModal();
            this.closeManagerModal();
            this.applyActiveChildToGlobals({ reason: 'create-child' });
            this.refreshVisibleUI('create-child');
            this.renderSwitchers();
            const createAutoNotice = this.buildMultipleAutoCreateNotice(multipleCount, createGroupSync?.createdCount || 0);
            this.notify(createAutoNotice ? `${this.getChildLabel(nextId)} を追加しました。${createAutoNotice}` : `${this.getChildLabel(nextId)} を追加しました`, '✓');
        },

        buildInitialLibrariesForCreate(startMode = 'blank', sourceChildId = '', copySections = [], targetChildId = '') {
            const blank = createBlankChildLibraries();
            if (startMode !== 'copy') return blank;
            const sourceChild = this.getChildById(sourceChildId);
            if (!sourceChild) return blank;
            const selected = new Set(Array.isArray(copySections) ? copySections : []);
            const next = createBlankChildLibraries();
            if (selected.has('reading')) {
                next.readingStock = cloneData(sourceChild.libraries?.readingStock, []);
            }
            if (selected.has('kanji')) {
                next.kanjiStock = this.cloneKanjiStockForChildCopy(sourceChild.libraries?.kanjiStock, {
                    keepSessionReading: selected.has('reading')
                });
            }
            if (selected.has('saved')) {
                next.savedNames = this.mergeSavedLibraries([], sourceChild.libraries?.savedNames, {
                    sourceChildId,
                    sourceLabel: sourceChild.meta?.displayLabel || '第一子',
                    targetChildId
                }).items;
            }
            return next;
        },

        decorateSettingsChildManagementCard() {
            const container = document.getElementById('settings-screen-content');
            if (!container) return;
            const titleNodes = Array.from(container.querySelectorAll('.item-title-unified'));
            const target = titleNodes.find((node) => String(node.textContent || '').trim() === '赤ちゃんの子性別' || String(node.textContent || '').trim() === '子ども管理');
            if (!target) return;
            const item = target.closest('.settings-item-unified');
            const activeChild = this.getActiveChild();
            if (!item || !activeChild) return;
            
            const valueNode = item.querySelector('.item-value-unified');
            const iconNode = item.querySelector('.item-icon-circle span');
            
            const label = this.getFormattedChildLabel(activeChild.meta.id);
            
            target.textContent = '子ども管理';
            if (valueNode) {
                valueNode.textContent = label + (label.includes('：') ? '' : ` ・ ${getGenderLabel(activeChild.meta.gender)}`);
            }
            if (iconNode) iconNode.textContent = '👶';
            item.onclick = () => this.openManagerModal();
        }
    };

    window.MeimayChildWorkspaces = MeimayChildWorkspaces;
    MeimayChildWorkspaces.install();
})();
