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
            // 保存済みルームがあれば再接続
            await MeimayPairing.resumeRoom();
        } else {
            console.log("FIREBASE: No user");
        }
    });
}

// 起動時に匿名認証を自動実行
MeimayAuth.init();

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
        const role = this._selectedCreateRole;
        if (!role) { showToast('ママ / パパを選んでください', '⚠️'); return null; }

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
        const role = this._selectedJoinRole;
        if (!role) { showToast('ママ / パパを選んでください', '⚠️'); return { success: false }; }
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

    // パートナーのデータをリアルタイム受信
    listenPartnerData: function (partnerUid) {
        if (!partnerUid || !MeimayPairing.roomCode) return;
        this.stopListening();

        this._partnerUnsub = firebaseDb.collection('rooms').doc(MeimayPairing.roomCode)
            .collection('data').doc(partnerUid)
            .onSnapshot((doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                const partnerLabel = data.role === 'mama' ? 'ママ' : 'パパ';

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
                    isSuper: item.isSuper || false
                } : item;
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
                if (typeof renderSavedList === 'function' &&
                    document.getElementById('scr-saved')?.classList.contains('active')) {
                    renderSavedList();
                }
            }
            return added;
        } catch (e) {
            console.error('SHARE: Merge saved failed', e);
            return 0;
        }
    }
};

// ============================================================
// PAIRING UI HELPERS
// ============================================================
function updatePairingUI() {
    const inRoom = !!MeimayPairing.roomCode;
    const hasPartner = !!MeimayPairing.partnerUid;

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
        btn.classList.toggle('hidden', !hasPartner);
    });

    // ドロワーのパートナー連携バッジ
    const drawerPairingBadge = document.getElementById('drawer-pairing-badge');
    if (drawerPairingBadge) {
        drawerPairingBadge.classList.toggle('hidden', !inRoom);
    }
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
const MeimayStats = {
    getCurrentWeekKey: function () {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}_${weekNo.toString().padStart(2, '0')}`;
    },

    recordKanjiLike: async function (kanjiString) {
        if (!kanjiString || typeof firebaseDb === 'undefined') return;
        try {
            const increment = firebase.firestore.FieldValue.increment(1);
            const batch = firebaseDb.batch();
            const allTimeRef = firebaseDb.collection('statistics').doc('allTime');
            batch.set(allTimeRef, { [kanjiString]: increment }, { merge: true });
            const weeklyRef = firebaseDb.collection('statistics').doc(`weekly_${this.getCurrentWeekKey()}`);
            batch.set(weeklyRef, { [kanjiString]: increment }, { merge: true });
            await batch.commit();
        } catch (e) {
            console.error('STATS: recordKanjiLike error', e);
        }
    },

    recordKanjiUnlike: async function (kanjiString) {
        if (!kanjiString || typeof firebaseDb === 'undefined') return;
        try {
            const decrement = firebase.firestore.FieldValue.increment(-1);
            const batch = firebaseDb.batch();
            const allTimeRef = firebaseDb.collection('statistics').doc('allTime');
            batch.set(allTimeRef, { [kanjiString]: decrement }, { merge: true });
            const weeklyRef = firebaseDb.collection('statistics').doc(`weekly_${this.getCurrentWeekKey()}`);
            batch.set(weeklyRef, { [kanjiString]: decrement }, { merge: true });
            await batch.commit();
        } catch (e) {
            console.error('STATS: recordKanjiUnlike error', e);
        }
    },

    fetchRankings: async function (type = 'allTime') {
        try {
            let docRef;
            if (type === 'weekly') {
                docRef = firebaseDb.collection('statistics').doc(`weekly_${this.getCurrentWeekKey()}`);
            } else {
                docRef = firebaseDb.collection('statistics').doc('allTime');
            }
            const doc = await docRef.get();
            if (!doc.exists) return [];
            const data = doc.data();
            return Object.keys(data)
                .filter(k => k !== 'updatedAt')
                .map(key => ({ kanji: key, count: data[key] }))
                .filter(item => item.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 100);
        } catch (e) {
            console.error(`STATS: fetchRankings(${type}) error`, e);
            return [];
        }
    }
};

window.MeimayStats = MeimayStats;

console.log("FIREBASE: Module loaded (v22.0 - anonymous + room pairing)");
