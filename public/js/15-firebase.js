/* ============================================================
   MODULE 15: FIREBASE (V22.0 - ANONYMOUS AUTH + ROOM PAIRING)
   アカウント不要・匿名認証・ルームコード方式パートナー連携
   ============================================================ */

// Firebase初期化
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

// ============================================================
// AUTH - 匿名認証（ユーザーには見えない自動処理）
// ============================================================
const MeimayAuth = {
    currentUser: null,

    // 起動時に自動呼び出し（ユーザー操作不要）
    init: async function () {
        if (firebaseAuth && !firebaseAuth.currentUser) {
            try {
                await firebaseAuth.signInAnonymously();
                console.log("FIREBASE: Anonymous sign-in success");
            } catch (e) {
                console.error("FIREBASE: Anonymous sign-in failed", e);
            }
        }
    },

    getCurrentUser: function () {
        return this.currentUser;
    },

    // ウィザード経由のニックネーム変更（設定画面で使用）
    editNickname: function () {
        const wizData = WizardData.get() || {};
        const oldName = wizData.username || '';
        const newName = prompt('新しいニックネームを入力してください', oldName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) { alert('ニックネームを入力してください'); return; }
        wizData.username = trimmed;
        WizardData.save(wizData);
        if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        if (typeof updateHomeGreeting === 'function') updateHomeGreeting();
        showToast('ニックネームを更新しました', '✨');
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
            // 保存済みルームがあれば再接続
            await MeimayPairing.resumeRoom();
            seedReadingStatsFromLocalHistory();
        } else {
            console.log("FIREBASE: No user");
        }
    });
}

// 起動時に匿名認証を自動実行
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

// ============================================================
// PAIRING - ルームコード方式パートナー連携
// ============================================================
const MeimayPairing = {
    roomCode: null,    // 現在のルームコード
    mySlot: null,      // 'memberA' or 'memberB'
    myRole: null,      // 'mama' or 'papa'
    partnerSlot: null, // 'memberB' or 'memberA'
    partnerUid: null,
    partnerRole: null,
    _selectedCreateRole: null,  // ルーム作成時に選んだロール
    _selectedJoinRole: null,    // 参加時に選んだロール
    _roomUnsub: null,

    // localStorageからルーム情報を復元
    resumeRoom: async function () {
        const code = localStorage.getItem('meimay_room_code');
        const slot = localStorage.getItem('meimay_room_slot');
        const role = localStorage.getItem('meimay_my_role');
        if (!code || !slot || !role) return;

        this.roomCode = code;
        this.mySlot = slot;
        this.myRole = role;
        this.partnerSlot = slot === 'memberA' ? 'memberB' : 'memberA';

        // Firestoreでルームが存在するか確認
        try {
            const doc = await firebaseDb.collection('rooms').doc(code).get();
            if (!doc.exists) {
                console.warn('PAIRING: Saved room no longer exists, clearing');
                this._clearLocal();
                return;
            }
            const data = doc.data();
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
            console.log(`PAIRING: Resumed room ${code} as ${slot} (${role})`);
        } catch (e) {
            console.error('PAIRING: Resume failed', e);
        }
    },

    // ロール選択（ルーム作成用）
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

    // ロール選択（参加用）
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

    // ルームを新規作成
    createRoom: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { showToast('しばらくお待ちください…', '⏳'); return null; }
        const role = this._selectedCreateRole || getPreferredPairingRole();
        if (!role) { showToast('先に設定でママ / パパを選んでください', '⚠️'); return null; }
        if (this._selectedCreateRole !== role) this.selectCreateRole(role);

        // 6文字ランダムコード
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        try {
            await firebaseDb.collection('rooms').doc(code).set({
                memberAUid: user.uid,
                memberARole: role,
                memberBUid: null,
                memberBRole: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.roomCode = code;
            this.mySlot = 'memberA';
            this.myRole = role;
            this.partnerSlot = 'memberB';

            localStorage.setItem('meimay_room_code', code);
            localStorage.setItem('meimay_room_slot', 'memberA');
            localStorage.setItem('meimay_my_role', role);

            this._listenRoom();
            updatePairingUI();
            await this.syncMyData();

            console.log(`PAIRING: Room created: ${code}`);
            return code;
        } catch (e) {
            console.error('PAIRING: Create room failed', e);
            showToast('ルーム作成に失敗しました', '❌');
            return null;
        }
    },

    // コードを入力してルームに参加
    joinRoom: async function (code) {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { showToast('しばらくお待ちください…', '⏳'); return { success: false }; }
        const role = this._selectedJoinRole || getPreferredPairingRole();
        if (!role) { showToast('先に設定でママ / パパを選んでください', '⚠️'); return { success: false }; }
        if (this._selectedJoinRole !== role) this.selectJoinRole(role);
        if (!code || code.trim().length < 4) { showToast('コードを入力してください', '⚠️'); return { success: false }; }

        const upperCode = code.trim().toUpperCase();

        try {
            const roomDoc = await firebaseDb.collection('rooms').doc(upperCode).get();
            if (!roomDoc.exists) {
                return { success: false, error: 'コードが見つかりません' };
            }

            const data = roomDoc.data();

            if (data.memberAUid === user.uid) {
                return { success: false, error: '自分のルームコードです' };
            }
            if (data.memberBUid && data.memberBUid !== user.uid) {
                return { success: false, error: 'このルームは満員です' };
            }

            // memberBとして参加
            await firebaseDb.collection('rooms').doc(upperCode).update({
                memberBUid: user.uid,
                memberBRole: role
            });

            this.roomCode = upperCode;
            this.mySlot = 'memberB';
            this.myRole = role;
            this.partnerSlot = 'memberA';
            this.partnerUid = data.memberAUid;
            this.partnerRole = data.memberARole;

            localStorage.setItem('meimay_room_code', upperCode);
            localStorage.setItem('meimay_room_slot', 'memberB');
            localStorage.setItem('meimay_my_role', role);

            this._listenRoom();
            MeimayShare.listenPartnerData(this.partnerUid);
            updatePairingUI();
            await this.syncMyData();

            console.log(`PAIRING: Joined room ${upperCode}`);
            return { success: true };
        } catch (e) {
            console.error('PAIRING: Join room failed', e);
            return { success: false, error: '参加に失敗しました' };
        }
    },

    // ルームを退出（連携解除）
    leaveRoom: async function () {
        if (!this.roomCode) return;
        const user = MeimayAuth.getCurrentUser();

        try {
            // 自分のデータドキュメントを削除
            if (user) {
                await firebaseDb.collection('rooms').doc(this.roomCode)
                    .collection('data').doc(user.uid).delete();
            }
            // ルームドキュメントから自分の情報を削除
            const update = {};
            update[`${this.mySlot}Uid`] = null;
            update[`${this.mySlot}Role`] = null;
            await firebaseDb.collection('rooms').doc(this.roomCode).update(update);
        } catch (e) {
            console.error('PAIRING: Leave room failed', e);
        }

        this._stopListening();
        this._clearLocal();
        updatePairingUI();
        console.log('PAIRING: Left room');
    },

    // 自分のデータをルームにアップロード（同期）
    syncMyData: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user || !this.roomCode) return;

        try {
            const minifiedLiked = (typeof liked !== 'undefined' ? liked : []).map(l => ({
                '漢字': l['漢字'],
                slot: l.slot,
                sessionReading: l.sessionReading,
                sessionSegments: l.sessionSegments || null,
                isSuper: l.isSuper || false
            }));

            const savedData = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
            const minifiedSaved = savedData.map(s => ({
                fullName: s.fullName,
                reading: s.reading || '',
                givenName: s.givenName || '',
                combinationKeys: s.combination ? s.combination.map(k => k['漢字']) : [],
                message: s.message || '',
                savedAt: s.savedAt || s.timestamp
            }));

            await firebaseDb.collection('rooms').doc(this.roomCode)
                .collection('data').doc(user.uid).set({
                    role: this.myRole,
                    liked: minifiedLiked,
                    savedNames: minifiedSaved,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            console.log('PAIRING: Synced my data to room');
        } catch (e) {
            console.error('PAIRING: Sync data failed', e);
        }
    },

    // Web Share API でルームコードを共有
    shareCode: function () {
        if (!this.roomCode) return;
        const partnerRoleLabel = this.myRole === 'mama' ? 'パパ' : 'ママ';
        const text = `メイメーで赤ちゃんの名前を一緒に選ぼう！\n${partnerRoleLabel}はこのコードを入力してね👶\n\nルームコード: ${this.roomCode}`;

        if (navigator.share) {
            navigator.share({
                title: 'メイメー - いっしょに名前を選ぼう',
                text: text
            }).catch(() => {});
        } else {
            navigator.clipboard?.writeText(this.roomCode).then(() => {
                showToast('コードをコピーしました', '📋');
            }).catch(() => {
                showToast(`コード: ${this.roomCode}`, '📋');
            });
        }
    },

    // ルームドキュメントをリアルタイム監視
    _listenRoom: function () {
        if (!this.roomCode) return;
        this._stopListeningRoom();

        this._roomUnsub = firebaseDb.collection('rooms').doc(this.roomCode)
            .onSnapshot((doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                const partnerUid = data[`${this.partnerSlot}Uid`];
                const partnerRole = data[`${this.partnerSlot}Role`];

                if (partnerUid && partnerUid !== this.partnerUid) {
                    // パートナーが参加した
                    this.partnerUid = partnerUid;
                    this.partnerRole = partnerRole;
                    MeimayShare.listenPartnerData(partnerUid);
                    updatePairingUI();
                    showToast('パートナーが参加しました！', '💑');
                    console.log(`PAIRING: Partner joined (${partnerRole})`);
                } else if (!partnerUid && this.partnerUid) {
                    // パートナーが退室した
                    this.partnerUid = null;
                    this.partnerRole = null;
                    MeimayShare.stopListening();
                    updatePairingUI();
                    showToast('パートナーが退室しました', '👋');
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
// SHARE - ルーム経由のデータ共有
// ============================================================
const MeimayShare = {
    _partnerUnsub: null,
    partnerSnapshot: { liked: [], savedNames: [], role: null },

    // パートナーのデータをリアルタイム受信
    listenPartnerData: function (partnerUid) {
        if (!partnerUid || !MeimayPairing.roomCode) return;
        this.stopListening();

        this._partnerUnsub = firebaseDb.collection('rooms').doc(MeimayPairing.roomCode)
            .collection('data').doc(partnerUid)
            .onSnapshot((doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                this.partnerSnapshot = {
                    liked: Array.isArray(data.liked) ? data.liked : [],
                    savedNames: Array.isArray(data.savedNames) ? data.savedNames : [],
                    role: data.role || null
                };
                const partnerLabel = data.role === 'mama' ? 'ママ' : 'パパ';
                if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();

                if (data.liked && data.liked.length > 0) {
                    const added = this.mergeSharedLiked(data.liked, partnerLabel);
                    if (added > 0) {
                        showToast(`${partnerLabel}のストック ${added}件 が届きました！`, '📥');
                    }
                }

                if (data.savedNames && data.savedNames.length > 0) {
                    const added = this.mergeSharedSaved(data.savedNames, partnerLabel);
                    if (added > 0) {
                        showToast(`${partnerLabel}の保存名前 ${added}件 が届きました！`, '📥');
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
        this.partnerSnapshot = { liked: [], savedNames: [], role: null };
        if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    },

    // ストック漢字をルームに共有（= 自分のデータをルームに同期）
    shareLiked: async function (silent = false) {
        if (!MeimayPairing.roomCode) {
            if (!silent) showToast('パートナーと連携してください', '⚠️');
            return;
        }
        await MeimayPairing.syncMyData();
        if (!silent) showToast('ストックを共有しました！', '📤');
    },

    // 保存名前をルームに共有
    shareSavedNames: async function (silent = false) {
        if (!MeimayPairing.roomCode) {
            if (!silent) showToast('パートナーと連携してください', '⚠️');
            return;
        }
        await MeimayPairing.syncMyData();
        if (!silent) showToast('保存名前を共有しました！', '📤');
    },

    // 受信ストックをローカルにマージ
    mergeSharedLiked: function (items, partnerName) {
        if (typeof liked === 'undefined') return 0;
        let added = 0;
        items.forEach(item => {
            const exists = liked.some(l =>
                l['漢字'] === item['漢字'] &&
                l.slot === item.slot &&
                l.sessionReading === item.sessionReading
            );
            if (!exists) {
                let fullKanji = typeof master !== 'undefined'
                    ? master.find(m => m['漢字'] === item['漢字'])
                    : null;
                let hydratedItem = fullKanji ? {
                    ...fullKanji,
                    slot: item.slot !== undefined ? item.slot : -1,
                    sessionReading: item.sessionReading || 'UNKNOWN',
                    sessionSegments: item.sessionSegments || null,
                    isSuper: item.isSuper || false,
                    gender: item.gender || fullKanji.gender || gender || 'neutral'
                } : item;
                if (!hydratedItem.gender) {
                    hydratedItem.gender = item.gender || fullKanji?.gender || gender || 'neutral';
                }
                hydratedItem.fromPartner = true;
                hydratedItem.partnerName = partnerName || 'パートナー';
                liked.push(hydratedItem);
                added++;
            }
        });
        if (added > 0) {
            if (typeof StorageBox !== 'undefined') StorageBox.saveLiked();
            if (typeof renderStock === 'function' &&
                document.getElementById('scr-stock')?.classList.contains('active')) {
                renderStock();
            }
        }
        if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
        return added;
    },

    // 受信保存名前をローカルにマージ
    mergeSharedSaved: function (items, partnerName) {
        try {
            const local = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
            const surArr = typeof surnameData !== 'undefined' && surnameData.length > 0
                ? surnameData
                : [{ kanji: typeof surnameStr !== 'undefined' ? surnameStr : '', strokes: 1 }];
            let added = 0;
            items.forEach(item => {
                const exists = local.some(l => l.fullName === item.fullName);
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
                        partnerName: partnerName || 'パートナー'
                    });
                    added++;
                }
            });
            if (added > 0) {
                localStorage.setItem('meimay_saved', JSON.stringify(local));
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
        const kanji = item?.['漢字'] || item?.kanji || '';
        if (!kanji) return '';
        return `kanji::${kanji}`;
    },

    buildSavedMatchKey: function (item) {
        if (!item) return '';
        const combinationKey = Array.isArray(item.combination) && item.combination.length > 0
            ? item.combination.map(part => part['漢字'] || part.kanji || '').join('')
            : (Array.isArray(item.combinationKeys) ? item.combinationKeys.join('') : '');
        const fullName = item.fullName || item.givenName || combinationKey;
        const reading = this.normalizeReading(item.reading || item.givenName || '');
        return `${fullName}::${combinationKey}::${reading}`;
    },

    getOwnLiked: function () {
        return (typeof liked !== 'undefined' ? liked : []).filter(item => !item.fromPartner);
    },

    getPartnerLiked: function () {
        return Array.isArray(MeimayShare.partnerSnapshot?.liked) ? MeimayShare.partnerSnapshot.liked : [];
    },

    getOwnSaved: function () {
        const list = typeof getSavedNames === 'function'
            ? getSavedNames()
            : JSON.parse(localStorage.getItem('meimay_saved') || '[]');
        return list.filter(item => !item.fromPartner);
    },

    getPartnerSaved: function () {
        return Array.isArray(MeimayShare.partnerSnapshot?.savedNames) ? MeimayShare.partnerSnapshot.savedNames : [];
    },

    getMatchedLikedItems: function () {
        const partnerKeys = new Set(this.getPartnerLiked().map(item => this.buildLikedMatchKey(item)).filter(Boolean));
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
        const partnerKeys = new Set(this.getPartnerLiked().map(entry => this.buildLikedMatchKey(entry)).filter(Boolean));
        return partnerKeys.has(key);
    },

    getMatchedSavedItems: function () {
        const partnerKeys = new Set(this.getPartnerSaved().map(item => this.buildSavedMatchKey(item)).filter(Boolean));
        const seenKeys = new Set();
        return this.getOwnSaved().filter(item => {
            const key = this.buildSavedMatchKey(item);
            if (!key || !partnerKeys.has(key) || seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
    },

    isSavedItemMatched: function (item) {
        const key = this.buildSavedMatchKey(item);
        if (!key) return false;
        const compareSet = item.fromPartner
            ? new Set(this.getOwnSaved().map(entry => this.buildSavedMatchKey(entry)).filter(Boolean))
            : new Set(this.getPartnerSaved().map(entry => this.buildSavedMatchKey(entry)).filter(Boolean));
        return compareSet.has(key);
    },

    getSummary: function () {
        const matchedLikedItems = this.getMatchedLikedItems();
        const matchedSavedItems = this.getMatchedSavedItems();
        const partnerLabel = MeimayPairing.partnerRole === 'mama' ? 'ママ' : MeimayPairing.partnerRole === 'papa' ? 'パパ' : 'パートナー';
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

function syncPairingRoleSelectionFromProfile() {
    const preferredRole = getPreferredPairingRole();
    const preferredRoleLabel = getPreferredPairingRoleLabel();

    const createLabel = document.getElementById('pairing-create-role-label');
    if (createLabel) {
        createLabel.textContent = preferredRoleLabel
            ? `現在の設定: ${preferredRoleLabel}`
            : '設定でママ / パパを選ぶと連携できます';
    }

    const joinLabel = document.getElementById('pairing-join-role-label');
    if (joinLabel) {
        joinLabel.textContent = preferredRoleLabel
            ? `現在の設定: ${preferredRoleLabel}`
            : '設定でママ / パパを選ぶと参加できます';
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

    const pairingNotLinked = document.getElementById('pairing-not-linked');
    const pairingLinked = document.getElementById('pairing-linked');

    if (inRoom) {
        if (pairingNotLinked) pairingNotLinked.classList.add('hidden');
        if (pairingLinked) pairingLinked.classList.remove('hidden');

        // コード表示
        const codeEl = document.getElementById('pairing-code-display-linked');
        if (codeEl) codeEl.textContent = MeimayPairing.roomCode;

        // 自分のロール表示
        const myRoleEl = document.getElementById('pairing-my-role');
        if (myRoleEl) myRoleEl.textContent = MeimayPairing.myRole === 'mama' ? 'ママ' : 'パパ';

        // パートナー状態表示
        const partnerStatusEl = document.getElementById('pairing-partner-status');
        if (partnerStatusEl) {
            if (hasPartner) {
                const partnerLabel = MeimayPairing.partnerRole === 'mama' ? 'ママ' : 'パパ';
                partnerStatusEl.textContent = `${partnerLabel}と連携中 💑`;
                partnerStatusEl.className = 'text-sm font-bold text-[#5d5444]';
            } else {
                partnerStatusEl.textContent = 'パートナー待機中…';
                partnerStatusEl.className = 'text-sm font-bold text-[#a6967a]';
            }
        }
    } else {
        if (pairingNotLinked) pairingNotLinked.classList.remove('hidden');
        if (pairingLinked) pairingLinked.classList.add('hidden');
    }

    // 共有ボタン（ストック/保存画面）
    const shareButtons = document.querySelectorAll('.partner-share-btn');
    shareButtons.forEach(btn => {
        btn.classList.add('hidden');
    });

    // ドロワーのパートナー連携バッジ
    const drawerPairingBadge = document.getElementById('drawer-pairing-badge');
    if (drawerPairingBadge) {
        drawerPairingBadge.classList.toggle('hidden', !inRoom);
    }

    refreshPartnerAwareUI();
}

// ルーム作成ボタン
async function handleGenerateCode() {
    const btn = document.getElementById('btn-generate-code');
    if (btn) btn.disabled = true;
    const code = await MeimayPairing.createRoom();
    if (btn) btn.disabled = false;
    if (code) {
        showToast('ルームを作成しました！', '🎉');
    }
}

// コード入力して参加ボタン
async function handleEnterCode() {
    const input = document.getElementById('pairing-code-input');
    const code = input?.value?.trim();
    const result = await MeimayPairing.joinRoom(code);
    if (result.success) {
        showToast('パートナーと連携しました！', '💑');
        if (input) input.value = '';
    } else if (result.error) {
        showToast(result.error, '⚠️');
    }
}

// ============================================================
// STORAGE HOOK — 保存時にルームへ自動同期
// ============================================================
(function hookStorageSync() {
    const waitForStorageBox = setInterval(() => {
        if (typeof StorageBox !== 'undefined' && StorageBox.saveAll) {
            const originalSaveAll = StorageBox.saveAll.bind(StorageBox);
            StorageBox.saveAll = function () {
                const result = originalSaveAll();
                if (MeimayPairing.roomCode) {
                    // デバウンスして自動同期
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

// デバウンス付き自動同期（5秒後）
MeimayPairing._autoSyncDebounced = (function () {
    let timer = null;
    return function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => MeimayPairing.syncMyData(), 5000);
    };
})();

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
function showToast(message, icon = '📢', onAction = null) {
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
        ">取り込む</button>`;
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
// STATS - 人気ランキング用集計モジュール（変更なし）
// ============================================================
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
            .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
            .replace(/[^ぁ-んー]/g, '');

    return String(normalized || '').trim();
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
                const kanji = String(item?.['漢字'] || item?.kanji || '').trim();
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
                if (apiItems.length > 0) {
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
            }
        } catch (apiError) {
            console.warn(`STATS: fetchRankings(${normalizedKind}:${normalizedType}) API fallback`, apiError);
        }

        try {
            const collections = getStatsRankingCollectionNames(normalizedKind, normalizedMetric, normalizedGender);
            const totals = new Map();
            const docId = normalizedType === 'monthly'
                ? `monthly_${this.getCurrentMonthKey()}`
                : normalizedType === 'weekly'
                    ? `weekly_${this.getCurrentWeekKey()}`
                    : 'allTime';

            await Promise.all(collections.map(async (collection) => {
                const doc = await firebaseDb.collection(collection).doc(docId).get();
                if (!doc.exists) return;
                const data = doc.data() || {};
                Object.keys(data)
                    .filter((key) => key !== 'updatedAt')
                    .forEach((key) => {
                        const count = Number(data[key]) || 0;
                        if (count <= 0) return;
                        if (normalizedKind === 'reading') {
                            const reading = normalizeStatsReadingText(key);
                            if (!reading) return;
                            const current = totals.get(reading) || { reading, count: 0 };
                            current.count += count;
                            totals.set(reading, current);
                            return;
                        }

                        const current = totals.get(key) || { kanji: key, count: 0 };
                        current.count += count;
                        totals.set(key, current);
                    });
            }));

            return Array.from(totals.values())
                .filter((item) => item.count > 0)
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    const aKey = normalizedKind === 'reading' ? a.reading : a.kanji;
                    const bKey = normalizedKind === 'reading' ? b.reading : b.kanji;
                    return String(aKey || '').localeCompare(String(bKey || ''), 'ja');
                })
                .slice(0, 100);
        } catch (e) {
            console.error(`STATS: fetchRankings(${normalizedKind}:${type}) error`, e);
            return [];
        }
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
        const ownSaved = Array.isArray(savedRaw) ? savedRaw.filter(item => !item?.fromPartner) : [];
        if (ownSaved.length !== savedRaw.length) {
            localStorage.setItem('meimay_saved', JSON.stringify(ownSaved));
            if (typeof savedNames !== 'undefined') savedNames = ownSaved;
        }
    } catch (e) {
        console.warn('PAIRING: Failed to cleanup legacy saved items', e);
    }
}

function getRoomSyncLikedItems() {
    const filterOwnItems = (items) => (Array.isArray(items) ? items.filter(item => !item?.fromPartner) : []);

    try {
        const memoryLiked = filterOwnItems(typeof liked !== 'undefined' ? liked : []);
        if (memoryLiked.length > 0) {
            return memoryLiked;
        }

        if (typeof StorageBox !== 'undefined' && typeof StorageBox._loadLikedState === 'function') {
            const state = StorageBox._loadLikedState();
            const items = filterOwnItems(state?.items);
            if (items.length > 0 || Array.isArray(state?.items)) {
                return items;
            }
        }
    } catch (e) {
        console.warn('PAIRING: Failed to read liked state from StorageBox', e);
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
            const items = filterOwnItems(parsed);
            if (items.length > 0 || Array.isArray(parsed)) {
                return items;
            }
        }
    } catch (e) {
        console.warn('PAIRING: Failed to read liked state from localStorage', e);
    }

    return [];
}

MeimayPairing.syncMyData = async function () {
    const user = MeimayAuth.getCurrentUser();
    if (!user || !this.roomCode) return;

    try {
        const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
            ? (WizardData.get() || {})
            : {};
        const ownLiked = getRoomSyncLikedItems();
        const minifiedLiked = ownLiked.map(l => ({
            '漢字': l['漢字'],
            slot: l.slot,
            sessionReading: l.sessionReading,
            sessionSegments: l.sessionSegments || null,
            isSuper: l.isSuper || false,
            gender: l.gender || l.settings?.gender || 'neutral'
        }));

        const savedData = JSON.parse(localStorage.getItem('meimay_saved') || '[]')
            .filter(item => !item?.fromPartner);
        const minifiedSaved = savedData.map(s => ({
            fullName: s.fullName,
            reading: s.reading || '',
            givenName: s.givenName || '',
            combinationKeys: s.combination ? s.combination.map(k => k['漢字'] || k.kanji || '') : [],
            message: s.message || '',
            savedAt: s.savedAt || s.timestamp,
            approvedFromPartner: s.approvedFromPartner === true,
            approvedPartnerSavedKey: s.approvedPartnerSavedKey || ''
        }));

        const minifiedReadingStock = (typeof getReadingStock === 'function' ? getReadingStock() : []).map(item => ({
            id: item.id,
            reading: item.reading,
            segments: Array.isArray(item.segments) ? item.segments : [],
            baseNickname: item.baseNickname || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            gender: item.gender || 'neutral',
            isSuper: !!item.isSuper,
            addedAt: item.addedAt || null,
            statsTracked: item.statsTracked !== false
        }));

        const encounteredLibrary = typeof getEncounteredLibrary === 'function'
            ? getEncounteredLibrary()
            : { readings: [] };
        const minifiedEncounteredReadings = (Array.isArray(encounteredLibrary.readings) ? encounteredLibrary.readings : [])
            .slice(0, 300)
            .map(item => ({
                key: String(item?.key || item?.reading || '').trim(),
                reading: String(item?.reading || '').trim(),
                seenCount: Number(item?.seenCount) || 0,
                monthlySeenCount: Number(item?.monthlySeenCount) || 0,
                monthlyMonthKey: String(item?.monthlyMonthKey || '').trim(),
                lastSeenAt: String(item?.lastSeenAt || '').trim(),
                tags: Array.isArray(item?.tags) ? item.tags.slice(0, 5) : [],
                examples: Array.isArray(item?.examples) ? item.examples.slice(0, 3) : [],
                baseNickname: String(item?.baseNickname || '').trim(),
                preferredLabel: String(item?.preferredLabel || '').trim(),
                gender: String(item?.gender || 'neutral').trim() || 'neutral',
                mode: String(item?.mode || '').trim(),
                encounterOrigin: String(item?.encounterOrigin || '').trim()
            }))
            .filter(item => item.key && item.reading);

        await firebaseDb.collection('rooms').doc(this.roomCode)
            .collection('data').doc(user.uid).set({
                role: this.myRole,
                displayName: String(wizard.username || '').trim(),
                themeId: typeof getProfileThemeId === 'function' ? getProfileThemeId(wizard.role) : (wizard.themeId || null),
                liked: minifiedLiked,
                savedNames: minifiedSaved,
                readingStock: minifiedReadingStock,
                encounteredReadings: minifiedEncounteredReadings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        console.log('PAIRING: Synced my data to room');
    } catch (e) {
        console.error('PAIRING: Sync data failed', e);
    }
};

MeimayShare.partnerSnapshot = { liked: [], savedNames: [], readingStock: [], encounteredReadings: [], role: null, displayName: '', themeId: '' };

MeimayShare.listenPartnerData = function (partnerUid) {
    if (!partnerUid || !MeimayPairing.roomCode) return;
    this.stopListening();

    this._partnerUnsub = firebaseDb.collection('rooms').doc(MeimayPairing.roomCode)
        .collection('data').doc(partnerUid)
        .onSnapshot((doc) => {
            if (!doc.exists) return;
            const data = doc.data() || {};
            cleanupLegacyPartnerLocalData();

            this.partnerSnapshot = {
                liked: Array.isArray(data.liked) ? data.liked : [],
                savedNames: Array.isArray(data.savedNames) ? data.savedNames : [],
                readingStock: Array.isArray(data.readingStock) ? data.readingStock : [],
                encounteredReadings: Array.isArray(data.encounteredReadings) ? data.encounteredReadings : [],
                role: data.role || null,
                displayName: String(data.displayName || '').trim(),
                themeId: String(data.themeId || '').trim()
            };

            if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
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
    this.partnerSnapshot = { liked: [], savedNames: [], readingStock: [], encounteredReadings: [], role: null, displayName: '', themeId: '' };
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
};

MeimayShare.syncProfileAppearance = async function () {
    const user = MeimayAuth.getCurrentUser();
    if (!user || !this.roomCode) return;

    const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    const nextRole = this.myRole || wizard.role || null;
    const nextThemeId = typeof getProfileThemeId === 'function'
        ? getProfileThemeId(wizard.role)
        : String(wizard.themeId || '').trim();

    try {
        await firebaseDb.collection('rooms').doc(this.roomCode)
            .collection('data').doc(user.uid).set({
                role: nextRole,
                displayName: String(wizard.username || '').trim(),
                themeId: nextThemeId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
    } catch (e) {
        console.warn('SHARE: Sync profile appearance failed', e);
    }
};

MeimayPartnerInsights.getPartnerReadingStock = function () {
    const partnerReadings = Array.isArray(MeimayShare.partnerSnapshot?.readingStock) ? MeimayShare.partnerSnapshot.readingStock : [];
    return Array.isArray(partnerReadings) ? partnerReadings : [];
};

MeimayPartnerInsights.normalizeReading = function (value) {
    const raw = String(value || '').trim().split('::')[0].trim();
    if (!raw) return '';
    return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
};

MeimayPartnerInsights.getOwnReadingStock = function () {
    const ownReadings = typeof getReadingStock === 'function' ? getReadingStock() : [];
    let hiddenReadings = new Set();
    try {
        hiddenReadings = new Set(JSON.parse(localStorage.getItem('meimay_hidden_readings') || '[]'));
    } catch (e) { }
    const hiddenReadingSet = new Set(
        Array.from(hiddenReadings)
            .map(value => this.normalizeReading(value))
            .filter(Boolean)
    );

    return ownReadings.filter(item => {
        const normalizedReading = this.normalizeReading(item?.reading);
        return !hiddenReadingSet.has(normalizedReading);
    });
};

MeimayPartnerInsights.getOwnEncounteredReadings = function () {
    const library = typeof getEncounteredLibrary === 'function'
        ? getEncounteredLibrary()
        : { readings: [] };
    return Array.isArray(library.readings) ? library.readings : [];
};

MeimayPartnerInsights.getPartnerEncounteredReadings = function () {
    const readings = MeimayShare?.partnerSnapshot?.encounteredReadings;
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

MeimayPartnerInsights.getPartnerDisplayName = function () {
    const snapshot = MeimayShare.partnerSnapshot || {};
    const explicitName = String(snapshot.displayName || '').trim();
    if (explicitName) return explicitName;
    if (typeof getPartnerRoleLabel === 'function') return getPartnerRoleLabel(snapshot.role);
    return snapshot.role === 'mama' ? 'ママ' : snapshot.role === 'papa' ? 'パパ' : 'パートナー';
};

MeimayPartnerInsights.getOwnApprovedSavedKeys = function () {
    return new Set(this.getOwnSaved()
        .filter(item => item?.approvedFromPartner)
        .map(item => item.approvedPartnerSavedKey || this.buildSavedMatchKey(item))
        .filter(Boolean));
};

MeimayPartnerInsights.getPartnerApprovedSavedKeys = function () {
    return new Set(this.getPartnerSaved()
        .filter(item => item?.approvedFromPartner)
        .map(item => item.approvedPartnerSavedKey || this.buildSavedMatchKey(item))
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
    const ownKeys = new Set(this.getOwnReadingCollection().map(entry => this.buildReadingStockKey(entry)).filter(Boolean));
    return ownKeys.has(key);
};

MeimayPartnerInsights.getOwnReadingCollection = function () {
    return this.buildReadingCollection(this.getOwnReadingStock(), this.getOwnLiked(), { fromPartner: false });
};

MeimayPartnerInsights.getPartnerReadingCollection = function () {
    return this.buildReadingCollection(this.getPartnerReadingStock(), this.getPartnerLiked(), { fromPartner: true });
};

MeimayPartnerInsights.getMatchedReadingItems = function () {
    const normalizeReading = (value) => {
        const raw = String(value || '').trim().split('::')[0].trim();
        if (!raw) return '';
        return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
    };

    const partnerReadings = new Set(
        this.getPartnerReadingCollection()
            .map(item => normalizeReading(item?.reading))
            .filter(Boolean)
    );
    const seenReadings = new Set();

    return this.getOwnReadingCollection().filter(item => {
        const normalizedReading = normalizeReading(item?.reading);
        if (!normalizedReading || !partnerReadings.has(normalizedReading) || seenReadings.has(normalizedReading)) {
            return false;
        }
        seenReadings.add(normalizedReading);
        return true;
    });
};

MeimayPartnerInsights.isReadingItemMatched = function (item) {
    const normalizeReading = (value) => {
        const raw = String(value || '').trim().split('::')[0].trim();
        if (!raw) return '';
        return (typeof toHira === 'function' ? toHira(raw) : raw).replace(/\s+/g, '');
    };

    const normalizedReading = normalizeReading(item?.reading);
    if (!normalizedReading) return false;

    const partnerReadings = new Set(
        this.getPartnerReadingCollection()
            .map(entry => normalizeReading(entry?.reading))
            .filter(Boolean)
    );
    return partnerReadings.has(normalizedReading);
};

MeimayPartnerInsights.getSummary = function () {
    const ownReadingItems = this.getOwnReadingCollection();
    const partnerReadingItems = this.getPartnerReadingCollection();
    const ownLikedItems = this.getOwnLiked();
    const partnerLikedItems = this.getPartnerLiked();
    const ownSavedItems = this.getOwnSaved();
    const partnerSavedItems = this.getPartnerSaved();
    const matchedReadingItems = this.getMatchedReadingItems();
    const matchedLikedItems = this.getMatchedLikedItems();
    const matchedSavedItems = this.getMatchedSavedItems();
    const partnerName = this.getPartnerDisplayName();
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
        ownKanjiCount: ownLikedItems.length,
        partnerKanjiCount: partnerLikedItems.length,
        ownSavedCount: ownSavedItems.length,
        partnerSavedCount: partnerSavedItems.length,
        matchedReadingCount: matchedReadingItems.length,
        matchedKanjiCount: matchedLikedItems.length,
        matchedNameCount: matchedSavedItems.length,
        matchedReadingItems: matchedReadingItems,
        matchedLikedItems: matchedLikedItems,
        matchedSavedItems: matchedSavedItems,
        matchedTotalCount: matchedReadingItems.length + matchedLikedItems.length + matchedSavedItems.length,
        ownTotalCount: ownReadingItems.length + ownLikedItems.length + ownSavedItems.length,
        partnerTotalCount: partnerReadingItems.length + partnerLikedItems.length + partnerSavedItems.length,
        counts: {
            own: {
                reading: ownReadingItems.length,
                kanji: ownLikedItems.length,
                saved: ownSavedItems.length
            },
            partner: {
                reading: partnerReadingItems.length,
                kanji: partnerLikedItems.length,
                saved: partnerSavedItems.length
            },
            matched: {
                reading: matchedReadingItems.length,
                kanji: matchedLikedItems.length,
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
            label: 'ママ',
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
        label: 'パパ',
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
    const partnerBase = typeof window.getActiveProfilePalette === 'function'
        ? window.getActiveProfilePalette(resolvedPartnerRole, MeimayShare?.partnerSnapshot?.themeId)
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
            label: 'ふたり',
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
        stars.push(`<span style="color:${palettes.self.star}; text-shadow:0 1px 0 rgba(255,255,255,0.72)">★</span>`);
    }
    if (options.partner) {
        stars.push(`<span style="color:${palettes.partner.star}; text-shadow:0 1px 0 rgba(255,255,255,0.72)">★</span>`);
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
    if (document.getElementById('scr-ranking')?.classList.contains('active')) {
        if (typeof loadRanking === 'function') loadRanking();
    }
}

window.refreshPartnerAwareUI = refreshPartnerAwareUI;
window.getPartnerRoleLabel = getPartnerRoleLabel;
cleanupLegacyPartnerLocalData();
