/* ============================================================
   MODULE 15: FIREBASE AUTH & CLOUD SYNC (V21.0)
   ユーザー認証 & Firestoreクラウド同期
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
// AUTH - ユーザー認証
// ============================================================
const MeimayAuth = {
    currentUser: null,

    // Google ログイン
    signInWithGoogle: async function () {
        try {
            showLoginLoading(true);
            showLoginError(''); // エラー表示をクリア
            const provider = new firebase.auth.GoogleAuthProvider();
            // 一部環境でポップアップがブロックされるため、エラー時はRedirectを誘導するなどの考慮が必要だが
            // まずはポップアップで試行し、エラー内容をログに出力
            await firebaseAuth.signInWithPopup(provider);
            console.log("FIREBASE: Google sign-in success");
        } catch (e) {
            console.error("FIREBASE: Google sign-in failed", e);
            let msg = getAuthErrorMessage(e.code);
            if (e.code === 'auth/popup-blocked') {
                msg = 'ポップアップがブロックされました。ブラウザの設定を確認してください。';
            }
            showLoginError(msg);
        } finally {
            showLoginLoading(false);
        }
    },

    // メール ログイン
    signInWithEmail: async function () {
        const email = document.getElementById('login-email')?.value?.trim();
        const pass = document.getElementById('login-password')?.value;
        if (!email || !pass) { showLoginError('メールアドレスとパスワードを入力してください'); return; }
        try {
            showLoginLoading(true);
            await firebaseAuth.signInWithEmailAndPassword(email, pass);
            console.log("FIREBASE: Email sign-in success");
        } catch (e) {
            console.error("FIREBASE: Email sign-in failed", e);
            showLoginError(getAuthErrorMessage(e.code));
        } finally {
            showLoginLoading(false);
        }
    },

    // メール 新規登録
    signUpWithEmail: async function () {
        const email = document.getElementById('login-email')?.value?.trim();
        const pass = document.getElementById('login-password')?.value;
        if (!email || !pass) { showLoginError('メールアドレスとパスワードを入力してください'); return; }
        if (pass.length < 6) { showLoginError('パスワードは6文字以上にしてください'); return; }
        try {
            showLoginLoading(true);
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;

            // メール認証を送信
            await user.sendEmailVerification();
            showToast('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。', '📧');

            console.log("FIREBASE: Email sign-up success and verification sent");
        } catch (e) {
            console.error("FIREBASE: Email sign-up failed", e);
            showLoginError(getAuthErrorMessage(e.code));
        } finally {
            showLoginLoading(false);
        }
    },

    // 認証メール再送
    resendVerificationEmail: async function () {
        const user = firebaseAuth.currentUser;
        if (!user) return;
        try {
            showLoginLoading(true);
            await user.sendEmailVerification();
            showToast('確認メールを再送しました。', '📧');
        } catch (e) {
            console.error("FIREBASE: Resend verification failed", e);
            showToast('再送に失敗しました。しばらく時間を置いてから再度お試しください。', '❌');
        } finally {
            showLoginLoading(false);
        }
    },

    // 匿名ログイン
    signInAnonymous: async function () {
        try {
            showLoginLoading(true);
            await firebaseAuth.signInAnonymously();
            console.log("FIREBASE: Anonymous sign-in success");
        } catch (e) {
            console.error("FIREBASE: Anonymous sign-in failed", e);
            showLoginError(getAuthErrorMessage(e.code));
        } finally {
            showLoginLoading(false);
        }
    },

    // ログアウト
    signOut: async function () {
        try {
            await firebaseAuth.signOut();
            console.log("FIREBASE: Signed out");
        } catch (e) {
            console.error("FIREBASE: Sign-out failed", e);
        }
    },

    getCurrentUser: function () {
        return this.currentUser;
    },

    // ニックネーム変更
    editNickname: function () {
        const wizData = WizardData.get() || {};
        const oldName = wizData.username || '';
        const newName = prompt('新しいニックネーム（呼び名）を入力してください', oldName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) {
            alert('ニックネームを入力してください');
            return;
        }
        wizData.username = trimmed;
        WizardData.save(wizData);
        updateAuthUI(this.currentUser);
        // ドロワーの名前も更新
        if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        // ホーム画面の挨拶も更新
        if (typeof updateHomeGreeting === 'function') updateHomeGreeting();
        // クラウド同期
        if (this.currentUser) MeimaySync.uploadData();
        showToast('ニックネームを更新しました', '✨');
    },

    // 名字変更
    editSurname: function () {
        const wizData = WizardData.get() || {};
        const oldSurname = wizData.surname || '';
        const newSurname = prompt('新しい名字を入力してください', oldSurname);
        if (newSurname === null) return;
        const trimmed = newSurname.trim();

        wizData.surname = trimmed;
        WizardData.save(wizData);

        // グローバル変数も更新
        if (typeof surnameStr !== 'undefined') {
            surnameStr = trimmed;
            const surnameInput = document.getElementById('in-surname');
            if (surnameInput) surnameInput.value = surnameStr;
            if (typeof updateSurnameData === 'function') updateSurnameData();
        }

        updateAuthUI(this.currentUser);
        // クラウド同期
        if (this.currentUser) MeimaySync.uploadData();
        showToast('名字を更新しました', '✨');
    }
};

// ============================================================
// SYNC - Firestoreクラウド同期
// ============================================================
const MeimaySync = {
    _uploading: false,
    _unsubscribe: null,

    // ローカル → Firestore にアップロード
    uploadData: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { console.warn("SYNC: No user, skip upload"); return; }

        // メール認証チェック (パスワード認証のみ)
        const providerId = user.providerData?.[0]?.providerId;
        if (providerId === 'password' && !user.emailVerified) {
            console.warn("SYNC: Email not verified, skip upload");
            return;
        }

        if (this._uploading) return;
        this._uploading = true;

        const statusEl = document.getElementById('sync-status');
        if (statusEl) statusEl.textContent = '🔄 同期中...';

        try {
            const userRef = firebaseDb.collection('users').doc(user.uid);

            // プロフィール
            await userRef.set({
                displayName: user.displayName || 'ゲスト',
                email: user.email || null,
                provider: user.providerData?.[0]?.providerId || 'anonymous',
                lastSync: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // ストック漢字
            if (typeof liked !== 'undefined') {
                await userRef.collection('data').doc('liked').set({
                    items: liked,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // 保存済み名前
            try {
                const savedData = localStorage.getItem('meimay_saved');
                if (savedData) {
                    await userRef.collection('data').doc('savedNames').set({
                        items: JSON.parse(savedData),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (e) { console.warn("SYNC: savedNames parse error", e); }

            // 読み方履歴
            try {
                const histData = localStorage.getItem('meimay_reading_history');
                if (histData) {
                    await userRef.collection('data').doc('readingHistory').set({
                        items: JSON.parse(histData),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (e) { console.warn("SYNC: history parse error", e); }

            // 設定
            try {
                const settings = {};
                ['naming_app_surname', 'naming_app_segments', 'naming_app_settings'].forEach(key => {
                    const val = localStorage.getItem(key);
                    if (val) settings[key] = val;
                });
                if (Object.keys(settings).length > 0) {
                    await userRef.collection('data').doc('settings').set({
                        ...settings,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (e) { console.warn("SYNC: settings parse error", e); }

            if (statusEl) statusEl.textContent = '✅ 同期済み';
            console.log("SYNC: Upload complete");
        } catch (e) {
            console.error("SYNC: Upload failed", e);
            if (statusEl) statusEl.textContent = '❌ 同期失敗';
        } finally {
            this._uploading = false;
        }
    },

    // Firestore → ローカルにダウンロード
    downloadData: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) return;

        // メール認証チェック
        const providerId = user.providerData?.[0]?.providerId;
        if (providerId === 'password' && !user.emailVerified) {
            console.warn("SYNC: Email not verified, skip download");
            return;
        }

        try {
            const userRef = firebaseDb.collection('users').doc(user.uid);
            const dataCol = userRef.collection('data');

            // ストック漢字
            const likedDoc = await dataCol.doc('liked').get();
            if (likedDoc.exists && likedDoc.data().items) {
                const cloudLiked = likedDoc.data().items;
                // Deletions would be reverted if we append localOnly, so we must strictly sync to Cloud state
                liked = [...cloudLiked];
                if (typeof StorageBox !== 'undefined') StorageBox.saveLiked();
                console.log(`SYNC: Downloaded liked (${cloudLiked.length} items)`);
            }

            // 保存済み名前
            const savedDoc = await dataCol.doc('savedNames').get();
            if (savedDoc.exists && savedDoc.data().items) {
                const cloudSaved = savedDoc.data().items;
                localStorage.setItem('meimay_saved', JSON.stringify(cloudSaved));
                if (typeof getSavedNames !== 'undefined') {
                    savedNames = cloudSaved;
                }
                console.log(`SYNC: Downloaded savedNames (${cloudSaved.length} items)`);
            }

            // 読み方履歴
            const histDoc = await dataCol.doc('readingHistory').get();
            if (histDoc.exists && histDoc.data().items) {
                const cloudHist = histDoc.data().items;
                localStorage.setItem('meimay_reading_history', JSON.stringify(cloudHist));
                console.log(`SYNC: Downloaded readingHistory (${cloudHist.length} items)`);
            }

            // 設定
            const settingsDoc = await dataCol.doc('settings').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                ['naming_app_surname', 'naming_app_segments', 'naming_app_settings'].forEach(key => {
                    if (data[key]) localStorage.setItem(key, data[key]);
                });
                console.log("SYNC: Downloaded settings");
            }

            console.log("SYNC: Download complete");
        } catch (e) {
            console.error("SYNC: Download failed", e);
        }
    },

    // 自動同期（保存時にフック）
    autoUploadDebounced: (function () {
        let timer = null;
        return function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                MeimaySync.uploadData();
            }, 5000); // 5秒デバウンス
        };
    })()
};

// ============================================================
// UI HELPERS
// ============================================================
function showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

function showLoginLoading(show) {
    // ボタンの無効化等（簡易版）
    const buttons = document.querySelectorAll('#login-form-area button');
    buttons.forEach(btn => {
        btn.disabled = show;
        if (show) btn.style.opacity = '0.5';
        else btn.style.opacity = '';
    });
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'メールアドレスの形式が正しくありません',
        'auth/user-disabled': 'このアカウントは無効です',
        'auth/user-not-found': 'このメールアドレスは登録されていません',
        'auth/wrong-password': 'パスワードが間違っています',
        'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
        'auth/weak-password': 'パスワードが弱すぎます（6文字以上にしてください）',
        'auth/popup-closed-by-user': 'ログインがキャンセルされました',
        'auth/cancelled-popup-request': 'ログインがキャンセルされました',
        'auth/network-request-failed': 'ネットワークエラー。接続を確認してください',
        'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています'
    };
    return messages[code] || 'ログインに失敗しました';
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('drawer-login-btn');
    const accountBtn = document.getElementById('drawer-account-btn');
    const avatar = document.getElementById('drawer-avatar');
    const username = document.getElementById('drawer-username');
    const loginForm = document.getElementById('login-form-area');
    const accountInfo = document.getElementById('account-info-area');
    const menuAccount = document.getElementById('drawer-menu-account');

    if (user) {
        // ログイン済み
        const wizData = WizardData.get() || {};
        const name = wizData.username || user.displayName || user.email?.split('@')[0] || 'ユーザー';
        const initial = name.charAt(0).toUpperCase();
        const provider = user.providerData?.[0]?.providerId || 'anonymous';
        const providerLabel = {
            'google.com': 'Google',
            'apple.com': 'Apple',
            'password': 'メール',
        }[provider] || '匿名';

        if (loginBtn) loginBtn.classList.add('hidden');
        if (accountBtn) accountBtn.classList.remove('hidden');
        if (avatar) avatar.textContent = initial;
        if (username) username.textContent = name;
        if (menuAccount) {
            menuAccount.querySelector('span:last-child').textContent = 'アカウント';
        }

        // ログイン画面の切り替え
        if (loginForm) loginForm.classList.add('hidden');
        if (accountInfo) accountInfo.classList.remove('hidden');

        const bigAvatar = document.getElementById('account-avatar-big');
        const dispName = document.getElementById('account-display-name');
        const emailEl = document.getElementById('account-email');
        const provEl = document.getElementById('account-provider');

        if (bigAvatar) bigAvatar.textContent = initial;
        if (dispName) dispName.textContent = name;
        if (emailEl) emailEl.textContent = user.email || '(メールなし)';
        if (provEl) provEl.textContent = providerLabel;

        const surnameEl = document.getElementById('account-surname');
        if (surnameEl) {
            const sn = wizData.surname || '';
            surnameEl.textContent = sn ? `@${sn}` : '@苗字未設定';
        }

        // メール認証状態の表示
        const verifyArea = document.getElementById('email-verification-area');
        if (verifyArea) {
            const isPasswordUser = provider === 'password';
            if (isPasswordUser && !user.emailVerified) {
                verifyArea.classList.remove('hidden');
            } else {
                verifyArea.classList.add('hidden');
            }
        }
    } else {
        // 未ログイン
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (accountBtn) accountBtn.classList.add('hidden');
        if (avatar) avatar.textContent = 'P';
        if (username) username.textContent = 'ゲスト';
        if (menuAccount) {
            menuAccount.querySelector('span:last-child').textContent = 'ログイン';
        }

        if (loginForm) loginForm.classList.remove('hidden');
        if (accountInfo) accountInfo.classList.add('hidden');
    }
}

// ============================================================
// AUTH STATE LISTENER
// ============================================================
if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged(async (user) => {
        MeimayAuth.currentUser = user;
        updateAuthUI(user);

        if (user) {
            console.log(`FIREBASE: Auth state -> logged in (${user.uid})`);

            // 認証済みかGoogleユーザーのみ同期・監視を開始
            const isVerified = (user.providerData?.[0]?.providerId !== 'password' || user.emailVerified);

            if (isVerified) {
                // ログイン直後: クラウドからダウンロード → ローカルとマージ → アップロード
                await MeimaySync.downloadData();
                await MeimaySync.uploadData();

                // パートナー情報の監視を開始
                if (typeof MeimayPairing !== 'undefined') MeimayPairing.listenForPartner();
            }

            // もしウィザードからのログインフローならホームへ遷移
            if (window.isWizardLoginFlow) {
                window.isWizardLoginFlow = false;
                if (typeof changeScreen === 'function') changeScreen('scr-mode');
                if (typeof updateHomeGreeting === 'function') updateHomeGreeting();
            }

            // ドロワーを閉じる
            if (typeof closeDrawer === 'function') closeDrawer();
        } else {
            console.log("FIREBASE: Auth state -> logged out");
            MeimayShare.stopListening();
            if (typeof MeimayPairing !== 'undefined') MeimayPairing.stopListeningPartner();
        }
    });
}

// ============================================================
// STORAGE HOOK — 保存時に自動同期
// ============================================================
(function hookStorageSync() {
    // StorageBoxのsaveAll完了後にクラウド同期を走らせる
    const waitForStorageBox = setInterval(() => {
        if (typeof StorageBox !== 'undefined' && StorageBox.saveAll) {
            const originalSaveAll = StorageBox.saveAll.bind(StorageBox);
            StorageBox.saveAll = function () {
                const result = originalSaveAll();
                if (MeimayAuth.getCurrentUser()) {
                    MeimaySync.autoUploadDebounced();
                    // Auto-share with partner if enabled
                    if (typeof shareMode !== 'undefined' && shareMode === 'auto' && typeof MeimayPairing !== 'undefined' && MeimayPairing.partnerId) {
                        MeimayShare.shareLiked(true);
                        MeimayShare.shareSavedNames(true);
                    }
                }
                return result;
            };

            const originalSaveLiked = StorageBox.saveLiked.bind(StorageBox);
            StorageBox.saveLiked = function () {
                const result = originalSaveLiked();
                if (MeimayAuth.getCurrentUser()) {
                    MeimaySync.autoUploadDebounced();
                    // Auto-share with partner if enabled
                    if (typeof shareMode !== 'undefined' && shareMode === 'auto' && typeof MeimayPairing !== 'undefined' && MeimayPairing.partnerId) {
                        MeimayShare.shareLiked(true);
                    }
                }
                return result;
            };

            clearInterval(waitForStorageBox);
            console.log("FIREBASE: Storage sync hooks attached");
        }
    }, 500);

    // 10秒でタイムアウト
    setTimeout(() => clearInterval(waitForStorageBox), 10000);
})();

// ============================================================
// DRAWER NAVIGATION HOOK
// ============================================================
(function hookDrawerLogin() {
    const waitForDrawerNav = setInterval(() => {
        if (typeof drawerNavigate !== 'undefined') {
            const originalDrawerNav = window.drawerNavigate;
            window.drawerNavigate = function (target) {
                if (target === 'login') {
                    if (typeof closeDrawer === 'function') closeDrawer();
                    if (typeof changeScreen === 'function') changeScreen('scr-login');
                    return;
                }
                originalDrawerNav.apply(this, arguments);
            };
            clearInterval(waitForDrawerNav);
            console.log("FIREBASE: Drawer login hook attached");
        }
    }, 500);
    setTimeout(() => clearInterval(waitForDrawerNav), 10000);
})();

// ============================================================
// PAIRING - パートナーペアリング
// ============================================================
const MeimayPairing = {
    partnerId: null,
    partnerName: null,

    // 6桁招待コード生成
    generateCode: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { showLoginError('先にログインしてください'); return null; }

        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            await firebaseDb.collection('pairingCodes').doc(code).set({
                uid: user.uid,
                displayName: user.displayName || user.email?.split('@')[0] || 'ユーザー',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 10分後に自動削除
            setTimeout(async () => {
                try { await firebaseDb.collection('pairingCodes').doc(code).delete(); } catch (e) { }
            }, 10 * 60 * 1000);

            console.log(`PAIRING: Code generated: ${code}`);
            return code;
        } catch (e) {
            console.error('PAIRING: Code generation failed', e);
            return null;
        }
    },

    // コードを入力してペアリング
    enterCode: async function (code) {
        const user = MeimayAuth.getCurrentUser();
        if (!user) { return { success: false, error: '先にログインしてください' }; }
        if (!code || code.length < 4) { return { success: false, error: 'コードを入力してください' }; }

        try {
            const codeDoc = await firebaseDb.collection('pairingCodes').doc(code.toUpperCase()).get();
            if (!codeDoc.exists) {
                return { success: false, error: 'コードが見つかりません（期限切れの可能性があります）' };
            }

            const data = codeDoc.data();
            if (data.uid === user.uid) {
                return { success: false, error: '自分自身のコードです' };
            }

            const partnerUid = data.uid;
            const partnerName = data.displayName || 'パートナー';

            // 相互にpartnerIdをセット
            const batch = firebaseDb.batch();
            batch.set(firebaseDb.collection('users').doc(user.uid), { partnerId: partnerUid, partnerName: partnerName }, { merge: true });
            batch.set(firebaseDb.collection('users').doc(partnerUid), {
                partnerId: user.uid,
                partnerName: user.displayName || user.email?.split('@')[0] || 'ユーザー'
            }, { merge: true });
            await batch.commit();

            // コードを削除
            await firebaseDb.collection('pairingCodes').doc(code.toUpperCase()).delete();

            this.partnerId = partnerUid;
            this.partnerName = partnerName;
            updatePairingUI();

            // 共有リスニング開始
            MeimayShare.listenForShared();

            console.log(`PAIRING: Paired with ${partnerUid}`);
            return { success: true, partnerName: partnerName };
        } catch (e) {
            console.error('PAIRING: Enter code failed', e);
            return { success: false, error: 'ペアリングに失敗しました' };
        }
    },

    // ペアリング解除
    unpair: async function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user || !this.partnerId) return;

        try {
            const batch = firebaseDb.batch();
            batch.update(firebaseDb.collection('users').doc(user.uid), {
                partnerId: firebase.firestore.FieldValue.delete(),
                partnerName: firebase.firestore.FieldValue.delete()
            });
            batch.update(firebaseDb.collection('users').doc(this.partnerId), {
                partnerId: firebase.firestore.FieldValue.delete(),
                partnerName: firebase.firestore.FieldValue.delete()
            });
            await batch.commit();

            MeimayShare.stopListening();
            this.partnerId = null;
            this.partnerName = null;
            updatePairingUI();
            console.log('PAIRING: Unpaired');
        } catch (e) {
            console.error('PAIRING: Unpair failed', e);
        }
    },

    _partnerUnsub: null,

    // パートナー情報のリスニング（リアルタイム検知）
    listenForPartner: function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) return;

        if (this._partnerUnsub) this._partnerUnsub();

        this._partnerUnsub = firebaseDb.collection('users').doc(user.uid).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();

                // パートナーIDに変化があった場合
                if (data.partnerId !== this.partnerId) {
                    this.partnerId = data.partnerId;
                    this.partnerName = data.partnerName || 'パートナー';

                    if (this.partnerId) {
                        console.log(`PAIRING: Partner linked: ${this.partnerName}`);
                        updatePairingUI();
                        // 連携されたら共有リスニングを開始
                        MeimayShare.listenForShared();
                    } else {
                        console.log('PAIRING: Partner unlinked');
                        updatePairingUI();
                        // 解除されたら共有リスニングを停止
                        MeimayShare.stopListening();
                    }
                } else if (data.partnerId && data.partnerName !== this.partnerName) {
                    // 名前だけ変わった場合
                    this.partnerName = data.partnerName;
                    updatePairingUI();
                }
            }
        }, (error) => {
            console.warn('PAIRING: Listen partner info failed', error);
        });
    },

    // リスニング停止
    stopListeningPartner: function () {
        if (this._partnerUnsub) {
            this._partnerUnsub();
            this._partnerUnsub = null;
        }
        this.partnerId = null;
        this.partnerName = null;
    }
};

// ============================================================
// SHARE - パートナーとのデータ共有
// ============================================================
const MeimayShare = {
    _likedUnsub: null,
    _savedUnsub: null,

    // ストック漢字をパートナーに共有
    shareLiked: async function (silent = false) {
        const user = MeimayAuth.getCurrentUser();
        const partnerId = MeimayPairing.partnerId;
        if (!user || !partnerId) {
            showToast('パートナーとペアリングしてください', '⚠️');
            return;
        }

        if (typeof liked === 'undefined' || liked.length === 0) {
            if (!silent) showToast('共有するストックがありません', '⚠️');
            return;
        }

        try {
            await firebaseDb.collection('users').doc(partnerId)
                .collection('shared').doc('liked').set({
                    items: liked,
                    fromUid: user.uid,
                    fromName: user.displayName || user.email?.split('@')[0] || 'パートナー',
                    sentAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            if (!silent) {
                showToast(`ストック ${liked.length}件 を共有しました！`, '📤');
            } console.log(`SHARE: Sent ${liked.length} liked items`);
        } catch (e) {
            console.error('SHARE: Send liked failed', e);
            showToast('共有に失敗しました', '❌');
        }
    },

    // 保存した名前をパートナーに共有
    shareSavedNames: async function (silent = false) {
        const user = MeimayAuth.getCurrentUser();
        const partnerId = MeimayPairing.partnerId;
        if (!user || !partnerId) {
            showToast('パートナーとペアリングしてください', '⚠️');
            return;
        }

        try {
            const saved = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
            if (saved.length === 0) {
                if (!silent) showToast('共有する保存名前がありません', '⚠️');
                return;
            }

            await firebaseDb.collection('users').doc(partnerId)
                .collection('shared').doc('savedNames').set({
                    items: saved,
                    fromUid: user.uid,
                    fromName: user.displayName || user.email?.split('@')[0] || 'パートナー',
                    sentAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            if (!silent) {
                showToast(`保存名前 ${saved.length}件 を共有しました！`, '📤');
            } console.log(`SHARE: Sent ${saved.length} saved names`);
        } catch (e) {
            console.error('SHARE: Send saved names failed', e);
            showToast('共有に失敗しました', '❌');
        }
    },

    // リアルタイム受信リスナー
    listenForShared: function () {
        const user = MeimayAuth.getCurrentUser();
        if (!user) return;

        this.stopListening();

        const sharedRef = firebaseDb.collection('users').doc(user.uid).collection('shared');

        // ストック共有の受信
        this._likedUnsub = sharedRef.doc('liked').onSnapshot((doc) => {
            if (doc.exists && doc.data().items) {
                const data = doc.data();
                // 自動取り込み＆フラグ付与
                const added = this.mergeSharedLiked(data.items, data.fromName);
                if (added > 0) {
                    showToast(`${data.fromName}からストック ${added}件 が届き、追加されました！`, '📥');
                    console.log(`SHARE: Auto-merged ${added} liked from ${data.fromName}`);
                }
            }
        });

        // 保存名前の受信
        this._savedUnsub = sharedRef.doc('savedNames').onSnapshot((doc) => {
            if (doc.exists && doc.data().items) {
                const data = doc.data();
                // 自動取り込み＆フラグ付与
                const added = this.mergeSharedSaved(data.items, data.fromName);
                if (added > 0) {
                    showToast(`${data.fromName}から保存名前 ${added}件 が届き、追加されました！`, '📥');
                    console.log(`SHARE: Auto-merged ${added} saved names from ${data.fromName}`);
                }
            }
        });

        console.log('SHARE: Listening for shared data');
    },

    stopListening: function () {
        if (this._likedUnsub) { this._likedUnsub(); this._likedUnsub = null; }
        if (this._savedUnsub) { this._savedUnsub(); this._savedUnsub = null; }
    },

    // 受信ストックを自動マージして追加件数を返す
    mergeSharedLiked: function (items, partnerName) {
        if (typeof liked === 'undefined') return 0;
        let added = 0;
        items.forEach(item => {
            const exists = liked.some(l => l['漢字'] === item['漢字'] && l.slot === item.slot && l.sessionReading === item.sessionReading);
            if (!exists) {
                // パートナー由来フラグを付与
                item.fromPartner = true;
                item.partnerName = partnerName || 'パートナー';
                liked.push(item);
                added++;
            }
        });
        if (added > 0) {
            if (typeof StorageBox !== 'undefined') StorageBox.saveLiked();
            // 画面更新 (ストック画面が開かれている場合)
            if (typeof renderStock === 'function' && document.getElementById('scr-stock') && document.getElementById('scr-stock').classList.contains('active')) {
                renderStock();
            }
        }
        return added;
    },

    // 受信保存名前を自動マージして追加件数を返す
    mergeSharedSaved: function (items, partnerName) {
        try {
            const local = JSON.parse(localStorage.getItem('meimay_saved') || '[]');
            let added = 0;
            items.forEach(item => {
                const exists = local.some(l => l.fullName === item.fullName);
                if (!exists) {
                    // パートナー由来フラグを付与
                    item.fromPartner = true;
                    item.partnerName = partnerName || 'パートナー';
                    local.push(item);
                    added++;
                }
            });
            if (added > 0) {
                localStorage.setItem('meimay_saved', JSON.stringify(local));
                // 画面更新 (保存済み画面が開かれている場合)
                if (typeof renderSavedList === 'function' && document.getElementById('scr-saved') && document.getElementById('scr-saved').classList.contains('active')) {
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
    const pairingNotLinked = document.getElementById('pairing-not-linked');
    const pairingLinked = document.getElementById('pairing-linked');
    const partnerNameEl = document.getElementById('pairing-partner-name');
    const shareButtons = document.querySelectorAll('.partner-share-btn');

    if (MeimayPairing.partnerId) {
        if (pairingNotLinked) pairingNotLinked.classList.add('hidden');
        if (pairingLinked) pairingLinked.classList.remove('hidden');
        if (partnerNameEl) partnerNameEl.textContent = MeimayPairing.partnerName || 'パートナー';
        shareButtons.forEach(btn => btn.classList.remove('hidden'));
    } else {
        if (pairingNotLinked) pairingNotLinked.classList.remove('hidden');
        if (pairingLinked) pairingLinked.classList.add('hidden');
        shareButtons.forEach(btn => btn.classList.add('hidden'));
    }
}

// 招待コード発行UI
async function handleGenerateCode() {
    const codeDisplay = document.getElementById('pairing-code-display');
    const btn = document.getElementById('btn-generate-code');
    if (btn) btn.disabled = true;

    const code = await MeimayPairing.generateCode();
    if (code && codeDisplay) {
        codeDisplay.textContent = code;
        codeDisplay.classList.remove('hidden');
    }
    if (btn) btn.disabled = false;
}

// コード入力してペアリング
async function handleEnterCode() {
    const input = document.getElementById('pairing-code-input');
    const code = input?.value?.trim();
    const result = await MeimayPairing.enterCode(code);
    if (result.success) {
        showToast(`${result.partnerName}とペアリングしました！`, '💑');
        if (input) input.value = '';
    } else {
        showToast(result.error, '⚠️');
    }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, icon = '📢', onAction = null) {
    // 既存トーストを削除
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

    // 自動消去
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, onAction ? 10000 : 4000);
}

// Toast CSS animations
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
window.MeimaySync = MeimaySync;
window.MeimayPairing = MeimayPairing;
window.MeimayShare = MeimayShare;
window.handleGenerateCode = handleGenerateCode;
window.handleEnterCode = handleEnterCode;
window.showToast = showToast;

console.log("FIREBASE: Module loaded (v21.0 + pairing)");







