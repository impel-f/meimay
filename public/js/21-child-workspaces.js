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

    function buildDisplayLabel(order) {
        return getJapaneseOrderLabel(order);
    }

    function getSavedNameLabel(item) {
        return String(item?.givenName || item?.fullName || '').trim();
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
        return { blank: blankFlag, ownKey, partnerKey, selectedKey, selectedSource, selectedAt };
    }

    function setSavedCanvasStateSnapshot(state = {}) {
        const blank = state?.blank === true;
        const ownKey = blank ? '' : String(state?.ownKey || '').trim();
        const partnerKey = blank ? '' : String(state?.partnerKey || '').trim();
        const selectedKey = blank ? '' : String(state?.selectedKey || '').trim();
        const selectedSource = blank ? '' : String(state?.selectedSource || '').trim();
        const selectedAt = blank ? '' : String(state?.selectedAt || '').trim();
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

    function getMatchedSavedNameLabel() {
        try {
            if (typeof MeimayPartnerInsights === 'undefined' || !MeimayPartnerInsights || typeof MeimayPartnerInsights.getSavedNameCanvasState !== 'function') {
                return '';
            }
            const canvasState = MeimayPartnerInsights.getSavedNameCanvasState();
            if (!canvasState || !canvasState.matched) return '';
            return getSavedNameLabel(canvasState.ownMain || canvasState.partnerMain);
        } catch (error) {
            return '';
        }
    }

    function getChildHeaderLabel(child) {
        return child?.meta?.displayLabel || '第一子';
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
                .meimay-child-inline-btn,.meimay-child-modal-btn{border:1px solid #eadfce;background:#fff;color:#5d5444;border-radius:9999px;font-weight:800;transition:transform .15s ease,box-shadow .15s ease,background .15s ease;padding:8px 12px;font-size:11px}
                .meimay-child-inline-btn:active,.meimay-child-modal-btn:active{transform:scale(.97)}
                .meimay-child-modal-overlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:clamp(12px,3vw,24px);background:rgba(49,38,24,.36);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
                .meimay-child-modal-sheet{width:min(560px,100%);max-height:min(86vh,820px);overflow-y:auto;border-radius:30px;background:linear-gradient(180deg,#fffaf4 0%,#fffdf8 100%);border:1px solid #eee5d8;box-shadow:0 28px 50px -28px rgba(93,84,68,.42);padding:20px 18px calc(18px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px}
                .meimay-child-modal-header{position:relative;min-height:40px}
                .meimay-child-modal-close{position:absolute;left:0;top:0;width:40px;height:40px;border-radius:9999px;border:1px solid #eadfce;background:#fff;color:#7a6f5a;font-size:22px;font-weight:900;line-height:1;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 18px -20px rgba(123,104,83,.28);transition:transform .15s ease,box-shadow .15s ease,background .15s ease;z-index:2}
                .meimay-child-modal-close:active{transform:scale(.95)}
                .meimay-child-modal-copy{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
                .meimay-child-modal-title{color:#5d5444;font-size:20px;font-weight:900;line-height:1.25;text-align:center}
                .meimay-child-modal-desc{margin-top:0;color:#8b7e66;font-size:12px;line-height:1.6;text-align:center}
                .meimay-child-modal-section{margin-top:0;padding:14px;border:1px solid #eee5d8;border-radius:24px;background:rgba(255,255,255,.86)}
                .meimay-child-step-label{display:inline-flex;align-items:center;justify-content:center;padding:3px 8px;border-radius:9999px;background:#fff3e4;color:#b9965b;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
                .meimay-child-modal-section-title{color:#5d5444;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
                .meimay-child-modal-stack{display:grid;gap:10px;margin-top:12px}
                .meimay-child-card{margin-top:10px;padding:12px;border:1px solid #eee5d8;border-radius:20px;background:#fff}
                .meimay-child-card.active{background:linear-gradient(180deg,#fffdf8 0%,#fff5e7 100%);border-color:#e6d3b4}
                .meimay-child-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
                .meimay-child-card-title{color:#5d5444;font-size:15px;font-weight:900}
                .meimay-child-card-meta{margin-top:4px;color:#8b7e66;font-size:11px;line-height:1.5}
                .meimay-child-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:9999px;background:#fff5de;color:#a27d47;font-size:10px;font-weight:900}
                .meimay-child-card-actions,.meimay-child-shared-actions,.meimay-child-editor-actions{display:flex;flex-direction:column;gap:8px;margin-top:12px}
                .meimay-child-editor-actions{position:sticky;bottom:0;padding-top:12px;background:linear-gradient(180deg,rgba(255,250,244,0) 0%,#fffaf4 24px);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
                .meimay-child-field{margin-top:12px}
                .meimay-child-field-label{display:block;margin-bottom:6px;color:#8b7e66;font-size:11px;font-weight:800}
                .meimay-child-input,.meimay-child-select{width:100%;padding:12px 14px;border:1px solid #eadfce;border-radius:18px;background:#fff;color:#5d5444;font-size:14px;font-weight:700;outline:none}
                .meimay-child-input:focus,.meimay-child-select:focus{border-color:#bca37f}
                .meimay-child-field-hint{margin-top:6px;color:#a6967a;font-size:10px;line-height:1.45}
                .meimay-child-radio-grid{display:grid;gap:8px;margin-top:10px}
                .meimay-child-radio-option{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #eadfce;border-radius:18px;background:#fff;cursor:pointer}
                .meimay-child-radio-option.selected{border-color:#bca37f;background:linear-gradient(180deg,#fff8eb 0%,#fff1d8 100%)}
                .meimay-child-radio-option input{margin-top:2px}
                .meimay-child-radio-title{color:#5d5444;font-size:13px;font-weight:900}
                .meimay-child-radio-desc{margin-top:3px;color:#8b7e66;font-size:11px;line-height:1.45}
                .meimay-child-gender-grid,.meimay-child-toggle-grid{display:grid;gap:8px;margin-top:10px}
                .meimay-child-gender-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
                .meimay-child-gender-btn,.meimay-child-toggle-btn{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:12px 14px;border:1px solid #eadfce;border-radius:18px;background:#fff;color:#5d5444;font-size:13px;font-weight:900;text-align:left}
                .meimay-child-gender-btn.selected,.meimay-child-toggle-btn.selected{border-color:#bca37f;background:linear-gradient(180deg,#fff8eb 0%,#fff1d8 100%)}
                .meimay-child-toggle-count{color:#a6967a;font-size:11px;font-weight:800}
                .meimay-child-danger{border-color:#f5c8c8;background:#fff6f6;color:#c45d5d}
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

        normalizeFamily(family) {
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
                    kanjiStock: this.normalizeKanjiLibrary(family?.sharedLibraries?.kanjiStock, { genericOnly: true })
                },
                appSettings: {
                    shareMode: String(family?.appSettings?.shareMode || base.appSettings.shareMode).trim() || 'auto',
                    showInappropriateKanji: family?.appSettings?.showInappropriateKanji === true
                }
            };
        },

        normalizeChildRecord(childId, childRecord, fallbackBirthOrder = 1) {
            const safeId = String(childRecord?.meta?.id || childId || '').trim();
            if (!safeId) return null;
            const rawMultipleIndex = childRecord?.meta?.multipleIndex ?? childRecord?.meta?.twinIndex ?? null;
            const twinSuffix = normalizeTwinSuffix(childRecord?.meta?.twinSuffix || childRecord?.meta?.multipleSuffix || (rawMultipleIndex !== null && rawMultipleIndex !== undefined ? multipleIndexToSuffix(rawMultipleIndex) : ''));
            const twinIndex = normalizeTwinIndex(rawMultipleIndex, twinSuffix);
            const birthOrder = normalizePositiveInteger(childRecord?.meta?.birthOrder, fallbackBirthOrder);
            const createdAt = String(childRecord?.meta?.createdAt || getNowIso());
            const updatedAt = String(childRecord?.meta?.updatedAt || createdAt);
            const birthGroupId = String(childRecord?.meta?.birthGroupId || childRecord?.meta?.twinGroupId || (twinIndex === null ? '' : `bg_${birthOrder}`)).trim() || null;
            return {
                meta: {
                    id: safeId,
                    birthOrder,
                    displayLabel: buildDisplayLabel(birthOrder, twinIndex),
                    gender: normalizeGenderValue(childRecord?.meta?.gender),
                    birthGroupId,
                    birthGroupIndex: twinIndex,
                    twinGroupId: birthGroupId,
                    twinIndex,
                    createdAt,
                    updatedAt
                },
                prefs: {
                    rule: String(childRecord?.prefs?.rule || 'strict').trim() || 'strict',
                    prioritizeFortune: childRecord?.prefs?.prioritizeFortune === true,
                    imageTags: Array.isArray(childRecord?.prefs?.imageTags) && childRecord.prefs.imageTags.length > 0 ? cloneData(childRecord.prefs.imageTags, ['none']) : ['none']
                },
                draft: { ...createBlankChildDraft(), ...cloneData(childRecord?.draft, {}) },
                libraries: {
                    readingStock: this.normalizeReadingLibrary(childRecord?.libraries?.readingStock),
                    kanjiStock: this.normalizeKanjiLibrary(childRecord?.libraries?.kanjiStock),
                    savedNames: this.normalizeSavedLibrary(childRecord?.libraries?.savedNames),
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
                    createdAt: getNowIso(),
                    updatedAt: getNowIso()
                },
                prefs: { rule: 'strict', prioritizeFortune: false, imageTags: ['none'] },
                draft: createBlankChildDraft(),
                libraries: createBlankChildLibraries()
            };
        },

        normalizeRoot(root) {
            const deletedChildren = normalizeDeletedChildrenMap(root?.deletedChildren || root?.deletedChildIds || {});
            const next = {
                version: ROOT_VERSION,
                activeChildId: String(root?.activeChildId || '').trim(),
                childOrder: Array.isArray(root?.childOrder) ? root.childOrder.map((id) => String(id || '').trim()).filter(Boolean) : [],
                family: this.normalizeFamily(root?.family),
                children: {},
                deletedChildren,
                createdAt: String(root?.createdAt || getNowIso()),
                updatedAt: String(root?.updatedAt || getNowIso())
            };
            Object.entries(root?.children || {}).forEach(([childId, childRecord], index) => {
                const normalized = this.normalizeChildRecord(childId, childRecord, index + 1);
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
                    const normalized = this.normalizeRoot(JSON.parse(raw));
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

        mergeRootState(localState = null, remoteState = null) {
            const hasRootData = (state) => !!state && typeof state === 'object' && (
                (state.children && typeof state.children === 'object' && Object.keys(state.children).length > 0)
                || (state.deletedChildren && typeof state.deletedChildren === 'object' && Object.keys(state.deletedChildren).length > 0)
                || (Array.isArray(state.deletedChildIds) && state.deletedChildIds.length > 0)
                || String(state.activeChildId || '').trim()
                || state.updatedAt
                || state.createdAt
            );
            const localRoot = hasRootData(localState) ? this.normalizeRoot(localState) : null;
            const remoteRoot = hasRootData(remoteState) ? this.normalizeRoot(remoteState) : null;
            if (!localRoot && !remoteRoot) return this.normalizeRoot({});
            if (!localRoot) return remoteRoot;
            if (!remoteRoot) return localRoot;
            const mergedDeletedChildren = mergeDeletedChildrenMaps(localRoot.deletedChildren, remoteRoot.deletedChildren);
            const mergedChildren = {};
            const remotePreferred = parseComparableTime(remoteRoot.updatedAt || remoteRoot.createdAt) >= parseComparableTime(localRoot.updatedAt || localRoot.createdAt);

            const upsertChild = (child, preferRemote = false) => {
                if (!child || typeof child !== 'object') return;
                const childId = String(child?.meta?.id || '').trim();
                if (!childId || Object.prototype.hasOwnProperty.call(mergedDeletedChildren, childId)) return;
                const existing = mergedChildren[childId];
                const childClone = cloneData(child, null);
                if (!existing) {
                    mergedChildren[childId] = childClone;
                    return;
                }
                const existingTime = parseComparableTime(existing?.meta?.updatedAt || existing?.meta?.createdAt);
                const incomingTime = parseComparableTime(childClone?.meta?.updatedAt || childClone?.meta?.createdAt);
                if (incomingTime > existingTime || (incomingTime === existingTime && preferRemote)) {
                    mergedChildren[childId] = childClone;
                }
            };

            Object.values(localRoot.children || {}).forEach((child) => upsertChild(child, false));
            Object.values(remoteRoot.children || {}).forEach((child) => upsertChild(child, true));

            const preferredRoot = remotePreferred ? remoteRoot : localRoot;
            const merged = {
                version: Math.max(
                    normalizePositiveInteger(localRoot.version, 0),
                    normalizePositiveInteger(remoteRoot.version, 0),
                    ROOT_VERSION
                ),
                activeChildId: '',
                childOrder: [],
                family: cloneData(preferredRoot.family || createBlankFamilyState(), createBlankFamilyState()),
                children: mergedChildren,
                deletedChildren: mergedDeletedChildren,
                createdAt: String(preferredRoot.createdAt || localRoot.createdAt || remoteRoot.createdAt || getNowIso()),
                updatedAt: String(preferredRoot.updatedAt || localRoot.updatedAt || remoteRoot.updatedAt || getNowIso())
            };

            merged.childOrder = this.buildOrderedChildIds(merged);
            const preferredActiveChildId = [localRoot.activeChildId, remoteRoot.activeChildId]
                .find((childId) => childId && merged.children[childId]);
            merged.activeChildId = preferredActiveChildId || merged.childOrder[0] || '';
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
                    displayLabel: buildDisplayLabel(existingMeta.birthOrder, birthGroupIndex),
                    gender: normalizeGenderValue(typeof gender !== 'undefined' ? gender : existingMeta.gender),
                    birthGroupId: existingMeta.birthGroupId || existingMeta.twinGroupId || (birthGroupIndex === null ? null : `bg_${normalizePositiveInteger(existingMeta.birthOrder, 1)}`),
                    birthGroupIndex,
                    twinGroupId: existingMeta.twinGroupId || existingMeta.birthGroupId || (birthGroupIndex === null ? null : `bg_${normalizePositiveInteger(existingMeta.birthOrder, 1)}`),
                    twinIndex: birthGroupIndex,
                    createdAt: existingMeta.createdAt || getNowIso(),
                    updatedAt: getNowIso()
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
                    savedNames: this.normalizeSavedLibrary(typeof getSavedNames === 'function' ? getSavedNames() : (typeof savedNames !== 'undefined' ? savedNames : [])),
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

        normalizeReadingLibrary(items) {
            const source = Array.isArray(items) ? items : [];
            const normalized = source.map((item) => {
                if (!item) return null;
                if (typeof normalizeReadingStockItem === 'function') {
                    return normalizeReadingStockItem(item);
                }
                const reading = String(item?.reading || item?.sessionReading || '').trim();
                if (!reading) return null;
                return {
                    ...cloneData(item, {}),
                    id: String(item?.id || `${reading}::${(item?.segments || []).join('/')}`),
                    reading,
                    segments: Array.isArray(item?.segments) ? cloneData(item.segments, []) : [],
                    gender: normalizeGenderValue(item?.gender)
                };
            }).filter(Boolean);
            return this.mergeReadingLibraries([], normalized).items;
        },

        normalizeKanjiLibrary(items, options = {}) {
            const source = Array.isArray(items) ? items : [];
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
                    genericOnly: true
                }).items;
            }
            return cloneData(next, []);
        },

        normalizeSavedLibrary(items) {
            return this.mergeSavedLibraries([], Array.isArray(items) ? items : []).items;
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
            const merged = cloneData(targetItems, []);
            const existingKanji = new Set(
                merged.map((item) => getKanjiValue(item)).filter(Boolean)
            );
            let addedCount = 0;
            (Array.isArray(sourceItems) ? sourceItems : []).forEach((item) => {
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
                const normalized = cloneData(item, null);
                if (!normalized) return;
                const key = this.getSavedItemKey(normalized);
                if (!key || seenKeys.has(key)) return;
                seenKeys.add(key);
                normalized.copiedFromChildId = options.sourceChildId || '';
                normalized.copiedFromChildLabel = options.sourceLabel || '';
                merged.push(normalized);
                addedCount += 1;
            });
            return { items: merged, addedCount };
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
            if (!item) return '';
            const fullName = String(item.fullName || item.givenName || '').trim();
            const combinationKeys = Array.isArray(item.combinationKeys) && item.combinationKeys.length > 0
                ? item.combinationKeys
                : Array.isArray(item.combination)
                    ? item.combination.map((part) => getKanjiValue(part)).filter(Boolean)
                    : [];
            return `${fullName}::${combinationKeys.join('')}`;
        },

        persistActiveChildSnapshot(reason = 'manual') {
            if (!this.initialized || this._persistenceLocked || !this.root) return;
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            activeChild.meta.updatedAt = getNowIso();
            activeChild.meta.gender = normalizeGenderValue(typeof gender !== 'undefined' ? gender : activeChild.meta.gender);
            this.root.children[activeChild.meta.id] = this.captureCurrentChildRecord(activeChild.meta);
            this.root.family = this.captureCurrentFamilyState();
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            this.saveRoot(this.root);
        },

        applyActiveChildToGlobals(options = {}) {
            const activeChild = this.getActiveChild();
            if (!activeChild) return;
            const family = this.root?.family || createBlankFamilyState();
            const child = this.normalizeChildRecord(activeChild.meta.id, activeChild);
            const draft = { ...createBlankChildDraft(), ...cloneData(child.draft, {}) };
            const nextSavedCanvas = child?.draft?.savedCanvas && typeof child.draft.savedCanvas === 'object'
                ? {
                    blank: child.draft.savedCanvas.blank === true,
                    ownKey: String(child.draft.savedCanvas.ownKey || '').trim(),
                    partnerKey: String(child.draft.savedCanvas.partnerKey || '').trim(),
                    selectedKey: String(child.draft.savedCanvas.selectedKey || '').trim(),
                    selectedSource: String(child.draft.savedCanvas.selectedSource || '').trim(),
                    selectedAt: String(child.draft.savedCanvas.selectedAt || '').trim()
                }
                : { blank: false, ownKey: '', partnerKey: '', selectedKey: '', selectedSource: '', selectedAt: '' };
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
                if (typeof liked !== 'undefined') liked = cloneData(child.libraries.kanjiStock, []);
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

        getChildSummary(childId) {
            const child = this.getChildById(childId);
            if (!child) return { readingCount: 0, kanjiCount: 0, savedCount: 0 };
            return {
                readingCount: Array.isArray(child.libraries?.readingStock) ? child.libraries.readingStock.length : 0,
                kanjiCount: new Set((child.libraries?.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean)).size,
                savedCount: (child.libraries?.savedNames || []).filter((item) => item?.fromPartner !== true).length
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
            const child = this.getChildById(childId);
            const localSummary = this.getChildSummary(childId);
            if (!child) {
                return { ...localSummary, summaryLabel: '' };
            }

            const activeChildId = this.root?.activeChildId || '';
            if (childId !== activeChildId) {
                return { ...localSummary, summaryLabel: '' };
            }

            const pairing = typeof getPairingHomeSummary === 'function'
                ? getPairingHomeSummary()
                : null;
            if (pairing?.hasPartner
                && typeof getHomeAggregateCounts === 'function'
                && typeof getHomeOwnershipSummary === 'function') {
                const ownSummary = getHomeOwnershipSummary();
                const aggregateCounts = getHomeAggregateCounts(
                    ownSummary.ownLikedCount,
                    ownSummary.ownReadingCount,
                    ownSummary.ownSavedCount,
                    pairing
                );
                return {
                    readingCount: aggregateCounts.readingStockCount,
                    kanjiCount: aggregateCounts.likedCount,
                    savedCount: aggregateCounts.savedCount,
                    summaryLabel: 'ふたりで集めた候補'
                };
            }

            return {
                ...localSummary,
                summaryLabel: 'マイ候補'
            };
        },
        getSharedSummary() {
            const shared = this.root?.family?.sharedLibraries || createBlankFamilyState().sharedLibraries;
            return {
                readingCount: Array.isArray(shared.readingStock) ? shared.readingStock.length : 0,
                kanjiCount: new Set((shared.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean)).size
            };
        },

        renderSwitchers(screenIds = KNOWN_SCREENS) {
            if (!this.initialized || !this.root) return;
            const ids = Array.isArray(screenIds) ? screenIds : KNOWN_SCREENS;
            ids.forEach((screenId) => {
                const host = document.querySelector(SCREEN_HOST_SELECTORS[screenId]);
                if (!host) return;
                const existing = host.querySelector(`.meimay-child-switcher[data-screen-id="${screenId}"]`);
                if (existing) existing.remove();
                const element = document.createElement('div');
                element.className = `meimay-child-switcher${screenId === 'scr-build' || screenId === 'scr-settings' ? ' compact' : ''}`;
                element.dataset.screenId = screenId;
                element.innerHTML = this.buildSwitcherMarkup(screenId);
                host.prepend(element);
            });
        },

        buildSwitcherMarkup(screenId) {
            const activeChild = this.getActiveChild();
            const activeLabel = activeChild?.meta?.displayLabel || '第一子';
            const activeGender = getGenderLabel(activeChild?.meta?.gender || 'neutral');
            const summary = this.getDisplayChildSummary(activeChild?.meta?.id);
            const childButtons = this.buildOrderedChildIds(this.root).map((childId) => {
                const child = this.getChildById(childId);
                const childSummary = this.getDisplayChildSummary(childId);
                const childSummaryLabel = childSummary.summaryLabel ? `${escapeHtml(childSummary.summaryLabel)} ・ ` : '';
                return `
                    <button type="button" onclick="MeimayChildWorkspaces.switchChild('${escapeHtml(childId)}')" class="meimay-child-chip${childId === this.root.activeChildId ? ' active' : ''}">
                        ${escapeHtml(child.meta.displayLabel)}
                        <span class="meimay-child-chip-sub">${escapeHtml(getGenderLabel(child.meta.gender))} ・ ${childSummaryLabel}読み ${childSummary.readingCount} / 漢字 ${childSummary.kanjiCount} / 保存 ${childSummary.savedCount}</span>
                    </button>
                `;
            }).join('');
            const summaryLabel = summary.summaryLabel ? `${escapeHtml(summary.summaryLabel)} ・ ` : '';
            return `
                <div class="meimay-child-switcher-header">
                    <div>
                        <div class="meimay-child-switcher-title">${escapeHtml(activeLabel)} を進行中</div>
                        <div class="meimay-child-switcher-subtitle">${escapeHtml(activeGender)} ・ ${summaryLabel}読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}</div>
                    </div>
                    <button type="button" class="meimay-child-inline-btn" onclick="MeimayChildWorkspaces.openManagerModal()">子ども管理</button>
                </div>
                <div class="meimay-child-chip-row">${childButtons}<button type="button" class="meimay-child-chip-add" onclick="MeimayChildWorkspaces.openChildModal('create')">＋ 追加</button></div>
                ${screenId === 'scr-mode' ? '<div class="meimay-child-switcher-meta">切り替えると今の作業状態を自動保存して、次の子どもの候補へ切り替えます。</div>' : ''}
            `;
        },
        decorateSettingsChildManagementCard() {
            const container = document.getElementById('settings-screen-content');
            if (!container) return;
            const titleNodes = Array.from(container.querySelectorAll('.item-title-unified'));
            const target = titleNodes.find((node) => String(node.textContent || '').trim() === '赤ちゃんの性別');
            if (!target) return;
            const item = target.closest('.settings-item-unified');
            const activeChild = this.getActiveChild();
            if (!item || !activeChild) return;
            const valueNode = item.querySelector('.item-value-unified');
            const iconNode = item.querySelector('.item-icon-circle span');
            target.textContent = '子ども管理';
            if (valueNode) valueNode.textContent = `${activeChild.meta.displayLabel} ・ ${getGenderLabel(activeChild.meta.gender)}`;
            if (iconNode) iconNode.textContent = '👶';
            item.onclick = () => this.openManagerModal();
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
            const twinIndex = options.multipleIndex ?? options.twinIndex ?? null;
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
                    displayLabel: buildDisplayLabel(birthOrder, twinIndex),
                    gender: genderValue,
                    birthGroupId: twinIndex === null ? null : `bg_${birthOrder}`,
                    birthGroupIndex: twinIndex,
                    twinGroupId: twinIndex === null ? null : `bg_${birthOrder}`,
                    twinIndex,
                    createdAt: getNowIso(),
                    updatedAt: getNowIso()
                },
                prefs: {
                    rule: String(prefs.rule || 'strict'),
                    prioritizeFortune: prefs.prioritizeFortune === true,
                    imageTags: Array.isArray(prefs.imageTags) && prefs.imageTags.length > 0 ? cloneData(prefs.imageTags, ['none']) : ['none']
                },
                draft: createBlankChildDraft(),
                libraries: this.buildInitialLibrariesForCreate(options.startMode, options.sourceChildId)
            };
        },

        buildInitialLibrariesForCreate(startMode = 'blank', sourceChildId = '') {
            const blank = createBlankChildLibraries();
            if (startMode === 'shared') {
                return {
                    ...blank,
                    readingStock: cloneData(this.root?.family?.sharedLibraries?.readingStock, []),
                    kanjiStock: cloneData(this.root?.family?.sharedLibraries?.kanjiStock, [])
                };
            }
            if (startMode === 'copy') {
                const sourceChild = this.getChildById(sourceChildId);
                if (!sourceChild) return blank;
                return {
                    ...blank,
                    readingStock: cloneData(sourceChild.libraries.readingStock, []),
                    kanjiStock: this.mergeKanjiLibraries([], sourceChild.libraries.kanjiStock, {
                        sourceChildId,
                        sourceLabel: sourceChild.meta.displayLabel
                    }).items,
                    savedNames: this.mergeSavedLibraries([], sourceChild.libraries.savedNames, {
                        sourceChildId,
                        sourceLabel: sourceChild.meta.displayLabel
                    }).items
                };
            }
            return blank;
        },

        openManagerModal() {
            if (!this.initialized) return;
            this.persistActiveChildSnapshot('open-manager');
            this.closeManagerModal();
            const activeChild = this.getActiveChild();
            const activeId = activeChild?.meta?.id || '';
            const sharedSummary = this.getSharedSummary();
            const childCards = this.buildOrderedChildIds(this.root).map((childId) => {
                const child = this.getChildById(childId);
                const summary = this.getChildSummary(childId);
                const isActive = childId === activeId;
                return `
                    <div class="meimay-child-card${isActive ? ' active' : ''}">
                        <div class="meimay-child-card-head">
                            <div>
                                <div class="meimay-child-card-title">${escapeHtml(child.meta.displayLabel)}</div>
                                <div class="meimay-child-card-meta">${escapeHtml(getGenderLabel(child.meta.gender))} ・ 読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}</div>
                            </div>
                            ${isActive ? '<span class="meimay-child-badge">編集中</span>' : ''}
                        </div>
                        <div class="meimay-child-card-actions">
                            ${!isActive ? `<button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.switchChild('${escapeHtml(childId)}')">切り替える</button>` : ''}
                            ${!isActive ? `<button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.copyAllFromChild('${escapeHtml(childId)}')">候補をコピー</button>` : ''}
                            <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.openChildModal('edit', '${escapeHtml(childId)}')">設定を編集</button>
                        </div>
                    </div>
                `;
            }).join('');

            const modal = document.createElement('div');
            modal.id = 'meimay-child-manager-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closeManagerModal();
            };
            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <button type="button" class="meimay-child-inline-btn" style="float:right" onclick="MeimayChildWorkspaces.closeManagerModal()">閉じる</button>
                    <div class="meimay-child-modal-title">子ども管理</div>
                    <div class="meimay-child-modal-desc">v1では切替時に今の状態を保存して、既存の単一子ロジックへ hydrate します。多胎は A, B, C... の順で扱えます。</div>
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">子ども一覧</div>
                        ${childCards}
                        <div class="meimay-child-card">
                            <div class="meimay-child-card-head">
                                <div>
                                    <div class="meimay-child-card-title">新しい子を追加</div>
                                    <div class="meimay-child-card-meta">第一子・第二子・三つ子以上も、同じ順番入力で扱えます。</div>
                                </div>
                            </div>
                            <div class="meimay-child-card-actions">
                                <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.openChildModal('create')">追加する</button>
                            </div>
                        </div>
                    </div>
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">家族共通の素材</div>
                        <div class="meimay-child-card-meta" style="margin-top:8px">読み ${sharedSummary.readingCount} / 漢字 ${sharedSummary.kanjiCount}</div>
                        <div class="meimay-child-shared-actions">
                            <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.applySharedLibrariesToActiveChild()">この子に取り込む</button>
                            <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.promoteActiveReadingsToShared()">今の読みを共通へ</button>
                            <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.promoteActiveKanjiToShared()">今の漢字を共通へ</button>
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
            const defaultBirthOrder = isEdit ? child?.meta?.birthOrder || 1 : this.getSuggestedBirthOrder();
            const defaultMultipleOrder = isEdit && child?.meta?.birthGroupIndex !== null && child?.meta?.birthGroupIndex !== undefined
                ? normalizePositiveInteger(child.meta.birthGroupIndex, 0) + 1
                : '';
            const selectedGender = isEdit ? child?.meta?.gender || 'neutral' : (typeof gender !== 'undefined' ? normalizeGenderValue(gender) : 'neutral');
            const copySourceOptions = this.buildOrderedChildIds(this.root).map((id) => {
                const record = this.getChildById(id);
                return `<option value="${escapeHtml(id)}">${escapeHtml(record.meta.displayLabel)}</option>`;
            }).join('');
            const modal = document.createElement('div');
            modal.id = 'meimay-child-editor-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closeChildModal();
            };
            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <button type="button" class="meimay-child-inline-btn" style="float:right" onclick="MeimayChildWorkspaces.closeChildModal()">閉じる</button>
                    <div class="meimay-child-modal-title">${isEdit ? '子どもの設定を編集' : '新しい子を追加'}</div>
                    <div class="meimay-child-modal-desc">順番・多胎内の順番・性別を持たせて、切替時に既存 state へ戻します。</div>
                    <div class="meimay-child-field"><label class="meimay-child-field-label" for="mcw-child-order">順番</label><input id="mcw-child-order" class="meimay-child-input" type="number" min="1" value="${defaultBirthOrder}"></div>
                    <div class="meimay-child-field">
                        <label class="meimay-child-field-label" for="mcw-child-multiple-order">多胎内の順番</label>
                        <input id="mcw-child-multiple-order" class="meimay-child-input" type="number" min="1" step="1" value="${defaultMultipleOrder}">
                        <div class="meimay-child-field-hint">未入力なら単胎です。1 = A, 2 = B, 3 = C... と自動表示します。</div>
                    </div>
                    <div class="meimay-child-field"><label class="meimay-child-field-label" for="mcw-child-gender">性別</label><select id="mcw-child-gender" class="meimay-child-select"><option value="male" ${selectedGender === 'male' ? 'selected' : ''}>男の子</option><option value="female" ${selectedGender === 'female' ? 'selected' : ''}>女の子</option><option value="neutral" ${selectedGender === 'neutral' ? 'selected' : ''}>指定なし</option></select></div>
                    ${isEdit ? '' : `
                        <div class="meimay-child-field">
                            <label class="meimay-child-field-label">はじめ方</label>
                            <div class="meimay-child-radio-grid">
                                <label class="meimay-child-radio-option"><input type="radio" name="mcw-start-mode" value="blank" checked onchange="MeimayChildWorkspaces.updateChildModalSourceVisibility()"><div><div class="meimay-child-radio-title">まっさらではじめる</div><div class="meimay-child-radio-desc">読み・漢字・保存候補は空で開始します。</div></div></label>
                                <label class="meimay-child-radio-option"><input type="radio" name="mcw-start-mode" value="shared" onchange="MeimayChildWorkspaces.updateChildModalSourceVisibility()"><div><div class="meimay-child-radio-title">家族共通の素材を使う</div><div class="meimay-child-radio-desc">family.sharedLibraries の読み・漢字だけを取り込みます。</div></div></label>
                                <label class="meimay-child-radio-option"><input type="radio" name="mcw-start-mode" value="copy" onchange="MeimayChildWorkspaces.updateChildModalSourceVisibility()"><div><div class="meimay-child-radio-title">他の子の候補をコピーする</div><div class="meimay-child-radio-desc">読み・漢字・保存候補を複製して開始します。</div></div></label>
                            </div>
                        </div>
                        <div class="meimay-child-field" id="mcw-child-copy-source-wrap" style="display:none">
                            <label class="meimay-child-field-label" for="mcw-child-copy-source">コピー元</label>
                            <select id="mcw-child-copy-source" class="meimay-child-select">${copySourceOptions}</select>
                        </div>
                    `}
                    <div class="meimay-child-editor-actions">
                        <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.saveChildModal('${isEdit ? 'edit' : 'create'}', ${isEdit ? `'${escapeHtml(childId)}'` : 'null'})">保存</button>
                        ${isEdit ? `<button type="button" class="meimay-child-modal-btn meimay-child-danger" onclick="MeimayChildWorkspaces.deleteChild('${escapeHtml(childId)}')">削除</button>` : ''}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            this.syncChildModalDeleteButtonState();
            this.updateChildModalSourceVisibility();
        },

        updateChildModalSourceVisibility() {
            const sourceWrap = document.getElementById('mcw-child-copy-source-wrap');
            if (!sourceWrap) return;
            const mode = document.querySelector('input[name="mcw-start-mode"]:checked')?.value || 'blank';
            sourceWrap.style.display = mode === 'copy' ? 'block' : 'none';
        },

        closeChildModal() {
            document.getElementById('meimay-child-editor-modal')?.remove();
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
        saveChildModal(mode = 'create', childId = null) {
            const birthOrder = normalizePositiveInteger(document.getElementById('mcw-child-order')?.value, 1);
            const multipleOrderRaw = String(document.getElementById('mcw-child-multiple-order')?.value || '').trim();
            const parsedMultipleOrder = multipleOrderRaw ? parseInt(multipleOrderRaw, 10) : NaN;
            const twinIndex = Number.isFinite(parsedMultipleOrder) && parsedMultipleOrder > 0 ? parsedMultipleOrder - 1 : null;
            const genderValue = normalizeGenderValue(document.getElementById('mcw-child-gender')?.value || 'neutral');
            const displayLabel = buildDisplayLabel(birthOrder, twinIndex);
            if (this.isDisplayLabelTaken(displayLabel, childId)) {
                this.notify('同じ表示ラベルの子どもがいます。多胎なら 1, 2, 3... の順番を分けてください。', '!');
                return;
            }
            if (mode === 'edit' && childId) {
                this.persistActiveChildSnapshot('before-edit-child');
                const child = this.getChildById(childId);
                if (!child) return;
                child.meta.birthOrder = birthOrder;
                child.meta.birthGroupIndex = twinIndex;
                child.meta.twinIndex = twinIndex;
                child.meta.birthGroupId = twinIndex === null ? null : `bg_${birthOrder}`;
                child.meta.twinGroupId = child.meta.birthGroupId;
                child.meta.displayLabel = displayLabel;
                child.meta.gender = genderValue;
                child.meta.updatedAt = getNowIso();
                this.root.childOrder = this.buildOrderedChildIds(this.root);
                this.saveRoot(this.root);
                if (childId === this.root.activeChildId) this.applyActiveChildToGlobals({ reason: 'edit-child' });
                this.closeChildModal();
                this.closeManagerModal();
                this.refreshVisibleUI('edit-child');
                this.notify('子どもの設定を更新しました', '✓');
                return;
            }
            const startMode = document.querySelector('input[name="mcw-start-mode"]:checked')?.value || 'blank';
            const sourceChildId = document.getElementById('mcw-child-copy-source')?.value || '';
            if (startMode === 'copy' && (!sourceChildId || !this.getChildById(sourceChildId))) {
                this.notify('コピー元の子どもを選んでください。', '!');
                return;
            }
            this.persistActiveChildSnapshot('before-create-child');
            const nextId = this.generateChildId();
            this.root.children[nextId] = this.buildChildRecordForCreate({ id: nextId, birthOrder, multipleIndex: twinIndex, gender: genderValue, startMode, sourceChildId });
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            this.root.activeChildId = nextId;
            this.saveRoot(this.root);
            this.closeChildModal();
            this.closeManagerModal();
            this.applyActiveChildToGlobals({ reason: 'create-child' });
            this.refreshVisibleUI('create-child');
            this.notify(`${this.getChildLabel(nextId)} を追加しました`, '✓');
        },

        copyAllFromChild(sourceChildId) {
            const sourceChild = this.getChildById(sourceChildId);
            const activeChild = this.getActiveChild();
            if (!sourceChild || !activeChild || sourceChildId === activeChild.meta.id) return;
            this.persistActiveChildSnapshot('before-copy-child');
            const target = this.getActiveChild();
            target.libraries.readingStock = this.mergeReadingLibraries(target.libraries.readingStock, sourceChild.libraries.readingStock).items;
            target.libraries.kanjiStock = this.mergeKanjiLibraries(target.libraries.kanjiStock, sourceChild.libraries.kanjiStock, { sourceChildId, sourceLabel: sourceChild.meta.displayLabel }).items;
            target.libraries.savedNames = this.mergeSavedLibraries(target.libraries.savedNames, sourceChild.libraries.savedNames, { sourceChildId, sourceLabel: sourceChild.meta.displayLabel }).items;
            target.meta.updatedAt = getNowIso();
            this.saveRoot(this.root);
            this.applyActiveChildToGlobals({ reason: 'copy-child' });
            this.refreshVisibleUI('copy-child');
            this.closeManagerModal();
            this.notify(`${sourceChild.meta.displayLabel} の候補をコピーしました`, '✓');
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

        notify(message, icon = '✓') {
            if (typeof showToast === 'function') showToast(message, icon);
            else alert(message);
        },

        getRootSnapshot() {
            return cloneData(this.root, null);
        },

        applyRemoteRootSnapshot(snapshot, options = {}) {
            if (!snapshot) return false;
            const merged = this.mergeRootState(this.root, snapshot);
            this.root = merged;
            this.saveRoot(merged, { skipRemoteSync: true });
            if (this.initialized) {
                this.applyActiveChildToGlobals({ reason: options.reason || 'remote-root' });
                this.renderSwitchers();
                this.decorateSettingsChildManagementCard();
                this.refreshVisibleUI(options.reason || 'remote-root');
            }
            return true;
        },

        saveRoot(root = this.root, options = {}) {
            if (!root) return;
            const nextRoot = root;
            nextRoot.updatedAt = getNowIso();
            if (!nextRoot.createdAt) nextRoot.createdAt = nextRoot.updatedAt;
            localStorage.setItem(ROOT_KEY, JSON.stringify(root));
            if (!options.skipRemoteSync) {
                if (typeof window.MeimayUserBackup !== 'undefined' && window.MeimayUserBackup && typeof window.MeimayUserBackup.scheduleSync === 'function') {
                    window.MeimayUserBackup.scheduleSync(options.reason || 'child-root-save');
                }
                if (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && typeof MeimayPairing._autoSyncDebounced === 'function') {
                    MeimayPairing._autoSyncDebounced(options.reason || 'child-root-save');
                }
            }
        },

        renderSwitchers() {
            document.querySelectorAll('.meimay-child-switcher').forEach((node) => node.remove());
            this.updateHeaderChildButton();
        },

        decorateSettingsChildManagementCard() {
            this.updateHeaderChildButton();
        },

        getChildLabel(childId) {
            const child = this.getChildById(childId);
            return child?.meta?.displayLabel || '第一子';
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
            const label = activeChild ? this.getChildLabel(activeChild.meta.id) : '第一子';
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

            activeChild.meta.birthOrder = nextBirthOrder;
            activeChild.meta.displayLabel = buildDisplayLabel(nextBirthOrder, activeChild.meta.birthGroupIndex);
            activeChild.meta.gender = nextGender;
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

        getAvailableBirthOrders(excludedChildId = null) {
            const taken = new Set();
            this.buildOrderedChildIds(this.root).forEach((childId) => {
                if (excludedChildId && childId === excludedChildId) return;
                const child = this.getChildById(childId);
                const order = normalizePositiveInteger(child?.meta?.birthOrder, 0);
                if (order >= 1) taken.add(order);
            });
            const available = [];
            for (let order = 1; order <= 10; order += 1) {
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
                return normalizePositiveInteger(child?.meta?.birthOrder, 0) === safeOrder;
            });
        },

        buildBirthOrderOptions(selectedOrder, excludedChildId = null) {
            const availableOrders = this.getAvailableBirthOrders(excludedChildId);
            const safeSelected = normalizePositiveInteger(selectedOrder, 0);
            if (availableOrders.length === 0 && !excludedChildId) {
                return '<option value="" disabled selected>追加できる順番がありません</option>';
            }
            const options = availableOrders.length > 0 ? availableOrders : [safeSelected || 1];
            return options.map((order) => {
                const isSelected = safeSelected === order;
                return `<option value="${order}"${isSelected ? ' selected' : ''}>${escapeHtml(getJapaneseOrderLabel(order))}</option>`;
            }).join('');
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
        },

        buildChildModalGenderButtons(selectedGender = 'neutral') {
            const buttons = [
                { value: 'male', label: '男の子' },
                { value: 'female', label: '女の子' },
                { value: 'neutral', label: '指定なし' }
            ];
            const normalized = normalizeGenderValue(selectedGender);
            return buttons.map((item) => {
                const isSelected = item.value === normalized;
                return `<button type="button" class="wiz-baby-gender-btn${isSelected ? ' selected' : ''}" data-child-modal-gender="${item.value}" aria-pressed="${isSelected ? 'true' : 'false'}" onclick="MeimayChildWorkspaces.selectChildModalGender('${item.value}')"><span class="wiz-baby-gender-title">${escapeHtml(item.label)}</span></button>`;
            }).join('');
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
            return {
                readingCount: Array.isArray(child.libraries?.readingStock) ? child.libraries.readingStock.length : 0,
                kanjiCount: new Set((child.libraries?.kanjiStock || []).map((item) => getKanjiValue(item)).filter(Boolean)).size,
                savedCount: Array.isArray(child.libraries?.savedNames)
                    ? child.libraries.savedNames.filter((item) => item?.fromPartner !== true).length
                    : 0
            };
        },

        getManagerChildTitle(childId) {
            const child = this.getChildById(childId);
            if (!child) return '';
            const baseLabel = child.meta?.displayLabel || '第一子';
            if (childId !== this.root?.activeChildId) return baseLabel;
            const matchedLabel = getMatchedSavedNameLabel();
            return matchedLabel ? `${baseLabel}：${matchedLabel}` : baseLabel;
        },

        buildCopySourceOptions(excludedChildId = '') {
            const childIds = this.buildOrderedChildIds(this.root).filter((id) => id !== excludedChildId);
            if (childIds.length === 0) {
                return '<option value="">引き継げる子がいません</option>';
            }
            const defaultSourceId = this.root?.activeChildId && childIds.includes(this.root.activeChildId)
                ? this.root.activeChildId
                : childIds[0];
            return childIds.map((childId) => {
                const child = this.getChildById(childId);
                const summary = this.getDisplayChildSummary(childId);
                const label = `${child?.meta?.displayLabel || '第一子'}（読 ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}）`;
                return `<option value="${escapeHtml(childId)}"${childId === defaultSourceId ? ' selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('');
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
                        <span>${escapeHtml(section.label)}</span>
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
            const counts = summary.summaryLabel
                ? `${summary.summaryLabel} ・ 読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}`
                : `読み ${summary.readingCount} / 漢字 ${summary.kanjiCount} / 保存 ${summary.savedCount}`;
            return `
                <div class="meimay-child-card${isActive ? ' active' : ''}">
                    <div class="meimay-child-card-head">
                        <div>
                            <div class="meimay-child-card-title">${title}</div>
                            <div class="meimay-child-card-meta">${escapeHtml(counts)}</div>
                        </div>
                        ${isActive
                            ? '<div class="meimay-child-badge">編集中</div>'
                            : `<button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.switchChild('${escapeHtml(childId)}')">切り替える</button>`}
                    </div>
                    <div class="meimay-child-card-actions">
                        <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.openChildModal('edit', '${escapeHtml(childId)}')">設定を編集</button>
                    </div>
                </div>
            `;
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
            const canAddMore = this.getAvailableBirthOrders().length > 0;
            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <div class="meimay-child-modal-header">
                        <button type="button" class="meimay-child-modal-close" aria-label="閉じる" onclick="MeimayChildWorkspaces.closeManagerModal()">×</button>
                    </div>
                    <div class="meimay-child-modal-copy">
                        <div class="meimay-child-modal-title">名づけ帳管理</div>
                        <div class="meimay-child-modal-desc">進める子の切り替えや、新しい子の追加ができます。</div>
                    </div>
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">進める子を切り替える</div>
                        <div class="meimay-child-modal-stack">${childCards}</div>
                    </div>
                    <div class="meimay-child-modal-section">
                        <div class="meimay-child-modal-section-title">新しい子を追加</div>
                        <div class="meimay-child-card-actions" style="margin-top:12px">
                            <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.openChildModal('create')" ${canAddMore ? '' : 'disabled'}>追加する</button>
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

            const familySurnameDraft = this.getCurrentFamilySurnameDraft();
            const hasFamilySurname = !!(familySurnameDraft.kanji || familySurnameDraft.reading);
            const selectedGender = isEdit
                ? normalizeGenderValue(child?.meta?.gender)
                : normalizeGenderValue(typeof gender !== 'undefined' ? gender : 'neutral');
            const selectedOrder = isEdit
                ? normalizePositiveInteger(child?.meta?.birthOrder, this.getSuggestedBirthOrder())
                : this.getSuggestedBirthOrder();
            const selectedSourceId = this.root?.activeChildId && this.getChildById(this.root.activeChildId)
                ? this.root.activeChildId
                : this.buildOrderedChildIds(this.root)[0] || '';
            const defaultSections = ['reading', 'kanji', 'saved'];
            const showDeleteButton = isEdit && this.buildOrderedChildIds(this.root).length > 1;
            const createDesc = hasFamilySurname
                ? '苗字は設定済みなので、生まれ順・性別・はじめ方だけを順に選べます。'
                : '苗字がまだでも大丈夫です。生まれ順・性別・はじめ方を順に選べます。';
            const modal = document.createElement('div');
            modal.id = 'meimay-child-editor-modal';
            modal.className = 'meimay-child-modal-overlay';
            modal.onclick = (event) => {
                if (event.target === modal) this.closeChildModal();
            };
            modal.innerHTML = `
                <div class="meimay-child-modal-sheet">
                    <div class="meimay-child-modal-header">
                        <button type="button" class="meimay-child-modal-close" aria-label="閉じる" onclick="MeimayChildWorkspaces.closeChildModal()">×</button>
                    </div>
                    <div class="meimay-child-modal-copy">
                        <div class="meimay-child-modal-title">${isEdit ? '子どもの設定を編集' : '新しい子を追加'}</div>
                        <div class="meimay-child-modal-desc">${isEdit ? '生まれ順と性別を見直せます。' : createDesc}</div>
                    </div>
                    <input type="hidden" id="mcw-child-gender" value="${escapeHtml(selectedGender)}">
                    <div class="meimay-child-field">
                        <div class="meimay-child-step-label">STEP 1</div>
                        <label class="meimay-child-field-label" for="mcw-child-order">生まれ順</label>
                        <select id="mcw-child-order" class="wiz-birth-order-select meimay-child-select">${this.buildBirthOrderOptions(selectedOrder, isEdit ? childId : null)}</select>
                    </div>
                    <div class="meimay-child-field">
                        <div class="meimay-child-step-label">STEP 2</div>
                        <label class="meimay-child-field-label">性別</label>
                        <div class="wiz-baby-gender-grid meimay-child-gender-grid">${this.buildChildModalGenderButtons(selectedGender)}</div>
                    </div>
                    ${isEdit ? '' : `
                        <div class="meimay-child-field">
                            <div class="meimay-child-step-label">STEP 3</div>
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
                                        <div class="meimay-child-radio-title">ほかの子の候補をコピーする</div>
                                        <div class="meimay-child-radio-desc">読み・漢字・保存候補を引き継いで始めます。</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div id="mcw-child-copy-area" style="display:none">
                            <div class="meimay-child-field">
                                <label class="meimay-child-field-label" for="mcw-child-copy-source">コピー元</label>
                                <select id="mcw-child-copy-source" class="meimay-child-select" onchange="MeimayChildWorkspaces.updateChildModalStartModeVisibility()">${this.buildCopySourceOptions()}</select>
                            </div>
                            <div class="meimay-child-field">
                                <label class="meimay-child-field-label">引き継ぐ内容</label>
                                <div class="meimay-child-toggle-grid">${this.buildCopySectionButtons(defaultSections, selectedSourceId)}</div>
                            </div>
                        </div>
                    `}
                    <div class="meimay-child-editor-actions">
                        <button type="button" class="meimay-child-modal-btn" onclick="MeimayChildWorkspaces.saveChildModal('${isEdit ? 'edit' : 'create'}', ${isEdit ? `'${escapeHtml(childId)}'` : 'null'})">保存</button>
                        ${showDeleteButton ? `<button type="button" class="meimay-child-modal-btn meimay-child-danger" onclick="MeimayChildWorkspaces.deleteChild('${escapeHtml(childId)}')">削除</button>` : ''}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            this.syncChildModalDeleteButtonState();
            this.selectChildModalGender(selectedGender);
            this.updateChildModalStartModeVisibility();
            this.updateChildModalCopySummary();
        },
        closeChildModal() {
            document.getElementById('meimay-child-editor-modal')?.remove();
        },

        saveChildModal(mode = 'create', childId = null) {
            const selectedOrder = normalizePositiveInteger(document.getElementById('mcw-child-order')?.value, 0);
            const birthOrder = selectedOrder || this.getSuggestedBirthOrder();
            const genderValue = this.getSelectedChildModalGender();
            if (mode === 'edit' && childId) {
                if (this.isBirthOrderTaken(birthOrder, childId)) {
                    this.notify('その順番はすでに使われています。', '!');
                    return;
                }
                const child = this.getChildById(childId);
                if (!child) return;
                this.persistActiveChildSnapshot('before-edit-child');
                child.meta.birthOrder = birthOrder;
                child.meta.displayLabel = buildDisplayLabel(birthOrder);
                child.meta.gender = genderValue;
                child.meta.birthGroupId = null;
                child.meta.birthGroupIndex = null;
                child.meta.twinGroupId = null;
                child.meta.twinIndex = null;
                child.meta.updatedAt = getNowIso();
                this.root.childOrder = this.buildOrderedChildIds(this.root);
                this.saveRoot(this.root);
                if (childId === this.root.activeChildId) this.applyActiveChildToGlobals({ reason: 'edit-child' });
                this.closeChildModal();
                this.closeManagerModal();
                this.refreshVisibleUI('edit-child');
                this.renderSwitchers();
                this.notify('子どもの設定を更新しました', '✓');
                return;
            }

            if (this.isBirthOrderTaken(birthOrder)) {
                this.notify('その順番はすでに使われています。', '!');
                return;
            }

            const startMode = this.getSelectedChildModalStartMode();
            const sourceChildId = this.getSelectedChildModalCopySourceId();
            const copySections = Array.from(this.getSelectedChildModalCopySections());
            if (startMode === 'copy' && (!sourceChildId || !this.getChildById(sourceChildId))) {
                this.notify('コピー元の子を選んでください。', '!');
                return;
            }

            this.persistActiveChildSnapshot('before-create-child');
            const nextId = this.generateChildId();
            this.root.children[nextId] = this.buildChildRecordForCreate({
                id: nextId,
                birthOrder,
                gender: genderValue,
                startMode,
                sourceChildId,
                copySections
            });
            this.root.childOrder = this.buildOrderedChildIds(this.root);
            this.root.activeChildId = nextId;
            this.saveRoot(this.root);
            this.closeChildModal();
            this.closeManagerModal();
            this.applyActiveChildToGlobals({ reason: 'create-child' });
            this.refreshVisibleUI('create-child');
            this.renderSwitchers();
            this.notify(`${this.getChildLabel(nextId)} を追加しました`, '✓');
        },

        buildInitialLibrariesForCreate(startMode = 'blank', sourceChildId = '', copySections = []) {
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
                next.kanjiStock = this.mergeKanjiLibraries([], sourceChild.libraries?.kanjiStock, {
                    sourceChildId,
                    sourceLabel: sourceChild.meta?.displayLabel || '第一子'
                }).items;
            }
            if (selected.has('saved')) {
                next.savedNames = this.mergeSavedLibraries([], sourceChild.libraries?.savedNames, {
                    sourceChildId,
                    sourceLabel: sourceChild.meta?.displayLabel || '第一子'
                }).items;
            }
            return next;
        },

        buildChildRecordForCreate(options = {}) {
            const id = String(options.id || this.generateChildId());
            const birthOrder = normalizePositiveInteger(options.birthOrder, this.getSuggestedBirthOrder());
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
                    displayLabel: buildDisplayLabel(birthOrder),
                    gender: genderValue,
                    birthGroupId: null,
                    birthGroupIndex: null,
                    twinGroupId: null,
                    twinIndex: null,
                    createdAt: getNowIso(),
                    updatedAt: getNowIso()
                },
                prefs: {
                    rule: String(prefs.rule || 'strict'),
                    prioritizeFortune: prefs.prioritizeFortune === true,
                    imageTags: Array.isArray(prefs.imageTags) && prefs.imageTags.length > 0 ? cloneData(prefs.imageTags, ['none']) : ['none']
                },
                draft: {
                    ...createBlankChildDraft(),
                    savedCanvas: {
                        blank: true,
                        ownKey: '',
                        partnerKey: '',
                        selectedKey: '',
                        selectedSource: '',
                        selectedAt: ''
                    }
                },
                libraries: this.buildInitialLibrariesForCreate(
                    options.startMode,
                    options.sourceChildId,
                    options.copySections
                )
            };
        }
    };

    window.MeimayChildWorkspaces = MeimayChildWorkspaces;
    MeimayChildWorkspaces.install();
})();
