/* ============================================================
   MODULE 11: SETTINGS (V6.0 - 別画面版)
   設定画面（ストック・ビルドと同レベル）
   ============================================================ */

// イメージタグの定義
const IMAGE_TAGS = [
    { id: 'none', label: 'こだわらない', icon: '✨' },
    { id: 'nature', label: '自然', icon: '🌿' },
    { id: 'brightness', label: '明るさ', icon: '☀️' },
    { id: 'water', label: '水', icon: '🌊' },
    { id: 'strength', label: '力強さ', icon: '💪' },
    { id: 'kindness', label: '優しさ', icon: '💗' },
    { id: 'intelligence', label: '知性', icon: '📚' },
    { id: 'honesty', label: '誠実', icon: '🎯' },
    { id: 'elegance', label: '品格', icon: '👑' },
    { id: 'tradition', label: '伝統', icon: '🎎' },
    { id: 'beauty', label: '美しさ', icon: '✨' },
    { id: 'success', label: '成功', icon: '🚀' },
    { id: 'peace', label: '安定', icon: '☮️' },
    { id: 'leadership', label: 'リーダー', icon: '⭐' },
    { id: 'hope', label: '希望', icon: '🌈' },
    { id: 'spirituality', label: '精神', icon: '🕊️' }
];

// グローバル変数
let selectedImageTags = ['none'];
let shareMode = 'auto'; // 'auto' or 'manual'
let showInappropriateKanji = false; // 不適切フラグがある漢字を表示するかどうか

const PROFILE_THEME_OPTIONS = [
    {
        id: 'sora',
        label: '空',
        accent: '#b8d6fb',
        accentStrong: '#8db8ec',
        accentSoft: '#f6faff',
        surface: '#fcfdff',
        mist: '#f8fbff',
        border: '#e4edf8',
        text: '#6e86a2',
        shadow: 'rgba(141, 184, 236, 0.12)',
        star: '#9ec3f2',
        page: '#fdfdff',
        dot: '#e8f1fb'
    },
    {
        id: 'sakura',
        label: '桜',
        accent: '#f6c0d0',
        accentStrong: '#e5a0b8',
        accentSoft: '#fff5f8',
        surface: '#fffdfd',
        mist: '#fff8fa',
        border: '#f3e2e8',
        text: '#926d79',
        shadow: 'rgba(229, 160, 184, 0.12)',
        star: '#ebb0c4',
        page: '#fffdfd',
        dot: '#f7e8ee'
    },
    {
        id: 'wakakusa',
        label: '若草',
        accent: '#c4dfab',
        accentStrong: '#a9c985',
        accentSoft: '#f8fcf1',
        surface: '#fdfffb',
        mist: '#f9fdf4',
        border: '#e5edd8',
        text: '#73845d',
        shadow: 'rgba(169, 201, 133, 0.13)',
        star: '#b7d58f',
        page: '#fdfffc',
        dot: '#edf5e0'
    },
    {
        id: 'yamabuki',
        label: '山吹',
        accent: '#f9d89a',
        accentStrong: '#e7bf6d',
        accentSoft: '#fff9ec',
        surface: '#fffefb',
        mist: '#fffbf2',
        border: '#f0e4c9',
        text: '#927a4a',
        shadow: 'rgba(231, 191, 109, 0.13)',
        star: '#efcb81',
        page: '#fffefb',
        dot: '#f7edd3'
    },
    {
        id: 'fuji',
        label: '藤',
        accent: '#d5c7ef',
        accentStrong: '#b6a3dc',
        accentSoft: '#f8f4ff',
        surface: '#fefcff',
        mist: '#faf7ff',
        border: '#e8e0f5',
        text: '#786c96',
        shadow: 'rgba(182, 163, 220, 0.12)',
        star: '#c4b4e8',
        page: '#fefcff',
        dot: '#efe9fb'
    },
    {
        id: 'anzu',
        label: '杏',
        accent: '#f6cab0',
        accentStrong: '#e8ad85',
        accentSoft: '#fff6ef',
        surface: '#fffdfb',
        mist: '#fff8f2',
        border: '#f0e2d7',
        text: '#9a7761',
        shadow: 'rgba(232, 173, 133, 0.13)',
        star: '#efba98',
        page: '#fffdfb',
        dot: '#f6ece4'
    }
];

function escapeProfileHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getResolvedProfileRole(preferredRole) {
    if (preferredRole === 'mama' || preferredRole === 'papa') return preferredRole;

    const pairingRole = typeof MeimayPairing !== 'undefined' ? MeimayPairing.myRole : '';
    if (pairingRole === 'mama' || pairingRole === 'papa') return pairingRole;

    const savedRole = localStorage.getItem('meimay_my_role');
    if (savedRole === 'mama' || savedRole === 'papa') return savedRole;

    const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    if (wizard.role === 'mama' || wizard.role === 'papa') return wizard.role;

    return 'other';
}

function getDefaultProfileThemeId(role) {
    if (role === 'mama') return 'sakura';
    if (role === 'papa') return 'sora';
    return 'anzu';
}

function getProfileThemeOption(themeId, role) {
    const legacyThemeIds = {
        blush: 'sakura',
        sky: 'sora',
        mint: 'wakakusa',
        amber: 'yamabuki',
        lavender: 'fuji',
        sand: 'anzu'
    };
    const resolvedThemeId = legacyThemeIds[themeId] || themeId;
    const fallbackId = getDefaultProfileThemeId(getResolvedProfileRole(role));
    return PROFILE_THEME_OPTIONS.find(option => option.id === resolvedThemeId)
        || PROFILE_THEME_OPTIONS.find(option => option.id === fallbackId)
        || PROFILE_THEME_OPTIONS[0];
}

function getPartnerReservedThemeInfo() {
    const hasPartner = typeof MeimayPairing !== 'undefined' && !!MeimayPairing.roomCode;
    if (!hasPartner || typeof MeimayShare === 'undefined') {
        return { themeId: '', partnerName: '', themeLabel: '' };
    }

    const snapshot = MeimayShare.partnerSnapshot || {};
    const themeId = String(snapshot.themeId || '').trim();
    const partnerName = (typeof window.MeimayPartnerInsights !== 'undefined' && typeof window.MeimayPartnerInsights.getPartnerDisplayName === 'function')
        ? window.MeimayPartnerInsights.getPartnerDisplayName()
        : (String(snapshot.displayName || snapshot.username || snapshot.nickname || '').trim() || (snapshot.role === 'mama' ? 'ママ' : snapshot.role === 'papa' ? 'パパ' : 'パートナー'));
    const themeLabel = themeId ? getProfileThemeOption(themeId, snapshot.role).label : '';
    return { themeId, partnerName, themeLabel };
}

function getAvailableProfileThemeId(requestedThemeId, role, blockedThemeId) {
    const requested = getProfileThemeOption(requestedThemeId, role).id;
    if (!blockedThemeId || requested !== blockedThemeId) return requested;

    const preferred = getDefaultProfileThemeId(role);
    if (preferred !== blockedThemeId) return preferred;

    const fallback = PROFILE_THEME_OPTIONS.find(option => option.id !== blockedThemeId);
    return fallback ? fallback.id : requested;
}

function getProfileThemeId(role) {
    const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    return wizard.themeId || getDefaultProfileThemeId(getResolvedProfileRole(role || wizard.role));
}

function getActiveProfilePalette(role, themeId) {
    const resolvedRole = getResolvedProfileRole(role);
    const option = getProfileThemeOption(themeId || getProfileThemeId(resolvedRole), resolvedRole);
    return {
        role: resolvedRole,
        label: option.label,
        accent: option.accent,
        accentStrong: option.accentStrong,
        accentSoft: option.accentSoft,
        surface: option.surface,
        mist: option.mist,
        border: option.border,
        text: option.text,
        shadow: option.shadow,
        star: option.star,
        page: option.page,
        dot: option.dot
    };
}

function applyProfileTheme(themeId) {
    const palette = getActiveProfilePalette(null, themeId);
    const root = document.documentElement;
    if (!root) return palette;

    root.style.setProperty('--profile-accent', palette.accent);
    root.style.setProperty('--profile-accent-strong', palette.accentStrong);
    root.style.setProperty('--profile-accent-soft', palette.accentSoft);
    root.style.setProperty('--profile-surface', palette.surface);
    root.style.setProperty('--profile-surface-alt', palette.mist);
    root.style.setProperty('--profile-border', palette.border);
    root.style.setProperty('--profile-text', palette.text);
    root.style.setProperty('--profile-shadow', palette.shadow);
    root.style.setProperty('--profile-page', palette.page);
    root.style.setProperty('--profile-dot', palette.dot);

    return palette;
}

function resolveProfileThemeForRoleChange(data, nextRole, previousRole) {
    const nextResolvedRole = getResolvedProfileRole(nextRole);
    const prevResolvedRole = getResolvedProfileRole(previousRole || data?.role);
    const reservedTheme = getPartnerReservedThemeInfo();
    const currentThemeId = String(data?.themeId || '').trim();
    const shouldUseRoleDefault = !data?.themeCustomized
        || !currentThemeId
        || currentThemeId === getDefaultProfileThemeId(prevResolvedRole);

    if (shouldUseRoleDefault) {
        return getAvailableProfileThemeId(
            getDefaultProfileThemeId(nextResolvedRole),
            nextResolvedRole,
            reservedTheme.themeId
        );
    }

    return getAvailableProfileThemeId(currentThemeId, nextResolvedRole, reservedTheme.themeId);
}

function syncProfileAppearance(options = {}) {
    applyProfileTheme();
    if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
    if (typeof refreshPartnerAwareUI === 'function') {
        refreshPartnerAwareUI();
    } else if (typeof renderHomeProfile === 'function') {
        renderHomeProfile();
    }
    if (options.rerenderSettings && typeof renderSettingsScreen === 'function') {
        renderSettingsScreen();
    }
}

function saveProfileAppearance(nextValues = {}) {
    if (typeof WizardData === 'undefined') return;

    const data = WizardData.get() || {};
    const reservedTheme = getPartnerReservedThemeInfo();
    if (Object.prototype.hasOwnProperty.call(nextValues, 'nickname')) {
        data.username = String(nextValues.nickname || '').trim().slice(0, 10);
    }
    if (Object.prototype.hasOwnProperty.call(nextValues, 'themeId')) {
        data.themeId = getAvailableProfileThemeId(
            nextValues.themeId || getDefaultProfileThemeId(getResolvedProfileRole(data.role)),
            getResolvedProfileRole(data.role),
            reservedTheme.themeId
        );
        if (nextValues.themeTouched === true) {
            data.themeCustomized = true;
        }
    }
    WizardData.save(data);
    if (typeof MeimayShare !== 'undefined' && typeof MeimayShare.syncProfileAppearance === 'function') {
        MeimayShare.syncProfileAppearance();
    }
    syncProfileAppearance({ rerenderSettings: !!nextValues.rerenderSettings });
}



/**
 * 設定画面を開く（別画面として）
 */
function openSettings() {
    renderSettingsScreen();
    changeScreen('scr-settings');
}

function getSettingsGenderLabel(value) {
    return value === 'male' ? '男の子' : value === 'female' ? '女の子' : '指定なし';
}

function getSettingsActiveChildSummary() {
    if (typeof MeimayChildWorkspaces === 'undefined'
        || !MeimayChildWorkspaces
        || typeof MeimayChildWorkspaces.getActiveChild !== 'function') {
        return getSettingsGenderLabel(gender);
    }

    const activeChild = MeimayChildWorkspaces.getActiveChild();
    if (!activeChild) return getSettingsGenderLabel(gender);
    const label = typeof MeimayChildWorkspaces.getChildLabel === 'function'
        ? MeimayChildWorkspaces.getChildLabel(activeChild.meta?.id)
        : (activeChild.meta?.displayLabel || '第一子');
    return `${label}・${getSettingsGenderLabel(activeChild.meta?.gender)}`;
}

function openActiveChildSettingsFromSettings() {
    if (typeof MeimayChildWorkspaces !== 'undefined'
        && MeimayChildWorkspaces
        && MeimayChildWorkspaces.root?.activeChildId
        && typeof MeimayChildWorkspaces.openChildModal === 'function') {
        MeimayChildWorkspaces.openChildModal('edit', MeimayChildWorkspaces.root.activeChildId);
        return;
    }
    openGenderInput();
}

/**
 * 設定画面のレンダリング
 */
function renderSettingsScreen() {
    const container = document.getElementById('settings-screen-content');
    if (!container) return;

    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const nicknameText = wizData?.username || '未設定';
    const roleText = wizData?.role === 'papa' ? 'パパ' : wizData?.role === 'mama' ? 'ママ' : '未設定';
    const profileThemeText = getProfileThemeOption(getProfileThemeId(wizData?.role), wizData?.role).label;
    const activeChildText = getSettingsActiveChildSummary();
    const kanjiRangeText = showInappropriateKanji ? 'すべて' : 'おすすめ';


    // Partner linking status
    let pairingStatusText = '未連携';
    let pairingStatusColor = '#a6967a';
    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        if (MeimayPairing.partnerUid) {
            pairingStatusText = `連携中（${MeimayPairing.roomCode}）`;
            pairingStatusColor = '#4ade80';
        } else {
            pairingStatusText = `連携待ち（${MeimayPairing.roomCode}）`;
            pairingStatusColor = '#b9965b';
        }
    }

    const premiumState = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getMembershipState === 'function'
        ? PremiumManager.getMembershipState()
        : null;
    const premiumDisplay = typeof PremiumManager !== 'undefined' && typeof PremiumManager.getDisplayStatus === 'function'
        ? PremiumManager.getDisplayStatus()
        : null;
    const dailyRemainingText = typeof getDailyRemainingCount === 'function' ? getDailyRemainingCount() : '-';
    const premiumText = premiumDisplay?.active
        ? (premiumDisplay.kind === 'trial' ? '無料体験中' : '有効')
        : (premiumState?.expired ? '期限切れ' : `無料プラン・残り ${dailyRemainingText} 回`);

    const escapeSettingsHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const renderSection = (label, content) => `
        <section class="settings-section">
            <div class="settings-section-label">${escapeSettingsHtml(label)}</div>
            <div class="settings-stack">${content}</div>
        </section>
    `;
    const renderItem = ({ title, value, onClick, valueStyle = '', arrow = '›', badge = '' }) => {
        const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
        return `
        <button type="button" class="settings-item-unified" onclick="${onClick}">
            <span class="item-content-unified">
                <span class="item-title-unified">${escapeSettingsHtml(title)}</span>
                ${hasValue ? `<span class="item-value-unified" style="${valueStyle}">${escapeSettingsHtml(value)}</span>` : ''}
            </span>
            <span class="item-arrow-unified flex items-center gap-2">
                ${badge}
                <span>${arrow}</span>
            </span>
        </button>
    `;
    };


    container.innerHTML = `
        <div class="settings-screen-content">
            ${renderSection('プロフィール', `
                ${renderItem({ title: 'ニックネーム', value: nicknameText, onClick: 'openProfileAppearanceModal()' })}
                ${renderItem({ title: 'テーマカラー', value: profileThemeText, onClick: 'openProfileAppearanceModal()' })}
                ${renderItem({ title: 'あなたの役割', value: roleText, onClick: 'openRoleInput()' })}
            `)}

            ${renderSection('名づけ条件', `
                ${renderItem({ title: '苗字', value: surnameStr || '未設定', onClick: 'openSurnameInput()' })}
                ${renderItem({ title: '子どもの設定', value: activeChildText, onClick: 'openActiveChildSettingsFromSettings()' })}
            `)}

            ${renderSection('共有とプレミアム', `
                ${renderItem({ title: 'パートナー連携', value: pairingStatusText, valueStyle: `color: ${pairingStatusColor};`, onClick: 'openPartnerSettingsSheet()' })}
                ${renderItem({
                    title: 'プレミアム',
                    value: premiumText,
                    valueStyle: 'white-space: pre-line;',
                    onClick: "if(typeof showPremiumModal==='function'){showPremiumModal();}"
                })}
            `)}

            ${renderSection('データと表示', `
                ${renderItem({ title: 'バックアップと復元', value: '復元キー', onClick: 'openTransferModal()' })}
                ${renderItem({ title: '表示する漢字の範囲', value: kanjiRangeText, onClick: 'openKanjiRangeSettingModal()' })}
                ${renderItem({ title: 'アプリデータを削除', value: '初期化', valueStyle: 'color:#c56555;font-weight:800;', onClick: 'openDeleteAppDataSheet()' })}
            `)}

            ${renderSection('ヘルプと情報', `
                ${renderItem({ title: '利用規約', onClick: "if(typeof openLegalScreen==='function'){openLegalScreen('terms');}" })}
                ${renderItem({ title: 'プライバシーポリシー', onClick: "if(typeof openLegalScreen==='function'){openLegalScreen('privacy');}" })}
            `)}

            ${renderSection('お問い合わせ', `
                ${renderItem({ title: 'お問い合わせ', onClick: "if(typeof openLegalScreen==='function'){openLegalScreen('contact');}" })}
            `)}
        </div>
    `;
}

/**
 * 全ストック削除
 */
function deleteAllStocks() {
    if (!confirm('本当にすべてのストック（いいねした漢字）を削除しますか？\nこの操作は元に戻せません。')) {
        return;
    }
    if (!confirm('【最終確認】\nストック一覧が完全に空になります。よろしいですか？')) {
        return;
    }

    // ストックを空にする
    liked.splice(0, liked.length);

    // 全体ランキング等の統計からもマイナスする処理は、数が多いと通信負荷がかかるため一旦省略
    // ローカルストレージに保存＆Firebase同期
    if (typeof StorageBox !== 'undefined' && StorageBox.saveLiked) {
        StorageBox.saveLiked();
    }

    alert('すべてのストックを消去しました。');
}

function openDeleteAppDataSheet() {
    const modal = `
        <div class="overlay active modal-overlay-dark" id="delete-app-data-sheet" onclick="if(event.target.id==='delete-app-data-sheet')closeDeleteAppDataSheet()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeDeleteAppDataSheet()">✕</button>
                <h3 class="modal-title">アプリデータを削除</h3>
                <p class="modal-desc">端末内の名づけデータ、復元キー、クラウドバックアップ、パートナー連携情報を削除します。</p>
                <div class="settings-sheet-list">
                    <div class="settings-sheet-row">
                        <span>削除されるもの</span>
                        <strong>保存名・ストック・設定</strong>
                    </div>
                    <div class="settings-sheet-row">
                        <span>購入履歴</span>
                        <strong>ストア側に残ります</strong>
                    </div>
                </div>
                <p class="mt-3 text-[11px] leading-relaxed text-[#9a8a70]">プレミアム購入済みの場合、削除後は同じApple ID / Googleアカウントで購入状態の同期が必要になることがあります。</p>
                <div id="delete-app-data-status" class="mt-3 hidden rounded-2xl bg-[#fff4ec] px-4 py-3 text-[11px] font-bold leading-relaxed text-[#9a5a46]"></div>
                <button type="button" id="delete-app-data-confirm" onclick="deleteMeimayAppData()" class="mt-4 w-full rounded-2xl bg-[#c56555] px-4 py-3 text-sm font-black text-white shadow-sm active:scale-95 transition-transform">すべてのデータを削除</button>
                <button type="button" onclick="closeDeleteAppDataSheet()" class="mt-2 w-full rounded-2xl border border-[#d4c5af] bg-white px-4 py-3 text-sm font-black text-[#5d5444] active:scale-95 transition-transform">キャンセル</button>
            </div>
        </div>
    `;
    document.getElementById('delete-app-data-sheet')?.remove();
    document.body.insertAdjacentHTML('beforeend', modal);
}

function closeDeleteAppDataSheet() {
    document.getElementById('delete-app-data-sheet')?.remove();
}

function setDeleteAppDataStatus(message, tone = 'working') {
    const status = document.getElementById('delete-app-data-status');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('hidden');
    status.style.background = tone === 'error' ? '#fff1f1' : '#fff4ec';
    status.style.color = tone === 'error' ? '#b74f4f' : '#9a5a46';
}

async function deleteMeimayAppData() {
    const firstConfirm = confirm('保存した名前、ストック、読み・漢字の履歴、設定、復元キー、クラウドバックアップを削除します。\nこの操作は元に戻せません。続けますか？');
    if (!firstConfirm) return;
    const finalConfirm = confirm('最終確認です。\n購入履歴はストア側に残りますが、アプリ内の名づけデータは削除されます。本当に削除しますか？');
    if (!finalConfirm) return;

    const button = document.getElementById('delete-app-data-confirm');
    if (button) {
        button.disabled = true;
        button.textContent = '削除中...';
        button.style.opacity = '0.7';
    }
    setDeleteAppDataStatus('削除しています。画面を閉じずにお待ちください。');

    const warnings = [];
    try {
        if (typeof MeimayShare !== 'undefined' && MeimayShare && typeof MeimayShare.stopListening === 'function') {
            MeimayShare.stopListening();
        }
    } catch (error) {
        console.warn('SETTINGS: Failed to stop partner listener before data deletion', error);
    }

    try {
        if (typeof MeimayPairing !== 'undefined' && MeimayPairing && MeimayPairing.roomCode && typeof MeimayPairing.leaveRoom === 'function') {
            await MeimayPairing.leaveRoom();
        }
    } catch (error) {
        console.warn('SETTINGS: Failed to leave pairing room during data deletion', error);
        warnings.push('パートナー連携の解除に失敗しました');
    }

    try {
        if (typeof MeimayUserBackup !== 'undefined' && MeimayUserBackup && typeof MeimayUserBackup.deleteRemoteBackup === 'function') {
            await MeimayUserBackup.deleteRemoteBackup();
        } else if (typeof firebaseDb !== 'undefined' && firebaseDb && typeof MeimayAuth !== 'undefined' && MeimayAuth.getCurrentUser()?.uid) {
            await firebaseDb.collection('users').doc(MeimayAuth.getCurrentUser().uid).delete();
        }
    } catch (error) {
        console.warn('SETTINGS: Failed to delete remote backup during data deletion', error);
        warnings.push('クラウドバックアップの削除に失敗しました');
    }

    const currentUser = (typeof firebaseAuth !== 'undefined' && firebaseAuth && firebaseAuth.currentUser)
        ? firebaseAuth.currentUser
        : (typeof MeimayAuth !== 'undefined' && MeimayAuth ? MeimayAuth.getCurrentUser() : null);
    try {
        if (currentUser && typeof currentUser.delete === 'function') {
            await currentUser.delete();
        }
    } catch (error) {
        console.warn('SETTINGS: Failed to delete anonymous Firebase user', error);
        warnings.push('匿名IDの削除に失敗しました');
    }

    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (error) {
        console.warn('SETTINGS: Failed to clear local storage', error);
    }

    if (warnings.length > 0) {
        setDeleteAppDataStatus('端末内データは削除しました。一部のクラウド削除は通信状況により完了していない可能性があります。必要に応じてお問い合わせください。', 'error');
    } else {
        setDeleteAppDataStatus('削除しました。アプリを再読み込みします。');
    }
    setTimeout(() => location.reload(), 900);
}



/**
 * ニックネーム入力
 */
function openNicknameInput() {
    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const current = String(wizData?.username || '').trim().slice(0, 10);
    showInputModal('ニックネームを入力', 'text', current, '例：メイ', (value) => {
        saveProfileAppearance({
            nickname: value,
            rerenderSettings: true
        });
    });
}

/**
 * 役割選択
 */
function openRoleInput(options = {}) {
    const config = typeof options === 'function' ? { onSave: options } : (options || {});
    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const current = (wizData?.role === 'mama' || wizData?.role === 'papa' || (!config.parentOnly && wizData?.role === 'other'))
        ? wizData.role
        : (config.parentOnly ? '' : 'other');
    const optionsList = [
        { label: 'ママ', value: 'mama' },
        { label: 'パパ', value: 'papa' }
    ];
    if (!config.parentOnly) {
        optionsList.push({ label: 'その他', value: 'other' });
    }
    showChoiceModal(config.title || '役割を選択', config.description || '', optionsList, current, (value) => {
        if (typeof WizardData !== 'undefined') {
            const data = WizardData.get() || {};
            const previousRole = data.role;
            data.role = value;
            data.themeId = resolveProfileThemeForRoleChange(data, value, previousRole);
            WizardData.save(data);
            if (typeof MeimayShare !== 'undefined' && typeof MeimayShare.syncProfileAppearance === 'function') {
                MeimayShare.syncProfileAppearance();
            }
            syncProfileAppearance({ rerenderSettings: true });
        }
        try {
            if (value === 'mama' || value === 'papa') {
                localStorage.setItem('meimay_my_role', value);
            } else if (!localStorage.getItem('meimay_room_code')) {
                localStorage.removeItem('meimay_my_role');
            }
        } catch (error) { }
        if (typeof syncPairingRoleSelectionFromProfile === 'function') {
            syncPairingRoleSelectionFromProfile();
        }
        if (typeof config.onSave === 'function') {
            config.onSave(value);
        }
    });
}



/**
 * 苗字入力
 */
function syncSurnameInputsToState() {
    const surnameInput = document.getElementById('in-surname');
    if (surnameInput) surnameInput.value = surnameStr || '';

    const diagSurnameInput = document.getElementById('diag-surname');
    if (diagSurnameInput) diagSurnameInput.value = surnameStr || '';
}

function rebuildSurnameDataFromState() {
    const chars = String(surnameStr || '').trim().split('');
    surnameData = chars.map((char) => {
        const found = Array.isArray(master) ? master.find((item) => item['漢字'] === char) : null;
        let strokes = 0;
        if (typeof strokeData !== 'undefined' && strokeData && strokeData[char]) {
            strokes = strokeData[char];
        } else if (found) {
            strokes = parseInt(found['画数'], 10) || 0;
        }
        return {
            kanji: char,
            strokes
        };
    });
}

function openSurnameInput(options = {}) {
    const afterSave = typeof options === 'function'
        ? options
        : (typeof options?.onSave === 'function' ? options.onSave : null);

    showSurnameModal(surnameStr, surnameReading, (kanji, reading) => {
        surnameStr = kanji || '';
        surnameReading = reading || '';
        syncSurnameInputsToState();

        if (typeof updateSurnameData === 'function' && document.getElementById('in-surname')) {
            updateSurnameData();
        } else {
            rebuildSurnameDataFromState();
            if (typeof syncPairingSurnameDisplay === 'function') syncPairingSurnameDisplay();
        }

        if (typeof WizardData !== 'undefined') {
            const data = WizardData.get() || {};
            data.surname = surnameStr;
            data.surnameReading = surnameReading;
            WizardData.save(data);
        }

        try {
            const surnameStorageKey = (typeof StorageBox !== 'undefined' && StorageBox && StorageBox.KEY_SURNAME)
                ? StorageBox.KEY_SURNAME
                : 'naming_app_surname';
            localStorage.setItem(surnameStorageKey, JSON.stringify({
                str: surnameStr,
                data: Array.isArray(surnameData) ? surnameData : [],
                reading: surnameReading || ''
            }));
        } catch (error) {
            console.warn('SETTINGS: Failed to persist surname state', error);
        }

        if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        saveSettings();
        renderSettingsScreen();
        if (typeof renderHomeProfile === 'function') renderHomeProfile();
        if (afterSave) {
            afterSave({
                surname: surnameStr,
                surnameReading,
                surnameData: Array.isArray(surnameData) ? surnameData : []
            });
        }
    });
}

/**
 * 性別選択
 */
function openGenderInput() {
    showChoiceModal('性別を選択', '選んだ性別に合う漢字が優先表示されます', [
        { label: '男の子', value: 'male' },
        { label: '女の子', value: 'female' },
        { label: '指定なし', value: 'neutral' }
    ], gender, (value) => {
        gender = value;
        saveSettings();
        renderSettingsScreen();
    });
}



/**
 * パートナー共有設定
 */
function editShareMode() {
    showChoiceModal('パートナー共有設定', '', [
        { label: '自動連携', value: 'auto', desc: 'ストックや保存済みを自動的にパートナーと同期します' },
        { label: '都度連携（手動）', value: 'manual', desc: 'ストック画面等の「共有」ボタンを押した時だけ同期します' }
    ], shareMode, (value) => {
        shareMode = value;
        saveSettings();
        renderSettingsScreen();
        const display = document.getElementById('account-share-mode-display');
        if (display) {
            display.innerText = value === 'manual' ? '都度連携（手動）' : '自動連携';
        }
    });
}

function openPartnerSettingsSheet() {
    const status = (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode)
        ? `${MeimayPairing.partnerUid ? '連携中' : '連携待ち'}（${escapeProfileHtml(MeimayPairing.roomCode)}）`
        : '未連携';
    const modal = `
        <div class="overlay active modal-overlay-dark" id="partner-settings-sheet" onclick="if(event.target.id==='partner-settings-sheet')closePartnerSettingsSheet()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closePartnerSettingsSheet()">✕</button>
                <h3 class="modal-title">パートナー連携</h3>
                <div class="settings-sheet-list">
                    <div class="settings-sheet-row">
                        <span>状態</span>
                        <strong>${status}</strong>
                    </div>
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closePartnerSettingsSheet(); changeScreen('scr-login');">
                        <span>連携設定を開く</span>
                        <strong>›</strong>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
}

function closePartnerSettingsSheet() {
    document.getElementById('partner-settings-sheet')?.remove();
}

function openLegalSettingsSheet() {
    const modal = `
        <div class="overlay active modal-overlay-dark" id="legal-settings-sheet" onclick="if(event.target.id==='legal-settings-sheet')closeLegalSettingsSheet()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeLegalSettingsSheet()">✕</button>
                <h3 class="modal-title">規約・プライバシー・お問い合わせ</h3>
                <div class="settings-sheet-list">
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closeLegalSettingsSheet(); if(typeof openLegalScreen==='function'){openLegalScreen('terms');}">
                        <span>利用規約</span>
                        <strong>›</strong>
                    </button>
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closeLegalSettingsSheet(); if(typeof openLegalScreen==='function'){openLegalScreen('privacy');}">
                        <span>プライバシーポリシー</span>
                        <strong>›</strong>
                    </button>
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closeLegalSettingsSheet(); if(typeof openLegalScreen==='function'){openLegalScreen('contact');}">
                        <span>お問い合わせ</span>
                        <strong>›</strong>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
}

function closeLegalSettingsSheet() {
    document.getElementById('legal-settings-sheet')?.remove();
}

function openProfileAppearanceModal() {
    const wizard = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    const role = getResolvedProfileRole(wizard.role);
    const reservedTheme = getPartnerReservedThemeInfo();
    const currentThemeId = getAvailableProfileThemeId(getProfileThemeId(role), role, reservedTheme.themeId);
    const currentName = String(wizard.username || '').trim().slice(0, 10);
    const themeButtons = PROFILE_THEME_OPTIONS.map((option) => {
        const isSelected = option.id === currentThemeId;
        const isReserved = reservedTheme.themeId === option.id;
        const blockedLabel = isReserved
            ? `${escapeProfileHtml(reservedTheme.partnerName)}が使用中`
            : '';
        return `
            <button type="button"
                class="profile-theme-option${isSelected ? ' selected' : ''}${isReserved ? ' disabled' : ''}"
                data-theme-id="${option.id}"
                aria-label="${option.label}${blockedLabel ? ` ${blockedLabel}` : ''}"
                ${isReserved ? 'disabled' : `onclick="selectProfileThemeOption('${option.id}', event)"`}>
                <span class="profile-theme-swatch"
                    style="background:linear-gradient(135deg, ${option.accent} 0%, ${option.accentStrong} 100%);box-shadow:0 8px 18px ${option.shadow};"></span>
                <span class="profile-theme-name">${option.label}</span>
                ${isReserved ? `<span class="profile-theme-meta">${blockedLabel}</span>` : ''}
            </button>
        `;
    }).join('');

    const modal = `
        <div class="overlay active modal-overlay-dark" id="profile-appearance-modal" onclick="if(event.target.id==='profile-appearance-modal')closeProfileAppearanceModal()">
            <div class="modal-sheet settings-sheet profile-appearance-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeProfileAppearanceModal()">✕</button>
                <h3 class="modal-title">プロフィール</h3>
                <div class="modal-body">
                    <div>
                        <label class="profile-appearance-label" for="profile-appearance-name">ニックネーム</label>
                        <input type="text"
                            id="profile-appearance-name"
                            class="modal-input-large text-center w-full"
                            value="${escapeProfileHtml(currentName)}"
                            placeholder="例：けい"
                            maxlength="10">
                        <div class="modal-input-underline"></div>
                    </div>
                    <div class="mt-5">
                        <div class="profile-appearance-label">テーマカラー</div>
                        <div class="profile-theme-grid">${themeButtons}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveProfileAppearanceModal()" class="btn-modal-primary">保存</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    window.profileAppearanceThemeId = currentThemeId;
    window.profileAppearanceThemeTouched = false;
    setTimeout(() => document.getElementById('profile-appearance-name')?.focus(), 100);
}

function selectProfileThemeOption(themeId, event) {
    const targetButton = event?.currentTarget || event?.target?.closest?.('.profile-theme-option');
    if (targetButton?.disabled || targetButton?.classList?.contains('disabled')) return;

    window.profileAppearanceThemeId = themeId;
    window.profileAppearanceThemeTouched = true;
    document.querySelectorAll('.profile-theme-option').forEach((button) => {
        button.classList.toggle('selected', button.dataset.themeId === themeId);
    });

    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
}

function saveProfileAppearanceModal() {
    const input = document.getElementById('profile-appearance-name');
    saveProfileAppearance({
        nickname: input ? input.value : '',
        themeId: window.profileAppearanceThemeId || getProfileThemeId(),
        themeTouched: window.profileAppearanceThemeTouched === true,
        rerenderSettings: document.getElementById('scr-settings')?.classList.contains('active')
    });
    closeProfileAppearanceModal();
    if (typeof showToast === 'function') showToast('プロフィールを更新しました', '✓');
}

function closeProfileAppearanceModal() {
    document.getElementById('profile-appearance-modal')?.remove();
    delete window.profileAppearanceThemeId;
    delete window.profileAppearanceThemeTouched;
}

function getStoredBackupRestoreKey() {
    return typeof MeimayUserBackup !== 'undefined'
        && MeimayUserBackup
        && typeof MeimayUserBackup.getStoredRestoreKey === 'function'
        ? MeimayUserBackup.getStoredRestoreKey()
        : '';
}

function updateBackupRestoreKeyDisplay(restoreKey = '') {
    const key = restoreKey || getStoredBackupRestoreKey();
    const display = document.getElementById('backup-restore-key-display');
    const copyButton = document.getElementById('backup-restore-key-copy');
    const issueButton = document.getElementById('backup-restore-key-issue');
    const stateLabel = document.getElementById('backup-restore-key-state');
    if (display) {
        display.textContent = key || '未発行';
        display.classList.toggle('is-empty', !key);
    }
    if (stateLabel) {
        stateLabel.textContent = key ? '発行済み' : '未発行';
        stateLabel.classList.toggle('is-ready', !!key);
    }
    if (copyButton) {
        copyButton.disabled = !key;
        copyButton.classList.toggle('is-disabled', !key);
    }
    if (issueButton) {
        issueButton.textContent = key ? '復元キーを再発行' : '復元キーを発行';
    }
}

function setBackupRestoreStatus(message = '', tone = 'neutral') {
    const status = document.getElementById('backup-restore-status');
    if (!status) return;
    status.textContent = message || '復元キーは、家族以外に共有しないでください。';
    status.dataset.tone = tone;
}

function formatBackupRestoreKeyInput(event) {
    const input = event && event.currentTarget ? event.currentTarget : document.getElementById('backup-restore-key-input');
    if (!input) return;
    const raw = input.value || '';
    const formatted = typeof MeimayUserBackup !== 'undefined'
        && MeimayUserBackup
        && typeof MeimayUserBackup._formatRestoreKey === 'function'
        ? MeimayUserBackup._formatRestoreKey(raw)
        : String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1-');
    input.value = formatted;
    setBackupRestoreStatus('', 'neutral');
}

function openTransferModal() {
    const restoreKey = getStoredBackupRestoreKey();
    const modal = `
        <div class="overlay active modal-overlay-dark" id="transfer-modal" onclick="if(event.target.id==='transfer-modal')closeTransferModal()">
            <div class="modal-sheet settings-sheet settings-transfer-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeTransferModal()">✕</button>
                <h3 class="modal-title">バックアップと復元</h3>
                <p class="modal-desc">端末を替えたときも、保存候補を復元キーで戻せます。パートナー連携は復元後に再設定してください。</p>
                <div class="modal-body backup-restore-body">
                    <section class="backup-restore-card">
                        <div class="backup-restore-card-head">
                            <div>
                                <div class="backup-restore-eyebrow">この端末</div>
                                <div class="backup-restore-title">復元キーを保管</div>
                            </div>
                            <span id="backup-restore-key-state" class="backup-restore-state ${restoreKey ? 'is-ready' : ''}">${restoreKey ? '発行済み' : '未発行'}</span>
                        </div>
                        <p class="backup-restore-copy">発行すると、現在の候補をクラウドに保存します。再発行すると前のキーは使えなくなります。</p>
                        <div class="backup-restore-key-box">
                            <span>復元キー</span>
                            <strong id="backup-restore-key-display" class="${restoreKey ? '' : 'is-empty'}">${restoreKey || '未発行'}</strong>
                        </div>
                        <div class="backup-restore-actions">
                            <button id="backup-restore-key-issue" onclick="issueBackupRestoreKey()" class="backup-restore-primary">
                                ${restoreKey ? '復元キーを再発行' : '復元キーを発行'}
                            </button>
                            <button id="backup-restore-key-copy" onclick="copyBackupRestoreKey()" class="backup-restore-secondary ${restoreKey ? '' : 'is-disabled'}" ${restoreKey ? '' : 'disabled'}>
                                キーをコピー
                            </button>
                        </div>
                    </section>
                    <section class="backup-restore-card">
                        <div class="backup-restore-eyebrow">別端末から</div>
                        <label class="backup-restore-title" for="backup-restore-key-input">復元キーで戻す</label>
                        <p class="backup-restore-copy">この端末にない候補だけを追加します。今ある候補は消えません。</p>
                        <input id="backup-restore-key-input" type="text" inputmode="text" autocomplete="off" maxlength="19" placeholder="XXXX-XXXX-XXXX-XXXX" aria-describedby="backup-restore-status" oninput="formatBackupRestoreKeyInput(event)" onkeydown="if(event.key==='Enter'){restoreBackupFromRestoreKey(event);}" class="backup-restore-input">
                        <button onclick="restoreBackupFromRestoreKey(event)" class="backup-restore-dark">
                            復元する
                        </button>
                    </section>
                    <section class="backup-restore-note">
                        <strong>復元ルール</strong>
                        <span>IDや苗字だけでは復元できません。復元キーをなくした場合は、元の端末で再発行してください。復元後も旧端末はそのまま使えますが、パートナー連携は新端末へ自動では移りません。</span>
                    </section>
                    <div id="backup-restore-status" class="backup-restore-status" role="status" aria-live="polite" data-tone="neutral">復元キーは、家族以外に共有しないでください。</div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    updateBackupRestoreKeyDisplay(restoreKey);
}

function closeTransferModal() {
    document.getElementById('transfer-modal')?.remove();
}

async function issueBackupRestoreKey() {
    if (typeof MeimayUserBackup === 'undefined' || !MeimayUserBackup) {
        if (typeof showToast === 'function') showToast('復元キーはまだ準備中です', '⚠');
        return;
    }
    const existingKey = getStoredBackupRestoreKey();
    if (existingKey && !confirm('復元キーを再発行すると、前のキーは使えなくなります。続けますか？')) {
        return;
    }
    setBackupRestoreStatus('現在の候補をバックアップしています。', 'neutral');
    const button = document.getElementById('backup-restore-key-issue');
    if (button) {
        button.disabled = true;
        button.textContent = '発行中...';
    }
    try {
        const result = existingKey && typeof MeimayUserBackup.rotateRestoreKey === 'function'
            ? await MeimayUserBackup.rotateRestoreKey()
            : await MeimayUserBackup.ensureRestoreKey();
        updateBackupRestoreKeyDisplay(result.restoreKey);
        setBackupRestoreStatus('復元キーを発行しました。安全な場所に保管してください。', 'success');
        if (typeof showToast === 'function') showToast('復元キーを発行しました', '✓');
    } catch (error) {
        console.warn('BACKUP: Restore key issue failed', error);
        const message = typeof MeimayUserBackup._getRestoreErrorMessage === 'function'
            ? MeimayUserBackup._getRestoreErrorMessage(error)
            : '復元キーの発行に失敗しました';
        setBackupRestoreStatus(message, 'error');
        if (typeof showToast === 'function') {
            showToast(message, '⚠');
        }
        updateBackupRestoreKeyDisplay(existingKey);
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

async function copyBackupRestoreKey() {
    const key = getStoredBackupRestoreKey();
    if (!key) {
        if (typeof showToast === 'function') showToast('先に復元キーを発行してください', '⚠');
        return;
    }
    try {
        await navigator.clipboard.writeText(key);
        setBackupRestoreStatus('復元キーをコピーしました。', 'success');
        if (typeof showToast === 'function') showToast('復元キーをコピーしました', '✓');
    } catch (error) {
        setBackupRestoreStatus('コピーできませんでした。表示されたキーを控えてください。', 'error');
        if (typeof showToast === 'function') showToast(`復元キー: ${key}`, '✓');
    }
}

async function restoreBackupFromRestoreKey(event) {
    const input = document.getElementById('backup-restore-key-input');
    const restoreKey = input ? input.value : '';
    const normalizedKey = typeof MeimayUserBackup !== 'undefined'
        && MeimayUserBackup
        && typeof MeimayUserBackup._normalizeRestoreKey === 'function'
        ? MeimayUserBackup._normalizeRestoreKey(restoreKey)
        : String(restoreKey || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalizedKey) {
        const message = '復元キーを入力してください。';
        setBackupRestoreStatus(message, 'error');
        if (typeof showToast === 'function') showToast(message, '⚠');
        return;
    }
    if (normalizedKey.length !== 16) {
        const message = '復元キーは16文字です。入力内容を確認してください。';
        setBackupRestoreStatus(message, 'error');
        if (typeof showToast === 'function') showToast(message, '⚠');
        return;
    }
    if (input && typeof MeimayUserBackup !== 'undefined' && MeimayUserBackup && typeof MeimayUserBackup._formatRestoreKey === 'function') {
        input.value = MeimayUserBackup._formatRestoreKey(normalizedKey);
    }
    if (!confirm('復元キーのバックアップを、この端末に追加します。今ある候補は消えません。続けますか？')) {
        return;
    }
    const button = event && event.currentTarget && event.currentTarget.tagName === 'BUTTON'
        ? event.currentTarget
        : null;
    if (button) {
        button.disabled = true;
        button.textContent = '復元中...';
    }
    setBackupRestoreStatus('バックアップを復元しています。', 'neutral');
    try {
        if (typeof MeimayUserBackup === 'undefined'
            || !MeimayUserBackup
            || typeof MeimayUserBackup.restoreFromKey !== 'function') {
            throw new Error('復元機能はまだ準備中です');
        }
        await MeimayUserBackup.restoreFromKey(restoreKey);
        closeTransferModal();
        if (typeof showToast === 'function') showToast('バックアップを復元しました', '✓');
        setTimeout(() => location.reload(), 700);
    } catch (error) {
        console.warn('BACKUP: Restore by key failed', error);
        const message = typeof MeimayUserBackup !== 'undefined'
            && MeimayUserBackup
            && typeof MeimayUserBackup._getRestoreErrorMessage === 'function'
            ? MeimayUserBackup._getRestoreErrorMessage(error)
            : (error?.message || 'バックアップ復元に失敗しました');
        setBackupRestoreStatus(message, 'error');
        if (typeof showToast === 'function') {
            showToast(message, '⚠');
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = '復元キーで復元';
        }
    }
}



/**
 * 使い方ガイド
 */
function showGuide() {
    if (typeof changeScreen === 'function') {
        changeScreen('scr-mode');
    }
    setTimeout(() => {
        if (typeof showContextualGuideForCurrentScreen === 'function') {
            showContextualGuideForCurrentScreen({ force: true, delay: 80 });
        } else if (typeof showTutorial === 'function') {
            showTutorial({ markShown: false });
        }
    }, 180);
}

/**
 * 不適切設定の切り替え
 */
function setKanjiRangeSetting(value) {
    showInappropriateKanji = value === 'all';
    saveSettings();
    renderSettingsScreen();
    showToast(`表示範囲を${showInappropriateKanji ? 'すべて' : 'おすすめ'}にしました`);
}

function openKanjiRangeSettingModal() {
    showChoiceModal(
        '表示する漢字の範囲',
        '通常は「おすすめ」のままで大丈夫です。人名に使える漢字を広く確認したいときだけ「すべて」を選びます。',
        [
            {
                value: 'recommended',
                label: 'おすすめ',
                desc: '名づけで使いやすい漢字を中心に表示します。'
            },
            {
                value: 'all',
                label: 'すべて',
                desc: '人名に使える漢字を広く表示します。候補が増える分、注意が必要な漢字も含まれます。'
            }
        ],
        showInappropriateKanji ? 'all' : 'recommended',
        setKanjiRangeSetting
    );
}

function toggleInappropriateSetting() {
    openKanjiRangeSettingModal();
}

/**
 * 汎用入力モーダル
 */
function showInputModal(title, type, currentValue, placeholder, onSave) {
    const modal = `
        <div class="overlay active modal-overlay-dark" id="input-modal" onclick="if(event.target.id==='input-modal')closeInputModal()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeInputModal()">✕</button>
                <h3 class="modal-title">${title}</h3>
                <div class="modal-body">
                    <input type="${type}" 
                           id="modal-input" 
                           class="modal-input-large" 
                           value="${currentValue || ''}"
                           placeholder="${placeholder}"
                           maxlength="10">
                    <div class="modal-input-underline"></div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveInputModal()" class="btn-modal-primary">保存</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    setTimeout(() => document.getElementById('modal-input')?.focus(), 100);

    window.inputModalCallback = onSave;
}

function saveInputModal() {
    const input = document.getElementById('modal-input');
    if (input && window.inputModalCallback) {
        window.inputModalCallback(input.value.trim());
    }
    closeInputModal();
}

function closeInputModal() {
    document.getElementById('input-modal')?.remove();
}

/**
 * 苗字入力用モーダル（漢字＋ふりがな）
 */
function showSurnameModal(currentKanji, currentReading, onSave) {
    const modal = `
        <div class="overlay active modal-overlay-dark" id="surname-modal" onclick="if(event.target.id==='surname-modal')closeSurnameModal()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeSurnameModal()">✕</button>
                <h3 class="modal-title">苗字を入力</h3>
                <div class="modal-body space-y-4">
                    <div>
                        <label class="text-xs text-[#a6967a] font-bold block text-center mb-1">漢字</label>
                        <input type="text" id="modal-surname-kanji" class="modal-input-large text-center w-full" value="${currentKanji || ''}" placeholder="例：山田">
                        <div class="modal-input-underline"></div>
                    </div>
                    <div class="mt-4">
                        <label class="text-xs text-[#a6967a] font-bold block text-center mb-1">ふりがな（任意）</label>
                        <input type="text" id="modal-surname-reading" class="modal-input-large text-center w-full" value="${currentReading || ''}" placeholder="例：やまだ">
                        <div class="modal-input-underline"></div>
                    </div>
                </div>
                <div class="modal-footer mt-6">
                    <button onclick="saveSurnameModal()" class="btn-modal-primary">保存</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
    setTimeout(() => document.getElementById('modal-surname-kanji')?.focus(), 100);

    window.surnameModalCallback = onSave;
}

function saveSurnameModal() {
    const kanjiInput = document.getElementById('modal-surname-kanji');
    const readingInput = document.getElementById('modal-surname-reading');
    if (kanjiInput && window.surnameModalCallback) {
        window.surnameModalCallback(kanjiInput.value.trim(), readingInput ? readingInput.value.trim() : '');
    }
    closeSurnameModal();
}

function closeSurnameModal() {
    document.getElementById('surname-modal')?.remove();
}

/**
 * 汎用選択モーダル
 */
function showChoiceModal(title, description, options, currentValue, onSave) {
    const optionsHTML = options.map(opt => {
        const isSelected = opt.value === currentValue;
        return `
            <button type="button" onclick="selectSettingsChoiceOption(${JSON.stringify(opt.value).replace(/"/g, '&quot;')}, event)"
                    class="choice-option ${isSelected ? 'selected' : ''}">
                <div class="choice-radio ${isSelected ? 'checked' : ''}"></div>
                <div class="choice-content">
                    <div class="choice-label">${opt.label}</div>
                    ${opt.desc ? `<div class="choice-desc">${opt.desc}</div>` : ''}
                </div>
            </button>
        `;
    }).join('');

    const modal = `
        <div class="overlay active modal-overlay-dark" id="choice-modal" onclick="if(event.target.id==='choice-modal')closeSettingsChoiceModal()">
            <div class="modal-sheet settings-sheet choice-sheet" onclick="event.stopPropagation()">
                <button type="button" class="modal-close-x" onclick="closeSettingsChoiceModal()">✕</button>
                <h3 class="modal-title">${title}</h3>
                ${description ? `<p class="modal-desc">${description}</p>` : ''}
                <div class="modal-body">
                    ${optionsHTML}
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="saveSettingsChoiceModal()" class="btn-modal-primary">完了</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    window.choiceModalValue = currentValue;
    window.choiceModalCallback = onSave;
}

function selectSettingsChoiceOption(value, evt) {
    window.choiceModalValue = value;
    document.querySelectorAll('.choice-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('.choice-radio').forEach(radio => radio.classList.remove('checked'));
    const trigger = evt?.currentTarget || evt?.target?.closest?.('.choice-option') || null;
    if (!trigger) return;
    trigger.classList.add('selected');
    const radio = trigger.querySelector('.choice-radio');
    if (radio) radio.classList.add('checked');
}

function saveSettingsChoiceModal() {
    if (window.choiceModalCallback) {
        window.choiceModalCallback(window.choiceModalValue);
    }
    closeSettingsChoiceModal();
}

function closeSettingsChoiceModal() {
    document.getElementById('choice-modal')?.remove();
}

/**
 * 設定を保存
 */
function saveSettings() {
    const settings = {
        surname: surnameStr,
        surnameReading: surnameReading,
        gender: gender,
        imageTags: selectedImageTags,
        rule: rule,
        prioritizeFortune: prioritizeFortune,
        segments: segments,
        shareMode: shareMode,
        showInappropriateKanji: showInappropriateKanji
    };
    localStorage.setItem('meimay_settings', JSON.stringify(settings));
    if (typeof MeimayPairing !== 'undefined'
        && MeimayPairing
        && MeimayPairing.roomCode
        && typeof MeimayPairing._autoSyncDebounced === 'function') {
        MeimayPairing._autoSyncDebounced('saveSettings');
    }
    console.log('SETTINGS: Saved', settings);
}

/**
 * 設定を読み込み
 */
function loadSettings() {
    const saved = localStorage.getItem('meimay_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            surnameStr = settings.surname || '';
            surnameReading = settings.surnameReading || '';
            gender = settings.gender || 'neutral';
            selectedImageTags = settings.imageTags || ['none'];
            rule = settings.rule || 'flexible';
            prioritizeFortune = settings.prioritizeFortune !== undefined ? settings.prioritizeFortune : false;
            segments = settings.segments || [];
            shareMode = settings.shareMode || 'auto';
            showInappropriateKanji = settings.showInappropriateKanji || false;
            console.log('SETTINGS: Loaded', settings);
        } catch (e) {
            console.error('SETTINGS: Failed to load', e);
        }
    }
}

loadSettings();
applyProfileTheme();

window.getResolvedProfileRole = getResolvedProfileRole;
window.getDefaultProfileThemeId = getDefaultProfileThemeId;
window.getProfileThemeId = getProfileThemeId;
window.getActiveProfilePalette = getActiveProfilePalette;
window.applyProfileTheme = applyProfileTheme;
window.resolveProfileThemeForRoleChange = resolveProfileThemeForRoleChange;
window.openProfileAppearanceModal = openProfileAppearanceModal;
window.selectProfileThemeOption = selectProfileThemeOption;
window.saveProfileAppearanceModal = saveProfileAppearanceModal;
window.closeProfileAppearanceModal = closeProfileAppearanceModal;
window.saveProfileAppearance = saveProfileAppearance;
window.openPartnerSettingsSheet = openPartnerSettingsSheet;
window.closePartnerSettingsSheet = closePartnerSettingsSheet;
window.openLegalSettingsSheet = openLegalSettingsSheet;
window.closeLegalSettingsSheet = closeLegalSettingsSheet;
window.openDeleteAppDataSheet = openDeleteAppDataSheet;
window.closeDeleteAppDataSheet = closeDeleteAppDataSheet;
window.deleteMeimayAppData = deleteMeimayAppData;
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.issueBackupRestoreKey = issueBackupRestoreKey;
window.copyBackupRestoreKey = copyBackupRestoreKey;
window.restoreBackupFromRestoreKey = restoreBackupFromRestoreKey;
window.formatBackupRestoreKeyInput = formatBackupRestoreKeyInput;
window.showGuide = showGuide;
window.openKanjiRangeSettingModal = openKanjiRangeSettingModal;
window.setKanjiRangeSetting = setKanjiRangeSetting;
window.toggleInappropriateSetting = toggleInappropriateSetting;

console.log("SETTINGS: Module loaded (v6.0 - Separate Screen)");
