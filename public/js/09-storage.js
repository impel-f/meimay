/* ============================================================
   MODULE 09: STORAGE (V13.1)
   LocalStorage永続化
   ============================================================ */

const StorageBox = {
    KEY_LIKED: 'naming_app_liked_chars',
    KEY_LIKED_LEGACY: 'meimay_liked',
    KEY_LIKED_BACKUP: 'meimay_liked_backup_v1',
    KEY_LIKED_META: 'meimay_liked_meta_v1',
    KEY_LIKED_CLEARED: 'meimay_liked_cleared_at',
    KEY_SAVED: 'meimay_saved',
    KEY_SAVED_CLEARED: 'meimay_saved_cleared_at',
    KEY_SURNAME: 'naming_app_surname',
    KEY_SEGMENTS: 'naming_app_segments',
    KEY_SETTINGS: 'naming_app_settings',
    KEY_KANJI_AI_CACHE: 'naming_app_kanji_ai_cache',
    KEY_USER_TAGS: 'meimay_user_tags',
    KEY_NOPED: 'meimay_noped',
    KEY_SOUND_PREFERENCES: 'meimay_sound_preferences',
    KEY_READING_STOCK: 'meimay_reading_stock',
    KEY_READING_HISTORY: 'meimay_reading_history',
    KEY_WIZARD: 'meimay_wizard',
    KEY_APP_SETTINGS: 'meimay_settings',
    KEY_PREMIUM: 'meimay_premium',
    KEY_APP_ACCOUNT_TOKEN: 'meimay_app_account_token',
    KEY_HOME_PAIR_CARD_DISMISSED: 'meimay_home_pair_card_dismissed_v1',
    KEY_BUILD_EXCLUDED: 'meimay_build_excluded',
    KEY_LIKED_REMOVED: 'meimay_liked_removed_v1',

    _readStoredArray: function (key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            console.warn(`STORAGE: Failed to parse ${key}`, e);
            return null;
        }
    },

    _normalizeLikedRemovalKey: function (value) {
        return String(value == null ? '' : value).trim();
    },

    _extractLikedRemovalKeys: function (target) {
        const keys = new Set();
        const add = (value) => {
            const key = this._normalizeLikedRemovalKey(value);
            if (key) keys.add(key);
        };

        if (typeof target === 'string' || typeof target === 'number') {
            add(target);
            return Array.from(keys);
        }

        if (!target || typeof target !== 'object') {
            return [];
        }

        if (typeof buildLikedCandidateKey === 'function') add(buildLikedCandidateKey(target));
        if (typeof getLikedCandidateDisplayKey === 'function') add(getLikedCandidateDisplayKey(target));
        if (typeof getLikedCandidateKanjiKey === 'function') add(getLikedCandidateKanjiKey(target));
        if (typeof getKanjiValue === 'function') add(getKanjiValue(target));
        add(target?.['漢字']);
        add(target?.kanji);

        return Array.from(keys);
    },

    _loadLikedRemovalState: function () {
        const removed = this._readStoredArray(this.KEY_LIKED_REMOVED);
        return Array.isArray(removed)
            ? [...new Set(removed.map((value) => this._normalizeLikedRemovalKey(value)).filter(Boolean))]
            : [];
    },

    _persistLikedRemovalState: function (items) {
        try {
            const safeRemoved = Array.isArray(items)
                ? [...new Set(items.map((value) => this._normalizeLikedRemovalKey(value)).filter(Boolean))]
                : [];
            if (safeRemoved.length === 0) {
                localStorage.removeItem(this.KEY_LIKED_REMOVED);
                return true;
            }
            localStorage.setItem(this.KEY_LIKED_REMOVED, JSON.stringify(safeRemoved));
            return true;
        } catch (e) {
            console.error("STORAGE: Save liked removal mirror failed", e);
            return false;
        }
    },

    _isRemovedLikedItem: function (item, removedSet = null) {
        if (!item) return false;
        const normalizedRemoved = removedSet instanceof Set ? removedSet : new Set(this._loadLikedRemovalState());
        if (normalizedRemoved.size === 0) return false;
        return this._extractLikedRemovalKeys(item).some((key) => normalizedRemoved.has(key));
    },

    _filterRemovedLikedItems: function (items) {
        const safeItems = Array.isArray(items) ? items : [];
        const removedSet = new Set(this._loadLikedRemovalState());
        if (removedSet.size === 0) return safeItems;
        return safeItems.filter((item) => !this._isRemovedLikedItem(item, removedSet));
    },

    recordRemovedLikedItems: function (target) {
        try {
            const next = new Set(this._loadLikedRemovalState());
            this._extractLikedRemovalKeys(target).forEach((key) => next.add(key));
            return this._persistLikedRemovalState(Array.from(next));
        } catch (e) {
            console.error("STORAGE: Record liked removal failed", e);
            return false;
        }
    },

    _persistLikedState: function (items) {
        try {
            const safeLiked = this._filterRemovedLikedItems(Array.isArray(items) ? items : []);
            const hadLikedState = localStorage.getItem(this.KEY_LIKED) !== null
                || localStorage.getItem(this.KEY_LIKED_LEGACY) !== null
                || localStorage.getItem(this.KEY_LIKED_META) !== null
                || localStorage.getItem(this.KEY_LIKED_BACKUP) !== null
                || localStorage.getItem(this.KEY_LIKED_CLEARED) !== null
                || localStorage.getItem(this.KEY_LIKED_REMOVED) !== null;
            if (safeLiked.length === 0 && !hadLikedState) {
                localStorage.removeItem(this.KEY_LIKED);
                localStorage.removeItem(this.KEY_LIKED_LEGACY);
                localStorage.removeItem(this.KEY_LIKED_META);
                localStorage.removeItem(this.KEY_LIKED_BACKUP);
                localStorage.removeItem(this.KEY_LIKED_CLEARED);
                return true;
            }
            const serialized = JSON.stringify(safeLiked);
            localStorage.setItem(this.KEY_LIKED, serialized);
            localStorage.setItem(this.KEY_LIKED_LEGACY, serialized);
            localStorage.setItem(this.KEY_LIKED_META, JSON.stringify({
                count: safeLiked.length,
                savedAt: new Date().toISOString()
            }));
            if (safeLiked.length > 0) {
                localStorage.setItem(this.KEY_LIKED_BACKUP, serialized);
                localStorage.removeItem(this.KEY_LIKED_CLEARED);
            } else {
                localStorage.removeItem(this.KEY_LIKED_BACKUP);
                if (hadLikedState) {
                    localStorage.setItem(this.KEY_LIKED_CLEARED, new Date().toISOString());
                }
            }
            return true;
        } catch (e) {
            console.error("STORAGE: Save liked mirror failed", e);
            return false;
        }
    },

    _loadLikedState: function () {
        const primaryRaw = localStorage.getItem(this.KEY_LIKED);
        const primary = this._readStoredArray(this.KEY_LIKED);
        const legacy = this._readStoredArray(this.KEY_LIKED_LEGACY);
        const backup = this._readStoredArray(this.KEY_LIKED_BACKUP);
        const explicitClear = !!localStorage.getItem(this.KEY_LIKED_CLEARED);
        const filterLoaded = (items) => this._filterRemovedLikedItems(Array.isArray(items) ? items : []);

        if (Array.isArray(primary) && primary.length > 0) {
            return { items: filterLoaded(primary), source: 'primary' };
        }
        if (!explicitClear && Array.isArray(legacy) && legacy.length > 0) {
            return { items: filterLoaded(legacy), source: 'legacy' };
        }
        if (!explicitClear && Array.isArray(backup) && backup.length > 0) {
            return { items: filterLoaded(backup), source: 'backup' };
        }
        if (Array.isArray(primary)) {
            return { items: filterLoaded(primary), source: 'primary' };
        }
        if (Array.isArray(legacy)) {
            return { items: filterLoaded(legacy), source: 'legacy' };
        }
        if (Array.isArray(backup) && primaryRaw == null) {
            return { items: filterLoaded(backup), source: 'backup' };
        }
        return { items: [], source: 'empty' };
    },

    _persistBuildExclusionState: function (items) {
        try {
            const safeExcluded = Array.isArray(items)
                ? [...new Set(items.map((value) => String(value || '').trim()).filter(Boolean))]
                : [];
            localStorage.setItem(this.KEY_BUILD_EXCLUDED, JSON.stringify(safeExcluded));
            return true;
        } catch (e) {
            console.error("STORAGE: Save build exclusion mirror failed", e);
            return false;
        }
    },

    _loadBuildExclusionState: function () {
        const excluded = this._readStoredArray(this.KEY_BUILD_EXCLUDED);
        return Array.isArray(excluded)
            ? [...new Set(excluded.map((value) => String(value || '').trim()).filter(Boolean))]
            : [];
    },

    /**
     * 全状態を保存
     */
    saveAll: function () {
        try {
            const safeLiked = this._filterRemovedLikedItems(Array.isArray(liked) ? liked : []);
            if (typeof syncReadingStockFromLiked === 'function') {
                syncReadingStockFromLiked(safeLiked);
            }
            const likedSaved = this._persistLikedState(safeLiked);
            this._persistBuildExclusionState(typeof excludedKanjiFromBuild !== 'undefined' ? excludedKanjiFromBuild : []);
            const safeSavedNames = Array.isArray(savedNames) ? savedNames : [];
            const hadSavedState = localStorage.getItem(this.KEY_SAVED) !== null
                || localStorage.getItem(this.KEY_SAVED_CLEARED) !== null;
            if (safeSavedNames.length === 0 && !hadSavedState) {
                localStorage.removeItem(this.KEY_SAVED);
                localStorage.removeItem(this.KEY_SAVED_CLEARED);
            } else {
                localStorage.setItem(this.KEY_SAVED, JSON.stringify(safeSavedNames));
                if (safeSavedNames.length === 0) {
                    localStorage.setItem(this.KEY_SAVED_CLEARED, new Date().toISOString());
                } else {
                    localStorage.removeItem(this.KEY_SAVED_CLEARED);
                }
            }
            localStorage.setItem(this.KEY_SURNAME, JSON.stringify({
                str: surnameStr,
                data: surnameData,
                reading: typeof surnameReading !== 'undefined' ? surnameReading : ''
            }));
            localStorage.setItem(this.KEY_SEGMENTS, JSON.stringify(segments));
            localStorage.setItem(this.KEY_SETTINGS, JSON.stringify({
                gender: gender,
                rule: rule,
                prioritizeFortune: prioritizeFortune
            }));
            localStorage.setItem(this.KEY_USER_TAGS, JSON.stringify(userTags));
            localStorage.setItem(this.KEY_NOPED, JSON.stringify(Array.from(noped)));
            const normalizedSoundPreferenceData = typeof normalizeSoundPreferenceData === 'function'
                ? normalizeSoundPreferenceData(typeof soundPreferenceData !== 'undefined' ? soundPreferenceData : null)
                : (typeof soundPreferenceData !== 'undefined' ? soundPreferenceData : { liked: [], noped: [] });
            if (typeof soundPreferenceData !== 'undefined') {
                soundPreferenceData = normalizedSoundPreferenceData;
            }
            localStorage.setItem(this.KEY_SOUND_PREFERENCES, JSON.stringify(normalizedSoundPreferenceData));

            console.log("STORAGE: State saved successfully");
            if (typeof queuePartnerStockSync === 'function') {
                queuePartnerStockSync('saveAll');
            }
            if (likedSaved && typeof notifyStockStateChanged === 'function') {
                notifyStockStateChanged('saveAll');
            }
            return true;
        } catch (e) {
            console.error("STORAGE: Save failed", e);
            return false;
        }
    },

    /**
     * 全状態を復元
     */
    loadAll: function () {
        try {
            // いいねした漢字
            const likedState = this._loadLikedState();
            liked = Array.isArray(likedState.items) ? likedState.items : [];
            const likedRemovalState = this._loadLikedRemovalState();
            const hadLikedState = localStorage.getItem(this.KEY_LIKED) !== null
                || localStorage.getItem(this.KEY_LIKED_LEGACY) !== null
                || localStorage.getItem(this.KEY_LIKED_META) !== null
                || localStorage.getItem(this.KEY_LIKED_BACKUP) !== null
                || localStorage.getItem(this.KEY_LIKED_CLEARED) !== null
                || localStorage.getItem(this.KEY_LIKED_REMOVED) !== null;
            const legacyLikedMissing = localStorage.getItem(this.KEY_LIKED_LEGACY) == null;
            const likedMetaMissing = localStorage.getItem(this.KEY_LIKED_META) == null;
            const likedBackupMissing = liked.length > 0 && localStorage.getItem(this.KEY_LIKED_BACKUP) == null;
            if (likedState.source !== 'primary' || legacyLikedMissing || likedMetaMissing || likedBackupMissing || likedRemovalState.length > 0) {
                this._persistLikedState(liked);
            }
            if (hadLikedState) {
                if (Array.isArray(liked) && liked.length === 0) {
                    localStorage.setItem(this.KEY_LIKED_CLEARED, new Date().toISOString());
                } else if (Array.isArray(liked)) {
                    localStorage.removeItem(this.KEY_LIKED_CLEARED);
                }
            }

            // 保存済み名前
            const s = localStorage.getItem(this.KEY_SAVED);
            if (s) savedNames = JSON.parse(s);
            if (s) {
                if (Array.isArray(savedNames) && savedNames.length === 0) {
                    localStorage.setItem(this.KEY_SAVED_CLEARED, new Date().toISOString());
                } else if (Array.isArray(savedNames)) {
                    localStorage.removeItem(this.KEY_SAVED_CLEARED);
                }
            }

            // 名字
            const n = localStorage.getItem(this.KEY_SURNAME);
            if (n) {
                const parsedN = JSON.parse(n);
                surnameStr = parsedN.str || "";
                surnameData = parsedN.data || [];
                if (typeof surnameReading !== 'undefined') {
                    surnameReading = parsedN.reading || "";
                }

                // UIに反映
                const input = document.getElementById('in-surname');
                if (input && surnameStr) {
                    input.value = surnameStr;
                }
            }

            if (Array.isArray(savedNames) && savedNames.length > 0 && typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate) {
                const surArr = surnameData && surnameData.length > 0
                    ? surnameData
                    : [{ kanji: surnameStr || '', strokes: 0 }];
                let savedUpdated = false;
                savedNames = savedNames.map(item => {
                    if (item?.fortune || !Array.isArray(item?.combination) || item.combination.length === 0) return item;
                    const givArr = item.combination
                        .map(part => ({
                            kanji: part?.['漢字'] || part?.kanji || '',
                            strokes: parseInt(part?.['画数'] ?? part?.strokes, 10) || 0
                        }))
                        .filter(part => part.kanji);
                    if (givArr.length === 0) return item;
                    const fortune = FortuneLogic.calculate(surArr, givArr);
                    if (!fortune) return item;
                    savedUpdated = true;
                    return { ...item, fortune };
                });
                if (savedUpdated) {
                    localStorage.setItem(this.KEY_SAVED, JSON.stringify(savedNames));
                }
            }

            // セグメント
            const seg = localStorage.getItem(this.KEY_SEGMENTS);
            if (seg) segments = JSON.parse(seg);

            // 設定
            const settings = localStorage.getItem(this.KEY_SETTINGS);
            if (settings) {
                const parsed = JSON.parse(settings);
                gender = parsed.gender || 'neutral';
                rule = parsed.rule || 'strict';
                prioritizeFortune = parsed.prioritizeFortune || false;

                // UIに反映
                if (typeof setGender === 'function') setGender(gender);
                if (typeof setRule === 'function') setRule(rule);

                const fortuneBtn = document.getElementById('btn-fortune');
                if (fortuneBtn && prioritizeFortune) {
                    fortuneBtn.classList.add('active');
                }
            }

            // タグスコア
            const tagsData = localStorage.getItem(this.KEY_USER_TAGS);
            if (tagsData) {
                userTags = JSON.parse(tagsData);
            }

            // NOPED (除外リスト)
            const nopedData = localStorage.getItem(this.KEY_NOPED);
            if (nopedData) {
                const arr = JSON.parse(nopedData);
                noped = new Set(arr);
            }

            const soundPrefData = localStorage.getItem(this.KEY_SOUND_PREFERENCES);
            if (soundPrefData && typeof soundPreferenceData !== 'undefined') {
                const parsedSoundPref = JSON.parse(soundPrefData);
                soundPreferenceData = typeof normalizeSoundPreferenceData === 'function'
                    ? normalizeSoundPreferenceData(parsedSoundPref)
                    : {
                        liked: Array.isArray(parsedSoundPref?.liked) ? parsedSoundPref.liked : [],
                        noped: Array.isArray(parsedSoundPref?.noped) ? parsedSoundPref.noped : []
                    };
                localStorage.setItem(this.KEY_SOUND_PREFERENCES, JSON.stringify(soundPreferenceData));
            } else if (typeof normalizeSoundPreferenceData === 'function' && typeof soundPreferenceData !== 'undefined') {
                soundPreferenceData = normalizeSoundPreferenceData(soundPreferenceData);
            }
            if (typeof excludedKanjiFromBuild !== 'undefined') {
                excludedKanjiFromBuild = this._loadBuildExclusionState();
            }

            // いいねだけ残っている旧データから読みストックを復元する
            if (Array.isArray(liked) && liked.length > 0 && typeof syncReadingStockFromLiked === 'function') {
                syncReadingStockFromLiked(liked);
            }

            console.log("STORAGE: State restored successfully");
            console.log(`  - Liked source: ${likedState.source}`);
            console.log(`  - Liked: ${liked.length} items`);
            console.log(`  - Saved: ${savedNames.length} names`);
            console.log(`  - Surname: ${surnameStr || '(none)'}`);
            console.log(`  - Noped: ${noped.size} items`);

            return true;
        } catch (e) {
            console.error("STORAGE: Load failed", e);
            return false;
        }
    },

    /**
     * 特定データの保存
     */
    saveLiked: function () {
        const safeLiked = this._filterRemovedLikedItems(Array.isArray(liked) ? liked : []);
        if (typeof syncReadingStockFromLiked === 'function') {
            syncReadingStockFromLiked(safeLiked);
        }
        const hadLikedState = localStorage.getItem(this.KEY_LIKED) !== null
            || localStorage.getItem(this.KEY_LIKED_LEGACY) !== null
            || localStorage.getItem(this.KEY_LIKED_META) !== null
            || localStorage.getItem(this.KEY_LIKED_BACKUP) !== null
            || localStorage.getItem(this.KEY_LIKED_CLEARED) !== null
            || localStorage.getItem(this.KEY_LIKED_REMOVED) !== null;
        const result = this._persistLikedState(safeLiked);
        try {
            if (Array.isArray(liked) && liked.length === 0) {
                if (hadLikedState) {
                    localStorage.setItem(this.KEY_LIKED_CLEARED, new Date().toISOString());
                }
            } else {
                localStorage.removeItem(this.KEY_LIKED_CLEARED);
            }
        } catch (e) {
            console.warn("STORAGE: Failed to update liked clear marker", e);
        }
        this._persistBuildExclusionState(typeof excludedKanjiFromBuild !== 'undefined' ? excludedKanjiFromBuild : []);
        if (typeof queuePartnerStockSync === 'function') {
            queuePartnerStockSync('saveLiked');
        }
        if (result && typeof notifyStockStateChanged === 'function') {
            notifyStockStateChanged('saveLiked');
        }
        return result;
    },

    saveNoped: function () {
        try {
            localStorage.setItem(this.KEY_NOPED, JSON.stringify(Array.from(noped)));
            return true;
        } catch (e) {
            console.error("STORAGE: Save noped failed", e);
            return false;
        }
    },

    saveSavedNames: function () {
        try {
            const safeSavedNames = Array.isArray(savedNames) ? savedNames : [];
            const hadSavedState = localStorage.getItem(this.KEY_SAVED) !== null
                || localStorage.getItem(this.KEY_SAVED_CLEARED) !== null;
            if (safeSavedNames.length === 0 && !hadSavedState) {
                localStorage.removeItem(this.KEY_SAVED);
                localStorage.removeItem(this.KEY_SAVED_CLEARED);
                return true;
            }
            localStorage.setItem(this.KEY_SAVED, JSON.stringify(safeSavedNames));
            if (safeSavedNames.length === 0) {
                if (hadSavedState) {
                    localStorage.setItem(this.KEY_SAVED_CLEARED, new Date().toISOString());
                }
            } else {
                localStorage.removeItem(this.KEY_SAVED_CLEARED);
            }
            if (typeof queuePartnerStockSync === 'function') {
                queuePartnerStockSync('saveSavedNames');
            }
            return true;
        } catch (e) {
            console.error("STORAGE: Save savedNames failed", e);
            return false;
        }
    },

    saveKanjiAiCache: function (kanji, text) {
        try {
            const raw = localStorage.getItem(this.KEY_KANJI_AI_CACHE);
            const cache = raw ? JSON.parse(raw) : {};
            cache[kanji] = { text, savedAt: new Date().toISOString() };
            localStorage.setItem(this.KEY_KANJI_AI_CACHE, JSON.stringify(cache));
        } catch (e) {
            console.error("STORAGE: kanji AI cache save failed", e);
        }
    },

    getKanjiAiCache: function (kanji) {
        try {
            const raw = localStorage.getItem(this.KEY_KANJI_AI_CACHE);
            if (!raw) return null;
            const cache = JSON.parse(raw);
            return cache[kanji] || null;
        } catch (e) {
            return null;
        }
    },

    /**
     * データ完全リセット
     */
    clearAll: function () {
        if (confirm("全てのデータをリセットしますか？\n（保存した名前・ストックが削除されます）")) {
            localStorage.clear();
            console.log("STORAGE: All data cleared");
            location.reload();
        }
    },

    /**
     * エクスポート（将来的な機能）
     */
    exportData: function () {
        const safeLiked = this._filterRemovedLikedItems(Array.isArray(liked) ? liked : []);
        const data = {
            version: 'meimay-backup-v2',
            liked: safeLiked,
            likedRemoved: this._loadLikedRemovalState(),
            savedNames: savedNames,
            surname: { str: surnameStr, data: surnameData, reading: typeof surnameReading !== 'undefined' ? surnameReading : '' },
            segments: segments,
            settings: {
                gender,
                rule,
                prioritizeFortune,
                imageTags: typeof selectedImageTags !== 'undefined' ? selectedImageTags : ['none'],
                shareMode: typeof shareMode !== 'undefined' ? shareMode : 'auto',
                showInappropriateKanji: typeof showInappropriateKanji !== 'undefined' ? showInappropriateKanji : false
            },
            userTags: typeof userTags !== 'undefined' ? userTags : {},
            noped: Array.from(typeof noped !== 'undefined' ? noped : []),
            readingStock: typeof getReadingStock === 'function' ? getReadingStock() : [],
            readingHistory: typeof getReadingHistory === 'function' ? getReadingHistory() : [],
            wizard: (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function') ? WizardData.get() : null,
            soundPreferenceData: typeof normalizeSoundPreferenceData === 'function' && typeof soundPreferenceData !== 'undefined'
                ? normalizeSoundPreferenceData(soundPreferenceData)
                : (typeof soundPreferenceData !== 'undefined' ? soundPreferenceData : { liked: [], noped: [] }),
            localPremiumState: (() => {
                try {
                    const raw = localStorage.getItem(this.KEY_PREMIUM);
                    return raw ? JSON.parse(raw) : null;
                } catch (e) {
                    return null;
                }
            })(),
            appAccountToken: localStorage.getItem(this.KEY_APP_ACCOUNT_TOKEN) || '',
            homePairCardDismissed: localStorage.getItem(this.KEY_HOME_PAIR_CARD_DISMISSED) === 'true',
            exportDate: new Date().toISOString()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `meimay-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        console.log("STORAGE: Data exported");
    },

    /**
     * インポート（将来的な機能）
     */
    importData: function (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (Array.isArray(data.likedRemoved)) {
                    this._persistLikedRemovalState(data.likedRemoved);
                }
                liked = this._filterRemovedLikedItems(Array.isArray(data.liked) ? data.liked : []);
                savedNames = data.savedNames || [];
                surnameStr = data.surname?.str || "";
                surnameData = data.surname?.data || [];
                if (typeof surnameReading !== 'undefined') {
                    surnameReading = data.surname?.reading || "";
                }
                segments = data.segments || [];

                if (data.settings) {
                    gender = data.settings.gender || 'neutral';
                    rule = data.settings.rule || 'strict';
                    prioritizeFortune = data.settings.prioritizeFortune || false;
                    if (typeof selectedImageTags !== 'undefined' && Array.isArray(data.settings.imageTags)) {
                        selectedImageTags = data.settings.imageTags;
                    }
                    if (typeof shareMode !== 'undefined' && data.settings.shareMode) {
                        shareMode = data.settings.shareMode;
                    }
                    if (typeof showInappropriateKanji !== 'undefined') {
                        showInappropriateKanji = data.settings.showInappropriateKanji === true;
                    }
                }

                if (typeof userTags !== 'undefined') {
                    userTags = data.userTags || {};
                }

                if (typeof noped !== 'undefined') {
                    noped = new Set(Array.isArray(data.noped) ? data.noped : []);
                }

                if (Array.isArray(data.readingStock)) {
                    const importedReadingStock = data.readingStock
                        .map((item) => (typeof normalizeReadingStockItem === 'function' ? normalizeReadingStockItem(item) : item))
                        .filter(Boolean);
                    localStorage.setItem(this.KEY_READING_STOCK, JSON.stringify(importedReadingStock));
                }

                if (Array.isArray(data.readingHistory)) {
                    localStorage.setItem(this.KEY_READING_HISTORY, JSON.stringify(data.readingHistory));
                }

                if (data.wizard && typeof WizardData !== 'undefined' && typeof WizardData.save === 'function') {
                    WizardData.save(data.wizard);
                }

                if (typeof soundPreferenceData !== 'undefined') {
                    soundPreferenceData = typeof normalizeSoundPreferenceData === 'function'
                        ? normalizeSoundPreferenceData(data.soundPreferenceData || { liked: [], noped: [] })
                        : {
                            liked: Array.isArray(data.soundPreferenceData?.liked) ? data.soundPreferenceData.liked : [],
                            noped: Array.isArray(data.soundPreferenceData?.noped) ? data.soundPreferenceData.noped : []
                        };
                    localStorage.setItem(this.KEY_SOUND_PREFERENCES, JSON.stringify(soundPreferenceData));
                }

                localStorage.setItem(this.KEY_APP_SETTINGS, JSON.stringify({
                    surname: surnameStr,
                    surnameReading: typeof surnameReading !== 'undefined' ? surnameReading : '',
                    gender: gender,
                    imageTags: typeof selectedImageTags !== 'undefined' ? selectedImageTags : ['none'],
                    rule: rule,
                    prioritizeFortune: prioritizeFortune,
                    segments: segments,
                    shareMode: typeof shareMode !== 'undefined' ? shareMode : 'auto',
                    showInappropriateKanji: typeof showInappropriateKanji !== 'undefined' ? showInappropriateKanji : false
                }));

                if (data.localPremiumState) {
                    localStorage.setItem(this.KEY_PREMIUM, JSON.stringify(data.localPremiumState));
                }

                if (typeof data.appAccountToken === 'string' && data.appAccountToken) {
                    localStorage.setItem(this.KEY_APP_ACCOUNT_TOKEN, data.appAccountToken);
                }

                if (data.homePairCardDismissed === true) {
                    localStorage.setItem(this.KEY_HOME_PAIR_CARD_DISMISSED, 'true');
                } else {
                    localStorage.removeItem(this.KEY_HOME_PAIR_CARD_DISMISSED);
                }

                this.saveAll();
                alert('データをインポートしました');
                location.reload();

                console.log("STORAGE: Data imported");
            } catch (err) {
                console.error("STORAGE: Import failed", err);
                alert('インポートに失敗しました');
            }
        };
        reader.readAsText(file);
    }
};

// 定期的な自動保存（30秒ごと）
setInterval(() => {
    if (liked.length > 0 || savedNames.length > 0) {
        StorageBox.saveAll();
    }
}, 30000);

// ページ離脱時に保存
window.addEventListener('beforeunload', () => {
    StorageBox.saveAll();
});

/**
 * 夫婦シェア機能
 * データをJSON文字列としてエクスポート/インポート
 */
function shareData() {
    const safeLiked = typeof StorageBox !== 'undefined' && StorageBox && typeof StorageBox._filterRemovedLikedItems === 'function'
        ? StorageBox._filterRemovedLikedItems(Array.isArray(liked) ? liked : [])
        : (Array.isArray(liked) ? liked : []);
    const data = {
        liked: safeLiked.map(l => ({
            '漢字': l['漢字'],
            '画数': l['画数'],
            slot: l.slot,
            sessionReading: l.sessionReading,
            gender: l.gender || 'neutral'
        })),
        savedNames: (getSavedNames ? getSavedNames() : savedNames).map(s => ({
            fullName: s.fullName,
            reading: s.reading || '',
            givenName: s.givenName || '',
            combinationKeys: s.combination ? s.combination.map(k => k['漢字']) : [],
            message: s.message || '',
            savedAt: s.savedAt || s.timestamp,
            fromPartner: s.fromPartner || false
        })),
        exportDate: new Date().toISOString(),
        version: 'meimay-share-v1'
    };

    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));

    // クリップボードにコピー
    const shareText = `meimay://${encoded}`;

    if (navigator.share) {
        navigator.share({
            title: 'メイメー - 名前候補を共有',
            text: `パートナーから名前候補が届きました！\nアプリで「データを受け取る」からこのテキストを貼り付けてください。`,
            url: ''
        }).catch(() => {
            copyShareToClipboard(shareText);
        });
    } else {
        copyShareToClipboard(shareText);
    }
}

function copyShareToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('共有データをコピーしました！\nパートナーに送って「データを受け取る」から貼り付けてもらってください。');
    }).catch(() => {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('共有データをコピーしました！');
    });
}

function receiveSharedData() {
    const input = prompt('パートナーから受け取ったデータを貼り付けてください：');
    if (!input) return;

    try {
        let json;
        if (input.startsWith('meimay://')) {
            const encoded = input.replace('meimay://', '');
            json = decodeURIComponent(escape(atob(encoded)));
        } else {
            json = input;
        }

        const data = JSON.parse(json);

        if (data.version !== 'meimay-share-v1') {
            alert('データ形式が正しくありません');
            return;
        }

        // 確認
        const likedCount = data.liked ? data.liked.length : 0;
        const savedCount = data.savedNames ? data.savedNames.length : 0;

        if (!confirm(`パートナーのデータを読み込みます：\n・ストック漢字：${likedCount}件\n・保存済み名前：${savedCount}件\n\n既存のデータとマージしますか？`)) {
            return;
        }

        // マージ（重複は除外）
        if (data.liked) {
            data.liked.forEach(item => {
                // masterから完全データを取得
                const full = master.find(k => k['漢字'] === item['漢字']);
                if (full) {
                    const exists = liked.some(l => l['漢字'] === item['漢字'] && l.slot === item.slot);
                    if (!exists) {
                        liked.push({
                            ...full,
                            slot: item.slot || -1,
                            sessionReading: item.sessionReading || 'SHARED',
                            gender: item.gender || full.gender || 'neutral'
                        });
                    }
                }
            });
        }

        if (data.savedNames) {
            const existing = typeof getSavedNames === 'function' ? getSavedNames() : [];
            const surArr = typeof surnameData !== 'undefined' && surnameData.length > 0 ? surnameData : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 0 }];

            data.savedNames.forEach(name => {
                const exists = existing.some(n => n.fullName === name.fullName);
                if (!exists) {
                    let combination = [];
                    if (name.combinationKeys && typeof master !== 'undefined') {
                        combination = name.combinationKeys.map(k => {
                            const found = master.find(m => m['漢字'] === k);
                            return found ? found : { '漢字': k, '画数': 1 };
                        });
                    } else if (name.combination) {
                        combination = name.combination;
                    }

                    let fortune = null;
                    if (typeof FortuneLogic !== 'undefined' && FortuneLogic.calculate && combination.length > 0) {
                        const givArr = combination.map(p => ({
                            kanji: p['漢字'],
                            strokes: parseInt(p['画数']) || 0
                        }));
                        fortune = FortuneLogic.calculate(surArr, givArr);
                    }

                    existing.push({
                        fullName: name.fullName,
                        reading: name.reading,
                        givenName: name.givenName,
                        combination: combination,
                        fortune: fortune,
                        message: name.message,
                        savedAt: name.savedAt,
                        fromPartner: true,
                        partnerName: 'パートナー'
                    });
                }
            });
            if (typeof savedNames !== 'undefined') savedNames = existing;
            if (typeof StorageBox !== 'undefined' && typeof StorageBox.saveSavedNames === 'function') {
                StorageBox.saveSavedNames();
            } else {
                localStorage.setItem('meimay_saved', JSON.stringify(existing));
                if (existing.length === 0) {
                    localStorage.setItem('meimay_saved_cleared_at', new Date().toISOString());
                } else {
                    localStorage.removeItem('meimay_saved_cleared_at');
                }
            }
        }

        StorageBox.saveLiked();
        alert('データを読み込みました！');

    } catch (e) {
        console.error("SHARE: Import failed", e);
        alert('データの読み込みに失敗しました。\nコピーしたテキストが正しいか確認してください。');
    }
}

window.shareData = shareData;
window.receiveSharedData = receiveSharedData;

console.log("STORAGE: Module loaded (with sharing)");
