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
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebaseAuth.signInWithPopup(provider);
            console.log("FIREBASE: Google sign-in success");
        } catch (e) {
            console.error("FIREBASE: Google sign-in failed", e);
            showLoginError(getAuthErrorMessage(e.code));
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
            await firebaseAuth.createUserWithEmailAndPassword(email, pass);
            console.log("FIREBASE: Email sign-up success");
        } catch (e) {
            console.error("FIREBASE: Email sign-up failed", e);
            showLoginError(getAuthErrorMessage(e.code));
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

        try {
            const userRef = firebaseDb.collection('users').doc(user.uid);
            const dataCol = userRef.collection('data');

            // ストック漢字
            const likedDoc = await dataCol.doc('liked').get();
            if (likedDoc.exists && likedDoc.data().items) {
                const cloudLiked = likedDoc.data().items;
                if (cloudLiked.length > 0) {
                    // マージ: クラウドデータをベースに、ローカルにしかないものを追加
                    const localOnly = liked.filter(local =>
                        !cloudLiked.some(cloud => cloud['漢字'] === local['漢字'] && cloud.slot === local.slot && cloud.sessionReading === local.sessionReading)
                    );
                    liked = [...cloudLiked, ...localOnly];
                    if (typeof StorageBox !== 'undefined') StorageBox.saveLiked();
                    console.log(`SYNC: Merged liked (cloud:${cloudLiked.length} + localOnly:${localOnly.length})`);
                }
            }

            // 保存済み名前
            const savedDoc = await dataCol.doc('savedNames').get();
            if (savedDoc.exists && savedDoc.data().items) {
                const cloudSaved = savedDoc.data().items;
                const localSaved = (() => { try { return JSON.parse(localStorage.getItem('meimay_saved') || '[]'); } catch { return []; } })();
                const localOnly = localSaved.filter(l => !cloudSaved.some(c => c.fullName === l.fullName));
                const merged = [...cloudSaved, ...localOnly];
                localStorage.setItem('meimay_saved', JSON.stringify(merged));
                console.log(`SYNC: Merged savedNames (cloud:${cloudSaved.length} + localOnly:${localOnly.length})`);
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
    const logoutBtn = document.getElementById('drawer-logout-btn');
    const avatar = document.getElementById('drawer-avatar');
    const username = document.getElementById('drawer-username');
    const loginForm = document.getElementById('login-form-area');
    const accountInfo = document.getElementById('account-info-area');
    const menuAccount = document.getElementById('drawer-menu-account');

    if (user) {
        // ログイン済み
        const name = user.displayName || user.email?.split('@')[0] || 'ユーザー';
        const initial = name.charAt(0).toUpperCase();
        const provider = user.providerData?.[0]?.providerId || 'anonymous';
        const providerLabel = {
            'google.com': 'Google',
            'apple.com': 'Apple',
            'password': 'メール',
        }[provider] || '匿名';

        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
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
    } else {
        // 未ログイン
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
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
            // ログイン直後: クラウドからダウンロード → ローカルとマージ → アップロード
            await MeimaySync.downloadData();
            await MeimaySync.uploadData();

            // ログイン画面にいたらホームに戻す
            const loginScreen = document.getElementById('scr-login');
            if (loginScreen && loginScreen.classList.contains('active')) {
                if (typeof changeScreen === 'function') changeScreen('scr-mode');
            }

            // ドロワーを閉じる
            if (typeof closeDrawer === 'function') closeDrawer();
        } else {
            console.log("FIREBASE: Auth state -> logged out");
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
                }
                return result;
            };

            const originalSaveLiked = StorageBox.saveLiked.bind(StorageBox);
            StorageBox.saveLiked = function () {
                const result = originalSaveLiked();
                if (MeimayAuth.getCurrentUser()) {
                    MeimaySync.autoUploadDebounced();
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

// Global exports
window.MeimayAuth = MeimayAuth;
window.MeimaySync = MeimaySync;

console.log("FIREBASE: Module loaded (v21.0)");
