/* ============================================================
   MODULE 15: FIREBASE (V22.0 - ANONYMOUS AUTH + ROOM PAIRING)
   繧｢繧ｫ繧ｦ繝ｳ繝井ｸ崎ｦ√・蛹ｿ蜷崎ｪ崎ｨｼ繝ｻ繝ｫ繝ｼ繝繧ｳ繝ｼ繝画婿蠑上ヱ繝ｼ繝医リ繝ｼ騾｣謳ｺ
   ============================================================ */

// Firebase蛻晄悄蛹・
const firebaseConfig = {
    apiKey: "AIzaSyCeteJiyV2Qsv0pdOp6Y0LsG2ov7kJd4I8",
    authDomain: "meimay-9a28f.firebaseapp.com",
    projectId: "meimay-9a28f",
    storageBucket: "meimay-9a28f.firebasestorage.app",
    messagingSenderId: "1091140035256",
    appId: "1:1091140035256:web:cd452523d8eb87f34b8a4d",
    measurementId: "G-RDT1HTGLF1"
};

let firebaseApp, firebaseAuth, firebaseDb;

try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();
    console.log("FIREBASE: Initialized successfully");
} catch (e) {
    console.error("FIREBASE: Init failed", e);
}

async function waitForFirebaseAuthReady(timeoutMs = 8000) {
    if (!firebaseAuth) return null;
    if (firebaseAuth.currentUser) return firebaseAuth.currentUser;

    try {
        return await new Promise((resolve) => {
            let settled = false;
            let timeoutId = null;
            let unsubscribe = null;

            const finish = (nextUser) => {
                if (settled) return;
                settled = true;
                if (timeoutId) clearTimeout(timeoutId);
                if (typeof unsubscribe === 'function') unsubscribe();
                resolve(nextUser || null);
            };

            timeoutId = setTimeout(() => finish(firebaseAuth.currentUser || null), timeoutMs);
            unsubscribe = firebaseAuth.onAuthStateChanged(
                (nextUser) => finish(nextUser),
                () => finish(firebaseAuth.currentUser || null)
            );
        });
    } catch (error) {
        console.warn('FIREBASE: Failed to wait for auth state', error);
        return firebaseAuth.currentUser || null;
    }
}

// ============================================================
// AUTH - 蛹ｿ蜷崎ｪ崎ｨｼ・医Θ繝ｼ繧ｶ繝ｼ縺ｫ縺ｯ隕九∴縺ｪ縺・・蜍募・逅・ｼ・// ============================================================
const MeimayAuth = {
    currentUser: null,

    // 襍ｷ蜍墓凾縺ｫ閾ｪ蜍募他縺ｳ蜃ｺ縺暦ｼ医Θ繝ｼ繧ｶ繝ｼ謫堺ｽ應ｸ崎ｦ・ｼ・
    init: async function () {
        if (!firebaseAuth) return null;

        const readyUser = await waitForFirebaseAuthReady();
        if (readyUser) {
            this.currentUser = readyUser;
            return readyUser;
        }

        if (!firebaseAuth.currentUser) {
            try {
                const credential = await firebaseAuth.signInAnonymously();
                console.log("FIREBASE: Anonymous sign-in success");
                this.currentUser = firebaseAuth.currentUser || credential?.user || null;
            } catch (e) {
                console.error("FIREBASE: Anonymous sign-in failed", e);
            }
        } else {
            this.currentUser = firebaseAuth.currentUser;
        }

        return this.currentUser || firebaseAuth.currentUser || null;
    },

    getCurrentUser: function () {
        return this.currentUser;
    },

    // 繧ｦ繧｣繧ｶ繝ｼ繝臥ｵ檎罰縺ｮ繝九ャ繧ｯ繝阪・繝螟画峩・郁ｨｭ螳夂判髱｢縺ｧ菴ｿ逕ｨ・・
    editNickname: function () {
        const wizData = WizardData.get() || {};
        const oldName = wizData.username || '';
        const newName = prompt('新しいニックネームを入力してください', oldName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) { alert('ニックネームを入力してください'); return; }
        wizData.username = trimmed;
        WizardData.save(wizData);
        if (typeof MeimayShare !== 'undefined' && typeof MeimayShare.syncProfileAppearance === 'function') {
            MeimayShare.syncProfileAppearance();
        }
        if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        if (typeof updateHomeGreeting === 'function') updateHomeGreeting();
        showToast('ニックネームを更新しました', '\u2728');
    }
};

// ============================================================
// AUTH STATE LISTENER
// ============================================================
if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged(async (user) => {
        MeimayAuth.currentUser = user;
        if (user) {
            console.log(`FIREBASE: Anonymous user ready (${user.uid})`);
            if (window.PremiumManager && typeof window.PremiumManager.bindToUserDoc === 'function') {
                await window.PremiumManager.bindToUserDoc(user);
            }
            if (window.MeimayUserBackup && typeof window.MeimayUserBackup.bootstrapForUser === 'function') {
                await window.MeimayUserBackup.bootstrapForUser(user);
            }
            // 菫晏ｭ俶ｸ医∩繝ｫ繝ｼ繝縺後≠繧後・蜀肴磁邯・
            await MeimayPairing.resumeRoom();
            seedReadingStatsFromLocalHistory();
        } else {
            console.log("FIREBASE: No user");
        }
    });
}

// 襍ｷ蜍墓凾縺ｫ蛹ｿ蜷崎ｪ崎ｨｼ繧定・蜍募ｮ溯｡・
MeimayAuth.init();

async function getFirebaseIdToken(timeoutMs = 8000) {
    if (!firebaseAuth) return null;

    if (!firebaseAuth.currentUser && typeof MeimayAuth !== 'undefined' && typeof MeimayAuth.init === 'function') {
        try {
            await MeimayAuth.init();
        } catch (error) {
            console.warn('FIREBASE: Anonymous auth init retry failed', error);
        }
    }

    if (firebaseAuth.currentUser) {
        try {
            return await firebaseAuth.currentUser.getIdToken();
        } catch (error) {
            console.warn('FIREBASE: Failed to get ID token from current user', error);
        }
    }

    try {
        const user = await new Promise((resolve) => {
            let settled = false;
            let timeoutId = null;
            let unsubscribe = null;

            const finish = (nextUser) => {
                if (settled) return;
                settled = true;
                if (timeoutId) clearTimeout(timeoutId);
                if (typeof unsubscribe === 'function') unsubscribe();
                resolve(nextUser || null);
            };

            timeoutId = setTimeout(() => finish(firebaseAuth.currentUser || null), timeoutMs);
            unsubscribe = firebaseAuth.onAuthStateChanged(
                (nextUser) => finish(nextUser),
                () => finish(firebaseAuth.currentUser || null)
            );
        });

        return user ? await user.getIdToken() : null;
    } catch (error) {
        console.warn('FIREBASE: Failed to wait for auth token', error);
        return null;
    }
}

async function getFirebaseRequestHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getFirebaseIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

window.getFirebaseIdToken = getFirebaseIdToken;
window.getFirebaseRequestHeaders = getFirebaseRequestHeaders;

function normalizeHiddenReadingKey(value) {
    const raw = String(value == null ? '' : value).trim().split('::')[0].trim();
    if (!raw) return '';
    return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
}

function readNormalizedHiddenReadings() {
    try {
        const raw = JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]');
        return Array.isArray(raw)
            ? [...new Set(raw.map((value) => normalizeHiddenReadingKey(value)).filter(Boolean))]
            : [];
    } catch (error) {
        return [];
    }
}

function readNormalizedHiddenReadingsFromSnapshot(values) {
    return Array.isArray(values)
        ? [...new Set(values.map((value) => normalizeHiddenReadingKey(value)).filter(Boolean))]
        : [];
}

function getPairingSavedNameCombinationKey(item) {
    if (!item) return '';
    if (Array.isArray(item.combination) && item.combination.length > 0) {
        return item.combination.map((part) => part?.['漢字'] || part?.kanji || '').join('').trim();
    }
    return Array.isArray(item.combinationKeys)
        ? item.combinationKeys.join('').trim()
        : '';
}

function getPairingSavedNameGivenName(item) {
    if (!item) return '';
    const direct = String(item.givenName || '').trim();
    if (direct) return direct;
    const combinationKey = getPairingSavedNameCombinationKey(item);
    if (combinationKey) return combinationKey;
    const fullName = String(item.fullName || '').trim();
    if (!fullName) return '';
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function getPairingSavedNameGivenReading(item) {
    if (!item) return '';
    const direct = String(item.givenReading || item.givenNameReading || '').trim();
    const reading = direct || String(item.reading || '').trim();
    if (!reading) return '';
    const parts = reading.split(/\s+/).filter(Boolean);
    const target = parts.length > 1 ? parts[parts.length - 1] : reading;
    return (typeof toHira === 'function' ? toHira(target) : target).replace(/\s+/g, '');
}

function buildPairingSavedNameKey(item) {
    if (!item) return '';
    const combinationKey = getPairingSavedNameCombinationKey(item);
    const givenName = getPairingSavedNameGivenName(item) || combinationKey;
    const givenReading = getPairingSavedNameGivenReading(item) || givenName;
    return `${givenName}::${combinationKey}::${givenReading}`.trim();
}

function canonicalizePairingSavedNameKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.split('::');
    if (parts.length < 2) return raw;
    const rawName = String(parts[0] || '').trim();
    const combinationKey = String(parts[1] || '').trim();
    const rawReading = String(parts.slice(2).join('::') || '').trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const readingParts = rawReading.split(/\s+/).filter(Boolean);
    const givenName = combinationKey || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : rawName);
    const readingTarget = readingParts.length > 1 ? readingParts[readingParts.length - 1] : rawReading;
    const givenReading = (typeof toHira === 'function' ? toHira(readingTarget) : readingTarget).replace(/\s+/g, '');
    return `${givenName || combinationKey}::${combinationKey}::${givenReading || givenName || combinationKey}`.trim();
}

function extractSavedCanvasOwnKeyFromWorkspaceState(state) {
    const canvas = extractSavedCanvasStateFromWorkspaceState(state);
    return String(canvas?.activeKey || canvas?.selectedKey || canvas?.ownKey || canvas?.partnerKey || '').trim();
}

function extractSavedCanvasStateFromWorkspaceState(state) {
    const emptyCanvas = { blank: false, ownKey: '', partnerKey: '', selectedKey: '', selectedSource: '', selectedAt: '', activeKey: '' };
    if (!state || typeof state !== 'object') {
        return emptyCanvas;
    }

    const normalizeCanvas = (canvas) => {
        if (!canvas || typeof canvas !== 'object') return null;
        const blank = canvas.blank === true;
        const ownKey = canonicalizePairingSavedNameKey(canvas.ownKey);
        const partnerKey = canonicalizePairingSavedNameKey(canvas.partnerKey);
        let selectedSource = canvas.selectedSource === 'partner'
            ? 'partner'
            : (canvas.selectedSource === 'own' ? 'own' : '');
        const rawSelectedKey = canonicalizePairingSavedNameKey(canvas.selectedKey);
        const selectedKey = rawSelectedKey
            || (selectedSource === 'partner' ? partnerKey : (selectedSource === 'own' ? ownKey : ''));
        if (!selectedSource && selectedKey) {
            if (selectedKey === partnerKey && selectedKey !== ownKey) {
                selectedSource = 'partner';
            } else if (selectedKey === ownKey && selectedKey !== partnerKey) {
                selectedSource = 'own';
            }
        }
        const selectedAt = String(canvas.selectedAt || '').trim();
        const activeKey = selectedKey
            || (selectedSource === 'partner' ? partnerKey : (selectedSource === 'own' ? ownKey : ''))
            || ownKey
            || partnerKey;
        return {
            blank,
            ownKey,
            partnerKey,
            selectedKey,
            selectedSource,
            selectedAt,
            activeKey
        };
    };

    const readCanvas = (candidate) => {
        const savedCanvas = candidate?.draft?.savedCanvas || candidate?.savedCanvas || null;
        return normalizeCanvas(savedCanvas);
    };

    const direct = readCanvas(state);
    if (direct) return direct;

    const activeChildId = String(state?.activeChildId || '').trim();
    const children = state?.children && typeof state.children === 'object' ? state.children : null;
    if (children && activeChildId && children[activeChildId]) {
        const active = readCanvas(children[activeChildId]);
        if (active) return active;
    }

    if (children) {
        for (const childId of Object.keys(children)) {
            const found = readCanvas(children[childId]);
            if (found) return found;
        }
    }

    return emptyCanvas;
}

const ROOM_SYNC_PAYLOAD_MAX_BYTES = 850 * 1024;

function safeJsonCloneForRoomSync(value, fallback = null) {
    if (value === undefined) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return fallback;
    }
}

function estimateSerializedSizeBytes(value) {
    try {
        const json = JSON.stringify(value);
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(json).length;
        }
        if (typeof Blob !== 'undefined') {
            return new Blob([json], { type: 'application/json' }).size;
        }
        return json.length * 2;
    } catch (error) {
        return Number.MAX_SAFE_INTEGER;
    }
}

function buildRoomSyncWorkspaceState(state) {
    const source = safeJsonCloneForRoomSync(state, null);
    if (!source || typeof source !== 'object') return null;

    const normalizeSavedCanvas = (savedCanvas) => {
        if (!savedCanvas || typeof savedCanvas !== 'object') return null;
        const ownKey = String(savedCanvas.ownKey || '').trim();
        const partnerKey = String(savedCanvas.partnerKey || '').trim();
        const selectedKey = String(savedCanvas.selectedKey || '').trim();
        if (!(savedCanvas.blank === true || ownKey || partnerKey || selectedKey)) return null;
        return {
            blank: savedCanvas.blank === true,
            ownKey,
            partnerKey,
            selectedKey,
            selectedSource: String(savedCanvas.selectedSource || '').trim(),
            selectedAt: String(savedCanvas.selectedAt || '').trim()
        };
    };

    const children = {};
    Object.entries(source.children || {}).forEach(([rawChildId, child]) => {
        const childId = String(rawChildId || child?.meta?.id || '').trim();
        if (!childId) return;
        const savedCanvas = normalizeSavedCanvas(child?.draft?.savedCanvas);
        children[childId] = {
            meta: safeJsonCloneForRoomSync(child?.meta, {}),
            prefs: safeJsonCloneForRoomSync(child?.prefs, {}),
            ...(savedCanvas ? { draft: { savedCanvas } } : {}),
            libraries: {
                readingStock: safeJsonCloneForRoomSync(child?.libraries?.readingStock, []),
                kanjiStock: safeJsonCloneForRoomSync(child?.libraries?.kanjiStock, []),
                savedNames: safeJsonCloneForRoomSync(child?.libraries?.savedNames, []),
                hiddenReadings: safeJsonCloneForRoomSync(child?.libraries?.hiddenReadings, [])
            }
        };
    });

    const childOrder = Array.isArray(source.childOrder)
        ? source.childOrder
            .map((childId) => String(childId || '').trim())
            .filter((childId) => childId && Object.prototype.hasOwnProperty.call(children, childId))
        : [];
    Object.keys(children).forEach((childId) => {
        if (!childOrder.includes(childId)) childOrder.push(childId);
    });

    return {
        version: Number.isFinite(Number(source.version)) ? Number(source.version) : 2,
        activeChildId: String(source.activeChildId || childOrder[0] || '').trim(),
        childOrder,
        family: {
            surnameDefault: {
                kanji: String(source.family?.surnameDefault?.kanji || '').trim(),
                reading: String(source.family?.surnameDefault?.reading || '').trim()
            },
            appSettings: {
                shareMode: String(source.family?.appSettings?.shareMode || 'auto').trim() || 'auto',
                showInappropriateKanji: source.family?.appSettings?.showInappropriateKanji === true
            }
        },
        deletedChildren: safeJsonCloneForRoomSync(source.deletedChildren, {}),
        children,
        createdAt: String(source.createdAt || '').trim(),
        updatedAt: String(source.updatedAt || source.savedAt || source.createdAt || '').trim()
    };
}

function attachRoomSyncWorkspaceState(payload, workspaceState, workspaceStateUpdatedAt) {
    const basePayload = workspaceStateUpdatedAt
        ? { ...payload, meimayStateV2UpdatedAt: workspaceStateUpdatedAt }
        : { ...payload };
    const variants = [];

    if (workspaceState && typeof workspaceState === 'object') {
        const compactWorkspaceState = buildRoomSyncWorkspaceState(workspaceState);
        if (compactWorkspaceState) {
            variants.push({
                ...basePayload,
                meimayStateV2: compactWorkspaceState
            });
        }
    }

    variants.push(basePayload);

    if (Array.isArray(basePayload.encounteredReadings) && basePayload.encounteredReadings.length > 0) {
        variants.push({
            ...basePayload,
            encounteredReadings: []
        });
    }

    for (const variant of variants) {
        if (estimateSerializedSizeBytes(variant) <= ROOM_SYNC_PAYLOAD_MAX_BYTES) {
            return variant;
        }
    }

    if (variants.length > 1) {
        console.warn('PAIRING: Room sync payload too large, trimming room sync fields');
    }

    return variants[variants.length - 1] || {
        ...payload,
        meimayStateV2UpdatedAt: workspaceStateUpdatedAt
    };
}

function getSavedSelectionKeyForSync(item) {
    if (!item) return '';
    const pairInsights = typeof window !== 'undefined' && window.MeimayPartnerInsights
        ? window.MeimayPartnerInsights
        : null;
    if (pairInsights && typeof pairInsights.buildSavedMatchKey === 'function') {
        return String(pairInsights.buildSavedMatchKey(item) || '').trim();
    }

    return buildPairingSavedNameKey(item);
}

function canonicalizeSavedNamesForSync(items, workspaceState) {
    const list = Array.isArray(items) ? items.map((item) => ({ ...(item || {}) })) : [];
    const canvas = extractSavedCanvasStateFromWorkspaceState(workspaceState);
    if (canvas.blank) {
        return list.map((item) => ({
            ...item,
            mainSelected: false,
            mainSelectedAt: ''
        }));
    }

    if (canvas.selectedSource === 'partner') return list;

    const selectedKey = canvas.selectedKey || canvas.activeKey || '';
    if (!selectedKey) return list;

    const hasSelectedItem = list.some((item) => getSavedSelectionKeyForSync(item) === selectedKey);
    if (!hasSelectedItem) {
        return list.map((item) => ({
            ...item,
            mainSelected: false,
            mainSelectedAt: ''
        }));
    }

    const now = new Date().toISOString();
    return list.map((item) => {
        const itemKey = getSavedSelectionKeyForSync(item);
        const isSelected = itemKey === selectedKey;
        return {
            ...item,
            mainSelected: isSelected,
            mainSelectedAt: isSelected ? String(item.mainSelectedAt || now).trim() : ''
        };
    });
}

const MeimayFirestorePayload = {
    _normalizeString(value) {
        return String(value == null ? '' : value).trim();
    },

    _normalizeReading(value) {
        const raw = this._normalizeString(value).split('::')[0].trim();
        if (!raw) return '';
        return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
    },

    _normalizeList(value) {
        if (!Array.isArray(value)) return [];
        return [...new Set(value.map((item) => this._normalizeString(item)).filter(Boolean))];
    },

    _normalizeExamples(value) {
        if (Array.isArray(value)) {
            return value.map((item) => this._normalizeString(item)).filter(Boolean);
        }
        const text = this._normalizeString(value);
        return text ? [text] : [];
    },

    _findKanjiMaster(kanji) {
        const target = this._normalizeString(kanji);
        if (!target || typeof master === 'undefined' || !Array.isArray(master)) return null;
        return master.find((entry) => this._normalizeString(entry?.['漢字'] || entry?.kanji) === target) || null;
    },

    _findReadingSource(reading) {
        const target = this._normalizeReading(reading);
        if (!target || typeof readingsData === 'undefined' || !Array.isArray(readingsData)) return null;
        return readingsData.find((entry) => {
            const entryReading = this._normalizeReading(entry?.reading);
            const entryAdana = this._normalizeReading(entry?.adana);
            return entryReading === target || entryAdana === target;
        }) || null;
    },

    _resolveLikedKanji(item) {
        if (typeof item === 'string') return this._normalizeString(item);
        if (Array.isArray(item) && item.length > 0 && (typeof item[0] === 'string' || typeof item[0] === 'number')) {
            return this._normalizeString(item[0]);
        }
        return this._normalizeString(
            item?.['漢字']
            || item?.['貌｡蟄･']
            || item?.['貍｢蟄・']
            || item?.kanji
            || item?.value
            || item?.char
            || item?.character
            || item?.label
        );
    },

    minifyLikedItem(item) {
        if (typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._isRemovedLikedItem === 'function' && StorageBox._isRemovedLikedItem(item)) {
            return null;
        }
        const kanji = this._resolveLikedKanji(item);
        if (!kanji) return null;
        return {
            '漢字': kanji,
            kanji,
            slot: Number.isFinite(Number(item?.slot)) ? Number(item.slot) : -1,
            sessionReading: this._normalizeString(item?.sessionReading),
            sessionSegments: Array.isArray(item?.sessionSegments) ? item.sessionSegments.slice(0, 12) : [],
            sessionDisplaySegments: Array.isArray(item?.sessionDisplaySegments) ? item.sessionDisplaySegments.slice(0, 12) : [],
            kanji_reading: this._normalizeString(item?.kanji_reading),
            isSuper: !!item?.isSuper,
            gender: this._normalizeString(item?.gender || item?.settings?.gender || 'neutral') || 'neutral',
            timestamp: item?.timestamp || item?.addedAt || item?.likedAt || null
        };
    },

    hydrateLikedItem(item, options = {}) {
        if (options.checkRemoved !== false && typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._isRemovedLikedItem === 'function' && StorageBox._isRemovedLikedItem(item)) {
            return null;
        }
        const kanji = this._resolveLikedKanji(item);
        if (!kanji) return null;
        const sourceItem = item && typeof item === 'object' && !Array.isArray(item)
            ? item
            : { kanji };
        const masterItem = this._findKanjiMaster(kanji);
        return {
            ...(masterItem || {}),
            ...sourceItem,
            '漢字': kanji,
            kanji,
            '画数': sourceItem?.['画数'] ?? sourceItem?.strokes ?? masterItem?.['画数'] ?? 1,
            '分類': sourceItem?.['分類'] ?? sourceItem?.category ?? masterItem?.['分類'] ?? '',
            kanji_reading: this._normalizeString(sourceItem?.kanji_reading || masterItem?.kanji_reading),
            slot: Number.isFinite(Number(sourceItem?.slot)) ? Number(sourceItem.slot) : -1,
            sessionReading: this._normalizeString(sourceItem?.sessionReading),
            sessionSegments: Array.isArray(sourceItem?.sessionSegments) ? [...sourceItem.sessionSegments] : [],
            sessionDisplaySegments: Array.isArray(sourceItem?.sessionDisplaySegments) ? [...sourceItem.sessionDisplaySegments] : [],
            isSuper: !!sourceItem?.isSuper,
            ownSuper: options.fromPartner ? false : !!sourceItem?.ownSuper || !!sourceItem?.isSuper,
            partnerSuper: options.fromPartner ? !!sourceItem?.partnerSuper || !!sourceItem?.isSuper : !!sourceItem?.partnerSuper,
            fromPartner: !!options.fromPartner,
            partnerAlsoPicked: !!options.partnerAlsoPicked,
            partnerName: options.partnerName || sourceItem?.partnerName || '',
            gender: this._normalizeString(sourceItem?.gender || masterItem?.gender || 'neutral') || 'neutral',
            timestamp: sourceItem?.timestamp || sourceItem?.addedAt || sourceItem?.likedAt || null
        };
    },

    minifySavedItem(item) {
        const combination = Array.isArray(item?.combination) ? item.combination : [];
        const combinationKeys = Array.isArray(item?.combinationKeys) && item.combinationKeys.length > 0
            ? item.combinationKeys.map((key) => this._normalizeString(key)).filter(Boolean)
            : combination.map((part) => this._normalizeString(part?.['漢字'] || part?.kanji)).filter(Boolean);

        return {
            fullName: this._normalizeString(item?.fullName),
            reading: this._normalizeString(item?.reading),
            givenName: this._normalizeString(item?.givenName),
            combinationKeys,
            message: this._normalizeString(item?.message),
            origin: this._normalizeString(item?.origin),
            savedAt: item?.savedAt || item?.timestamp || null,
            fromPartner: item?.fromPartner === true,
            approvedFromPartner: item?.approvedFromPartner === true,
            approvedPartnerSavedKey: canonicalizePairingSavedNameKey(this._normalizeString(item?.approvedPartnerSavedKey)),
            partnerName: this._normalizeString(item?.partnerName),
            mainSelected: item?.mainSelected === true,
            mainSelectedAt: this._normalizeString(item?.mainSelectedAt)
        };
    },

    hydrateSavedItem(item) {
        const combinationKeys = Array.isArray(item?.combinationKeys) && item.combinationKeys.length > 0
            ? item.combinationKeys.map((key) => this._normalizeString(key)).filter(Boolean)
            : (Array.isArray(item?.combination)
                ? item.combination.map((part) => this._normalizeString(part?.['漢字'] || part?.kanji)).filter(Boolean)
                : []);
        const combination = Array.isArray(item?.combination) && item.combination.length > 0
            ? item.combination.map((part) => ({ ...(part || {}) }))
            : combinationKeys.map((key) => this._findKanjiMaster(key) || { '漢字': key, '画数': 1 });

        let fortune = item?.fortune || null;
        try {
            if (!fortune && typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate && combination.length > 0) {
                const surArr = typeof surnameData !== 'undefined' && Array.isArray(surnameData) && surnameData.length > 0
                    ? surnameData
                    : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 0 }];
                const givArr = combination.map((part) => ({
                    kanji: part?.['漢字'] || part?.kanji || '',
                    strokes: parseInt(part?.['画数'] ?? part?.strokes ?? 0, 10) || 0
                })).filter((part) => part.kanji);
                if (givArr.length > 0) {
                    fortune = FortuneLogic.calculate(surArr, givArr);
                }
            }
        } catch (error) { }

        return {
            ...(item || {}),
            fullName: this._normalizeString(item?.fullName),
            reading: this._normalizeString(item?.reading),
            givenName: this._normalizeString(item?.givenName),
            combination,
            combinationKeys,
            message: this._normalizeString(item?.message),
            origin: this._normalizeString(item?.origin),
            savedAt: item?.savedAt || item?.timestamp || null,
            fortune,
            fromPartner: item?.fromPartner === true,
            approvedFromPartner: item?.approvedFromPartner === true,
            approvedPartnerSavedKey: canonicalizePairingSavedNameKey(this._normalizeString(item?.approvedPartnerSavedKey)),
            partnerName: this._normalizeString(item?.partnerName),
            mainSelected: item?.mainSelected === true,
            mainSelectedAt: this._normalizeString(item?.mainSelectedAt)
        };
    },

    minifyReadingStockItem(item) {
        const resolvedReading = typeof resolveReadingStockValue === 'function'
            ? resolveReadingStockValue(item)
            : this._normalizeString(item?.reading || item?.sessionReading || (typeof item?.id === 'string' ? item.id.split('::')[0] : ''));
        const reading = this._normalizeString(resolvedReading);
        if (!reading) return null;
        const baseReading = typeof getReadingBaseReading === 'function' ? getReadingBaseReading(reading) : reading.split('::')[0].trim();
        if (baseReading === 'INHERITED_LIBRARY' || baseReading === 'SHARED_LIBRARY') return null;
        const segments = Array.isArray(item?.segments) ? item.segments.filter(Boolean).map((segment) => this._normalizeString(segment)).filter(Boolean) : [];
        return {
            id: this._normalizeString(item?.id || (typeof getReadingStockKey === 'function' ? getReadingStockKey(reading, segments) : '')),
            reading,
            segments,
            baseNickname: this._normalizeString(item?.baseNickname),
            gender: this._normalizeString(item?.gender || 'neutral') || 'neutral',
            isSuper: !!item?.isSuper,
            ownSuper: !!item?.ownSuper,
            partnerSuper: !!item?.partnerSuper,
            source: this._normalizeString(item?.source),
            readingPromoted: !!(item?.readingPromoted || item?.promotedReading || item?.promoted || item?.source === 'reading-combination'),
            addedAt: item?.addedAt || item?.timestamp || null,
            statsTracked: item?.statsTracked !== false
        };
    },

    hydrateReadingStockItem(item) {
        const resolvedReading = typeof resolveReadingStockValue === 'function'
            ? resolveReadingStockValue(item)
            : this._normalizeString(item?.reading || item?.sessionReading || (typeof item?.id === 'string' ? item.id.split('::')[0] : ''));
        const reading = this._normalizeString(resolvedReading);
        if (!reading) return null;
        const baseReading = typeof getReadingBaseReading === 'function' ? getReadingBaseReading(reading) : reading.split('::')[0].trim();
        if (baseReading === 'INHERITED_LIBRARY' || baseReading === 'SHARED_LIBRARY') return null;
        const segments = Array.isArray(item?.segments) ? item.segments.filter(Boolean).map((segment) => this._normalizeString(segment)).filter(Boolean) : [];
        const source = this._findReadingSource(reading);
        const tags = this._normalizeList(item?.tags).length > 0 ? this._normalizeList(item.tags) : this._normalizeList(source?.tags);
        const examples = this._normalizeExamples(item?.examples).length > 0 ? this._normalizeExamples(item.examples) : this._normalizeExamples(source?.examples);
        const baseNickname = this._normalizeString(item?.baseNickname || item?.preferredLabel || source?.adana || source?.reading);
        const preferredLabel = this._normalizeString(item?.preferredLabel || source?.adana || baseNickname || reading);

        return {
            ...(item || {}),
            id: this._normalizeString(item?.id || (typeof getReadingStockKey === 'function' ? getReadingStockKey(reading, segments) : reading)),
            reading,
            segments,
            baseNickname,
            preferredLabel,
            tags,
            examples,
            gender: this._normalizeString(item?.gender || source?.gender || 'neutral') || 'neutral',
            isSuper: !!item?.isSuper,
            ownSuper: item?.ownSuper !== undefined ? !!item.ownSuper : !!item?.isSuper,
            partnerSuper: item?.partnerSuper !== undefined ? !!item.partnerSuper : false,
            source: this._normalizeString(item?.source),
            readingPromoted: !!(item?.readingPromoted || item?.promotedReading || item?.promoted || item?.source === 'reading-combination' || segments.length > 0),
            addedAt: item?.addedAt || item?.timestamp || null,
            statsTracked: item?.statsTracked !== false
        };
    },

    minifyEncounteredReading(item) {
        const reading = this._normalizeString(item?.reading || item?.key);
        const key = this._normalizeString(item?.key || reading);
        if (!key || !reading) return null;
        return {
            key,
            reading,
            seenCount: Number(item?.seenCount) || 0,
            likeCount: Number(item?.likeCount) || 0,
            nopeCount: Number(item?.nopeCount) || 0,
            monthlySeenCount: Number(item?.monthlySeenCount) || 0,
            monthlyLikeCount: Number(item?.monthlyLikeCount) || 0,
            monthlyNopeCount: Number(item?.monthlyNopeCount) || 0,
            monthlyMonthKey: this._normalizeString(item?.monthlyMonthKey),
            firstSeenAt: this._normalizeString(item?.firstSeenAt || item?.lastSeenAt),
            lastSeenAt: this._normalizeString(item?.lastSeenAt),
            lastAction: this._normalizeString(item?.lastAction),
            gender: this._normalizeString(item?.gender || 'neutral') || 'neutral',
            mode: this._normalizeString(item?.mode),
            encounterOrigin: this._normalizeString(item?.encounterOrigin),
            baseNickname: this._normalizeString(item?.baseNickname)
        };
    },

    hydrateEncounteredReading(item) {
        const reading = this._normalizeString(item?.reading || item?.key);
        const key = this._normalizeString(item?.key || reading);
        if (!key || !reading) return null;
        const source = this._findReadingSource(reading);
        const tags = this._normalizeList(item?.tags).length > 0 ? this._normalizeList(item.tags) : this._normalizeList(source?.tags);
        const examples = this._normalizeExamples(item?.examples).length > 0 ? this._normalizeExamples(item.examples) : this._normalizeExamples(source?.examples);
        const baseNickname = this._normalizeString(item?.baseNickname || item?.preferredLabel || source?.adana || '');
        const preferredLabel = this._normalizeString(item?.preferredLabel || source?.adana || baseNickname || reading);

        return {
            ...(item || {}),
            key,
            reading,
            seenCount: Number(item?.seenCount) || 0,
            likeCount: Number(item?.likeCount) || 0,
            nopeCount: Number(item?.nopeCount) || 0,
            monthlySeenCount: Number(item?.monthlySeenCount) || 0,
            monthlyLikeCount: Number(item?.monthlyLikeCount) || 0,
            monthlyNopeCount: Number(item?.monthlyNopeCount) || 0,
            monthlyMonthKey: this._normalizeString(item?.monthlyMonthKey),
            firstSeenAt: this._normalizeString(item?.firstSeenAt || item?.lastSeenAt),
            lastSeenAt: this._normalizeString(item?.lastSeenAt || item?.firstSeenAt),
            lastAction: this._normalizeString(item?.lastAction),
            gender: this._normalizeString(item?.gender || source?.gender || 'neutral') || 'neutral',
            mode: this._normalizeString(item?.mode),
            encounterOrigin: this._normalizeString(item?.encounterOrigin),
            baseNickname,
            preferredLabel,
            tags,
            examples
        };
    },

    projectSections(sections = {}) {
        const rawLiked = (Array.isArray(sections?.liked) ? sections.liked : [])
            .map((item) => this.minifyLikedItem(item))
            .filter(Boolean);
        const likedMap = new Map();
        rawLiked.forEach(item => {
            const kanji = item['漢字'] || item['\u8c8c\uff61\u87c4\uff65'] || item['\u8c8d\uff62\u87c4\u30fb'] || item.kanji;
            const key = `${kanji}::${item.slot}::${item.sessionReading}`;
            if (!likedMap.has(key)) likedMap.set(key, item);
        });

        const rawReadingStock = (Array.isArray(sections?.readingStock) ? sections.readingStock : [])
            .map((item) => this.minifyReadingStockItem(item))
            .filter(Boolean);
        const stockMap = new Map();
        rawReadingStock.forEach(item => {
            const key = item.reading || item['\u96b1\uff6d\u7e3a\uff7f'];
            if (!stockMap.has(key)) stockMap.set(key, item);
        });

        return {
            liked: Array.from(likedMap.values()),
            savedNames: (Array.isArray(sections?.savedNames) ? sections.savedNames : []).map((item) => this.minifySavedItem(item)).filter(Boolean),
            readingStock: Array.from(stockMap.values()),
            encounteredReadings: (Array.isArray(sections?.encounteredReadings) ? sections.encounteredReadings : []).map((item) => this.minifyEncounteredReading(item)).filter(Boolean)
        };
    },

    hydrateSections(sections = {}) {
        const rawLiked = (Array.isArray(sections?.liked) ? sections.liked : [])
            .map((item) => this.hydrateLikedItem(item))
            .filter(Boolean);
        const likedMap = new Map();
        rawLiked.forEach(item => {
            const kanji = item['漢字'] || item['\u8c8c\uff61\u87c4\uff65'] || item['\u8c8d\uff62\u87c4\u30fb'] || item.kanji;
            const key = `${kanji}::${item.slot}::${item.sessionReading}`;
            if (!likedMap.has(key)) likedMap.set(key, item);
        });

        const rawReadingStock = (Array.isArray(sections?.readingStock) ? sections.readingStock : [])
            .map((item) => this.hydrateReadingStockItem(item))
            .filter(Boolean);
        const stockMap = new Map();
        rawReadingStock.forEach(item => {
            const key = item.reading || item['\u96b1\uff6d\u7e3a\uff7f'];
            if (!stockMap.has(key)) stockMap.set(key, item);
        });

        return {
            liked: Array.from(likedMap.values()),
            savedNames: (Array.isArray(sections?.savedNames) ? sections.savedNames : []).map((item) => this.hydrateSavedItem(item)).filter(Boolean),
            readingStock: Array.from(stockMap.values()),
            encounteredReadings: (Array.isArray(sections?.encounteredReadings) ? sections.encounteredReadings : []).map((item) => this.hydrateEncounteredReading(item)).filter(Boolean)
        };
    }
};

window.MeimayFirestorePayload = MeimayFirestorePayload;

// ============================================================
// PAIRING - 繝ｫ繝ｼ繝繧ｳ繝ｼ繝画婿蠑上ヱ繝ｼ繝医リ繝ｼ騾｣謳ｺ
// ============================================================
const MeimayPairing = {
    roomCode: null,    // 迴ｾ蝨ｨ縺ｮ繝ｫ繝ｼ繝繧ｳ繝ｼ繝・    mySlot: null,      // 'memberA' or 'memberB'
    myRole: null,      // 'mama' or 'papa'
    partnerSlot: null, // 'memberB' or 'memberA'
    partnerUid: null,
    partnerRole: null,
    _selectedCreateRole: null,  // 繝ｫ繝ｼ繝菴懈・譎ゅ↓驕ｸ繧薙□繝ｭ繝ｼ繝ｫ
    _selectedJoinRole: null,    // 蜿ょ刈譎ゅ↓驕ｸ繧薙□繝ｭ繝ｼ繝ｫ
    _roomUnsub: null,
    _isLeavingRoom: false,

    // localStorage縺九ｉ繝ｫ繝ｼ繝諠・ｱ繧貞ｾｩ蜈・
    resumeRoom: async function () {
        const code = localStorage.getItem('meimay_room_code');
        const slot = localStorage.getItem('meimay_room_slot');
        const role = localStorage.getItem('meimay_my_role');
        if (!code || !slot || !role) return;

        this.roomCode = code;
        this.mySlot = slot;
        this.myRole = role;
        this.partnerSlot = slot === 'memberA' ? 'memberB' : 'memberA';

        // Firestore縺ｧ繝ｫ繝ｼ繝縺悟ｭ伜惠縺吶ｋ縺狗｢ｺ隱・
        try {
            const doc = await firebaseDb.collection('rooms').doc(code).get();
            if (!doc.exists) {
                console.warn('PAIRING: Saved room no longer exists, clearing');
                this._clearLocal();
                return;
            }
            const data = doc.data() || {};
            const currentUid = MeimayAuth.getCurrentUser()?.uid || firebaseAuth?.currentUser?.uid || '';
            this.mySlot = resolveRoomSlotFromDoc(data, currentUid, this.mySlot || slot);
            this.partnerSlot = this.mySlot === 'memberA' ? 'memberB' : 'memberA';
            this.myRole = data[`${this.mySlot}Role`] || role;
            this._isLeavingRoom = false;
            localStorage.setItem('meimay_room_slot', this.mySlot);
            localStorage.setItem('meimay_my_role', this.myRole || role);

            const partnerUid = data[`${this.partnerSlot}Uid`];
            const partnerRole = data[`${this.partnerSlot}Role`];
            if (partnerUid) {
                this.partnerUid = partnerUid;
                this.partnerRole = partnerRole;
                MeimayShare.listenPartnerData(partnerUid);
            }
            this._listenRoom();
            updatePairingUI();
            await this.syncMyData();
            if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
                const publicPremiumState = typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function'
                    ? PremiumManager.getPublicPremiumSnapshot()
                    : null;
                await MeimayShare.syncPremiumState(publicPremiumState);
            }
            console.log(`PAIRING: Resumed room ${code} as ${slot} (${role})`);
        } catch (e) {
            console.error('PAIRING: Resume failed', e);
        }
    },

    // 繝ｭ繝ｼ繝ｫ驕ｸ謚橸ｼ医Ν繝ｼ繝菴懈・逕ｨ・・
    selectCreateRole: function (role) {
        this._selectedCreateRole = role;
        const mamaBtn = document.getElementById('create-role-mama');
        const papaBtn = document.getElementById('create-role-papa');
        const createBtn = document.getElementById('btn-generate-code');
        if (mamaBtn) mamaBtn.classList.toggle('border-[#f4a3b9]', role === 'mama');
        if (mamaBtn) mamaBtn.classList.toggle('bg-[#fdf0f4]', role === 'mama');
        if (mamaBtn) mamaBtn.classList.toggle('border-[#eee5d8]', role !== 'mama');
        if (papaBtn) papaBtn.classList.toggle('border-[#a3b9f4]', role === 'papa');
        if (papaBtn) papaBtn.classList.toggle('bg-[#f0f4fd]', role === 'papa');
        if (papaBtn) papaBtn.classList.toggle('border-[#eee5d8]', role !== 'papa');
        if (createBtn) createBtn.disabled = false;
    },

    // 繝ｭ繝ｼ繝ｫ驕ｸ謚橸ｼ亥盾蜉逕ｨ・・
    selectJoinRole: function (role) {
        this._selectedJoinRole = role;
        const mamaBtn = document.getElementById('join-role-mama');
        const papaBtn = document.getElementById('join-role-papa');
        if (mamaBtn) mamaBtn.classList.toggle('border-[#f4a3b9]', role === 'mama');
        if (mamaBtn) mamaBtn.classList.toggle('bg-[#fdf0f4]', role === 'mama');
        if (mamaBtn) mamaBtn.classList.toggle('border-[#eee5d8]', role !== 'mama');
        if (papaBtn) papaBtn.classList.toggle('border-[#a3b9f4]', role === 'papa');
        if (papaBtn) papaBtn.classList.toggle('bg-[#f0f4fd]', role === 'papa');
        if (papaBtn) papaBtn.classList.toggle('border-[#eee5d8]', role !== 'papa');
    },

    // 繝ｫ繝ｼ繝繧呈眠隕丈ｽ懈・
    createRoom: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { showToast('サインインを待っています。', '\u23f3'); return null; }
        const role = this._selectedCreateRole || getPreferredPairingRole();
        if (!role) { showToast('先に設定でママ / パパを選んでください', '\u26a0'); return null; }
        if (this._selectedCreateRole !== role) this.selectCreateRole(role);
        const pairingSurname = getCurrentPairingSurnameState();
        if (!pairingSurname.surname) {
            showToast('苗字を入力してください', '\u26a0');
            return null;
        }

        // 6譁・ｭ励Λ繝ｳ繝繝繧ｳ繝ｼ繝・
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        try {
            await firebaseDb.collection('rooms').doc(code).set({
                memberAUid: user.uid,
                memberARole: role,
                memberASurname: pairingSurname.surname,
                memberASurnameReading: pairingSurname.reading || null,
                memberBUid: null,
                memberBRole: null,
                memberBSurname: null,
                memberBSurnameReading: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.roomCode = code;
            this.mySlot = 'memberA';
            this.myRole = role;
            this.partnerSlot = 'memberB';
            this._isLeavingRoom = false;

            localStorage.setItem('meimay_room_code', code);
            localStorage.setItem('meimay_room_slot', 'memberA');
            localStorage.setItem('meimay_my_role', role);

            this._listenRoom();
            updatePairingUI();
            await this.syncMyData();
            if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
                const publicPremiumState = typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function'
                    ? PremiumManager.getPublicPremiumSnapshot()
                    : null;
                await MeimayShare.syncPremiumState(publicPremiumState);
            }

            console.log(`PAIRING: Room created: ${code}`);
            return code;
        } catch (e) {
            console.error('PAIRING: Create room failed', e);
            showToast('ルームの作成に失敗しました', '\u26a0');
            return null;
        }
    },

    // 繧ｳ繝ｼ繝峨ｒ蜈･蜉帙＠縺ｦ繝ｫ繝ｼ繝縺ｫ蜿ょ刈
    joinRoom: async function (code) {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { showToast('サインインを待っています。', '\u23f3'); return { success: false }; }
        const role = this._selectedJoinRole || getPreferredPairingRole();
        if (!role) { showToast('先に設定でママ / パパを選んでください', '\u26a0'); return { success: false }; }
        if (this._selectedJoinRole !== role) this.selectJoinRole(role);
        if (!code || code.trim().length < 4) { showToast('コードを入力してください', '\u26a0'); return { success: false }; }

        const pairingSurname = getCurrentPairingSurnameState();
        if (!pairingSurname.surname) {
            return { success: false, error: '苗字を入力してください' };
        }

        const upperCode = code.trim().toUpperCase();

        try {
            const roomDoc = await firebaseDb.collection('rooms').doc(upperCode).get();
            if (!roomDoc.exists) {
                return { success: false, error: 'コードが見つかりません' };
            }

            const data = roomDoc.data();
            const partnerSlot = 'memberA';
            const partnerUid = data[`${partnerSlot}Uid`] || '';
            const partnerSurnameField = getPairingRoomSurnameField(partnerSlot);
            const partnerSurnameReadingField = getPairingRoomSurnameReadingField(partnerSlot);
            let partnerSurname = normalizePairingSurnameValue(data[partnerSurnameField]);
            let partnerSurnameReading = normalizePairingSurnameValue(data[partnerSurnameReadingField]);
            if (!partnerSurname && partnerUid) {
                try {
                    const partnerDataDoc = await firebaseDb.collection('rooms').doc(upperCode)
                        .collection('data').doc(partnerUid).get();
                    if (partnerDataDoc.exists) {
                        const partnerData = partnerDataDoc.data() || {};
                        partnerSurname = normalizePairingSurnameValue(
                            partnerData.surname || partnerData.surnameStr || partnerData?.wizard?.surname || ''
                        );
                        partnerSurnameReading = normalizePairingSurnameValue(
                            partnerData.surnameReading || partnerData?.wizard?.surnameReading || ''
                        );
                    }
                } catch (error) {
                    console.warn('PAIRING: Partner surname lookup failed', error);
                }
            }

            if (data.memberAUid === user.uid) {
                return { success: false, error: '自分のルームです' };
            }
            if (data.memberBUid && data.memberBUid !== user.uid) {
                return { success: false, error: 'このルームは満員です' };
            }

            // memberB縺ｨ縺励※蜿ょ刈
            if (pairingSurname.surname !== partnerSurname) {
                return { success: false, error: '苗字が一致しません' };
            }

            await firebaseDb.collection('rooms').doc(upperCode).update({
                memberBUid: user.uid,
                memberBRole: role,
                memberBSurname: pairingSurname.surname,
                memberBSurnameReading: pairingSurname.reading || null
            });

            this.roomCode = upperCode;
            this.mySlot = 'memberB';
            this.myRole = role;
            this.partnerSlot = 'memberA';
            this.partnerUid = data.memberAUid;
            this.partnerRole = data.memberARole;
            this._isLeavingRoom = false;

            localStorage.setItem('meimay_room_code', upperCode);
            localStorage.setItem('meimay_room_slot', 'memberB');
            localStorage.setItem('meimay_my_role', role);

            this._listenRoom();
            MeimayShare.listenPartnerData(this.partnerUid);
            updatePairingUI();
            await this.syncMyData();
            if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.syncPremiumState === 'function') {
                const publicPremiumState = typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function'
                    ? PremiumManager.getPublicPremiumSnapshot()
                    : null;
                await MeimayShare.syncPremiumState(publicPremiumState);
            }

            console.log(`PAIRING: Joined room ${upperCode}`);
            return { success: true };
        } catch (e) {
            console.error('PAIRING: Join room failed', e);
            return { success: false, error: '参加に失敗しました' };
        }
    },

    // 繝ｫ繝ｼ繝繧帝蜃ｺ・磯｣謳ｺ隗｣髯､・・
    leaveRoom: async function () {
        if (!this.roomCode) return;
        this._isLeavingRoom = true;
        const user = MeimayAuth.getCurrentUser();
        const roomCode = this.roomCode;
        const roomRef = firebaseDb.collection('rooms').doc(roomCode);
        const mySlot = this.mySlot;

        // まず画面だけは確実に戻す。以降の後処理で例外が出ても見た目は変える。
        try {
            this._stopListening();
        } catch (e) {
            console.warn('PAIRING: Stop listening failed during leave', e);
        }

        this.roomCode = null;
        this.mySlot = null;
        this.myRole = null;
        this.partnerSlot = null;
        this.partnerUid = null;
        this.partnerRole = null;
        localStorage.removeItem('meimay_room_code');
        localStorage.removeItem('meimay_room_slot');
        localStorage.removeItem('meimay_my_role');

        if (typeof MeimayShare !== 'undefined') {
            MeimayShare.partnerSnapshot = { liked: [], savedNames: [], readingStock: [], encounteredReadings: [], hiddenReadings: [], likedRemoved: [], meimayBackup: null, backup: null, partnerUserBackup: null, role: null, displayName: '', username: '', nickname: '', themeId: '' };
        }

        if (typeof changeScreen === 'function') {
            changeScreen('scr-login');
        }
        updatePairingUI();

        try {
            cleanupLegacyPartnerLocalData();
        } catch (e) {
            console.warn('PAIRING: Cleanup failed during leave', e);
        }

        try {
            const roomDoc = await roomRef.get();
            const roomData = roomDoc.exists ? (roomDoc.data() || {}) : {};

            if (user) {
                await roomRef.collection('data').doc(user.uid).delete();
            }

            const currentUid = user?.uid || firebaseAuth?.currentUser?.uid || '';
            let slotToClear = '';
            if (currentUid && roomData.memberAUid === currentUid) {
                slotToClear = 'memberA';
            } else if (currentUid && roomData.memberBUid === currentUid) {
                slotToClear = 'memberB';
            } else if (mySlot === 'memberA' || mySlot === 'memberB') {
                slotToClear = mySlot;
            } else {
                slotToClear = resolveRoomSlotFromDoc(roomData, currentUid, 'memberA');
            }

            const update = {};
            update[`${slotToClear}Uid`] = null;
            update[`${slotToClear}Role`] = null;
            update[`${slotToClear}Surname`] = null;
            update[`${slotToClear}SurnameReading`] = null;
            await roomRef.set(update, { merge: true });
        } catch (e) {
            console.error('PAIRING: Leave room failed', e);
        } finally {
            this._isLeavingRoom = false;
            console.log('PAIRING: Left room');
        }
    },

    // 閾ｪ蛻・・繝・・繧ｿ繧偵Ν繝ｼ繝縺ｫ繧｢繝・・繝ｭ繝ｼ繝会ｼ亥酔譛滂ｼ・
    syncMyData: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user || !this.roomCode || this._isLeavingRoom) return;

        try {
            const hiddenReadings = readNormalizedHiddenReadings();
            const pairingSurname = getCurrentPairingSurnameState();
            const projectedSections = MeimayFirestorePayload.projectSections({
                liked: typeof liked !== 'undefined' ? liked : [],
                savedNames: JSON.parse(localStorage.getItem('meimay_saved') || '[]')
            });

            await firebaseDb.collection('rooms').doc(this.roomCode)
                .collection('data').doc(user.uid).set({
                role: this.myRole,
                liked: projectedSections.liked,
                savedNames: projectedSections.savedNames,
                hiddenReadings,
                surname: pairingSurname.surname,
                surnameReading: pairingSurname.reading,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            const roomSurnameField = getPairingRoomSurnameField(this.mySlot);
            const roomSurnameReadingField = getPairingRoomSurnameReadingField(this.mySlot);
            if (roomSurnameField) {
                await firebaseDb.collection('rooms').doc(this.roomCode).set({
                    [roomSurnameField]: pairingSurname.surname || null,
                    [roomSurnameReadingField]: pairingSurname.reading || null
                }, { merge: true });
            }

            console.log('PAIRING: Synced my data to room');
        } catch (e) {
            console.error('PAIRING: Sync data failed', e);
        }
    },

    // Web Share API 縺ｧ繝ｫ繝ｼ繝繧ｳ繝ｼ繝峨ｒ蜈ｱ譛・
    shareCode: function () {
        if (!this.roomCode) return;
        const partnerRoleLabel = this.myRole === 'mama' ? 'パパ' : 'ママ';
        const text = `メイメイで名前づけのコードを共有します。\n${partnerRoleLabel}はこのコードを入力してください。\n\nルームコード: ${this.roomCode}`;

        if (navigator.share) {
            navigator.share({
                title: 'メイメイ - 名前づけのコードを共有',
                text: text
            }).catch(() => {});
        } else {
            navigator.clipboard?.writeText(this.roomCode).then(() => {
                showToast('コードをコピーしました', '\u2713');
            }).catch(() => {
                showToast(`コード: ${this.roomCode}`, '\u2713');
            });
        }
    },

    // 繝ｫ繝ｼ繝繝峨く繝･繝｡繝ｳ繝医ｒ繝ｪ繧｢繝ｫ繧ｿ繧､繝逶｣隕・
    _listenRoom: function () {
        if (!this.roomCode) return;
        this._stopListeningRoom();

        this._roomUnsub = firebaseDb.collection('rooms').doc(this.roomCode)
            .onSnapshot((doc) => {
                if (!doc.exists) return;
                const data = doc.data() || {};
                const currentUid = MeimayAuth.getCurrentUser()?.uid || firebaseAuth?.currentUser?.uid || '';
                const storedMySlot = this.mySlot || (this.partnerSlot === 'memberA' ? 'memberB' : 'memberA');
                const nextMySlot = resolveRoomSlotFromDoc(data, currentUid, storedMySlot);
                const nextPartnerSlot = nextMySlot === 'memberA' ? 'memberB' : 'memberA';
                const nextMyRole = data[`${nextMySlot}Role`] || this.myRole || null;
                const partnerUid = data[`${nextPartnerSlot}Uid`];
                const partnerRole = data[`${nextPartnerSlot}Role`];

                if (nextMySlot !== this.mySlot) {
                    this.mySlot = nextMySlot;
                    this.partnerSlot = nextPartnerSlot;
                    localStorage.setItem('meimay_room_slot', nextMySlot);
                }
                this.partnerSlot = nextPartnerSlot;
                if (nextMyRole && nextMyRole !== this.myRole) {
                    this.myRole = nextMyRole;
                    localStorage.setItem('meimay_my_role', nextMyRole);
                }

                if (partnerUid && partnerUid !== this.partnerUid) {
                    // 繝代・繝医リ繝ｼ縺悟盾蜉縺励◆
                    this.partnerUid = partnerUid;
                    this.partnerRole = partnerRole;
                    MeimayShare.listenPartnerData(partnerUid);
                    updatePairingUI();
                     showToast('パートナーが連携しました', '\u2713');
                    console.log(`PAIRING: Partner joined (${partnerRole})`);
                } else if (!partnerUid && this.partnerUid) {
                    // 繝代・繝医リ繝ｼ縺碁螳､縺励◆
                    this.partnerUid = null;
                    this.partnerRole = null;
                    MeimayShare.stopListening();
                    updatePairingUI();
                    showToast('パートナーとの連携が解除されました', '\u2713');
                    console.log('PAIRING: Partner left');
                }
            }, (e) => {
                console.warn('PAIRING: Room listen error', e);
            });
    },

    _stopListeningRoom: function () {
        if (this._roomUnsub) {
            this._roomUnsub();
            this._roomUnsub = null;
        }
    },

    _stopListening: function () {
        this._stopListeningRoom();
        MeimayShare.stopListening();
        this.partnerUid = null;
        this.partnerRole = null;
    },

    _clearLocal: function () {
        this.roomCode = null;
        this.mySlot = null;
        this.myRole = null;
        this.partnerSlot = null;
        localStorage.removeItem('meimay_room_code');
        localStorage.removeItem('meimay_room_slot');
        localStorage.removeItem('meimay_my_role');
    }
};

// ============================================================
// SHARE - 繝ｫ繝ｼ繝邨檎罰縺ｮ繝・・繧ｿ蜈ｱ譛・// ============================================================
const MeimayShare = {
    _partnerUnsub: null,
    partnerSnapshot: { liked: [], savedNames: [], hiddenReadings: [], role: null },

    // 繝代・繝医リ繝ｼ縺ｮ繝・・繧ｿ繧偵Μ繧｢繝ｫ繧ｿ繧､繝蜿嶺ｿ｡
    listenPartnerData: function (partnerUid) {
        if (!partnerUid || !MeimayPairing.roomCode) return;
        this.stopListening();

        this._partnerUnsub = firebaseDb.collection('rooms').doc(MeimayPairing.roomCode)
            .collection('data').doc(partnerUid)
            .onSnapshot((doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                const likedRemovalSource = Array.isArray(data.meimayBackup?.likedRemoved) && data.meimayBackup.likedRemoved.length > 0
                    ? data.meimayBackup.likedRemoved
                    : (Array.isArray(data.likedRemoved) ? data.likedRemoved : []);
                const filterRemoved = (items, removalSource = likedRemovalSource) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
                    ? StorageBox._filterRemovedLikedItems(items, removalSource)
                    : (Array.isArray(items) ? items.filter(Boolean) : []);
                const prevSnapshot = this.partnerSnapshot || {};
                this.partnerSnapshot = {
                    liked: filterRemoved(Array.isArray(data.liked) ? data.liked : [], likedRemovalSource),
                    savedNames: Array.isArray(data.savedNames) ? data.savedNames : [],
                    hiddenReadings: readNormalizedHiddenReadingsFromSnapshot(data.hiddenReadings),
                    likedRemoved: Array.isArray(likedRemovalSource) ? likedRemovalSource : [],
                    role: data.role || null,
                    // 子ワークスペース情報は上書きせず引き継ぐ（applyRemoteRootSnapshot等で設定される）
                    meimayStateV2: data.meimayStateV2 || prevSnapshot.meimayStateV2 || null,
                    meimayBackup: data.meimayBackup || prevSnapshot.meimayBackup || null,
                    backup: data.meimayBackup || prevSnapshot.backup || null,
                    partnerUserBackup: prevSnapshot.partnerUserBackup || null,
                    premiumState: prevSnapshot.premiumState || null,
                    displayName: String(data.displayName || prevSnapshot.displayName || '').trim(),
                    username: String(data.username || prevSnapshot.username || '').trim(),
                    nickname: String(data.nickname || prevSnapshot.nickname || '').trim(),
                    themeId: String(data.themeId || prevSnapshot.themeId || '').trim()
                };
                const partnerLabel = data.role === 'mama' ? 'ママ' : 'パパ';
                if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();

                const filteredLiked = filterRemoved(Array.isArray(data.liked) ? data.liked : [], likedRemovalSource);
                if (filteredLiked.length > 0) {
                    const added = this.mergeSharedLiked(filteredLiked, partnerLabel);
                    if (added > 0) {
                        showToast(`${partnerLabel}のストック ${added}件を取り込みました`, '\u2713');
                    }
                }

                if (data.savedNames && data.savedNames.length > 0) {
                    const added = this.mergeSharedSaved(data.savedNames, partnerLabel);
                    if (added > 0) {
                        showToast(`${partnerLabel}の保存候補 ${added}件を取り込みました`, '\u2713');
                    }
                }
            }, (e) => {
                console.warn('SHARE: Listen partner data error', e);
            });

        console.log('SHARE: Listening for partner data');
    },

    stopListening: function () {
        if (this._partnerUnsub) {
            this._partnerUnsub();
            this._partnerUnsub = null;
        }
        this.partnerSnapshot = { liked: [], savedNames: [], hiddenReadings: [], likedRemoved: [], meimayBackup: null, backup: null, partnerUserBackup: null, role: null };
        if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    },

    // 繧ｹ繝医ャ繧ｯ貍｢蟄励ｒ繝ｫ繝ｼ繝縺ｫ蜈ｱ譛会ｼ・ 閾ｪ蛻・・繝・・繧ｿ繧偵Ν繝ｼ繝縺ｫ蜷梧悄・・
    shareLiked: async function (silent = false) {
        if (!MeimayPairing.roomCode) {
            if (!silent) showToast('パートナーと連携してください', '\u26a0');
            return;
        }
        await MeimayPairing.syncMyData();
        if (!silent) showToast('ストックを共有しました', '\u2713');
    },

    // 菫晏ｭ伜錐蜑阪ｒ繝ｫ繝ｼ繝縺ｫ蜈ｱ譛・
    shareSavedNames: async function (silent = false) {
        if (!MeimayPairing.roomCode) {
            if (!silent) showToast('パートナーと連携してください', '\u26a0');
            return;
        }
        await MeimayPairing.syncMyData();
        if (!silent) showToast('保存候補を共有しました', '\u2713');
    },

    // パートナーの共有likedを受けリpartnerSnapshotに反映する。
    // 小注意: 以前は liked 配列に直接插入していたが、
    //   - sync₊④⑥renderの無限ループ「 mergeSharedLiked → StorageBox.saveLiked
    //     → queuePartnerStockSync → syncMyData → Firestore更新
    //     → listenPartnerData再発火 → mergeSharedLiked 」の原因だった
    //   - liked配列にパートナーデータを混入すると子ワークスペース切替時に消える
    //   - getMergedLikedCandidates() が partnerSnapshot.liked を直接参照するのでマージ不要
    mergeSharedLiked: function (items, partnerName) {
        if (typeof liked === 'undefined') return 0;
        const hiddenSet = new Set(readNormalizedHiddenReadingsFromSnapshot(MeimayShare.partnerSnapshot?.hiddenReadings || []));
        const sourceItems = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
            ? StorageBox._filterRemovedLikedItems(Array.isArray(items) ? items : [])
            : (Array.isArray(items) ? items : []);
        // partnerSnapshotを更新するのみ。liked配列からは完全に分離する。
        // UI側は getMergedLikedCandidates() で partnerSnapshot.liked を参照する。
        const validPartnerItems = sourceItems.filter(item => {
            if (!item) return false;
            const readingKey = normalizeHiddenReadingKey(item?.sessionReading || item?.reading || '');
            if (readingKey && hiddenSet.has(readingKey)) return false;
            return true;
        });
        // partnerSnapshotのlikesは listenPartnerData内で設定済みなので追加のカウント返回は不要
        // renderStock側で partnerFocus機能により表示するので、ここでは 0 を返す
        if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
        return 0;
    },

    // 蜿嶺ｿ｡菫晏ｭ伜錐蜑阪ｒ繝ｭ繝ｼ繧ｫ繝ｫ縺ｫ繝槭・繧ｸ
    mergeSharedSaved: function (items, partnerName) {
        try {
            const local = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
            const surArr = typeof surnameData !== 'undefined' && surnameData.length > 0
                ? surnameData
                : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 0 }];
            let added = 0;
            items.forEach(item => {
                const itemKey = this.buildSavedMatchKey(item);
                const exists = itemKey ? local.some(l => this.buildSavedMatchKey(l) === itemKey) : false;
                if (!exists) {
                    let combination = [];
                    if (item.combinationKeys && typeof master !== 'undefined') {
                        combination = item.combinationKeys.map(k => {
                            const found = master.find(m => m['漢字'] === k);
                            return found || { '漢字': k, '画数': 1 };
                        });
                    }
                    let fortune = null;
                    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate && combination.length > 0) {
                        const givArr = combination.map(p => ({
                            kanji: p['漢字'],
                            strokes: parseInt(p['画数']) || 0
                        }));
                        fortune = FortuneLogic.calculate(surArr, givArr);
                    }
                    local.push({
                        fullName: item.fullName,
                        reading: item.reading,
                        givenName: item.givenName,
                        combination: combination,
                        fortune: fortune,
                        message: item.message,
                        savedAt: item.savedAt,
                        fromPartner: true,
                        partnerName: partnerName || '繝代・繝医リ繝ｼ',
                        approvedFromPartner: item?.approvedFromPartner === true,
                        approvedPartnerSavedKey: this._normalizeString(item?.approvedPartnerSavedKey),
                        mainSelected: item?.mainSelected === true,
                        mainSelectedAt: this._normalizeString(item?.mainSelectedAt)
                    });
                    added++;
                }
            });
            if (added > 0) {
                if (typeof savedNames !== 'undefined') savedNames = local;
                if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveSavedNames === 'function') {
                    // skipPartnerSync: true でパートナー同期ループを防止
                    StorageBox.saveSavedNames({ skipPartnerSync: true });
                } else {
                    localStorage.setItem('meimay_saved', JSON.stringify(local));
                    if (local.length === 0) {
                        localStorage.setItem('meimay_saved_cleared_at', new Date().toISOString());
                    } else {
                        localStorage.removeItem('meimay_saved_cleared_at');
                    }
                }
                if (typeof renderSavedScreen === 'function' &&
                    document.getElementById('scr-saved')?.classList.contains('active')) {
                    renderSavedScreen();
                }
            }
            if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
            return added;
        } catch (e) {
            console.error('SHARE: Merge saved failed', e);
            return 0;
        }
    }
};

function refreshPartnerAwareUI() {
    if (typeof applyProfileTheme === 'function') applyProfileTheme();
    if (typeof renderHomeProfile === 'function' && document.getElementById('scr-mode')) {
        renderHomeProfile();
    }
    if (typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces && typeof MeimayChildWorkspaces.renderSwitchers === 'function') {
        MeimayChildWorkspaces.renderSwitchers();
    }
    if (typeof renderSavedScreen === 'function' && document.getElementById('scr-saved')?.classList.contains('active')) {
        renderSavedScreen();
    }
    if (typeof renderSettingsScreen === 'function' && document.getElementById('scr-settings')?.classList.contains('active')) {
        renderSettingsScreen();
    }
}

const MeimayPartnerInsights = {
    normalizeReading: function (value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const target = text.includes(' ') ? text.split(' ').pop() : text;
        return (typeof toHira === 'function' ? toHira(target) : target).replace(/\s+/g, '');
    },

    buildLikedMatchKey: function (item) {
        const kanji = item?.['漢字'] || item?.['貌｡蟄･'] || item?.kanji || '';
        if (!kanji) return '';
        return `kanji::${kanji}`;
    },

    buildSavedMatchKey: function (item) {
        return buildPairingSavedNameKey(item);
    },

    _safeClone: function (value) {
        if (value == null || typeof value !== 'object') return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            if (Array.isArray(value)) {
                return value.map((item) => this._safeClone(item));
            }
            return { ...value };
        }
    },

    getOwnHiddenReadingSet: function () {
        return new Set(readNormalizedHiddenReadings());
    },

    _getPartnerChildContext: function () {
        const manager = typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces
            ? MeimayChildWorkspaces
            : null;
        const context = {
            manager,
            activeChild: null,
            partnerRoot: null,
            partnerChild: null,
            partnerChildCount: 0,
            localChildCount: 0,
            requiresScopedChild: false
        };
        if (!manager) return context;

        try {
            const localRoot = manager.root && typeof manager.root === 'object'
                ? manager.root
                : (typeof manager.getRootSnapshot === 'function' ? manager.getRootSnapshot() : null);
            const localChildren = localRoot?.children && typeof localRoot.children === 'object'
                ? localRoot.children
                : {};
            const localChildCount = Array.isArray(localRoot?.childOrder) && localRoot.childOrder.length > 0
                ? localRoot.childOrder.length
                : Object.keys(localChildren).length;
            const activeChild = typeof manager.getActiveChild === 'function'
                ? manager.getActiveChild()
                : null;
            const partnerRoot = typeof manager.getPartnerWorkspaceRoot === 'function'
                ? manager.getPartnerWorkspaceRoot()
                : null;
            const partnerChildren = partnerRoot?.children && typeof partnerRoot.children === 'object'
                ? partnerRoot.children
                : {};
            const partnerChildCount = Array.isArray(partnerRoot?.childOrder) && partnerRoot.childOrder.length > 0
                ? partnerRoot.childOrder.length
                : Object.keys(partnerChildren).length;
            const partnerChild = activeChild && typeof manager.getPartnerChildForChild === 'function'
                ? manager.getPartnerChildForChild(activeChild)
                : null;
            const activeBirthOrder = Number(activeChild?.meta?.birthOrder || activeChild?.birthOrder || 1);
            const activeTwinIndex = activeChild?.meta?.birthGroupIndex
                ?? activeChild?.meta?.twinIndex
                ?? activeChild?.birthGroupIndex
                ?? activeChild?.twinIndex
                ?? null;

            return {
                manager,
                activeChild,
                partnerRoot,
                partnerChild,
                partnerChildCount,
                localChildCount,
                requiresScopedChild: !!activeChild && (
                    localChildCount > 1
                    || activeBirthOrder > 1
                    || !(activeTwinIndex === null || activeTwinIndex === undefined || activeTwinIndex === '')
                )
            };
        } catch (error) {
            console.warn('PAIRING: Failed to resolve partner child context', error);
            return context;
        }
    },

    _shouldSuppressUnscopedPartnerFallback: function () {
        const context = this._getPartnerChildContext();
        return !!(context.requiresScopedChild && !context.partnerChild);
    },

    _shouldUseScopedPartnerChildOnly: function () {
        const context = this._getPartnerChildContext();
        return !!(context.requiresScopedChild && context.partnerChild && context.partnerChildCount > 1);
    },

    _getPartnerChildRecord: function () {
        const context = this._getPartnerChildContext();
        if (context.partnerChild && typeof context.partnerChild === 'object') return context.partnerChild;
        if (context.requiresScopedChild) return null;
        const activeChildId = String(context.partnerRoot?.activeChildId || '').trim();
        const partnerChild = activeChildId && context.partnerRoot?.children?.[activeChildId]
            ? context.partnerRoot.children[activeChildId]
            : null;
        if (partnerChild && typeof partnerChild === 'object') return partnerChild;
        return null;
    },

    _getPartnerChildLibraries: function () {
        const partnerChild = this._getPartnerChildRecord();
        return partnerChild?.libraries && typeof partnerChild.libraries === 'object'
            ? partnerChild.libraries
            : null;
    },

    getPartnerHiddenReadingSet: function () {
        const partnerLibraries = this._getPartnerChildLibraries();
        if (this._shouldUseScopedPartnerChildOnly()) {
            return new Set(readNormalizedHiddenReadingsFromSnapshot(partnerLibraries?.hiddenReadings || []));
        }
        if (partnerLibraries && Array.isArray(partnerLibraries.hiddenReadings)) {
            return new Set(readNormalizedHiddenReadingsFromSnapshot(partnerLibraries.hiddenReadings));
        }
        if (this._shouldSuppressUnscopedPartnerFallback()) {
            return new Set();
        }
        const snapshot = MeimayShare.partnerSnapshot || {};
        const backup = snapshot.partnerUserBackup || snapshot.meimayBackup || snapshot.backup || {};
        const hiddenReadings = Array.isArray(snapshot.hiddenReadings) && snapshot.hiddenReadings.length > 0
            ? snapshot.hiddenReadings
            : (Array.isArray(backup.hiddenReadings) ? backup.hiddenReadings : []);
        return new Set(readNormalizedHiddenReadingsFromSnapshot(hiddenReadings));
    },

    _isHiddenReadingItem: function (item, hiddenSet) {
        const reading = this.normalizeReading(item?.sessionReading || item?.reading || '');
        return !!reading && hiddenSet.has(reading);
    },

    _isImportedLibraryItem: function (item) {
        const sessionReading = this.normalizeReading(item?.sessionReading || item?.reading || '');
        const importedFromChildId = String(item?.importedFromChildId || '').trim();
        return sessionReading === 'INHERITED_LIBRARY'
            || sessionReading === 'SHARED_LIBRARY'
            || importedFromChildId.length > 0;
    },

    getOwnLiked: function () {
        const hiddenSet = this.getOwnHiddenReadingSet();
        const filteredLiked = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
            ? StorageBox._filterRemovedLikedItems(typeof liked !== 'undefined' ? liked : [])
            : (typeof liked !== 'undefined' ? liked : []);
        return filteredLiked.filter(item => !item?.fromPartner && !this._isHiddenReadingItem(item, hiddenSet) && !this._isImportedLibraryItem(item));
    },

    getPartnerLiked: function () {
        const hiddenSet = this.getPartnerHiddenReadingSet();
        const partnerLiked = this.getPartnerLikedRaw();
        return partnerLiked.filter(item => !this._isHiddenReadingItem(item, hiddenSet));
    },

    getPartnerLikedRaw: function () {
        if (this._shouldSuppressUnscopedPartnerFallback()) {
            return [];
        }
        const snapshot = MeimayShare.partnerSnapshot || {};
        const backup = snapshot.partnerUserBackup || snapshot.meimayBackup || snapshot.backup || {};
        const likedRemovalSource = Array.isArray(snapshot.likedRemoved) && snapshot.likedRemoved.length > 0
            ? snapshot.likedRemoved
            : (Array.isArray(backup.likedRemoved) ? backup.likedRemoved : []);
        const filterRemoved = (items) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
            ? StorageBox._filterRemovedLikedItems(items, likedRemovalSource)
            : (Array.isArray(items) ? items.filter(Boolean) : []);
        const normalizeLikedItems = (items, sourceLabel) => {
            const filtered = filterRemoved(items);
            const normalized = filtered.map((item) => {
                if (typeof MeimayFirestorePayload !== 'undefined' && MeimayFirestorePayload && typeof MeimayFirestorePayload.hydrateLikedItem === 'function') {
                    return MeimayFirestorePayload.hydrateLikedItem(item, { fromPartner: true, checkRemoved: false });
                }
                return item;
            }).filter((item) => {
                if (!item) return false;
                const kanji = String(item?.kanji || item?.['漢字'] || '').trim();
                return !!kanji && Array.from(kanji).length === 1;
            });
            if (filtered.length > 0 && normalized.length === 0) {
                console.warn('PAIRING: Partner liked items could not be normalized for stock view', {
                    source: sourceLabel,
                    count: filtered.length,
                    sample: filtered.slice(0, 3)
                });
            }
            return normalized;
        };
        const partnerLibraries = this._getPartnerChildLibraries();
        if (this._shouldUseScopedPartnerChildOnly()) {
            return normalizeLikedItems(partnerLibraries?.kanjiStock || [], 'child-library');
        }
        // 子ワークスペースのライブラリが存在し、かつデータがある場合のみ使用（空なら flat フォールバックへ）
        if (partnerLibraries && Array.isArray(partnerLibraries.kanjiStock) && partnerLibraries.kanjiStock.length > 0) {
            return normalizeLikedItems(partnerLibraries.kanjiStock, 'child-library');
        }
        const backupLiked = Array.isArray(backup.liked)
            ? normalizeLikedItems(backup.liked, 'backup-liked')
            : [];
        const snapshotLiked = normalizeLikedItems(snapshot.liked, 'snapshot-liked');
        if (snapshotLiked.length > 0) {
            return snapshotLiked;
        }
        if (backupLiked.length > 0) {
            return backupLiked;
        }
        return [];
    },

    getOwnSaved: function () {
        const list = typeof getSavedNames === 'function'
            ? getSavedNames()
            : JSON.parse(localStorage.getItem('meimay_saved') || '[]');
        return list;
    },

    getPartnerSaved: function () {
        const partnerLibraries = this._getPartnerChildLibraries();
        if (this._shouldUseScopedPartnerChildOnly()) {
            return Array.isArray(partnerLibraries?.savedNames) ? partnerLibraries.savedNames : [];
        }
        // 子ワークスペースのライブラリが存在し、かつデータがある場合のみ使用（空なら flat フォールバックへ）
        if (partnerLibraries && Array.isArray(partnerLibraries.savedNames) && partnerLibraries.savedNames.length > 0) {
            return partnerLibraries.savedNames;
        }
        if (this._shouldSuppressUnscopedPartnerFallback()) {
            return [];
        }
        const snapshot = MeimayShare.partnerSnapshot || {};
        const backup = snapshot.partnerUserBackup || snapshot.meimayBackup || snapshot.backup || {};
        if (Array.isArray(snapshot.savedNames) && snapshot.savedNames.length > 0) {
            return snapshot.savedNames;
        }
        if (Array.isArray(backup.savedNames) && backup.savedNames.length > 0) {
            return backup.savedNames;
        }
        return [];
    },

    getMatchedLikedItems: function () {
        const partnerLiked = this.getPartnerLiked
            ? this.getPartnerLiked()
            : (this.getPartnerLikedRaw ? this.getPartnerLikedRaw() : []);
        const partnerKeys = new Set(partnerLiked.map(item => this.buildLikedMatchKey(item)).filter(Boolean));
        const seenKeys = new Set();
        return this.getOwnLiked().filter(item => {
            const key = this.buildLikedMatchKey(item);
            if (!key || !partnerKeys.has(key) || seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
    },

    isLikedItemMatched: function (item) {
        const key = this.buildLikedMatchKey(item);
        if (!key) return false;
        const partnerLiked = this.getPartnerLiked
            ? this.getPartnerLiked()
            : (this.getPartnerLikedRaw ? this.getPartnerLikedRaw() : []);
        const partnerKeys = new Set(partnerLiked.map(entry => this.buildLikedMatchKey(entry)).filter(Boolean));
        return partnerKeys.has(key);
    },

    getMatchedSavedItems: function () {
        const partnerItems = this.getPartnerSaved();
        const ownItems = this.getOwnSaved();
        const ownOverrideKey = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
            ? window.__meimaySavedCanvasOwnKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : '');
        const ownCandidates = ownItems.slice();
        if (ownOverrideKey) {
            const overrideItem = ownItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === ownOverrideKey);
            if (overrideItem && !ownCandidates.some(item => this.buildSavedMatchKey(item) === ownOverrideKey)) {
                ownCandidates.push(overrideItem);
            }
        }
        const partnerKeys = new Set(partnerItems.map(item => this.buildSavedMatchKey(item)).filter(Boolean));
        const seenKeys = new Set();
        return ownCandidates.filter(item => {
            const key = this.buildSavedMatchKey(item);
            if (!key || !partnerKeys.has(key) || seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
    },

    isSavedItemMatched: function (item) {
        const key = this.buildSavedMatchKey(item);
        if (!key) return false;
        const matchedKeys = new Set(this.getMatchedSavedItems().map(entry => this.buildSavedMatchKey(entry)).filter(Boolean));
        return matchedKeys.has(key);
    },

    getSummary: function () {
        const matchedLikedItems = this.getMatchedLikedItems();
        const matchedSavedItems = this.getMatchedSavedItems();
        const partnerLabel = MeimayPairing.partnerRole === 'mama' ? '繝槭・' : MeimayPairing.partnerRole === 'papa' ? '繝代ヱ' : '繝代・繝医リ繝ｼ';
        const previewLabels = [
            ...matchedSavedItems.slice(0, 2).map(item => item.givenName || item.fullName || ''),
            ...matchedLikedItems.slice(0, 3).map(item => item['漢字'] || '')
        ].filter(Boolean).slice(0, 4);

        return {
            inRoom: !!MeimayPairing.roomCode,
            hasPartner: !!MeimayPairing.partnerUid,
            partnerLabel: partnerLabel,
            matchedKanjiCount: matchedLikedItems.length,
            matchedNameCount: matchedSavedItems.length,
            matchedLikedItems: matchedLikedItems,
            matchedSavedItems: matchedSavedItems,
            previewLabels: previewLabels
        };
    },

    getOwnMainSavedItem: function () {
        const blankCanvas = typeof window !== 'undefined' && (
            window.__meimaySavedCanvasBlank === true ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('meimay_saved_canvas_blank') === '1')
        );
        if (blankCanvas) return null;
        const ownItems = this.getOwnSaved();
        const partnerItems = this.getPartnerSaved();
        const overrideKey = canonicalizePairingSavedNameKey(typeof window !== 'undefined' && typeof window.__meimaySavedCanvasOwnKey === 'string' && window.__meimaySavedCanvasOwnKey
            ? window.__meimaySavedCanvasOwnKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_own_key') || '') : ''));
        if (overrideKey) {
            const overrideItem = ownItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === overrideKey)
                || partnerItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === overrideKey);
            if (overrideItem) return overrideItem;
        }

        const items = ownItems.filter(item => item?.mainSelected && !item?.fromPartner && !item?.approvedFromPartner);
        if (items.length === 0) return null;
        return items.slice().sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;
    },

    getPartnerMainSavedItem: function () {
        const blankCanvas = typeof window !== 'undefined' && (
            window.__meimaySavedCanvasBlank === true ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('meimay_saved_canvas_blank') === '1')
        );
        if (blankCanvas) return null;
        const partnerItems = this.getPartnerSaved();
        const overrideKey = canonicalizePairingSavedNameKey(typeof window !== 'undefined' && typeof window.__meimaySavedCanvasPartnerKey === 'string' && window.__meimaySavedCanvasPartnerKey
            ? window.__meimaySavedCanvasPartnerKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_partner_key') || '') : ''));
        if (overrideKey) {
            const overrideItem = partnerItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === overrideKey);
            if (overrideItem) return overrideItem;
        }

        const partnerChildCanvasKey = canonicalizePairingSavedNameKey(this._getPartnerChildRecord()?.draft?.savedCanvas?.ownKey);
        if (partnerChildCanvasKey) {
            const childWorkspaceItem = partnerItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === partnerChildCanvasKey);
            if (childWorkspaceItem) return childWorkspaceItem;
        }

        const workspaceStateCandidates = [
            MeimayShare?.partnerSnapshot?.meimayStateV2,
            MeimayShare?.partnerSnapshot?.partnerUserBackup?.meimayStateV2,
            MeimayShare?.partnerSnapshot?.partnerUserBackup?.childWorkspaceStateV2,
            MeimayShare?.partnerSnapshot?.backup?.meimayStateV2,
            MeimayShare?.partnerSnapshot?.backup?.childWorkspaceStateV2,
            MeimayShare?.partnerSnapshot?.meimayBackup?.meimayStateV2,
            MeimayShare?.partnerSnapshot?.meimayBackup?.childWorkspaceStateV2
        ];
        for (const candidate of workspaceStateCandidates) {
            const workspaceKey = canonicalizePairingSavedNameKey(extractSavedCanvasOwnKeyFromWorkspaceState(candidate));
            if (!workspaceKey) continue;
            const workspaceItem = partnerItems.slice().reverse().find(item => this.buildSavedMatchKey(item) === workspaceKey);
            if (workspaceItem) return workspaceItem;
        }

        const items = partnerItems.filter(item => item?.mainSelected);
        if (items.length === 0) return null;
        return items.slice().sort((a, b) => {
            const aTime = new Date(a.mainSelectedAt || a.savedAt || a.timestamp || 0).getTime();
            const bTime = new Date(b.mainSelectedAt || b.savedAt || b.timestamp || 0).getTime();
            return bTime - aTime;
        })[0] || null;
    },

    getSavedNameCanvasState: function () {
        const blankCanvas = typeof window !== 'undefined' && (
            window.__meimaySavedCanvasBlank === true ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('meimay_saved_canvas_blank') === '1')
        );
        if (blankCanvas) {
            return {
                ownMain: null,
                partnerMain: null,
                ownKey: '',
                partnerKey: '',
                selectedKey: '',
                selectedSource: '',
                selectedAt: '',
                activeMain: null,
                activeKey: '',
                matched: false,
                partnerName: this.getPartnerDisplayName()
            };
        }
        const ownMain = this.getOwnMainSavedItem();
        const partnerMain = this.getPartnerMainSavedItem();
        const ownKey = this.buildSavedMatchKey(ownMain);
        const partnerKey = this.buildSavedMatchKey(partnerMain);
        const selectedKey = canonicalizePairingSavedNameKey(typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedKey === 'string' && window.__meimaySavedCanvasSelectedKey
            ? window.__meimaySavedCanvasSelectedKey
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_key') || '') : ''));
        const selectedSource = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedSource === 'string'
            ? window.__meimaySavedCanvasSelectedSource
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_source') || '') : '');
        const selectedAt = typeof window !== 'undefined' && typeof window.__meimaySavedCanvasSelectedAt === 'string'
            ? window.__meimaySavedCanvasSelectedAt
            : (typeof localStorage !== 'undefined' ? (localStorage.getItem('meimay_saved_canvas_selected_at') || '') : '');
        const activeMain = selectedSource === 'partner'
            ? partnerMain
            : (selectedSource === 'own'
                ? ownMain
                : (ownMain || partnerMain));
        const activeKey = selectedKey || this.buildSavedMatchKey(activeMain);

        return {
            ownMain,
            partnerMain,
            ownKey,
            partnerKey,
            selectedKey: selectedKey || activeKey,
            selectedSource,
            selectedAt,
            activeMain,
            activeKey,
            matched: !!ownKey && !!partnerKey && ownKey === partnerKey,
            partnerName: this.getPartnerDisplayName()
        };
    }
};

window.MeimayPartnerInsights = MeimayPartnerInsights;
// ============================================================
// PAIRING UI HELPERS
// ============================================================
function getPreferredPairingRole() {
    const currentRole = typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null;
    if (currentRole === 'mama' || currentRole === 'papa') return currentRole;

    const savedRole = localStorage.getItem('meimay_my_role');
    if (savedRole === 'mama' || savedRole === 'papa') return savedRole;

    if (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') {
        const wizard = WizardData.get();
        const wizardRole = wizard?.role;
        if (wizardRole === 'mama' || wizardRole === 'papa') return wizardRole;
    }

    return '';
}

function getPreferredPairingRoleLabel() {
    const role = getPreferredPairingRole();
    if (role === 'mama') return 'ママ';
    if (role === 'papa') return 'パパ';
    return '';
}

function formatPartnerStatusName(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    if (value === 'ママ' || value === 'パパ' || value === 'パートナー') return value;
    if (value.endsWith('さん')) return value;
    return value + 'さん';
}
function getWizardNickname() {
    if (typeof WizardData === 'undefined' || typeof WizardData.get !== 'function') return '';
    const wizard = WizardData.get() || {};
    return String(wizard.username || '').trim();
}

function normalizePairingSurnameValue(value) {
    return String(value || '').trim();
}

function getCurrentPairingSurnameState() {
    const globalSurname = normalizePairingSurnameValue(typeof surnameStr !== 'undefined' ? surnameStr : '');
    const globalReading = normalizePairingSurnameValue(typeof surnameReading !== 'undefined' ? surnameReading : '');
    if (globalSurname || globalReading) {
        return {
            surname: globalSurname,
            reading: globalReading
        };
    }

    if (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') {
        const wizard = WizardData.get() || {};
        const wizardSurname = normalizePairingSurnameValue(wizard.surname || wizard.surnameStr || '');
        const wizardReading = normalizePairingSurnameValue(wizard.surnameReading || '');
        if (wizardSurname || wizardReading) {
            return {
                surname: wizardSurname,
                reading: wizardReading
            };
        }
    }

    try {
        const settings = JSON.parse(localStorage.getItem('meimay_settings') || '{}');
        const settingsSurname = normalizePairingSurnameValue(settings.surname || '');
        const settingsReading = normalizePairingSurnameValue(settings.surnameReading || '');
        if (settingsSurname || settingsReading) {
            return {
                surname: settingsSurname,
                reading: settingsReading
            };
        }
    } catch (error) {
        // ignore settings parse failures and fall through to the empty state
    }

    return { surname: '', reading: '' };
}

function syncPairingSurnameDisplay() {
    const current = getCurrentPairingSurnameState();
    const surname = String(current.surname || '').trim();
    const reading = String(current.reading || '').trim();

    const displayEl = document.getElementById('pairing-surname-display');
    if (displayEl) {
        displayEl.textContent = surname || '未設定';
    }

    const subtextEl = document.getElementById('pairing-surname-subtext');
    if (subtextEl) {
        subtextEl.textContent = surname
            ? (reading ? `読み: ${reading}` : '入力済みの苗字です')
            : '連携時に使う苗字です';
    }

    const actionEl = document.getElementById('pairing-surname-action-label');
    if (actionEl) {
        actionEl.textContent = surname ? '変更する' : '入力する';
    }
}

function getPairingRoomSurnameField(slot) {
    if (slot === 'memberA') return 'memberASurname';
    if (slot === 'memberB') return 'memberBSurname';
    return '';
}

function getPairingRoomSurnameReadingField(slot) {
    if (slot === 'memberA') return 'memberASurnameReading';
    if (slot === 'memberB') return 'memberBSurnameReading';
    return '';
}

function formatPairingParticipantLabel(name, role, fallbackLabel = '') {
    const roleLabel = role === 'mama' ? 'ママ' : role === 'papa' ? 'パパ' : '';
    const value = String(name || '').trim();
    if (!value) {
        if (fallbackLabel === 'あなた' && roleLabel) return `${fallbackLabel}(${roleLabel})`;
        return roleLabel || fallbackLabel;
    }
    if (value === 'ママ' || value === 'パパ' || value === 'パートナー') {
        return roleLabel && value !== roleLabel ? `${value}(${roleLabel})` : value;
    }
    if (value.endsWith('さん')) {
        return roleLabel ? `${value}(${roleLabel})` : value;
    }
    return roleLabel ? `${value}さん(${roleLabel})` : `${value}さん`;
}
function syncPairingRoleSelectionFromProfile() {
    const preferredRole = getPreferredPairingRole();
    const preferredRoleLabel = getPreferredPairingRoleLabel();

    const createLabel = document.getElementById('pairing-create-role-label');
    if (createLabel) {
        createLabel.textContent = preferredRoleLabel
            ? '現在の設定: ' + preferredRoleLabel
            : '設定でママ / パパを選ぶと連携しやすくなります';
    }

    const joinLabel = document.getElementById('pairing-join-role-label');
    if (joinLabel) {
        joinLabel.textContent = preferredRoleLabel
            ? '現在の設定: ' + preferredRoleLabel
            : '設定でママ / パパを選ぶと参加しやすくなります';
    }

    if (!preferredRole || typeof MeimayPairing === 'undefined') return;

    if (MeimayPairing._selectedCreateRole !== preferredRole) {
        MeimayPairing.selectCreateRole(preferredRole);
    }

    if (MeimayPairing._selectedJoinRole !== preferredRole) {
        MeimayPairing.selectJoinRole(preferredRole);
    }
}
function updatePairingUI() {
    const inRoom = !!MeimayPairing.roomCode;
    const hasPartner = !!MeimayPairing.partnerUid;
    syncPairingRoleSelectionFromProfile();
    syncPairingSurnameDisplay();

    const pairingNotLinked = document.getElementById('pairing-not-linked');
    const pairingLinked = document.getElementById('pairing-linked');

    if (inRoom) {
        if (pairingNotLinked) pairingNotLinked.classList.add('hidden');
        if (pairingLinked) pairingLinked.classList.remove('hidden');

        const codeEl = document.getElementById('pairing-code-display-linked');
        if (codeEl) codeEl.textContent = MeimayPairing.roomCode;

        const myRoleEl = document.getElementById('pairing-my-role');
        if (myRoleEl) myRoleEl.textContent = formatPairingParticipantLabel(getWizardNickname(), MeimayPairing.myRole, 'あなた');

        const partnerStatusEl = document.getElementById('pairing-partner-status');
        if (partnerStatusEl) {
            if (hasPartner) {
                const partnerDisplayName = typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getPartnerDisplayName === 'function'
                    ? MeimayPartnerInsights.getPartnerDisplayName()
                    : (MeimayPairing.partnerDisplayName || MeimayPairing.partnerLabel || 'パートナー');
                partnerStatusEl.textContent = formatPairingParticipantLabel(partnerDisplayName, MeimayPairing.partnerRole, 'パートナー') + 'と連携中';
                partnerStatusEl.className = 'text-sm font-bold text-[#5d5444]';
            } else {
                partnerStatusEl.textContent = 'パートナー未連携';
                partnerStatusEl.className = 'text-sm font-bold text-[#a6967a]';
            }
        }
    } else {
        if (pairingNotLinked) pairingNotLinked.classList.remove('hidden');
        if (pairingLinked) pairingLinked.classList.add('hidden');
    }

    const drawerPartnerStatusButton = document.getElementById('drawer-partner-status-button');
    const drawerPartnerStatusLabel = document.getElementById('drawer-partner-status-label');
    const drawerPartnerStatusSubtext = document.getElementById('drawer-partner-status-subtext');
    const drawerPairingBadge = document.getElementById('drawer-pairing-badge');
    if (drawerPartnerStatusButton && drawerPartnerStatusLabel) {
        drawerPartnerStatusButton.classList.remove('hidden');
        if (inRoom && hasPartner) {
            const partnerDisplayName = typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getPartnerDisplayName === 'function'
                ? MeimayPartnerInsights.getPartnerDisplayName()
                : (MeimayPairing.partnerDisplayName || MeimayPairing.partnerLabel || 'パートナー');
            const partnerStatusName = formatPartnerStatusName(partnerDisplayName);
            drawerPartnerStatusLabel.textContent = '🔗パートナー：連携中';
            if (drawerPartnerStatusSubtext) {
                const showPartnerName = partnerStatusName && partnerStatusName !== 'パートナー';
                drawerPartnerStatusSubtext.textContent = showPartnerName ? partnerStatusName : '';
                drawerPartnerStatusSubtext.classList.toggle('hidden', !showPartnerName);
            }
        } else {
            drawerPartnerStatusLabel.textContent = '🔗パートナー：未連携';
            if (drawerPartnerStatusSubtext) {
                drawerPartnerStatusSubtext.textContent = '';
                drawerPartnerStatusSubtext.classList.add('hidden');
            }
        }
    }
    if (drawerPairingBadge) {
        drawerPairingBadge.classList.toggle('hidden', !(inRoom && hasPartner));
    }

    refreshPartnerAwareUI();
}
async function handleGenerateCode() {
    const btn = document.getElementById('btn-generate-code');
    if (btn) btn.disabled = true;
    const code = await MeimayPairing.createRoom();
    if (btn) btn.disabled = false;
    if (code) {
        showToast('ルームを作成しました', '\u2713');
    }
}
async function handleEnterCode() {
    const input = document.getElementById('pairing-code-input');
    const code = input?.value?.trim();
    const result = await MeimayPairing.joinRoom(code);
    if (result.success) {
        showToast('パートナーと連携しました', '\u2713');
        if (input) input.value = '';
    } else if (result.error) {
        showToast(result.error, '!');
    }
}
(function hookStorageSync() {
    const waitForStorageBox = setInterval(() => {
        if (typeof StorageBox !== 'undefined' && StorageBox.saveAll) {
            const originalSaveAll = StorageBox.saveAll.bind(StorageBox);
            StorageBox.saveAll = function () {
                const result = originalSaveAll();
                if (MeimayPairing.roomCode) {
                    // 繝・ヰ繧ｦ繝ｳ繧ｹ縺励※閾ｪ蜍募酔譛・
                    MeimayPairing._autoSyncDebounced?.();
                }
                return result;
            };

            const originalSaveLiked = StorageBox.saveLiked.bind(StorageBox);
            StorageBox.saveLiked = function () {
                const result = originalSaveLiked();
                if (MeimayPairing.roomCode) {
                    MeimayPairing._autoSyncDebounced?.();
                }
                return result;
            };

            if (typeof saveReadingStock === 'function') {
                const originalSaveReadingStock = saveReadingStock.bind(window);
                saveReadingStock = function (stock) {
                    const result = originalSaveReadingStock(stock);
                    if (MeimayPairing.roomCode) {
                        MeimayPairing._autoSyncDebounced?.();
                    }
                    return result;
                };
            }

            if (MeimayPairing.roomCode) {
                // Flush any stock restored before the sync hook attached.
                MeimayPairing._autoSyncDebounced?.();
            }

            clearInterval(waitForStorageBox);
            console.log("FIREBASE: Storage sync hooks attached");
        }
    }, 500);
    setTimeout(() => clearInterval(waitForStorageBox), 10000);
})();
MeimayPairing._autoSyncDebounced = (function () {
    let timer = null;
    return function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => MeimayPairing.syncMyData(), 1200);
    };
})();

function queuePartnerStockSync(reason = 'stock') {
    if (typeof MeimayPairing === 'undefined' || !MeimayPairing.roomCode) return false;
    if (typeof MeimayPairing._autoSyncDebounced !== 'function') return false;
    MeimayPairing._autoSyncDebounced(reason);
    return true;
}

window.queuePartnerStockSync = queuePartnerStockSync;

let roomSyncSuspendInFlight = false;
function flushRoomSyncOnSuspend() {
    if (roomSyncSuspendInFlight) return;
    if (!MeimayPairing || !MeimayPairing.roomCode || typeof MeimayPairing.syncMyData !== 'function') return;

    roomSyncSuspendInFlight = true;
    Promise.resolve(MeimayPairing.syncMyData())
        .catch((error) => {
            console.warn('PAIRING: Suspend sync failed', error);
        })
        .finally(() => {
            roomSyncSuspendInFlight = false;
        });
}

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushRoomSyncOnSuspend);
    window.addEventListener('beforeunload', flushRoomSyncOnSuspend);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushRoomSyncOnSuspend();
        }
    });
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, icon = '\u2728', onAction = null) {
    const existing = document.getElementById('meimay-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'meimay-toast';
    toast.style.cssText = `
        position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
        background: rgba(93,84,68,0.95); color: white; padding: 12px 20px;
        border-radius: 16px; font-size: 13px; font-weight: 700;
        z-index: 99999; display: flex; align-items: center; gap: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); backdrop-filter: blur(12px);
        animation: toastIn 0.3s ease-out;
        max-width: 90vw;
    `;

    let html = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
    if (onAction) {
        html += `<button onclick="this.parentElement._onAction?.(); this.parentElement.remove()" style="
            margin-left:8px; padding:4px 12px; background:rgba(255,255,255,0.2);
            border:none; color:white; border-radius:8px; font-size:11px; font-weight:900; cursor:pointer;
        ">蜿悶ｊ霎ｼ繧</button>`;
    }
    toast.innerHTML = html;
    if (onAction) toast._onAction = onAction;

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, onAction ? 10000 : 4000);
}

// Toast CSS
(function addToastCSS() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(-20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(-50%) translateY(0); } to { opacity:0; transform:translateX(-50%) translateY(-20px); } }
    `;
    document.head.appendChild(style);
})();

// Global exports
window.MeimayAuth = MeimayAuth;
window.MeimayPairing = MeimayPairing;
window.MeimayShare = MeimayShare;
window.handleGenerateCode = handleGenerateCode;
window.handleEnterCode = handleEnterCode;
window.showToast = showToast;

// ============================================================
// STATS - 莠ｺ豌励Λ繝ｳ繧ｭ繝ｳ繧ｰ逕ｨ髮・ｨ医Δ繧ｸ繝･繝ｼ繝ｫ・亥､画峩縺ｪ縺暦ｼ・// ============================================================
function normalizeStatsReadingText(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const partnerNormalizer = typeof MeimayPartnerInsights !== 'undefined'
        && typeof MeimayPartnerInsights.normalizeReading === 'function'
        ? MeimayPartnerInsights.normalizeReading.bind(MeimayPartnerInsights)
        : null;

    const normalized = partnerNormalizer
        ? partnerNormalizer(raw)
        : raw
            .replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
            .replace(/[^縺・繧薙・]/g, '');

    return String(normalized || '').trim();
}

function getReadingRankingAllowlist(targetGender = 'all') {
    if (!Array.isArray(readingsData) || readingsData.length === 0) return null;

    const normalizedGender = normalizeStatsGenderValue(targetGender);
    const allowed = new Set();

    readingsData.forEach((entry) => {
        const normalizedReading = normalizeStatsReadingText(entry?.reading || '');
        if (!normalizedReading) return;

        if (
            normalizedGender !== 'all' &&
            typeof isReadingGenderAllowed === 'function' &&
            !isReadingGenderAllowed(entry?.gender, normalizedGender)
        ) {
            return;
        }

        allowed.add(normalizedReading);
    });

    return allowed;
}

function normalizeStatsGenderValue(value, fallback = 'all') {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'male' || raw === 'female' || raw === 'neutral' || raw === 'all') {
        return raw;
    }

    const fallbackRaw = String(fallback || '').trim().toLowerCase();
    if (fallbackRaw === 'male' || fallbackRaw === 'female' || fallbackRaw === 'neutral' || fallbackRaw === 'all') {
        return fallbackRaw;
    }

    return 'all';
}

function normalizeStatsScopeValue(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'global' || raw === 'gender' || raw === 'all') {
        return raw;
    }
    return 'all';
}

function getStatsGenderTargets(genderValue) {
    const normalized = normalizeStatsGenderValue(genderValue);
    if (normalized === 'male' || normalized === 'female') {
        return [normalized];
    }
    if (normalized === 'neutral') {
        return ['male', 'female'];
    }
    return [];
}

function getStatsRankingCollectionNames(kind, metric = 'all', gender = 'all') {
    const normalizedKind = kind === 'reading' ? 'reading' : 'kanji';
    const normalizedMetric = normalizedKind === 'reading'
        ? (metric === 'like' || metric === 'direct' ? metric : 'all')
        : 'all';

    const baseCollections = normalizedKind !== 'reading'
        ? ['statistics']
        : normalizedMetric === 'like'
            ? ['reading_like_statistics']
            : normalizedMetric === 'direct'
                ? ['reading_statistics']
                : ['reading_statistics', 'reading_like_statistics'];

    const genderTargets = getStatsGenderTargets(gender);
    if (genderTargets.length === 0) {
        return baseCollections;
    }

    return baseCollections.flatMap((collection) => genderTargets.map((target) => `${collection}_${target}`));
}

function buildStatsRequestBody(baseBody = {}, genderOrOptions = null, defaultScope = 'all') {
    const options = genderOrOptions && typeof genderOrOptions === 'object'
        ? genderOrOptions
        : { gender: genderOrOptions };
    const scope = normalizeStatsScopeValue(options.scope || defaultScope);
    const resolvedGender = normalizeStatsGenderValue(
        options.gender,
        typeof gender !== 'undefined' ? gender : 'all'
    );

    const body = { ...baseBody };
    if (scope !== 'global' && resolvedGender !== 'all') {
        body.gender = resolvedGender;
    }
    if (scope !== 'all') {
        body.scope = scope;
    }
    return body;
}

function notifyRankingCardState(kind, key, delta = 0, stocked = null) {
    if (typeof window === 'undefined') return false;
    if (typeof window.updateRankingCardState !== 'function') return false;
    return window.updateRankingCardState(kind, key, delta, stocked);
}

const MeimayStats = {
    getCurrentWeekKey: function () {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}_${weekNo.toString().padStart(2, '0')}`;
    },

    getCurrentMonthKey: function () {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit'
            }).formatToParts(new Date());
            const year = parts.find(part => part.type === 'year')?.value;
            const month = parts.find(part => part.type === 'month')?.value;
            if (year && month) return `${year}_${month}`;
        } catch (error) {
            // Fallback below keeps ranking usable if the environment lacks Intl time zones.
        }

        const offsetMs = 9 * 60 * 60 * 1000;
        const shifted = new Date(Date.now() + offsetMs);
        return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
    },

    recordKanjiLike: async function (kanjiString, genderOrOptions = null) {
        if (!kanjiString) return;
        try {
            const options = genderOrOptions && typeof genderOrOptions === 'object'
                ? genderOrOptions
                : { gender: genderOrOptions };
            const normalizedDelta = Number.isInteger(Number(options.delta)) && Number(options.delta) !== 0
                ? Number(options.delta)
                : 1;
            const body = buildStatsRequestBody({
                kanji: kanjiString,
                delta: normalizedDelta
            }, options);
            const normalizedPeriod = options.period === 'allTime' || options.period === 'monthly' || options.period === 'weekly'
                ? options.period
                : '';
            if (normalizedPeriod) {
                body.period = normalizedPeriod;
            }
            const response = await fetch('/api/stats', {
                method: 'POST',
                headers: await getFirebaseRequestHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            notifyRankingCardState('kanji', kanjiString, normalizedDelta, normalizedDelta > 0);
            return true;
        } catch (e) {
            console.error('STATS: recordKanjiLike error', e);
            return false;
        }
    },

    recordKanjiUnlike: async function (kanjiString, genderOrOptions = null) {
        if (!kanjiString) return;
        try {
            const options = genderOrOptions && typeof genderOrOptions === 'object'
                ? genderOrOptions
                : { gender: genderOrOptions };
            const normalizedDelta = Number.isInteger(Number(options.delta)) && Number(options.delta) !== 0
                ? Number(options.delta)
                : -1;
            const body = buildStatsRequestBody({
                kanji: kanjiString,
                delta: normalizedDelta
            }, options);
            const normalizedPeriod = options.period === 'allTime' || options.period === 'monthly' || options.period === 'weekly'
                ? options.period
                : '';
            if (normalizedPeriod) {
                body.period = normalizedPeriod;
            }
            const response = await fetch('/api/stats', {
                method: 'POST',
                headers: await getFirebaseRequestHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            notifyRankingCardState('kanji', kanjiString, normalizedDelta, normalizedDelta > 0);
            return true;
        } catch (e) {
            console.error('STATS: recordKanjiUnlike error', e);
            return false;
        }
    },

    recordReadingEncounter: async function (readingString, delta = 1, period = 'all', genderOrOptions = null) {
        const normalizedReading = normalizeStatsReadingText(readingString);
        if (!normalizedReading) return false;
        const normalizedDelta = Number(delta);
        const normalizedPeriod = period === 'allTime' || period === 'monthly' || period === 'weekly' ? period : 'all';
        if (!Number.isInteger(normalizedDelta) || normalizedDelta === 0) return false;

        try {
            const body = buildStatsRequestBody({
                kind: 'reading',
                reading: normalizedReading,
                delta: normalizedDelta,
                metric: 'direct'
            }, genderOrOptions);
            if (normalizedPeriod !== 'all') {
                body.period = normalizedPeriod;
            }

            const response = await fetch('/api/stats', {
                method: 'POST',
                headers: await getFirebaseRequestHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            notifyRankingCardState('reading', normalizedReading, normalizedDelta, null);
            return true;
        } catch (e) {
            console.error('STATS: recordReadingEncounter error', e);
            return false;
        }
    },

    recordReadingLike: async function (readingString, delta = 1, period = 'all', genderOrOptions = null) {
        const normalizedReading = normalizeStatsReadingText(readingString);
        if (!normalizedReading) return false;
        const normalizedDelta = Number(delta);
        const normalizedPeriod = period === 'allTime' || period === 'monthly' || period === 'weekly' ? period : 'all';
        if (!Number.isInteger(normalizedDelta) || normalizedDelta === 0) return false;

        try {
            const body = buildStatsRequestBody({
                kind: 'reading',
                reading: normalizedReading,
                delta: normalizedDelta,
                metric: 'like'
            }, genderOrOptions);
            if (normalizedPeriod !== 'all') {
                body.period = normalizedPeriod;
            }

            const response = await fetch('/api/stats', {
                method: 'POST',
                headers: await getFirebaseRequestHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            notifyRankingCardState('reading', normalizedReading, normalizedDelta, normalizedDelta > 0);
            return true;
        } catch (e) {
            console.error('STATS: recordReadingLike error', e);
            return false;
        }
    },

    recordReadingUnlike: async function (readingString, delta = -1, period = 'all', genderOrOptions = null) {
        const normalizedReading = normalizeStatsReadingText(readingString);
        if (!normalizedReading) return false;
        const normalizedDelta = Number(delta);
        const normalizedPeriod = period === 'allTime' || period === 'monthly' || period === 'weekly' ? period : 'all';
        if (!Number.isInteger(normalizedDelta) || normalizedDelta === 0) return false;

        try {
            const body = buildStatsRequestBody({
                kind: 'reading',
                reading: normalizedReading,
                delta: normalizedDelta,
                metric: 'like'
            }, genderOrOptions);
            if (normalizedPeriod !== 'all') {
                body.period = normalizedPeriod;
            }

            const response = await fetch('/api/stats', {
                method: 'POST',
                headers: await getFirebaseRequestHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            notifyRankingCardState('reading', normalizedReading, normalizedDelta, normalizedDelta > 0);
            return true;
        } catch (e) {
            console.error('STATS: recordReadingUnlike error', e);
            return false;
        }
    },

    bootstrapReadingStatsCollections: async function () {
        if (this._readingStatsBootstrapPromise) return this._readingStatsBootstrapPromise;

        const run = async () => {
            try {
                const response = await fetch('/api/stats', {
                    method: 'POST',
                    headers: await getFirebaseRequestHeaders(),
                    body: JSON.stringify({
                        kind: 'reading',
                        metric: 'all',
                        period: 'all',
                        bootstrap: true
                    })
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                return true;
            } catch (e) {
                console.warn('STATS: bootstrap reading collections failed', e);
                return false;
            }
        };

        this._readingStatsBootstrapPromise = run().finally(() => {
            this._readingStatsBootstrapPromise = null;
        });

        return this._readingStatsBootstrapPromise;
    },

    seedEncounteredReadingStats: async function () {
        const seededFlagKey = 'meimay_reading_stats_seeded_v3';
        if (this._readingStatsSeedPromise) return this._readingStatsSeedPromise;

        const run = async () => {
            if (typeof this.bootstrapReadingStatsCollections === 'function') {
                await this.bootstrapReadingStatsCollections();
            }

            const currentMonthKey = this.getCurrentMonthKey();
            const getMonthKeyFromDate = (date) => {
                try {
                    const parts = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Tokyo',
                        year: 'numeric',
                        month: '2-digit'
                    }).formatToParts(date);
                    const year = parts.find(part => part.type === 'year')?.value;
                    const month = parts.find(part => part.type === 'month')?.value;
                    if (year && month) return `${year}_${month}`;
                } catch (error) {
                    // Fallback below keeps seeding working even in older runtimes.
                }

                const offsetMs = 9 * 60 * 60 * 1000;
                const shifted = new Date(date.getTime() + offsetMs);
                return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
            };

            const directTotals = new Map();
            const likeTotals = new Map();

            const bumpTotals = (map, reading, allDelta = 0, monthlyDelta = 0) => {
                if (!reading) return;
                const current = map.get(reading) || { allTime: 0, monthly: 0 };
                current.allTime += Math.max(0, Number(allDelta) || 0);
                current.monthly += Math.max(0, Number(monthlyDelta) || 0);
                map.set(reading, current);
            };

            const readingHistory = typeof getReadingHistory === 'function'
                ? getReadingHistory()
                : [];
            readingHistory.forEach((entry) => {
                const reading = normalizeStatsReadingText(entry?.reading || '');
                if (!reading) return;

                const searchedAt = entry?.searchedAt ? new Date(entry.searchedAt) : null;
                const monthly = searchedAt && !Number.isNaN(searchedAt.getTime()) && getMonthKeyFromDate(searchedAt) === currentMonthKey
                    ? 1
                    : 0;
                bumpTotals(directTotals, reading, 1, monthly);
            });

            const readingStock = typeof getReadingStock === 'function'
                ? getReadingStock()
                : [];
            readingStock.forEach((entry) => {
                if (entry && entry.statsTracked === false) return;
                const reading = normalizeStatsReadingText(entry?.reading || entry?.key || '');
                if (!reading) return;

                const addedAt = entry?.addedAt ? new Date(entry.addedAt) : null;
                const monthly = addedAt && !Number.isNaN(addedAt.getTime()) && getMonthKeyFromDate(addedAt) === currentMonthKey
                    ? 1
                    : 0;
                bumpTotals(likeTotals, reading, 1, monthly);
            });

            if (directTotals.size === 0 && likeTotals.size === 0) {
                localStorage.setItem(seededFlagKey, '1');
                return true;
            }

            const [serverAllTimeItems, serverMonthlyItems] = await Promise.all([
                this.fetchRankings('allTime', 'reading', 'direct'),
                this.fetchRankings('monthly', 'reading', 'direct')
            ]);

            const [serverLikeAllTimeItems, serverLikeMonthlyItems] = await Promise.all([
                this.fetchRankings('allTime', 'reading', 'like'),
                this.fetchRankings('monthly', 'reading', 'like')
            ]);

            const serverAllTime = new Map();
            const serverMonthly = new Map();
            const serverLikeAllTime = new Map();
            const serverLikeMonthly = new Map();

            (Array.isArray(serverAllTimeItems) ? serverAllTimeItems : []).forEach((item) => {
                const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                const count = Number(item?.count) || 0;
                if (reading && count > 0) {
                    serverAllTime.set(reading, count);
                }
            });

            (Array.isArray(serverMonthlyItems) ? serverMonthlyItems : []).forEach((item) => {
                const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                const count = Number(item?.count) || 0;
                if (reading && count > 0) {
                    serverMonthly.set(reading, count);
                }
            });

            (Array.isArray(serverLikeAllTimeItems) ? serverLikeAllTimeItems : []).forEach((item) => {
                const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                const count = Number(item?.count) || 0;
                if (reading && count > 0) {
                    serverLikeAllTime.set(reading, count);
                }
            });

            (Array.isArray(serverLikeMonthlyItems) ? serverLikeMonthlyItems : []).forEach((item) => {
                const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                const count = Number(item?.count) || 0;
                if (reading && count > 0) {
                    serverLikeMonthly.set(reading, count);
                }
            });

            const tasks = [];
            directTotals.forEach((counts, reading) => {
                const serverAllTimeCount = Number(serverAllTime.get(reading)) || 0;
                const serverMonthlyCount = Number(serverMonthly.get(reading)) || 0;
                const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - serverAllTimeCount);
                const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - serverMonthlyCount);

                if (allTimeDelta > 0) {
                    tasks.push(this.recordReadingEncounter(reading, allTimeDelta, 'allTime', { scope: 'global' }));
                }
                if (monthlyDelta > 0) {
                    tasks.push(this.recordReadingEncounter(reading, monthlyDelta, 'monthly', { scope: 'global' }));
                }
            });

            likeTotals.forEach((counts, reading) => {
                const serverAllTimeCount = Number(serverLikeAllTime.get(reading)) || 0;
                const serverMonthlyCount = Number(serverLikeMonthly.get(reading)) || 0;
                const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - serverAllTimeCount);
                const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - serverMonthlyCount);

                if (allTimeDelta > 0) {
                    tasks.push(this.recordReadingLike(reading, allTimeDelta, 'allTime', { scope: 'global' }));
                }
                if (monthlyDelta > 0) {
                    tasks.push(this.recordReadingLike(reading, monthlyDelta, 'monthly', { scope: 'global' }));
                }
            });

            if (tasks.length === 0) {
                localStorage.setItem(seededFlagKey, '1');
                return true;
            }

            const results = await Promise.all(tasks);
            const hasSuccess = results.some(Boolean);
            if (hasSuccess) {
                localStorage.setItem(seededFlagKey, '1');
            }
            return hasSuccess;
        };

        this._readingStatsSeedPromise = run().finally(() => {
            this._readingStatsSeedPromise = null;
        });

        return this._readingStatsSeedPromise;
    },

    seedEncounteredReadingStatsByGender: async function () {
        const seededFlagKey = 'meimay_reading_gender_stats_seeded_v2';
        if (this._readingGenderStatsSeedPromise) return this._readingGenderStatsSeedPromise;

        const run = async () => {
            const currentMonthKey = this.getCurrentMonthKey();
            const getMonthKeyFromDate = (date) => {
                try {
                    const parts = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Tokyo',
                        year: 'numeric',
                        month: '2-digit'
                    }).formatToParts(date);
                    const year = parts.find((part) => part.type === 'year')?.value;
                    const month = parts.find((part) => part.type === 'month')?.value;
                    if (year && month) return `${year}_${month}`;
                } catch (error) {
                    // Fallback below keeps seeding working even in older runtimes.
                }

                const offsetMs = 9 * 60 * 60 * 1000;
                const shifted = new Date(date.getTime() + offsetMs);
                return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
            };

            const bumpTotals = (map, reading, allDelta = 0, monthlyDelta = 0) => {
                if (!reading) return;
                const current = map.get(reading) || { allTime: 0, monthly: 0 };
                current.allTime += Math.max(0, Number(allDelta) || 0);
                current.monthly += Math.max(0, Number(monthlyDelta) || 0);
                map.set(reading, current);
            };

            const addEntry = (bucketMap, reading, genderValue, allDelta, monthlyDelta) => {
                const targets = getStatsGenderTargets(genderValue);
                if (targets.length === 0) return;
                targets.forEach((target) => {
                    const current = bucketMap.get(target) || new Map();
                    bumpTotals(current, reading, allDelta, monthlyDelta);
                    bucketMap.set(target, current);
                });
            };

            const directTotalsByGender = new Map();
            const likeTotalsByGender = new Map();
            const readingHistory = typeof getReadingHistory === 'function'
                ? getReadingHistory()
                : [];
            const readingStock = typeof getReadingStock === 'function'
                ? getReadingStock()
                : [];

            readingHistory.forEach((entry) => {
                const reading = normalizeStatsReadingText(entry?.reading || '');
                if (!reading) return;
                const genderKey = normalizeStatsGenderValue(entry?.settings?.gender || entry?.gender || gender);

                const searchedAt = entry?.searchedAt ? new Date(entry.searchedAt) : null;
                const monthly = searchedAt && !Number.isNaN(searchedAt.getTime()) && getMonthKeyFromDate(searchedAt) === currentMonthKey
                    ? 1
                    : 0;
                addEntry(directTotalsByGender, reading, genderKey, 1, monthly);
            });

            readingStock.forEach((entry) => {
                if (entry && entry.statsTracked === false) return;
                const reading = normalizeStatsReadingText(entry?.reading || entry?.key || '');
                if (!reading) return;
                const genderKey = normalizeStatsGenderValue(entry?.gender || entry?.settings?.gender || gender);

                const addedAt = entry?.addedAt ? new Date(entry.addedAt) : null;
                const monthly = addedAt && !Number.isNaN(addedAt.getTime()) && getMonthKeyFromDate(addedAt) === currentMonthKey
                    ? 1
                    : 0;
                addEntry(likeTotalsByGender, reading, genderKey, 1, monthly);
            });

            const genderBuckets = Array.from(new Set([
                ...directTotalsByGender.keys(),
                ...likeTotalsByGender.keys()
            ]));

            if (directTotalsByGender.size === 0 && likeTotalsByGender.size === 0) {
                localStorage.setItem(seededFlagKey, '1');
                return true;
            }

            const tasks = [];

            for (const genderKey of genderBuckets) {
                const directTotals = directTotalsByGender.get(genderKey) || new Map();
                const likeTotals = likeTotalsByGender.get(genderKey) || new Map();

                const [
                    serverDirectAllTimeItems,
                    serverDirectMonthlyItems,
                    serverLikeAllTimeItems,
                    serverLikeMonthlyItems
                ] = await Promise.all([
                    this.fetchRankings('allTime', 'reading', 'direct', genderKey),
                    this.fetchRankings('monthly', 'reading', 'direct', genderKey),
                    this.fetchRankings('allTime', 'reading', 'like', genderKey),
                    this.fetchRankings('monthly', 'reading', 'like', genderKey)
                ]);

                const serverDirectAllTime = new Map();
                const serverDirectMonthly = new Map();
                const serverLikeAllTime = new Map();
                const serverLikeMonthly = new Map();

                (Array.isArray(serverDirectAllTimeItems) ? serverDirectAllTimeItems : []).forEach((item) => {
                    const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                    const count = Number(item?.count) || 0;
                    if (reading && count > 0) serverDirectAllTime.set(reading, count);
                });
                (Array.isArray(serverDirectMonthlyItems) ? serverDirectMonthlyItems : []).forEach((item) => {
                    const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                    const count = Number(item?.count) || 0;
                    if (reading && count > 0) serverDirectMonthly.set(reading, count);
                });
                (Array.isArray(serverLikeAllTimeItems) ? serverLikeAllTimeItems : []).forEach((item) => {
                    const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                    const count = Number(item?.count) || 0;
                    if (reading && count > 0) serverLikeAllTime.set(reading, count);
                });
                (Array.isArray(serverLikeMonthlyItems) ? serverLikeMonthlyItems : []).forEach((item) => {
                    const reading = normalizeStatsReadingText(item?.reading || item?.key || '');
                    const count = Number(item?.count) || 0;
                    if (reading && count > 0) serverLikeMonthly.set(reading, count);
                });

                directTotals.forEach((counts, reading) => {
                    const serverAllTimeCount = Number(serverDirectAllTime.get(reading)) || 0;
                    const serverMonthlyCount = Number(serverDirectMonthly.get(reading)) || 0;
                    const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - serverAllTimeCount);
                    const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - serverMonthlyCount);

                    if (allTimeDelta > 0) {
                        tasks.push(this.recordReadingEncounter(reading, allTimeDelta, 'allTime', {
                            gender: genderKey,
                            scope: 'gender'
                        }));
                    }
                    if (monthlyDelta > 0) {
                        tasks.push(this.recordReadingEncounter(reading, monthlyDelta, 'monthly', {
                            gender: genderKey,
                            scope: 'gender'
                        }));
                    }
                });

                likeTotals.forEach((counts, reading) => {
                    const serverAllTimeCount = Number(serverLikeAllTime.get(reading)) || 0;
                    const serverMonthlyCount = Number(serverLikeMonthly.get(reading)) || 0;
                    const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - serverAllTimeCount);
                    const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - serverMonthlyCount);

                    if (allTimeDelta > 0) {
                        tasks.push(this.recordReadingLike(reading, allTimeDelta, 'allTime', {
                            gender: genderKey,
                            scope: 'gender'
                        }));
                    }
                    if (monthlyDelta > 0) {
                        tasks.push(this.recordReadingLike(reading, monthlyDelta, 'monthly', {
                            gender: genderKey,
                            scope: 'gender'
                        }));
                    }
                });
            }

            if (tasks.length === 0) {
                localStorage.setItem(seededFlagKey, '1');
                return true;
            }

            const results = await Promise.all(tasks);
            const hasSuccess = results.some(Boolean);
            if (hasSuccess) {
                localStorage.setItem(seededFlagKey, '1');
            }
            return hasSuccess;
        };

        this._readingGenderStatsSeedPromise = run().finally(() => {
            this._readingGenderStatsSeedPromise = null;
        });

        return this._readingGenderStatsSeedPromise;
    },

    seedKanjiStatsFromLocalLikes: async function () {
        const seededFlagKey = 'meimay_kanji_gender_stats_seeded_v2';
        if (this._kanjiGenderStatsSeedPromise) return this._kanjiGenderStatsSeedPromise;

        const run = async () => {
            const getMonthKeyFromDate = (date) => {
                try {
                    const parts = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Tokyo',
                        year: 'numeric',
                        month: '2-digit'
                    }).formatToParts(date);
                    const year = parts.find((part) => part.type === 'year')?.value;
                    const month = parts.find((part) => part.type === 'month')?.value;
                    if (year && month) return `${year}_${month}`;
                } catch (error) {
                    // Fallback below keeps seeding working even in older runtimes.
                }

                const offsetMs = 9 * 60 * 60 * 1000;
                const shifted = new Date(date.getTime() + offsetMs);
                return `${shifted.getUTCFullYear()}_${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
            };

            const currentMonthKey = this.getCurrentMonthKey();
            const allTotals = new Map();
            const totalsByGender = new Map();
            const ownLikedItems = typeof MeimayPartnerInsights !== 'undefined' && typeof MeimayPartnerInsights.getOwnLiked === 'function'
                ? MeimayPartnerInsights.getOwnLiked()
                : (Array.isArray(liked) ? liked.filter((item) => !item?.fromPartner) : []);

            const bumpTotals = (map, kanji, allDelta = 0, monthlyDelta = 0) => {
                if (!kanji) return;
                const current = map.get(kanji) || { allTime: 0, monthly: 0 };
                current.allTime += Math.max(0, Number(allDelta) || 0);
                current.monthly += Math.max(0, Number(monthlyDelta) || 0);
                map.set(kanji, current);
            };

            const addGenderTotals = (genderKey, kanji, allDelta = 0, monthlyDelta = 0) => {
                const current = totalsByGender.get(genderKey) || new Map();
                bumpTotals(current, kanji, allDelta, monthlyDelta);
                totalsByGender.set(genderKey, current);
            };

            ownLikedItems.forEach((item) => {
                const kanji = item?.['漢字'] || item?.['貌｡蟄･'] || item?.kanji || '';
                if (!kanji) return;

                const genderKey = normalizeStatsGenderValue(item?.gender || item?.settings?.gender || gender);
                const genderTargets = getStatsGenderTargets(genderKey);
                const addedAt = item?.addedAt || item?.timestamp || item?.likedAt || '';
                const addedDate = addedAt ? new Date(addedAt) : null;
                const monthly = addedDate && !Number.isNaN(addedDate.getTime()) && getMonthKeyFromDate(addedDate) === currentMonthKey
                    ? 1
                    : 0;

                bumpTotals(allTotals, kanji, 1, monthly);
                genderTargets.forEach((target) => addGenderTotals(target, kanji, 1, monthly));
            });

            const genderBuckets = Array.from(totalsByGender.keys());
            const globalDirect = await Promise.all([
                this.fetchRankings('allTime', 'kanji', 'all'),
                this.fetchRankings('monthly', 'kanji', 'all')
            ]);
            const serverAllTime = new Map();
            const serverMonthly = new Map();

            (Array.isArray(globalDirect[0]) ? globalDirect[0] : []).forEach((item) => {
                const kanji = String(item?.kanji || item?.key || '').trim();
                const count = Number(item?.count) || 0;
                if (kanji && count > 0) serverAllTime.set(kanji, count);
            });
            (Array.isArray(globalDirect[1]) ? globalDirect[1] : []).forEach((item) => {
                const kanji = String(item?.kanji || item?.key || '').trim();
                const count = Number(item?.count) || 0;
                if (kanji && count > 0) serverMonthly.set(kanji, count);
            });

            const tasks = [];
            allTotals.forEach((counts, kanji) => {
                const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - (Number(serverAllTime.get(kanji)) || 0));
                const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - (Number(serverMonthly.get(kanji)) || 0));

                if (allTimeDelta > 0) {
                    tasks.push(this.recordKanjiLike(kanji, {
                        scope: 'global',
                        period: 'allTime',
                        delta: allTimeDelta
                    }));
                }
                if (monthlyDelta > 0) {
                    tasks.push(this.recordKanjiLike(kanji, {
                        scope: 'global',
                        period: 'monthly',
                        delta: monthlyDelta
                    }));
                }
            });

            for (const genderKey of genderBuckets) {
                const genderTotals = totalsByGender.get(genderKey) || new Map();
                const [serverGenderAllTimeItems, serverGenderMonthlyItems] = await Promise.all([
                    this.fetchRankings('allTime', 'kanji', 'all', genderKey),
                    this.fetchRankings('monthly', 'kanji', 'all', genderKey)
                ]);
                const serverGenderAllTime = new Map();
                const serverGenderMonthly = new Map();

                (Array.isArray(serverGenderAllTimeItems) ? serverGenderAllTimeItems : []).forEach((item) => {
                    const kanji = String(item?.kanji || item?.key || '').trim();
                    const count = Number(item?.count) || 0;
                    if (kanji && count > 0) serverGenderAllTime.set(kanji, count);
                });
                (Array.isArray(serverGenderMonthlyItems) ? serverGenderMonthlyItems : []).forEach((item) => {
                    const kanji = String(item?.kanji || item?.key || '').trim();
                    const count = Number(item?.count) || 0;
                    if (kanji && count > 0) serverGenderMonthly.set(kanji, count);
                });

                genderTotals.forEach((counts, kanji) => {
                    const allTimeDelta = Math.max(0, (Number(counts.allTime) || 0) - (Number(serverGenderAllTime.get(kanji)) || 0));
                    const monthlyDelta = Math.max(0, (Number(counts.monthly) || 0) - (Number(serverGenderMonthly.get(kanji)) || 0));

                    if (allTimeDelta > 0) {
                        tasks.push(this.recordKanjiLike(kanji, {
                            gender: genderKey,
                            scope: 'gender',
                            period: 'allTime',
                            delta: allTimeDelta
                        }));
                    }
                    if (monthlyDelta > 0) {
                        tasks.push(this.recordKanjiLike(kanji, {
                            gender: genderKey,
                            scope: 'gender',
                            period: 'monthly',
                            delta: monthlyDelta
                        }));
                    }
                });
            }

            if (tasks.length === 0) {
                localStorage.setItem(seededFlagKey, '1');
                return true;
            }

            const results = await Promise.all(tasks);
            const hasSuccess = results.some(Boolean);
            if (hasSuccess) {
                localStorage.setItem(seededFlagKey, '1');
            }
            return hasSuccess;
        };

        this._kanjiGenderStatsSeedPromise = run().finally(() => {
            this._kanjiGenderStatsSeedPromise = null;
        });

        return this._kanjiGenderStatsSeedPromise;
    },

    fetchRankings: async function (type = 'allTime', kind = 'kanji', metric = 'all', gender = 'all') {
        const normalizedType = type === 'monthly' || type === 'weekly' ? type : 'allTime';
        const normalizedKind = kind === 'reading' ? 'reading' : 'kanji';
        const normalizedMetric = normalizedKind === 'reading'
            ? (metric === 'direct' || metric === 'like' ? metric : 'all')
            : 'all';
        const normalizedGender = normalizeStatsGenderValue(gender);

        try {
            const query = new URLSearchParams({
                period: normalizedType,
                kind: normalizedKind,
            });
            if (normalizedKind === 'reading' && normalizedMetric !== 'all') {
                query.set('metric', normalizedMetric);
            }
            if (normalizedGender !== 'all') {
                query.set('gender', normalizedGender);
            }

            const response = await fetch(`/api/stats?${query.toString()}`, {
                cache: 'no-store'
            });

            if (response.ok) {
                const payload = await response.json();
                const apiItems = Array.isArray(payload?.items) ? payload.items : [];
                const payloadGender = normalizeStatsGenderValue(payload?.gender);
                if (normalizedGender !== 'all' && payloadGender !== normalizedGender) {
                    throw new Error('API gender mismatch');
                }
                return apiItems
                    .map((item) => {
                        const key = normalizedKind === 'reading'
                            ? String(item?.reading || item?.key || '').trim()
                            : String(item?.kanji || item?.key || '').trim();
                        return normalizedKind === 'reading'
                            ? { reading: key, count: Number(item?.count) || 0 }
                            : { kanji: key, count: Number(item?.count) || 0 };
                    })
                    .filter((item) => (normalizedKind === 'reading' ? item.reading : item.kanji) && item.count > 0)
                    .sort((a, b) => {
                        if (b.count !== a.count) return b.count - a.count;
                        const aKey = normalizedKind === 'reading' ? a.reading : a.kanji;
                        const bKey = normalizedKind === 'reading' ? b.reading : b.kanji;
                        return aKey.localeCompare(bKey, 'ja');
                    })
                    .slice(0, 100);
            }
        } catch (apiError) {
            console.warn(`STATS: fetchRankings(${normalizedKind}:${normalizedType}) API fallback`, apiError);
        }

        return [];
    }
};

window.MeimayStats = MeimayStats;

function seedReadingStatsFromLocalHistory() {
    try {
        if (typeof MeimayStats !== 'undefined' && typeof MeimayStats.bootstrapReadingStatsCollections === 'function') {
            MeimayStats.bootstrapReadingStatsCollections().catch((error) => {
                console.warn('STATS: reading bootstrap failed', error);
            });
        }

        if (typeof MeimayStats === 'undefined' || typeof MeimayStats.seedEncounteredReadingStats !== 'function') return;

        MeimayStats.seedEncounteredReadingStats().catch((error) => {
            console.warn('STATS: startup reading seed failed', error);
        });

        if (typeof MeimayStats.seedEncounteredReadingStatsByGender === 'function') {
            MeimayStats.seedEncounteredReadingStatsByGender().catch((error) => {
                console.warn('STATS: startup gender reading seed failed', error);
            });
        }

        if (typeof MeimayStats.seedKanjiStatsFromLocalLikes === 'function') {
            MeimayStats.seedKanjiStatsFromLocalLikes().catch((error) => {
                console.warn('STATS: startup gender kanji seed failed', error);
            });
        }
    } catch (error) {
        console.warn('STATS: startup reading seed skipped', error);
    }
}

if (typeof window !== 'undefined') {
    const runStartupReadingSeed = () => {
        setTimeout(seedReadingStatsFromLocalHistory, 0);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        runStartupReadingSeed();
    } else {
        window.addEventListener('load', runStartupReadingSeed, { once: true });
    }
}

console.log("FIREBASE: Module loaded (v22.1 - anonymous + room pairing + reading seed)");

function getPartnerRoleLabel(role) {
    if (role === 'mama') return 'ママ';
    if (role === 'papa') return 'パパ';
    return 'パートナー';
}

function resolveRoomSlotFromDoc(data = {}, currentUid = '', fallbackSlot = '') {
    const storedSlot = fallbackSlot === 'memberA' || fallbackSlot === 'memberB' ? fallbackSlot : '';
    if (currentUid && data.memberAUid === currentUid) return 'memberA';
    if (currentUid && data.memberBUid === currentUid) return 'memberB';
    if (storedSlot) return storedSlot;
    if (data.memberAUid && !data.memberBUid) return 'memberA';
    if (data.memberBUid && !data.memberAUid) return 'memberB';
    return 'memberA';
}

function cleanupLegacyPartnerLocalData() {
    try {
        if (typeof liked !== 'undefined' && Array.isArray(liked)) {
            const ownLiked = liked.filter(item => !item?.fromPartner);
            if (ownLiked.length !== liked.length) {
                liked.splice(0, liked.length, ...ownLiked);
                if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) StorageBox.saveLiked();
            }
        }
    } catch (e) {
        console.warn('PAIRING: Failed to cleanup legacy liked items', e);
    }

    try {
        const savedRaw = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
        if (Array.isArray(savedRaw) && typeof savedNames !== 'undefined') {
            savedNames = savedRaw;
        }
    } catch (e) {
        console.warn('PAIRING: Failed to cleanup legacy saved items', e);
    }
}

function getRoomSyncLikedItems() {
    const filterOwnItems = (items) => (Array.isArray(items) ? items.filter(item => !item?.fromPartner) : []);
    const filterRemovedItems = (items) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
        ? StorageBox._filterRemovedLikedItems(items)
        : (Array.isArray(items) ? items.filter(Boolean) : []);

    try {
        const memoryLiked = filterRemovedItems(filterOwnItems(typeof liked !== 'undefined' ? liked : []));
        if (memoryLiked.length > 0) {
            return memoryLiked;
        }

        if (typeof StorageBox !== 'undefined' && typeof StorageBox._loadLikedState === 'function') {
            const state = StorageBox._loadLikedState();
            const items = filterRemovedItems(filterOwnItems(state?.items));
            return items.length > 0 ? items : [];
        }
    } catch (e) {
        console.warn('PAIRING: Failed to read liked state from StorageBox', e);
    }

    return [];
}

MeimayPairing.syncMyData = async function () {
    const user = MeimayAuth.getCurrentUser();
    if (!user || !this.roomCode) return;

    try {
        // 送信前にアクティブ子の現在状態を meimayStateV2 へ書き込む
        if (typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces && MeimayChildWorkspaces.initialized) {
            try {
                MeimayChildWorkspaces.persistActiveChildSnapshot('pre-sync');
            } catch (e) {
                console.warn('PAIRING: persistActiveChildSnapshot failed', e);
            }
        }

        const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
            ? (WizardData.get() || {})
            : {};

        // childWorkspaceStateV2 を先に取得（persistActiveChildSnapshot後なので最新状態が入っている）
        const childWorkspaceStateV2 = typeof MeimayUserBackup !== 'undefined'
            && MeimayUserBackup
            && typeof MeimayUserBackup._readChildWorkspaceStateV2 === 'function'
            ? MeimayUserBackup._readChildWorkspaceStateV2()
            : (typeof MeimayChildWorkspaces !== 'undefined'
                && MeimayChildWorkspaces
                && typeof MeimayChildWorkspaces.getRootSnapshot === 'function'
                    ? MeimayChildWorkspaces.getRootSnapshot()
                    : null);

        // flat データ: 全子のライブラリを集約（子ごとの分離は meimayStateV2 側で管理、flat は後方互換用）
        let ownLiked = getRoomSyncLikedItems();
        let savedDataRaw = JSON.parse(localStorage.getItem('meimay_saved') || '[]').filter(item => item && typeof item === 'object');
        let readingStockSource = typeof getReadingStock === 'function' ? getReadingStock() : [];

        // meimayStateV2 が取れた場合は全子のデータを集約して flat データを補完
        if (childWorkspaceStateV2 && childWorkspaceStateV2.children && typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces) {
            try {
                const filterRemoved = (items) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
                    ? StorageBox._filterRemovedLikedItems(items)
                    : (Array.isArray(items) ? items.filter(Boolean) : []);
                const allKanji = [];
                const allReadings = [];
                const allSaved = [];
                const kanjiSeen = new Set();
                const readingSeen = new Set();
                const savedSeen = new Set();
                Object.values(childWorkspaceStateV2.children).forEach((child) => {
                    filterRemoved(child?.libraries?.kanjiStock || []).forEach((item) => {
                        const key = String(item?.['漢字'] || item?.kanji || '').trim();
                        if (key && !kanjiSeen.has(key)) { kanjiSeen.add(key); allKanji.push(item); }
                    });
                    (child?.libraries?.readingStock || []).forEach((item) => {
                        const key = String(item?.id || item?.reading || '').trim();
                        if (key && !readingSeen.has(key)) { readingSeen.add(key); allReadings.push(item); }
                    });
                    (child?.libraries?.savedNames || []).filter(item => !item?.fromPartner).forEach((item) => {
                        const key = String(item?.fullName || item?.givenName || '').trim();
                        if (key && !savedSeen.has(key)) { savedSeen.add(key); allSaved.push(item); }
                    });
                });
                if (allKanji.length >= ownLiked.length) ownLiked = allKanji;
                if (allReadings.length >= readingStockSource.length) readingStockSource = allReadings;
                if (allSaved.length >= savedDataRaw.length) savedDataRaw = allSaved;
            } catch (e) {
                console.warn('PAIRING: Failed to aggregate all-child flat data', e);
            }
        }

        const encounteredLibrary = typeof getEncounteredLibrary === 'function'
            ? getEncounteredLibrary()
            : { readings: [] };
        const canonicalSavedData = typeof canonicalizeSavedNamesForSync === 'function'
            ? canonicalizeSavedNamesForSync(savedDataRaw, childWorkspaceStateV2)
            : savedDataRaw;
        const projectedSections = MeimayFirestorePayload.projectSections({
            liked: Array.isArray(ownLiked) ? ownLiked : [],
            savedNames: canonicalSavedData,
            readingStock: Array.isArray(readingStockSource) ? readingStockSource : [],
            encounteredReadings: Array.isArray(encounteredLibrary.readings) ? encounteredLibrary.readings : []
        });

        const hiddenReadings = readNormalizedHiddenReadings();
        const likedRemoved = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._loadLikedRemovalState === 'function'
            ? StorageBox._loadLikedRemovalState()
            : [];
        const childWorkspaceStateV2UpdatedAt = childWorkspaceStateV2 && typeof childWorkspaceStateV2 === 'object'
            ? String(childWorkspaceStateV2.updatedAt || childWorkspaceStateV2.savedAt || childWorkspaceStateV2.createdAt || Date.now())
            : '';
        const childWorkspaceStateV2Meta = childWorkspaceStateV2
            ? { meimayStateV2UpdatedAt: childWorkspaceStateV2UpdatedAt }
            : {};
        const roomDataRef = firebaseDb.collection('rooms').doc(this.roomCode).collection('data').doc(user.uid);
        const roomDataDoc = await roomDataRef.get();
        const existingRoomData = roomDataDoc.exists ? (roomDataDoc.data() || {}) : {};
        const likedClearFlag = localStorage.getItem('meimay_liked_cleared_at');
        const savedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_SAVED_CLEARED
            ? localStorage.getItem(StorageBox.KEY_SAVED_CLEARED)
            : localStorage.getItem('meimay_saved_cleared_at');
        const pickStoredSection = (localItems, existingItems) => {
            if (Array.isArray(localItems) && localItems.length > 0) return localItems;
            if (Array.isArray(existingItems) && existingItems.length > 0) return existingItems;
            return Array.isArray(localItems) ? localItems : [];
        };
        const likedShouldClear = likedClearFlag
            || (Array.isArray(likedRemoved) && likedRemoved.length > 0 && (!Array.isArray(projectedSections.liked) || projectedSections.liked.length === 0));
        const likedToStore = likedShouldClear
            ? (Array.isArray(projectedSections.liked) ? projectedSections.liked : [])
            : pickStoredSection(projectedSections.liked, existingRoomData.liked);
        const savedNamesToStore = savedClearFlag
            ? (Array.isArray(projectedSections.savedNames) ? projectedSections.savedNames : [])
            : pickStoredSection(projectedSections.savedNames, existingRoomData.savedNames);
        const readingStockToStore = pickStoredSection(projectedSections.readingStock, existingRoomData.readingStock);
        const encounteredToStore = pickStoredSection(projectedSections.encounteredReadings, existingRoomData.encounteredReadings);
        const existingProfileName = String(existingRoomData.displayName || existingRoomData.username || existingRoomData.nickname || '').trim();
        const profileName = String(wizard.username || existingProfileName || '').trim();
        const rawProfileThemeId = typeof getProfileThemeId === 'function'
            ? getProfileThemeId(wizard.role)
            : (wizard.themeId || existingRoomData.themeId || null);
        const profileThemeId = typeof rawProfileThemeId === 'string'
            ? rawProfileThemeId.trim() || null
            : null;
        const cloneRoomArray = (items) => safeJsonCloneForRoomSync(Array.isArray(items) ? items : [], []);
        const roomBackup = {
            schemaVersion: 1,
            syncedAtMs: Date.now(),
            likedCount: Array.isArray(likedToStore) ? likedToStore.length : 0,
            savedNamesCount: Array.isArray(savedNamesToStore) ? savedNamesToStore.length : 0,
            readingStockCount: Array.isArray(readingStockToStore) ? readingStockToStore.length : 0,
            encounteredReadingsCount: Array.isArray(encounteredToStore) ? encounteredToStore.length : 0,
            hiddenReadingsCount: Array.isArray(hiddenReadings) ? hiddenReadings.length : 0,
            likedRemovedCount: Array.isArray(likedRemoved) ? likedRemoved.length : 0,
            likedRemoved: cloneRoomArray(likedRemoved),
            pairRoomCode: String(this.roomCode || ''),
            roomCode: String(this.roomCode || ''),
            ...childWorkspaceStateV2Meta
        };
        if (likedShouldClear) {
            roomBackup.liked = [];
        }

        const publicPremiumState = typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function'
            ? PremiumManager.getPublicPremiumSnapshot()
            : null;
        const premiumFields = publicPremiumState || {};
        const roomPayloadBase = {
            role: this.myRole || null,
            displayName: profileName,
            username: profileName,
            nickname: profileName,
            themeId: profileThemeId,
            liked: cloneRoomArray(likedToStore),
            savedNames: cloneRoomArray(savedNamesToStore),
            readingStock: cloneRoomArray(readingStockToStore),
            encounteredReadings: cloneRoomArray(encounteredToStore),
            hiddenReadings: cloneRoomArray(hiddenReadings),
            likedRemoved: cloneRoomArray(likedRemoved),
            meimayBackup: roomBackup,
            backup: roomBackup,
            isPremium: typeof premiumFields.isPremium === 'boolean' ? premiumFields.isPremium : false,
            subscriptionStatus: typeof premiumFields.subscriptionStatus === 'string'
                ? premiumFields.subscriptionStatus
                : null,
            premiumStatus: typeof premiumFields.premiumStatus === 'string'
                ? premiumFields.premiumStatus
                : (typeof premiumFields.subscriptionStatus === 'string' ? premiumFields.subscriptionStatus : null),
            appStoreExpiresAt: premiumFields.appStoreExpiresAt || null,
            premiumExpiresAt: premiumFields.premiumExpiresAt || premiumFields.appStoreExpiresAt || null,
            appStoreProductId: typeof premiumFields.appStoreProductId === 'string'
                ? premiumFields.appStoreProductId
                : null,
            premiumProductId: typeof premiumFields.premiumProductId === 'string'
                ? premiumFields.premiumProductId
                : (typeof premiumFields.appStoreProductId === 'string' ? premiumFields.appStoreProductId : null),
            appStoreLastNotificationType: typeof premiumFields.appStoreLastNotificationType === 'string'
                ? premiumFields.appStoreLastNotificationType
                : null,
            latestNotificationType: typeof premiumFields.latestNotificationType === 'string'
                ? premiumFields.latestNotificationType
                : (typeof premiumFields.appStoreLastNotificationType === 'string' ? premiumFields.appStoreLastNotificationType : null)
        };
        const roomPayload = attachRoomSyncWorkspaceState(roomPayloadBase, childWorkspaceStateV2, childWorkspaceStateV2UpdatedAt);
        roomPayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        await roomDataRef.set(roomPayload, { merge: true });

        console.log('PAIRING: Synced my data to room');
    } catch (e) {
        console.error('PAIRING: Sync data failed', e);
    }
};

// (旧版 listenPartnerData / stopListening は削除 - meimayStateV2対応の新版に統一)

MeimayShare.getConnectedPremiumSnapshot = function () {
    if (this.partnerUserSnapshot) {
        return this.partnerUserSnapshot;
    }

    const partnerSnapshot = this.partnerSnapshot || null;
    if (!partnerSnapshot) return null;

    if (partnerSnapshot.premiumState) {
        return partnerSnapshot.premiumState;
    }

    if (this.buildPublicPremiumSnapshot) {
        const premiumState = this.buildPublicPremiumSnapshot(partnerSnapshot);
        if (premiumState) {
            return premiumState;
        }
    }

    return null;
};

MeimayShare.syncProfileAppearance = async function () {
    const user = MeimayAuth.getCurrentUser();
    if (!user || !this.roomCode) return;

    const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    const nextRole = this.myRole || wizard.role || null;
    const roomDataRef = firebaseDb.collection('rooms').doc(this.roomCode).collection('data').doc(user.uid);

    try {
        const roomDataDoc = await roomDataRef.get();
        const existingRoomData = roomDataDoc.exists ? (roomDataDoc.data() || {}) : {};
        const existingProfileName = String(
            existingRoomData.displayName
            || existingRoomData.username
            || existingRoomData.nickname
            || ''
        ).trim();
        const profileName = String(wizard.username || existingProfileName || '').trim();
        const nextThemeId = typeof getProfileThemeId === 'function'
            ? getProfileThemeId(wizard.role)
            : String(wizard.themeId || existingRoomData.themeId || '').trim();
        const safeThemeId = typeof nextThemeId === 'string'
            ? nextThemeId.trim() || null
            : null;
        const currentPairingSurname = getCurrentPairingSurnameState();
        await roomDataRef.set({
                role: nextRole,
                displayName: profileName,
                username: profileName,
                nickname: profileName,
                themeId: safeThemeId,
                surname: currentPairingSurname.surname,
                surnameReading: currentPairingSurname.reading,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        if (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && typeof MeimayPairing._autoSyncDebounced === 'function') {
            MeimayPairing._autoSyncDebounced('profile-appearance');
        }
    } catch (e) {
        console.warn('SHARE: Sync profile appearance failed', e);
    }
};

MeimayPartnerInsights.getPartnerReadingStock = function () {
    const partnerLibraries = this._getPartnerChildLibraries();
    if (this._shouldUseScopedPartnerChildOnly()) {
        const hiddenSet = this.getPartnerHiddenReadingSet();
        return Array.isArray(partnerLibraries?.readingStock)
            ? partnerLibraries.readingStock
                .map((item) => (typeof normalizeReadingStockItem === 'function'
                    ? normalizeReadingStockItem(this._safeClone(item))
                    : this._safeClone(item)))
                .filter(Boolean)
                .filter(item => !this._isHiddenReadingItem(item, hiddenSet))
            : [];
    }
    if (!partnerLibraries && this._shouldSuppressUnscopedPartnerFallback()) {
        return [];
    }
    const snapshot = MeimayShare.partnerSnapshot || {};
    const backup = snapshot.partnerUserBackup || snapshot.meimayBackup || snapshot.backup || {};
    // 子ワークスペースのライブラリが存在し、かつデータがある場合のみ使用（空なら flat フォールバックへ）
    const partnerReadings = partnerLibraries && Array.isArray(partnerLibraries.readingStock) && partnerLibraries.readingStock.length > 0
        ? partnerLibraries.readingStock
        : (Array.isArray(snapshot.readingStock) && snapshot.readingStock.length > 0
            ? snapshot.readingStock
            : (Array.isArray(backup.readingStock) ? backup.readingStock : []));
    const hiddenSet = this.getPartnerHiddenReadingSet();
    return Array.isArray(partnerReadings)
        ? partnerReadings
            .map((item) => (typeof normalizeReadingStockItem === 'function'
                ? normalizeReadingStockItem(this._safeClone(item))
                : this._safeClone(item)))
            .filter(Boolean)
            .filter(item => !this._isHiddenReadingItem(item, hiddenSet))
        : [];
};


MeimayPartnerInsights.normalizeReading = function (value) {
    const raw = String(value || '').trim().split('::')[0].trim();
    if (!raw) return '';
    return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
};

MeimayPartnerInsights.getOwnReadingStock = function () {
    const ownReadings = typeof getReadingStock === 'function' ? getReadingStock() : [];
    const hiddenReadingSet = this.getOwnHiddenReadingSet();
    return ownReadings.filter(item => !this._isHiddenReadingItem(item, hiddenReadingSet));
};

MeimayPartnerInsights.getOwnEncounteredReadings = function () {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    return Array.isArray(library.readings) ? library.readings : [];
};

MeimayPartnerInsights.getPartnerEncounteredReadings = function () {
    if (this._shouldSuppressUnscopedPartnerFallback()) {
        return [];
    }
    const snapshot = MeimayShare?.partnerSnapshot || {};
    const backup = snapshot.partnerUserBackup || snapshot.meimayBackup || snapshot.backup || {};
    const readings = Array.isArray(snapshot.encounteredReadings) && snapshot.encounteredReadings.length > 0
        ? snapshot.encounteredReadings
        : backup.encounteredReadings;
    return Array.isArray(readings) ? readings : [];
};

MeimayPartnerInsights.getEncounteredReadingsForRanking = function () {
    const ownReadings = this.getOwnEncounteredReadings();
    const partnerReadings = this.getPartnerEncounteredReadings();
    if (partnerReadings.length === 0) return ownReadings;
    return [...ownReadings, ...partnerReadings];
};

MeimayPartnerInsights.buildReadingStockKey = function (item) {
    const reading = item?.reading || '';
    const segments = Array.isArray(item?.segments) ? item.segments : [];
    if (typeof getReadingStockKey === 'function') return getReadingStockKey(reading, segments);
    return `${reading}::${segments.join('/')}`;
};

MeimayPartnerInsights.buildLikedReadingKey = function (item) {
    const reading = item?.sessionReading || item?.reading || '';
    if (!reading || ['FREE', 'SEARCH', 'RANKING', 'SHARED', 'UNKNOWN'].includes(reading)) return '';
    const segments = Array.isArray(item?.sessionSegments) ? item.sessionSegments : (Array.isArray(item?.segments) ? item.segments : []);
    return this.buildReadingStockKey({ reading, segments });
};

MeimayPartnerInsights.buildReadingCollection = function (readingItems = [], likedItems = [], options = {}) {
    const merged = new Map();
    const fromPartner = options.fromPartner === true;

    const upsert = (item, key) => {
        if (!key) return;
        const existing = merged.get(key);
        const normalized = {
            ...item,
            id: item?.id || key,
            reading: item?.reading || item?.sessionReading || '',
            segments: Array.isArray(item?.segments) ? item.segments : (Array.isArray(item?.sessionSegments) ? item.sessionSegments : []),
            tags: Array.isArray(item?.tags) ? item.tags : [],
            baseNickname: item?.baseNickname || '',
            isSuper: !!item?.isSuper,
            fromPartner: fromPartner || !!item?.fromPartner,
            isDerivedFromLiked: !!item?.isDerivedFromLiked,
            statsTracked: item?.statsTracked !== false
        };
        if (!existing) {
            merged.set(key, normalized);
            return;
        }
        if ((!existing.segments || existing.segments.length === 0) && normalized.segments.length > 0) {
            existing.segments = normalized.segments;
        }
        if (!existing.baseNickname && normalized.baseNickname) {
            existing.baseNickname = normalized.baseNickname;
        }
        if ((!existing.tags || existing.tags.length === 0) && normalized.tags.length > 0) {
            existing.tags = normalized.tags;
        }
        existing.isSuper = existing.isSuper || normalized.isSuper;
        existing.fromPartner = existing.fromPartner || normalized.fromPartner;
        existing.isDerivedFromLiked = existing.isDerivedFromLiked || normalized.isDerivedFromLiked;
        existing.statsTracked = existing.statsTracked !== false && normalized.statsTracked !== false;
    };

    readingItems.forEach(item => {
        upsert(item, this.buildReadingStockKey(item));
    });

    likedItems.forEach(item => {
        const key = this.buildLikedReadingKey(item);
        if (!key) return;
        upsert({
            reading: item?.sessionReading || '',
            segments: Array.isArray(item?.sessionSegments) ? item.sessionSegments : [],
            isSuper: !!item?.isSuper,
            isDerivedFromLiked: true,
            fromPartner,
            statsTracked: true
        }, key);
    });

    return Array.from(merged.values());
};

function isGenericPartnerDisplayName(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    return ['パートナー', 'ママ', 'パパ', '連携中', '未連携', '未設定', 'あなた'].includes(text);
}

function inferPartnerDisplayNameFromSnapshot(snapshot = {}) {
    const directCandidates = [
        snapshot.displayName,
        snapshot.username,
        snapshot.nickname,
        snapshot.partnerName
    ];
    const backupCandidates = [
        snapshot.partnerUserBackup && snapshot.partnerUserBackup.displayName,
        snapshot.partnerUserBackup && snapshot.partnerUserBackup.username,
        snapshot.partnerUserBackup && snapshot.partnerUserBackup.nickname,
        snapshot.partnerUserBackup && snapshot.partnerUserBackup.partnerName
    ];

    for (const candidate of [...directCandidates, ...backupCandidates]) {
        const text = String(candidate || '').trim();
        if (text && !isGenericPartnerDisplayName(text)) return text;
    }

    const tally = new Map();
    const addCandidate = (candidate) => {
        const text = String(candidate || '').trim();
        if (!text || isGenericPartnerDisplayName(text)) return;
        tally.set(text, (tally.get(text) || 0) + 1);
    };

    const readingStock = Array.isArray(snapshot.readingStock) ? snapshot.readingStock : [];
    readingStock.forEach(item => {
        addCandidate(item?.baseNickname);
        addCandidate(item?.preferredLabel);
        addCandidate(item?.displayName);
    });

    const encounteredReadings = Array.isArray(snapshot.encounteredReadings) ? snapshot.encounteredReadings : [];
    encounteredReadings.forEach(item => {
        addCandidate(item?.baseNickname);
        addCandidate(item?.preferredLabel);
    });

    if (tally.size > 0) {
        return Array.from(tally.entries())
            .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    }

    return '';
}

MeimayPartnerInsights.getPartnerDisplayName = function () {
    const snapshot = MeimayShare.partnerSnapshot || {};
    const inferredName = inferPartnerDisplayNameFromSnapshot(snapshot);
    if (inferredName) return inferredName;
    if (typeof getPartnerRoleLabel === 'function') return getPartnerRoleLabel(snapshot.role);
    return snapshot.role === 'mama' ? 'ママ' : snapshot.role === 'papa' ? 'パパ' : 'パートナー';
};

MeimayPartnerInsights.getOwnApprovedSavedKeys = function () {
    return new Set(this.getOwnSaved()
        .filter(item => item?.approvedFromPartner)
        .map(item => canonicalizePairingSavedNameKey(item.approvedPartnerSavedKey) || this.buildSavedMatchKey(item))
        .filter(Boolean));
};

MeimayPartnerInsights.getPartnerApprovedSavedKeys = function () {
    return new Set(this.getPartnerSaved()
        .filter(item => item?.approvedFromPartner)
        .map(item => canonicalizePairingSavedNameKey(item.approvedPartnerSavedKey) || this.buildSavedMatchKey(item))
        .filter(Boolean));
};

MeimayPartnerInsights.getExplicitMatchedSavedKeys = function () {
    const matched = new Set();
    const ownSavedKeys = new Set(this.getOwnSaved().map(item => this.buildSavedMatchKey(item)).filter(Boolean));
    const partnerSavedKeys = new Set(this.getPartnerSaved().map(item => this.buildSavedMatchKey(item)).filter(Boolean));

    this.getOwnApprovedSavedKeys().forEach(key => {
        if (partnerSavedKeys.has(key)) matched.add(key);
    });
    this.getPartnerApprovedSavedKeys().forEach(key => {
        if (ownSavedKeys.has(key)) matched.add(key);
    });

    return matched;
};

MeimayPartnerInsights.getMatchedSavedItems = function () {
    const matchedKeys = this.getExplicitMatchedSavedKeys();
    if (matchedKeys.size === 0) return [];

    const ownSaved = this.getOwnSaved();
    const representativeByKey = new Map();
    ownSaved.forEach(item => {
        const key = this.buildSavedMatchKey(item);
        if (!key || !matchedKeys.has(key)) return;
        const existing = representativeByKey.get(key);
        if (!existing || (existing.approvedFromPartner && !item.approvedFromPartner)) {
            representativeByKey.set(key, item);
        }
    });

    return Array.from(matchedKeys)
        .map(key => representativeByKey.get(key))
        .filter(Boolean);
};

MeimayPartnerInsights.isSavedItemMatched = function (item) {
    const key = this.buildSavedMatchKey(item);
    if (!key) return false;
    return this.getExplicitMatchedSavedKeys().has(key);
};

MeimayPartnerInsights.isPartnerSavedApproved = function (item) {
    const key = this.buildSavedMatchKey(item);
    if (!key) return false;
    if (item?.approvedFromPartner) return true;
    return this.getOwnApprovedSavedKeys().has(key);
};

MeimayPartnerInsights.isPartnerReadingApproved = function (item) {
    const key = this.buildReadingStockKey(item);
    if (!key) return false;
    const ownKeys = new Set(this.getOwnReadingStock().map(entry => this.buildReadingStockKey(entry)).filter(Boolean));
    return ownKeys.has(key);
};

MeimayPartnerInsights.getOwnReadingCollection = function () {
    return this.buildReadingCollection(this.getOwnReadingStock(), this.getOwnLiked(), { fromPartner: false });
};

MeimayPartnerInsights.getPartnerReadingCollection = function () {
    return this.buildReadingCollection(this.getPartnerReadingStock(), this.getPartnerLiked(), { fromPartner: true });
};

MeimayPartnerInsights.getMatchedReadingItems = function () {
    const ownReadings = this.getOwnReadingStock();
    const partnerReadings = this.getPartnerReadingStock();
    const partnerKeys = new Set(partnerReadings.map(item => this.buildReadingStockKey(item)).filter(Boolean));
    const seenKeys = new Set();

    return ownReadings.filter(item => {
        const key = this.buildReadingStockKey(item);
        if (!key || !partnerKeys.has(key) || seenKeys.has(key)) {
            return false;
        }
        seenKeys.add(key);
        return true;
    });
};

MeimayPartnerInsights.isReadingItemMatched = function (item) {
    const key = this.buildReadingStockKey(item);
    if (!key) return false;

    const partnerReadings = this.getPartnerReadingStock();
    const partnerKeys = new Set(partnerReadings.map(entry => this.buildReadingStockKey(entry)).filter(Boolean));
    return partnerKeys.has(key);
};

MeimayPartnerInsights.getSummary = function () {
    const ownReadingItems = this.getOwnReadingStock();
    const partnerReadingItems = this.getPartnerReadingStock();
    const ownLikedItems = this.getOwnLiked();
    const partnerLikedItems = this.getPartnerLiked();
    const ownSavedItems = this.getOwnSaved();
    const partnerSavedItems = this.getPartnerSaved();
    const matchedReadingItems = this.getMatchedReadingItems();
    const matchedLikedItems = this.getMatchedLikedItems();
    const matchedSavedItems = this.getMatchedSavedItems();
    const partnerName = this.getPartnerDisplayName();
    const ownKanjiCount = typeof window.getVisibleKanjiStockCardCount === 'function' ? window.getVisibleKanjiStockCardCount('all', ownLikedItems) : ownLikedItems.length;
    const partnerKanjiCount = typeof window.getVisibleKanjiStockCardCount === 'function'
        ? window.getVisibleKanjiStockCardCount('partner', partnerLikedItems)
        : partnerLikedItems.length;
    const matchedKanjiCount = typeof window.getVisibleKanjiStockCardCount === 'function' ? window.getVisibleKanjiStockCardCount('matched') : matchedLikedItems.length;
    const previewLabels = [
        ...matchedSavedItems.slice(0, 2).map(item => item.givenName || item.fullName || ''),
        ...matchedLikedItems.slice(0, 3).map(item => item['漢字'] || '')
    ].filter(Boolean).slice(0, 4);

    return {
        inRoom: !!MeimayPairing.roomCode,
        hasPartner: !!MeimayPairing.partnerUid,
        partnerLabel: partnerName,
        partnerDisplayName: partnerName,
        ownReadingCount: ownReadingItems.length,
        partnerReadingCount: partnerReadingItems.length,
        ownKanjiCount: ownKanjiCount,
        partnerKanjiCount: partnerKanjiCount,
        ownSavedCount: ownSavedItems.length,
        partnerSavedCount: partnerSavedItems.length,
        matchedReadingCount: matchedReadingItems.length,
        matchedKanjiCount: matchedKanjiCount,
        matchedNameCount: matchedSavedItems.length,
        matchedReadingItems: matchedReadingItems,
        matchedLikedItems: matchedLikedItems,
        matchedSavedItems: matchedSavedItems,
        matchedTotalCount: matchedReadingItems.length + matchedKanjiCount + matchedSavedItems.length,
        ownTotalCount: ownReadingItems.length + ownKanjiCount + ownSavedItems.length,
        partnerTotalCount: partnerReadingItems.length + partnerKanjiCount + partnerSavedItems.length,
        counts: {
            own: {
                reading: ownReadingItems.length,
                kanji: ownKanjiCount,
                saved: ownSavedItems.length
            },
            partner: {
                reading: partnerReadingItems.length,
                kanji: partnerKanjiCount,
                saved: partnerSavedItems.length
            },
            matched: {
                reading: matchedReadingItems.length,
                kanji: matchedKanjiCount,
                saved: matchedSavedItems.length
            }
        },
        previewLabels: previewLabels
    };
};

function inferPartnerRole(role) {
    if (role === 'mama') return 'papa';
    if (role === 'papa') return 'mama';
    return 'mama';
}

function getMeimayRolePalette(role) {
    if (role === 'mama') {
        return {
            role: 'mama',
            label: '繝槭・',
            accent: '#f2a2b8',
            accentStrong: '#dc7f9c',
            accentSoft: '#fef0f5',
            surface: '#fff8fb',
            mist: '#fff5f8',
            border: '#f7dbe5',
            text: '#8e6170',
            shadow: 'rgba(242, 162, 184, 0.14)',
            star: '#ea89a7'
        };
    }
    return {
        role: 'papa',
        label: '繝代ヱ',
        accent: '#8fbff8',
        accentStrong: '#5f98de',
        accentSoft: '#eff7ff',
        surface: '#f8fbff',
        mist: '#f3f8ff',
        border: '#d9e8ff',
        text: '#59779d',
        shadow: 'rgba(143, 191, 248, 0.14)',
        star: '#6ea9ef'
    };
}

function getMeimayRelationshipPalettes() {
    const myRole = typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : null;
    const resolvedSelfRole = (myRole === 'mama' || myRole === 'papa') ? myRole : 'papa';
    const partnerRole = MeimayShare?.partnerSnapshot?.role;
    const resolvedPartnerRole = (partnerRole === 'mama' || partnerRole === 'papa')
        ? partnerRole
        : inferPartnerRole(resolvedSelfRole);
    const selfBase = typeof window.getActiveProfilePalette === 'function'
        ? window.getActiveProfilePalette(resolvedSelfRole)
        : getMeimayRolePalette(resolvedSelfRole);
    const partnerThemeId = String(MeimayShare?.partnerSnapshot?.themeId || '').trim() || getDefaultProfileThemeId(resolvedPartnerRole);
    const partnerBase = typeof window.getActiveProfilePalette === 'function'
        ? window.getActiveProfilePalette(resolvedPartnerRole, partnerThemeId)
        : getMeimayRolePalette(resolvedPartnerRole);
    const getMatchedSurface = (base) => base?.mist || base?.surface || '#fffaf5';
    const getMatchedAccent = (base) => base?.accentSoft || base?.accent || '#fff1e1';
    const getMatchedBorder = (base) => base?.border || '#eadfce';
    const self = {
        ...selfBase,
        surface: `linear-gradient(to bottom right, ${selfBase.mist} 0%, ${selfBase.accentSoft} 28%, #ffffff 100%)`
    };
    const partner = {
        ...partnerBase,
        surface: `linear-gradient(to top left, ${partnerBase.mist} 0%, ${partnerBase.accentSoft} 28%, #ffffff 100%)`
    };

    return {
        self,
        partner,
        matched: {
            role: 'matched',
            label: '縺ｵ縺溘ｊ',
            accent: self.accent,
            accentAlt: partner.accent,
            accentSoft: `linear-gradient(135deg, ${getMatchedAccent(selfBase)} 0%, #fffafc 46%, ${getMatchedAccent(partnerBase)} 100%)`,
            surface: `linear-gradient(135deg, ${getMatchedSurface(selfBase)} 0%, #fffdfb 44%, ${getMatchedSurface(partnerBase)} 100%)`,
            border: getMatchedBorder(selfBase),
            borderAlt: getMatchedBorder(partnerBase),
            text: '#7d6671',
            shadow: 'rgba(189, 166, 204, 0.18)'
        }
    };
}

function getMeimayOwnershipPalette(kind) {
    const palettes = getMeimayRelationshipPalettes();
    if (kind === 'partner') return palettes.partner;
    if (kind === 'matched') return palettes.matched;
    return palettes.self;
}

function renderMeimaySuperStars(options = {}) {
    const palettes = getMeimayRelationshipPalettes();
    const stars = [];
    if (options.self) {
        stars.push(`<span style="color:${palettes.self.star}; text-shadow:0 1px 0 rgba(255,255,255,0.72)">\u2605</span>`);
    }
    if (options.partner) {
        stars.push(`<span style="color:${palettes.partner.star}; text-shadow:0 1px 0 rgba(255,255,255,0.72)">\u2605</span>`);
    }
    if (stars.length === 0) return '';
    const className = options.className || '';
    const inlineStyle = options.style ? ` style="${options.style}"` : '';
    return `<div class="${className}"${inlineStyle}>${stars.join('')}</div>`;
}

window.getMeimayRelationshipPalettes = getMeimayRelationshipPalettes;
window.getMeimayOwnershipPalette = getMeimayOwnershipPalette;
window.renderMeimaySuperStars = renderMeimaySuperStars;

function refreshPartnerAwareUI() {
    if (typeof applyProfileTheme === 'function') applyProfileTheme();
    if (typeof renderHomeProfile === 'function' && document.getElementById('scr-mode')) {
        renderHomeProfile();
    }
    if (typeof renderSavedScreen === 'function' && document.getElementById('scr-saved')?.classList.contains('active')) {
        renderSavedScreen();
    }
    if (typeof renderSettingsScreen === 'function' && document.getElementById('scr-settings')?.classList.contains('active')) {
        renderSettingsScreen();
    }
    if (document.getElementById('scr-stock')?.classList.contains('active')) {
        if (typeof renderStock === 'function') renderStock();
        if (typeof renderReadingStockSection === 'function') renderReadingStockSection();
    }
    if (document.getElementById('scr-build')?.classList.contains('active')) {
        if (typeof renderBuildSelection === 'function') renderBuildSelection();
    }
    if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
}

window.refreshPartnerAwareUI = refreshPartnerAwareUI;
window.getPartnerRoleLabel = getPartnerRoleLabel;

const MeimayUserBackup = {
    _syncTimer: null,
    _syncInFlight: false,
    _restoreInFlight: false,
    _lastSyncedFingerprint: '',
    _hooksInstalled: false,
    _remoteBackupDisabled: false,

    _isPermissionDeniedError: function (error) {
        const code = String(error?.code || error?.name || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        return code.includes('permission') || code.includes('denied') || message.includes('missing or insufficient permissions') || message.includes('permission denied');
    },

    _currentUser: function () {
        if (typeof MeimayAuth !== 'undefined' && typeof MeimayAuth.getCurrentUser === 'function') {
            return MeimayAuth.getCurrentUser();
        }
        if (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser) {
            return firebaseAuth.currentUser;
        }
        return null;
    },

    _safeClone: function (value) {
        if (value == null || typeof value !== 'object') return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            if (Array.isArray(value)) {
                return value.map((item) => this._safeClone(item));
            }
            return { ...value };
        }
    },

    _ownLikedItems: function () {
        let source = [];
        try {
            if (typeof StorageBox !== 'undefined' && typeof StorageBox._loadLikedState === 'function') {
                const state = StorageBox._loadLikedState();
                source = Array.isArray(state?.items) ? state.items : [];
                const removedFilteredState = typeof StorageBox._filterRemovedLikedItems === 'function'
                    ? StorageBox._filterRemovedLikedItems(source)
                    : source;
                const filteredState = removedFilteredState
                    .filter((item) => item && !item.fromPartner)
                    .map((item) => this._safeClone(item));
                if (filteredState.length > 0) {
                    return filteredState;
                }
            } else if (Array.isArray(liked)) {
                source = liked;
            }
        } catch (error) {
            source = Array.isArray(liked) ? liked : [];
        }

        if (Array.isArray(liked) && liked.length > 0) {
            const removedFilteredLiked = typeof StorageBox !== 'undefined' && typeof StorageBox._filterRemovedLikedItems === 'function'
                ? StorageBox._filterRemovedLikedItems(liked)
                : liked;
            const filteredLiked = removedFilteredLiked
                .filter((item) => item && !item.fromPartner)
                .map((item) => this._safeClone(item));
            if (filteredLiked.length > 0) {
                return filteredLiked;
            }
        }

        try {
            const keys = [
                typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED ? StorageBox.KEY_LIKED : 'naming_app_liked_chars',
                typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_LEGACY ? StorageBox.KEY_LIKED_LEGACY : 'meimay_liked',
                typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_BACKUP ? StorageBox.KEY_LIKED_BACKUP : 'meimay_liked_backup_v1'
            ];

            for (const key of keys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                const items = Array.isArray(parsed)
                    ? parsed.filter((item) => item && !item.fromPartner)
                    : [];
                const removedFilteredItems = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
                    ? StorageBox._filterRemovedLikedItems(items)
                    : items;
                if (removedFilteredItems.length > 0) {
                    return removedFilteredItems.map((item) => this._safeClone(item));
                }
            }
        } catch (error) {
            console.warn('BACKUP: Failed to read liked fallback sources', error);
        }

        return [];
    },

    _ownSavedNames: function () {
        try {
            const list = typeof getSavedNames === 'function'
                ? getSavedNames()
                : (Array.isArray(savedNames) ? savedNames : JSON.parse(localStorage.getItem('meimay_saved') || '[]'));
            return Array.isArray(list)
                ? list.filter((item) => item && !item.fromPartner).map((item) => this._safeClone(item))
                : [];
        } catch (error) {
            return Array.isArray(savedNames)
                ? savedNames.filter((item) => item && !item.fromPartner).map((item) => this._safeClone(item))
                : [];
        }
    },

    _ownReadingStock: function () {
        try {
            const stock = typeof getReadingStock === 'function' ? getReadingStock() : [];
            return Array.isArray(stock)
                ? stock.filter((item) => item && !item.fromPartner).map((item) => this._safeClone(item))
                : [];
        } catch (error) {
            return [];
        }
    },

    _readChildWorkspaceStateV2: function () {
        try {
            if (typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces && typeof MeimayChildWorkspaces.getRootSnapshot === 'function') {
                const snapshot = MeimayChildWorkspaces.getRootSnapshot();
                if (snapshot && typeof snapshot === 'object') {
                    return this._safeClone(snapshot);
                }
            }

            const raw = localStorage.getItem('meimay_state_v2');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    },

    _getChildWorkspaceStateV2Stamp: function (state = null) {
        const snapshot = state || this._readChildWorkspaceStateV2();
        if (!snapshot || typeof snapshot !== 'object') return '';
        const updatedAt = String(snapshot.updatedAt || '').trim();
        if (updatedAt) return updatedAt;
        const createdAt = String(snapshot.createdAt || '').trim();
        if (createdAt) return createdAt;
        return JSON.stringify({
            version: snapshot.version || 0,
            activeChildId: String(snapshot.activeChildId || ''),
            childCount: snapshot && snapshot.children && typeof snapshot.children === 'object'
                ? Object.keys(snapshot.children).length
                : 0,
            childOrderCount: Array.isArray(snapshot.childOrder) ? snapshot.childOrder.length : 0
        });
    },

    _hasChildWorkspaceStructureDelta: function (localState = null, remoteState = null) {
        if (!remoteState || typeof remoteState !== 'object') return false;
        if (!localState || typeof localState !== 'object') return true;

        const toPositiveInt = (value, fallback = 1) => {
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        };
        const toNonNegativeInt = (value, fallback = 0) => {
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
        };
        const getSlotKey = (child) => {
            const meta = child?.meta || child || {};
            const birthOrder = toPositiveInt(meta.birthOrder, 1);
            const rawTwinIndex = meta.birthGroupIndex ?? meta.twinIndex ?? meta.multipleIndex ?? null;
            const twinIndex = rawTwinIndex === null || rawTwinIndex === undefined || rawTwinIndex === ''
                ? null
                : toNonNegativeInt(rawTwinIndex, 0);
            return `${birthOrder}:${twinIndex === null ? 'n' : twinIndex}`;
        };

        const localChildren = localState.children && typeof localState.children === 'object'
            ? localState.children
            : {};
        const remoteChildren = remoteState.children && typeof remoteState.children === 'object'
            ? remoteState.children
            : {};
        const localSlots = new Set(Object.values(localChildren).map((child) => getSlotKey(child)).filter(Boolean));
        const remoteSlots = new Set(Object.values(remoteChildren).map((child) => getSlotKey(child)).filter(Boolean));

        if (remoteSlots.size !== localSlots.size) return true;
        for (const slotKey of remoteSlots) {
            if (!localSlots.has(slotKey)) return true;
        }
        return false;
    },

    _shouldApplyRemoteChildWorkspaceStateV2: function (localState = null, remoteState = null) {
        if (!remoteState || typeof remoteState !== 'object') return false;
        if (!localState || typeof localState !== 'object') return true;
        if (this._hasChildWorkspaceStructureDelta(localState, remoteState)) return true;
        const parseStamp = (value) => {
            const time = new Date(String(value || '').trim() || 0).getTime();
            return Number.isFinite(time) ? time : 0;
        };

        const remoteStamp = parseStamp(this._getChildWorkspaceStateV2Stamp(remoteState));
        const localStamp = parseStamp(this._getChildWorkspaceStateV2Stamp(localState));
        if (remoteStamp > 0 || localStamp > 0) {
            return remoteStamp >= localStamp;
        }
        return false;
    },

    _applyChildWorkspaceStateV2: function (state = null) {
        if (!state || typeof state !== 'object') return false;
        try {
            let applied = false;
            if (typeof MeimayChildWorkspaces !== 'undefined' && MeimayChildWorkspaces && typeof MeimayChildWorkspaces.applyRemoteRootSnapshot === 'function') {
                applied = MeimayChildWorkspaces.applyRemoteRootSnapshot(state, { reason: 'firestore-bootstrap' });
            } else {
                localStorage.setItem('meimay_state_v2', JSON.stringify(state));
                applied = true;
            }
            if (applied && typeof this.scheduleSync === 'function') {
                this.scheduleSync('child-workspace-apply');
            }
            return applied;
        } catch (error) {
            console.warn('BACKUP: Failed to apply child workspace state', error);
            return false;
        }
    },

    _readCurrentSections: function () {
        return {
            liked: this._ownLikedItems(),
            savedNames: this._ownSavedNames(),
            readingStock: this._ownReadingStock(),
            likedRemoved: typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._loadLikedRemovalState === 'function'
                ? StorageBox._loadLikedRemovalState()
                : [],
            childWorkspaceStateV2: this._readChildWorkspaceStateV2()
        };
    },

    _getLikedKey: function (item) {
        const kanji = item?.['漢字'] || item?.['貌｡蟄･'] || item?.kanji || '';
        if (kanji) return kanji;
        const sessionReading = String(item?.sessionReading || '').trim();
        const slot = String(item?.slot ?? '').trim();
        const reading = String(item?.reading || '').trim();
        return [sessionReading, slot, reading].filter(Boolean).join('::');
    },

    _getSavedKey: function (item) {
        const fullName = String(item?.fullName || '').trim();
        if (fullName) return fullName;
        const givenName = String(item?.givenName || '').trim();
        if (givenName) return givenName;
        if (Array.isArray(item?.combinationKeys) && item.combinationKeys.length > 0) {
            return item.combinationKeys.join('');
        }
        if (Array.isArray(item?.combination) && item.combination.length > 0) {
            return item.combination.map((part) => part?.kanji || part?.['漢字'] || '').join('');
        }
        return '';
    },

    _getReadingStockKey: function (item) {
        if (!item) return '';
        if (item.id) return String(item.id).trim();
        const reading = String(item.reading || '').trim();
        const segments = Array.isArray(item.segments) ? item.segments.join('/') : '';
        if (typeof getReadingStockKey === 'function') {
            return getReadingStockKey(reading, Array.isArray(item.segments) ? item.segments : []);
        }
        return [reading, segments].filter(Boolean).join('::');
    },

    _mergeByKey: function (localItems, remoteItems, keyGetter) {
        const merged = new Map();
        const parseStamp = (value) => {
            const stamp = new Date(String(value || '').trim() || 0).getTime();
            return Number.isFinite(stamp) ? stamp : 0;
        };
        const mergeSelectionState = (existing, incoming, base) => {
            const hasMainSelected = (existing && Object.prototype.hasOwnProperty.call(existing, 'mainSelected'))
                || (incoming && Object.prototype.hasOwnProperty.call(incoming, 'mainSelected'))
                || existing?.mainSelected === true
                || incoming?.mainSelected === true;
            if (hasMainSelected) {
                const existingSelected = existing?.mainSelected === true;
                const incomingSelected = incoming?.mainSelected === true;
                const existingAt = String(existing?.mainSelectedAt || '').trim();
                const incomingAt = String(incoming?.mainSelectedAt || '').trim();
                base.mainSelected = existingSelected || incomingSelected;
                if (base.mainSelected) {
                    if (existingSelected && incomingSelected) {
                        base.mainSelectedAt = parseStamp(existingAt) >= parseStamp(incomingAt)
                            ? (existingAt || incomingAt)
                            : (incomingAt || existingAt);
                    } else if (existingSelected) {
                        base.mainSelectedAt = existingAt || incomingAt;
                    } else {
                        base.mainSelectedAt = incomingAt || existingAt;
                    }
                } else {
                    base.mainSelectedAt = '';
                }
            }
            if ((existing && Object.prototype.hasOwnProperty.call(existing, 'approvedFromPartner'))
                || (incoming && Object.prototype.hasOwnProperty.call(incoming, 'approvedFromPartner'))
                || existing?.approvedFromPartner === true
                || incoming?.approvedFromPartner === true) {
                base.approvedFromPartner = existing?.approvedFromPartner === true || incoming?.approvedFromPartner === true;
            }
            if ((existing && Object.prototype.hasOwnProperty.call(existing, 'fromPartner'))
                || (incoming && Object.prototype.hasOwnProperty.call(incoming, 'fromPartner'))
                || existing?.fromPartner === true
                || incoming?.fromPartner === true) {
                base.fromPartner = existing?.fromPartner === true || incoming?.fromPartner === true;
            }
            if ((existing && Object.prototype.hasOwnProperty.call(existing, 'approvedPartnerSavedKey'))
                || (incoming && Object.prototype.hasOwnProperty.call(incoming, 'approvedPartnerSavedKey'))) {
                base.approvedPartnerSavedKey = String(existing?.approvedPartnerSavedKey || incoming?.approvedPartnerSavedKey || '').trim();
            }
            if ((existing && Object.prototype.hasOwnProperty.call(existing, 'partnerName'))
                || (incoming && Object.prototype.hasOwnProperty.call(incoming, 'partnerName'))) {
                base.partnerName = String(existing?.partnerName || incoming?.partnerName || '').trim();
            }
            return base;
        };
        const put = (item, preferExisting) => {
            if (!item) return;
            const key = String(keyGetter(item) || '').trim();
            const clone = this._safeClone(item);
            if (!key) {
                merged.set(`__${merged.size}_${Math.random().toString(36).slice(2)}`, clone);
                return;
            }
            if (!merged.has(key)) {
                merged.set(key, mergeSelectionState({}, clone, clone));
                return;
            }
            const existing = merged.get(key);
            const base = preferExisting ? { ...clone, ...existing } : { ...existing, ...clone };
            merged.set(key, mergeSelectionState(existing, clone, base));
        };

        (Array.isArray(localItems) ? localItems : []).forEach((item) => put(item, true));
        (Array.isArray(remoteItems) ? remoteItems : []).forEach((item) => put(item, false));
        return Array.from(merged.values());
    },

    _normalizeReadingStockList: function (items) {
        const list = Array.isArray(items) ? items : [];
        return list.map((item) => {
            if (typeof normalizeReadingStockItem === 'function') {
                return normalizeReadingStockItem(this._safeClone(item));
            }
            return this._safeClone(item);
        }).filter(Boolean);
    },

    _hasData: function (sections) {
        const likedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_CLEARED
            ? localStorage.getItem(StorageBox.KEY_LIKED_CLEARED)
            : localStorage.getItem('meimay_liked_cleared_at');
        const savedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_SAVED_CLEARED
            ? localStorage.getItem(StorageBox.KEY_SAVED_CLEARED)
            : localStorage.getItem('meimay_saved_cleared_at');
        return !!(sections && (
            (Array.isArray(sections.liked) && sections.liked.length > 0) ||
            (Array.isArray(sections.likedRemoved) && sections.likedRemoved.length > 0) ||
            (Array.isArray(sections.savedNames) && sections.savedNames.length > 0) ||
            (Array.isArray(sections.readingStock) && sections.readingStock.length > 0) ||
            !!sections.childWorkspaceStateV2 ||
            !!likedClearFlag ||
            !!savedClearFlag
        ));
    },

    _fingerprint: function (sections) {
        try {
            const projectedSections = MeimayFirestorePayload.projectSections(sections);
            const pairRoomCode = typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode
                ? String(MeimayPairing.roomCode)
                : '';
            const hiddenReadings = typeof readNormalizedHiddenReadings === 'function'
                ? readNormalizedHiddenReadings()
                : [];
            const likedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_CLEARED
                ? localStorage.getItem(StorageBox.KEY_LIKED_CLEARED)
                : localStorage.getItem('meimay_liked_cleared_at');
            const savedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_SAVED_CLEARED
                ? localStorage.getItem(StorageBox.KEY_SAVED_CLEARED)
                : localStorage.getItem('meimay_saved_cleared_at');
            return JSON.stringify({
                liked: projectedSections.liked || [],
                likedRemoved: Array.isArray(sections?.likedRemoved) ? sections.likedRemoved.length : 0,
                savedNames: projectedSections.savedNames || [],
                readingStock: projectedSections.readingStock || [],
                pairRoomCode,
                hiddenReadings,
                likedClearFlag: !!likedClearFlag,
                savedClearFlag: !!savedClearFlag,
                childWorkspaceStateV2: this._getChildWorkspaceStateV2Stamp(sections?.childWorkspaceStateV2)
            });
        } catch (error) {
            return `${sections?.liked?.length || 0}:${sections?.savedNames?.length || 0}:${sections?.readingStock?.length || 0}:${localStorage.getItem('meimay_liked_cleared_at') ? 1 : 0}:${localStorage.getItem('meimay_saved_cleared_at') ? 1 : 0}`;
        }
    },

    _buildRemotePatch: function (sections) {
        const childWorkspaceStateV2 = sections?.childWorkspaceStateV2 || this._readChildWorkspaceStateV2();
        const projectedSections = MeimayFirestorePayload.projectSections({
            ...(sections || {}),
            savedNames: typeof canonicalizeSavedNamesForSync === 'function'
                ? canonicalizeSavedNamesForSync(sections?.savedNames, childWorkspaceStateV2)
                : sections?.savedNames
        });
        const likedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_CLEARED
            ? localStorage.getItem(StorageBox.KEY_LIKED_CLEARED)
            : localStorage.getItem('meimay_liked_cleared_at');
        const savedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_SAVED_CLEARED
            ? localStorage.getItem(StorageBox.KEY_SAVED_CLEARED)
            : localStorage.getItem('meimay_saved_cleared_at');
        const likedRemoved = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._loadLikedRemovalState === 'function'
            ? StorageBox._loadLikedRemovalState()
            : [];
        const likedShouldClear = likedClearFlag
            || (Array.isArray(likedRemoved) && likedRemoved.length > 0 && (!Array.isArray(projectedSections.liked) || projectedSections.liked.length === 0));
        const backup = {
            schemaVersion: 1,
            syncedAtMs: Date.now(),
            likedCount: Array.isArray(projectedSections.liked) ? projectedSections.liked.length : 0,
            savedNamesCount: Array.isArray(projectedSections.savedNames) ? projectedSections.savedNames.length : 0,
            readingStockCount: Array.isArray(projectedSections.readingStock) ? projectedSections.readingStock.length : 0,
            likedRemovedCount: Array.isArray(likedRemoved) ? likedRemoved.length : 0,
            likedRemoved: this._safeClone(Array.isArray(likedRemoved) ? likedRemoved : [])
        };
        const pairRoomCode = typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode
            ? String(MeimayPairing.roomCode)
            : null;
        const hiddenReadings = typeof readNormalizedHiddenReadings === 'function'
            ? readNormalizedHiddenReadings()
            : [];

        if (Array.isArray(projectedSections.liked) && projectedSections.liked.length > 0 && !likedShouldClear) {
            backup.liked = this._safeClone(projectedSections.liked);
        } else if (likedShouldClear) {
            backup.liked = [];
        }
        if (Array.isArray(projectedSections.savedNames) && projectedSections.savedNames.length > 0) {
            backup.savedNames = this._safeClone(projectedSections.savedNames);
        } else if (savedClearFlag) {
            backup.savedNames = [];
        }
        if (Array.isArray(projectedSections.readingStock) && projectedSections.readingStock.length > 0) {
            backup.readingStock = this._safeClone(this._normalizeReadingStockList(projectedSections.readingStock));
        }
        if (childWorkspaceStateV2 && typeof childWorkspaceStateV2 === 'object') {
            backup.meimayStateV2 = this._safeClone(childWorkspaceStateV2);
            backup.meimayStateV2UpdatedAt = String(childWorkspaceStateV2.updatedAt || childWorkspaceStateV2.savedAt || childWorkspaceStateV2.createdAt || '');
        }

        const patch = {
            meimayBackup: backup,
            backup,
            pairRoomCode,
            roomCode: pairRoomCode,
            hiddenReadings: this._safeClone(Array.isArray(hiddenReadings) ? hiddenReadings : []),
            likedRemoved: this._safeClone(Array.isArray(likedRemoved) ? likedRemoved : []),
            meimayBackupUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (likedShouldClear) {
            patch.liked = Array.isArray(projectedSections.liked) && projectedSections.liked.length > 0
                ? this._safeClone(projectedSections.liked)
                : [];
        }
        if (savedClearFlag) {
            patch.savedNames = Array.isArray(projectedSections.savedNames) && projectedSections.savedNames.length > 0
                ? this._safeClone(projectedSections.savedNames)
                : [];
        }

        return patch;
    },

    _applySectionsToLocal: function (sections) {
        const hydratedSections = MeimayFirestorePayload.hydrateSections(sections);
        const likedItems = Array.isArray(hydratedSections?.liked) ? hydratedSections.liked : [];
        const safeLikedItems = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
            ? StorageBox._filterRemovedLikedItems(likedItems)
            : likedItems;
        const savedItems = Array.isArray(hydratedSections?.savedNames) ? hydratedSections.savedNames : [];
        const readingStockItems = this._normalizeReadingStockList(Array.isArray(hydratedSections?.readingStock) ? hydratedSections.readingStock : []);

        this._restoreInFlight = true;
        try {
            if (typeof liked !== 'undefined') liked = this._safeClone(safeLikedItems);
            if (typeof savedNames !== 'undefined') savedNames = this._safeClone(savedItems);
            const hadLikedState = localStorage.getItem('meimay_liked') !== null
                || localStorage.getItem('meimay_liked_cleared_at') !== null
                || localStorage.getItem('naming_app_liked_chars') !== null
                || localStorage.getItem('meimay_liked_backup_v1') !== null
                || localStorage.getItem('meimay_liked_meta_v1') !== null;

            if (typeof StorageBox !== 'undefined') {
                if (typeof StorageBox._persistLikedState === 'function') {
                    StorageBox._persistLikedState(safeLikedItems);
                } else {
                    localStorage.setItem('naming_app_liked_chars', JSON.stringify(safeLikedItems));
                    localStorage.setItem('meimay_liked', JSON.stringify(safeLikedItems));
                    localStorage.setItem('meimay_liked_meta_v1', JSON.stringify({
                        count: safeLikedItems.length,
                        savedAt: new Date().toISOString()
                    }));
                }
            } else {
                localStorage.setItem('naming_app_liked_chars', JSON.stringify(safeLikedItems));
                localStorage.setItem('meimay_liked', JSON.stringify(safeLikedItems));
            }
            if (safeLikedItems.length === 0) {
                if (hadLikedState) {
                    localStorage.setItem('meimay_liked_cleared_at', new Date().toISOString());
                }
            } else {
                localStorage.removeItem('meimay_liked_cleared_at');
            }
            if (safeLikedItems.length === 0 && !hadLikedState) {
                localStorage.removeItem('meimay_liked');
                localStorage.removeItem('naming_app_liked_chars');
                localStorage.removeItem('meimay_liked_meta_v1');
                localStorage.removeItem('meimay_liked_backup_v1');
            }

            const hadSavedState = localStorage.getItem('meimay_saved') !== null
                || localStorage.getItem('meimay_saved_cleared_at') !== null;
            if (savedItems.length === 0 && !hadSavedState) {
                localStorage.removeItem('meimay_saved');
                localStorage.removeItem('meimay_saved_cleared_at');
            } else {
                localStorage.setItem('meimay_saved', JSON.stringify(savedItems));
                if (savedItems.length === 0) {
                    localStorage.setItem('meimay_saved_cleared_at', new Date().toISOString());
                } else {
                    localStorage.removeItem('meimay_saved_cleared_at');
                }
            }
            localStorage.setItem('meimay_reading_stock', JSON.stringify(readingStockItems));

            if (typeof StorageBox !== 'undefined' && typeof StorageBox.loadAll === 'function') {
                StorageBox.loadAll();
            }

            if (typeof renderHistoryScreen === 'function' && document.getElementById('scr-history')?.classList.contains('active')) {
                renderHistoryScreen();
            }
            if (typeof refreshPartnerAwareUI === 'function') {
                refreshPartnerAwareUI();
            }
        } finally {
            this._restoreInFlight = false;
        }
    },

    syncLocalToRemote: async function (user = null, options = {}) {
        const currentUser = user || this._currentUser();
        if (this._remoteBackupDisabled) return false;
        if (!currentUser || typeof firebaseDb === 'undefined' || !firebaseDb) return false;

        const sections = options.sections || this._readCurrentSections();
        if (!this._hasData(sections)) return false;

        const fingerprint = this._fingerprint(sections);
        if (!options.force && fingerprint === this._lastSyncedFingerprint) {
            return true;
        }

        try {
            await firebaseDb.collection('users').doc(currentUser.uid).set(
                this._buildRemotePatch(sections),
                { merge: true }
            );
            this._lastSyncedFingerprint = fingerprint;
            console.log(`BACKUP: synced Firestore backup for ${currentUser.uid}`);
            return true;
        } catch (error) {
            if (this._isPermissionDeniedError(error)) {
                this._remoteBackupDisabled = true;
                return false;
            }
            console.warn('BACKUP: Firestore sync failed', error);
            return false;
        }
    },

    bootstrapForUser: async function (user = null) {
        const currentUser = user || this._currentUser();
        if (this._remoteBackupDisabled) return false;
        if (!currentUser || typeof firebaseDb === 'undefined' || !firebaseDb) return false;
        if (this._restoreInFlight) return false;

        try {
            const doc = await firebaseDb.collection('users').doc(currentUser.uid).get();
            const remoteData = doc.exists ? (doc.data() || {}) : {};
            const remoteBackup = remoteData.meimayBackup || remoteData.backup || null;
            const filterRemoved = (items) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
                ? StorageBox._filterRemovedLikedItems(items)
                : (Array.isArray(items) ? items.filter(Boolean) : []);
            const remoteLikedRemovalSource = Array.isArray(remoteBackup?.likedRemoved) && remoteBackup.likedRemoved.length > 0
                ? remoteBackup.likedRemoved
                : (Array.isArray(remoteData.likedRemoved) ? remoteData.likedRemoved : []);
            if (Array.isArray(remoteLikedRemovalSource) && remoteLikedRemovalSource.length > 0
                && typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._persistLikedRemovalState === 'function') {
                StorageBox._persistLikedRemovalState(remoteLikedRemovalSource);
            }
            const remoteBackupLiked = Array.isArray(remoteBackup?.liked)
                ? filterRemoved(remoteBackup.liked)
                : [];
            const remoteChildWorkspaceStateV2 = remoteBackup?.meimayStateV2
                || remoteBackup?.stateV2
                || remoteData.meimayStateV2
                || remoteData.stateV2
                || null;
            const mergeRemoteItems = (nestedItems, legacyItems, keyGetter) => {
                const combined = [];
                if (Array.isArray(nestedItems)) combined.push(...filterRemoved(nestedItems));
                if (Array.isArray(legacyItems)) combined.push(...filterRemoved(legacyItems));
                return this._mergeByKey([], combined, keyGetter);
            };
            const remoteSections = {
                liked: mergeRemoteItems(remoteBackupLiked, remoteData.liked, (item) => this._getLikedKey(item)),
                savedNames: mergeRemoteItems(remoteBackup?.savedNames, remoteData.savedNames, (item) => this._getSavedKey(item)),
                readingStock: mergeRemoteItems(remoteBackup?.readingStock, remoteData.readingStock, (item) => this._getReadingStockKey(item))
            };

            const localSections = this._readCurrentSections();
            const likedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_LIKED_CLEARED
                ? localStorage.getItem(StorageBox.KEY_LIKED_CLEARED)
                : localStorage.getItem('meimay_liked_cleared_at');
            const savedClearFlag = typeof StorageBox !== 'undefined' && StorageBox.KEY_SAVED_CLEARED
                ? localStorage.getItem(StorageBox.KEY_SAVED_CLEARED)
                : localStorage.getItem('meimay_saved_cleared_at');

            if (likedClearFlag && (!Array.isArray(localSections.liked) || localSections.liked.length === 0)) {
                remoteSections.liked = [];
            }
            if (savedClearFlag && (!Array.isArray(localSections.savedNames) || localSections.savedNames.length === 0)) {
                remoteSections.savedNames = [];
            }

            const mergedSections = {
                liked: this._mergeByKey(localSections.liked, remoteSections.liked, (item) => this._getLikedKey(item)),
                savedNames: this._mergeByKey(localSections.savedNames, remoteSections.savedNames, (item) => this._getSavedKey(item)),
                readingStock: this._mergeByKey(localSections.readingStock, remoteSections.readingStock, (item) => this._getReadingStockKey(item))
            };

            const localChildWorkspaceStateV2 = this._readChildWorkspaceStateV2();
            if (remoteChildWorkspaceStateV2) {
                if (this._shouldApplyRemoteChildWorkspaceStateV2(localChildWorkspaceStateV2, remoteChildWorkspaceStateV2)) {
                    this._applyChildWorkspaceStateV2(remoteChildWorkspaceStateV2);
                }
            }

            if (this._hasData(mergedSections) && this._fingerprint(mergedSections) !== this._fingerprint(localSections)) {
                this._applySectionsToLocal(mergedSections);
            }

            const refreshedSections = this._readCurrentSections();
            await this.syncLocalToRemote(currentUser, { sections: refreshedSections, force: true });
            return true;
        } catch (error) {
            if (this._isPermissionDeniedError(error)) {
                this._remoteBackupDisabled = true;
                return false;
            }
            console.warn('BACKUP: bootstrap failed', error);
            return false;
        }
    },

    scheduleSync: function (reason = 'save') {
        if (this._restoreInFlight) return;
        if (this._remoteBackupDisabled) return;
        const currentUser = this._currentUser();
        if (!currentUser || typeof firebaseDb === 'undefined' || !firebaseDb) return;
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this.syncLocalToRemote(currentUser, { force: false, reason }).catch((error) => {
                console.warn('BACKUP: scheduled sync failed', error);
            });
        }, 1200);
    },

    installHooks: function () {
        if (this._hooksInstalled) return;
        this._hooksInstalled = true;

        if (typeof StorageBox !== 'undefined') {
            if (typeof StorageBox.saveAll === 'function' && !StorageBox.saveAll._meimayBackupWrapped) {
                const originalSaveAll = StorageBox.saveAll.bind(StorageBox);
                const manager = this;
                StorageBox.saveAll = function (...args) {
                    const result = originalSaveAll(...args);
                    if (!manager._restoreInFlight) manager.scheduleSync('saveAll');
                    return result;
                };
                StorageBox.saveAll._meimayBackupWrapped = true;
            }

            if (typeof StorageBox.saveLiked === 'function' && !StorageBox.saveLiked._meimayBackupWrapped) {
                const originalSaveLiked = StorageBox.saveLiked.bind(StorageBox);
                const manager = this;
                StorageBox.saveLiked = function (...args) {
                    const result = originalSaveLiked(...args);
                    if (!manager._restoreInFlight) manager.scheduleSync('saveLiked');
                    return result;
                };
                StorageBox.saveLiked._meimayBackupWrapped = true;
            }

            if (typeof StorageBox.saveSavedNames === 'function' && !StorageBox.saveSavedNames._meimayBackupWrapped) {
                const originalSaveSavedNames = StorageBox.saveSavedNames.bind(StorageBox);
                const manager = this;
                StorageBox.saveSavedNames = function (...args) {
                    const result = originalSaveSavedNames(...args);
                    if (!manager._restoreInFlight) manager.scheduleSync('saveSavedNames');
                    return result;
                };
                StorageBox.saveSavedNames._meimayBackupWrapped = true;
            }
        }

        if (typeof saveReadingStock === 'function' && !saveReadingStock._meimayBackupWrapped) {
            const originalSaveReadingStock = saveReadingStock.bind(window);
            const manager = this;
            saveReadingStock = function (...args) {
                const result = originalSaveReadingStock(...args);
                if (!manager._restoreInFlight) manager.scheduleSync('saveReadingStock');
                return result;
            };
            saveReadingStock._meimayBackupWrapped = true;
        }

        setInterval(() => {
            this.scheduleSync('interval');
        }, 60000);
    }
};

window.MeimayUserBackup = MeimayUserBackup;

cleanupLegacyPartnerLocalData();
MeimayUserBackup.installHooks();

MeimayShare._partnerUserUnsub = null;
MeimayShare.partnerUserSnapshot = null;

MeimayShare.buildPublicPremiumSnapshot = function (data) {
    if (!data) return null;

    const isPremium = typeof data.isPremium === 'boolean' ? data.isPremium : null;
    const subscriptionStatus = typeof data.subscriptionStatus === 'string'
        ? data.subscriptionStatus.trim().toLowerCase()
        : (typeof data.premiumStatus === 'string' ? data.premiumStatus.trim().toLowerCase() : null);
    const appStoreExpiresAt = data.appStoreExpiresAt || data.premiumExpiresAt || null;
    const premiumExpiresAt = data.premiumExpiresAt || data.appStoreExpiresAt || null;
    const appStoreProductId = typeof data.appStoreProductId === 'string'
        ? data.appStoreProductId.trim() || null
        : (typeof data.premiumProductId === 'string' ? data.premiumProductId.trim() || null : null);
    const premiumProductId = typeof data.premiumProductId === 'string'
        ? data.premiumProductId.trim() || null
        : appStoreProductId;
    const appStoreLastNotificationType = typeof data.appStoreLastNotificationType === 'string'
        ? data.appStoreLastNotificationType.trim() || null
        : (typeof data.latestNotificationType === 'string' ? data.latestNotificationType.trim() || null : null);
    const latestNotificationType = typeof data.latestNotificationType === 'string'
        ? data.latestNotificationType.trim() || null
        : appStoreLastNotificationType;
    const hasIndicators = isPremium !== null
        || !!subscriptionStatus
        || !!appStoreExpiresAt
        || !!premiumExpiresAt
        || !!appStoreProductId
        || !!premiumProductId;

    if (!hasIndicators) return null;

    return {
        raw: data,
        isPremium,
        subscriptionStatus,
        premiumStatus: subscriptionStatus,
        appStoreExpiresAt,
        premiumExpiresAt,
        appStoreProductId,
        premiumProductId,
        appStoreLastNotificationType,
        latestNotificationType,
        updatedAt: data.updatedAt || null
    };
};

MeimayShare.syncPremiumState = async function (premiumState = null) {
    const user = MeimayAuth.getCurrentUser();
    const roomCode = (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode)
        ? MeimayPairing.roomCode
        : (this.roomCode || null);
    const isLeavingRoom = !!((typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing._isLeavingRoom) || this._isLeavingRoom);
    if (!user || !roomCode || isLeavingRoom) return false;

    const state = this.buildPublicPremiumSnapshot
        ? this.buildPublicPremiumSnapshot(premiumState || (typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function'
            ? PremiumManager.getPublicPremiumSnapshot()
            : null))
        : null;

    if (!state) return false;

    try {
        await firebaseDb.collection('rooms').doc(roomCode)
            .collection('data').doc(user.uid).set({
                isPremium: state.isPremium,
                subscriptionStatus: state.subscriptionStatus,
                premiumStatus: state.premiumStatus,
                appStoreExpiresAt: state.appStoreExpiresAt,
                premiumExpiresAt: state.premiumExpiresAt,
                appStoreProductId: state.appStoreProductId,
                premiumProductId: state.premiumProductId,
                appStoreLastNotificationType: state.appStoreLastNotificationType,
                latestNotificationType: state.latestNotificationType,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        return true;
    } catch (e) {
        console.warn('SHARE: Sync premium state failed', e);
        return false;
    }
};

MeimayShare.listenPartnerData = function (partnerUid) {
    if (!partnerUid || !MeimayPairing.roomCode) return;
    this.stopListening();

    this._partnerUnsub = firebaseDb.collection('rooms').doc(MeimayPairing.roomCode)
        .collection('data').doc(partnerUid)
        .onSnapshot((doc) => {
            void (async () => {
                try {
            if (partnerUid !== MeimayPairing.partnerUid) return;
            const data = doc.exists ? (doc.data() || {}) : {};
            cleanupLegacyPartnerLocalData();
            const roomBackup = data.meimayBackup || data.backup || {};
            const roomLikedRemovalSource = Array.isArray(roomBackup?.likedRemoved) && roomBackup.likedRemoved.length > 0
                ? roomBackup.likedRemoved
                : (Array.isArray(data.likedRemoved) ? data.likedRemoved : []);
            let partnerLikedRemovalSource = Array.isArray(roomLikedRemovalSource) ? roomLikedRemovalSource : [];
            const filterRemoved = (items, removalSource = partnerLikedRemovalSource) => typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
                ? StorageBox._filterRemovedLikedItems(items, removalSource)
                : (Array.isArray(items) ? items.filter(Boolean) : []);
            let likedSource = filterRemoved(Array.isArray(data.liked) ? data.liked : [], partnerLikedRemovalSource);
            let savedNamesSource = Array.isArray(data.savedNames) ? data.savedNames : [];
            let readingStockSource = Array.isArray(data.readingStock) ? data.readingStock : [];
            let encounteredSource = Array.isArray(data.encounteredReadings) ? data.encounteredReadings : [];
            let hiddenReadingsSource = Array.isArray(data.hiddenReadings) ? data.hiddenReadings : [];
            let partnerChildWorkspaceStateV2 = data.meimayStateV2
                || roomBackup.meimayStateV2
                || roomBackup.childWorkspaceStateV2
                || null;

            if (!likedSource.length && Array.isArray(roomBackup.liked) && roomBackup.liked.length > 0) {
                likedSource = filterRemoved(roomBackup.liked);
            }
            if (!savedNamesSource.length && Array.isArray(roomBackup.savedNames) && roomBackup.savedNames.length > 0) {
                savedNamesSource = roomBackup.savedNames;
            }
            if (!readingStockSource.length && Array.isArray(roomBackup.readingStock) && roomBackup.readingStock.length > 0) {
                readingStockSource = roomBackup.readingStock;
            }
            if (!encounteredSource.length && Array.isArray(roomBackup.encounteredReadings) && roomBackup.encounteredReadings.length > 0) {
                encounteredSource = roomBackup.encounteredReadings;
            }
            if (!hiddenReadingsSource.length && Array.isArray(roomBackup.hiddenReadings) && roomBackup.hiddenReadings.length > 0) {
                hiddenReadingsSource = roomBackup.hiddenReadings;
            }

            const roomPremiumSnapshot = this.buildPublicPremiumSnapshot(data);
            let partnerPremiumSnapshot = roomPremiumSnapshot;
            let partnerUserBackup = null;
            if (partnerUid && (
                !likedSource.length
                || !savedNamesSource.length
                || !readingStockSource.length
                || !encounteredSource.length
                || !hiddenReadingsSource.length
                || !partnerChildWorkspaceStateV2
            )) {
                try {
                    const partnerUserDoc = await firebaseDb.collection('users').doc(partnerUid).get();
                    if (partnerUserDoc.exists) {
                        const partnerUserData = partnerUserDoc.data() || {};
                        const partnerBackup = partnerUserData.meimayBackup || partnerUserData.backup || {};
                        const remoteLikedRemovalSource = Array.isArray(partnerBackup?.likedRemoved) && partnerBackup.likedRemoved.length > 0
                            ? partnerBackup.likedRemoved
                            : (Array.isArray(partnerUserData.likedRemoved) ? partnerUserData.likedRemoved : []);
                        const effectiveLikedRemovalSource = Array.isArray(remoteLikedRemovalSource) && remoteLikedRemovalSource.length > 0
                            ? remoteLikedRemovalSource
                            : partnerLikedRemovalSource;
                        if ((!Array.isArray(partnerLikedRemovalSource) || partnerLikedRemovalSource.length === 0)
                            && Array.isArray(remoteLikedRemovalSource) && remoteLikedRemovalSource.length > 0) {
                            partnerLikedRemovalSource = remoteLikedRemovalSource;
                        }
                        const partnerBackupLiked = Array.isArray(partnerBackup.liked)
                            ? filterRemoved(partnerBackup.liked, effectiveLikedRemovalSource)
                            : [];
                        if (!partnerChildWorkspaceStateV2) {
                            partnerChildWorkspaceStateV2 = partnerBackup.meimayStateV2
                                || partnerBackup.childWorkspaceStateV2
                                || partnerUserData.meimayStateV2
                                || partnerUserData.childWorkspaceStateV2
                                || null;
                        }
                        partnerUserBackup = {
                            ...partnerBackup,
                            likedRemoved: Array.isArray(effectiveLikedRemovalSource) ? effectiveLikedRemovalSource : [],
                            liked: Array.isArray(partnerBackup.liked) && partnerBackup.liked.length > 0
                                ? filterRemoved(partnerBackup.liked, effectiveLikedRemovalSource)
                                : filterRemoved(partnerUserData.liked, effectiveLikedRemovalSource),
                            savedNames: Array.isArray(partnerBackup.savedNames) && partnerBackup.savedNames.length > 0
                                ? partnerBackup.savedNames
                                : (Array.isArray(partnerUserData.savedNames) ? partnerUserData.savedNames : []),
                            readingStock: Array.isArray(partnerBackup.readingStock) && partnerBackup.readingStock.length > 0
                                ? partnerBackup.readingStock
                                : (Array.isArray(partnerUserData.readingStock) ? partnerUserData.readingStock : []),
                            encounteredReadings: Array.isArray(partnerBackup.encounteredReadings) && partnerBackup.encounteredReadings.length > 0
                                ? partnerBackup.encounteredReadings
                                : (Array.isArray(partnerUserData.encounteredReadings) ? partnerUserData.encounteredReadings : []),
                            hiddenReadings: Array.isArray(partnerBackup.hiddenReadings) && partnerBackup.hiddenReadings.length > 0
                                ? partnerBackup.hiddenReadings
                                : (Array.isArray(partnerUserData.hiddenReadings) ? partnerUserData.hiddenReadings : [])
                        };
                        if (!likedSource.length && partnerBackupLiked.length > 0) {
                            likedSource = partnerBackupLiked;
                        }
                        if (!likedSource.length && Array.isArray(partnerUserBackup.liked)
                            && partnerUserBackup.liked.length > 0) {
                            likedSource = filterRemoved(partnerUserBackup.liked, effectiveLikedRemovalSource);
                        }
                        if (!savedNamesSource.length && Array.isArray(partnerUserBackup.savedNames) && partnerUserBackup.savedNames.length > 0) {
                            savedNamesSource = partnerUserBackup.savedNames;
                        }
                        if (!readingStockSource.length && Array.isArray(partnerUserBackup.readingStock) && partnerUserBackup.readingStock.length > 0) {
                            readingStockSource = partnerUserBackup.readingStock;
                        }
                        if (!encounteredSource.length && Array.isArray(partnerUserBackup.encounteredReadings) && partnerUserBackup.encounteredReadings.length > 0) {
                            encounteredSource = partnerUserBackup.encounteredReadings;
                        }
                        if (!hiddenReadingsSource.length && Array.isArray(partnerUserBackup.hiddenReadings) && partnerUserBackup.hiddenReadings.length > 0) {
                            hiddenReadingsSource = partnerUserBackup.hiddenReadings;
                        }
                    }
                } catch (error) {
                    // partner backup の読込に失敗しても room 側の値を優先する
                }
            }

            const hydratedSections = MeimayFirestorePayload.hydrateSections({
                liked: likedSource,
                savedNames: savedNamesSource,
                readingStock: readingStockSource,
                encounteredReadings: encounteredSource
            });

            this.partnerSnapshot = {
                liked: hydratedSections.liked,
                savedNames: hydratedSections.savedNames,
                readingStock: hydratedSections.readingStock,
                encounteredReadings: hydratedSections.encounteredReadings,
                hiddenReadings: readNormalizedHiddenReadingsFromSnapshot(hiddenReadingsSource.length > 0 ? hiddenReadingsSource : data.hiddenReadings),
                premiumState: partnerPremiumSnapshot,
                role: data.role || null,
                displayName: String(data.displayName || '').trim(),
                username: String(data.username || '').trim(),
                nickname: String(data.nickname || '').trim(),
                themeId: String(data.themeId || '').trim(),
                likedRemoved: Array.isArray(partnerLikedRemovalSource) ? partnerLikedRemovalSource : [],
                meimayStateV2: partnerChildWorkspaceStateV2,
                meimayStateV2UpdatedAt: partnerChildWorkspaceStateV2 && typeof MeimayUserBackup !== 'undefined' && MeimayUserBackup && typeof MeimayUserBackup._getChildWorkspaceStateV2Stamp === 'function'
                    ? MeimayUserBackup._getChildWorkspaceStateV2Stamp(partnerChildWorkspaceStateV2)
                    : '',
                meimayBackup: roomBackup,
                backup: roomBackup,
                partnerUserBackup
            };
            this.partnerUserSnapshot = partnerPremiumSnapshot;
            if (typeof updatePremiumUI === 'function') {
                updatePremiumUI();
            }

            if (typeof updatePairingUI === 'function') {
                updatePairingUI();
            } else if (typeof refreshPartnerAwareUI === 'function') {
                refreshPartnerAwareUI();
            }
                } catch (error) {
                    console.warn('SHARE: Listen partner data error', error);
                }
            })();
        }, (e) => {
            console.warn('SHARE: Listen partner data error', e);
        });

    console.log('SHARE: Listening for partner data');
};

MeimayShare.stopListening = function () {
    if (this._partnerUnsub) {
        this._partnerUnsub();
        this._partnerUnsub = null;
    }
    if (this._partnerUserUnsub) {
        this._partnerUserUnsub();
        this._partnerUserUnsub = null;
    }
    this.partnerSnapshot = { liked: [], savedNames: [], readingStock: [], encounteredReadings: [], hiddenReadings: [], likedRemoved: [], meimayBackup: null, backup: null, partnerUserBackup: null, premiumState: null, role: null, displayName: '', username: '', nickname: '', themeId: '' };
    this.partnerUserSnapshot = null;
    if (typeof updatePremiumUI === 'function') updatePremiumUI();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
};

window.getConnectedPartnerPremiumSnapshot = function () {
    if (typeof MeimayShare === 'undefined' || !MeimayShare) {
        return null;
    }
    if (typeof MeimayShare.getConnectedPremiumSnapshot === 'function') {
        const premiumSnapshot = MeimayShare.getConnectedPremiumSnapshot();
        if (premiumSnapshot) return premiumSnapshot;
    }
    if (MeimayShare.partnerUserSnapshot) {
        return MeimayShare.partnerUserSnapshot;
    }
    if (MeimayShare.partnerSnapshot && MeimayShare.partnerSnapshot.premiumState) {
        return MeimayShare.partnerSnapshot.premiumState;
    }
    return null;
};

window.getConnectedPremiumPartnerSnapshot = function () {
    return window.getConnectedPartnerPremiumSnapshot();
};
