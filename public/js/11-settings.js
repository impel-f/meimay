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
    const kanjiRangeNote = showInappropriateKanji
        ? '人名に使える漢字をすべて表示します。'
        : '名づけに適した漢字のみ表示します。';


    // Partner linking status
    let pairingStatusText = '未連携';
    let pairingStatusColor = '#a6967a';
    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        pairingStatusText = `連携中（${MeimayPairing.roomCode}）`;
        pairingStatusColor = '#4ade80';
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
    const renderItem = ({ title, value, onClick, valueStyle = '', arrow = '›', badge = '' }) => `
        <button type="button" class="settings-item-unified" onclick="${onClick}">
            <span class="item-content-unified">
                <span class="item-title-unified">${escapeSettingsHtml(title)}</span>
                <span class="item-value-unified" style="${valueStyle}">${escapeSettingsHtml(value)}</span>
            </span>
            <span class="item-arrow-unified flex items-center gap-2">
                ${badge}
                <span>${arrow}</span>
            </span>
        </button>
    `;


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
                <button type="button" class="settings-item-unified settings-item-note" onclick="toggleInappropriateSetting()">
                    <span class="item-content-unified">
                        <span class="item-copy-unified">
                            <span class="item-title-unified">表示する漢字の範囲</span>
                            <span class="item-note-unified">${kanjiRangeNote}</span>
                        </span>
                        <span class="item-value-unified">${kanjiRangeText}</span>
                    </span>
                    <span class="settings-toggle ${showInappropriateKanji ? 'active' : ''}" aria-hidden="true">
                        <span></span>
                    </span>
                </button>
            `)}

            ${renderSection('ヘルプと情報', `
                ${renderItem({ title: '利用規約・プライバシー', value: '確認する', onClick: 'openLegalSettingsSheet()' })}
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
function openRoleInput() {
    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const current = wizData?.role || 'other';
    showChoiceModal('役割を選択', '', [
        { label: 'ママ', value: 'mama' },
        { label: 'パパ', value: 'papa' },
        { label: 'その他', value: 'other' }
    ], current, (value) => {
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

function openSurnameInput() {
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
        ? `連携中（${escapeProfileHtml(MeimayPairing.roomCode)}）`
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
                <h3 class="modal-title">利用規約・プライバシー</h3>
                <div class="settings-sheet-list">
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closeLegalSettingsSheet(); if(typeof openLegalScreen==='function'){openLegalScreen('terms');}">
                        <span>利用規約</span>
                        <strong>›</strong>
                    </button>
                    <button type="button" class="settings-sheet-row settings-sheet-link" onclick="closeLegalSettingsSheet(); if(typeof openLegalScreen==='function'){openLegalScreen('privacy');}">
                        <span>プライバシーポリシー</span>
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
    if (display) {
        display.textContent = key || '未発行';
        display.classList.toggle('text-[#b04a3a]', !key);
    }
    if (copyButton) {
        copyButton.disabled = !key;
        copyButton.classList.toggle('opacity-50', !key);
    }
    if (issueButton) {
        issueButton.textContent = key ? '復元キーを再発行' : '復元キーを発行';
    }
}

function openTransferModal() {
    const restoreKey = getStoredBackupRestoreKey();
    const modal = `
        <div class="overlay active modal-overlay-dark" id="transfer-modal" onclick="if(event.target.id==='transfer-modal')closeTransferModal()">
            <div class="modal-sheet settings-sheet settings-transfer-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeTransferModal()">✕</button>
                <h3 class="modal-title">バックアップと復元</h3>
                <p class="modal-desc">復元キーでバックアップを戻します。ID＋苗字一致だけでは復元できません。</p>
                <div class="modal-body space-y-3 text-left">
                    <div class="rounded-2xl bg-white border border-[#e7d9c5] px-4 py-3">
                        <div class="text-[12px] font-black text-[#5d5444]">復元キー</div>
                        <div class="mt-1 text-[11px] leading-relaxed text-[#8b7e66]">発行時にこの端末の候補をクラウドへバックアップします。キーを知っている人は復元できるので、家族内だけで保管してください。</div>
                        <div class="mt-3 rounded-xl bg-[#f8f3ea] border border-[#eadfcd] px-3 py-2">
                            <div class="text-[10px] font-bold text-[#a6967a]">この端末の復元キー</div>
                            <div id="backup-restore-key-display" class="mt-1 font-mono text-[15px] font-black tracking-[0.08em] text-[#5d5444]">${restoreKey || '未発行'}</div>
                        </div>
                        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button id="backup-restore-key-issue" onclick="issueBackupRestoreKey()" class="w-full py-3 rounded-2xl bg-[#bca37f] text-white font-bold text-sm shadow-sm">
                                ${restoreKey ? '復元キーを再発行' : '復元キーを発行'}
                            </button>
                            <button id="backup-restore-key-copy" onclick="copyBackupRestoreKey()" class="w-full py-3 rounded-2xl border border-[#d8ccb9] bg-white text-[#5d5444] font-bold text-sm ${restoreKey ? '' : 'opacity-50'}" ${restoreKey ? '' : 'disabled'}>
                                キーをコピー
                            </button>
                        </div>
                        <div class="mt-4 border-t border-[#eee5d8] pt-3">
                            <label class="block text-[10px] font-bold text-[#a6967a] mb-1" for="backup-restore-key-input">別端末の復元キー</label>
                            <input id="backup-restore-key-input" type="text" inputmode="text" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" class="w-full rounded-2xl border border-[#d8ccb9] bg-[#fffaf2] px-3 py-3 text-sm font-bold text-[#5d5444] tracking-[0.08em] uppercase">
                            <button onclick="restoreBackupFromRestoreKey(event)" class="mt-2 w-full py-3 rounded-2xl bg-[#5d5444] text-white font-bold text-sm shadow-sm">
                                復元キーで復元
                            </button>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-[#fff8ea] border border-[#e8d5ad] px-4 py-3">
                        <div class="text-[11px] font-black text-[#5d5444]">大切なこと</div>
                        <div class="mt-1 text-[10px] leading-relaxed text-[#8b7e66]">復元すると、この端末にない候補が追加されます。今ある候補はそのまま残ります。</div>
                        <div class="mt-2 text-[10px] leading-relaxed text-[#a6967a]">復元キーだけで戻せるため、家族以外には共有しないでください。</div>
                    </div>
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
        if (typeof showToast === 'function') showToast('復元キーを発行しました', '✓');
    } catch (error) {
        console.warn('BACKUP: Restore key issue failed', error);
        if (typeof showToast === 'function') {
            const message = typeof MeimayUserBackup._getRestoreErrorMessage === 'function'
                ? MeimayUserBackup._getRestoreErrorMessage(error)
                : '復元キーの発行に失敗しました';
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
        if (typeof showToast === 'function') showToast('復元キーをコピーしました', '✓');
    } catch (error) {
        if (typeof showToast === 'function') showToast(`復元キー: ${key}`, '✓');
    }
}

async function restoreBackupFromRestoreKey(event) {
    const input = document.getElementById('backup-restore-key-input');
    const restoreKey = input ? input.value : '';
    if (!restoreKey.trim()) {
        if (typeof showToast === 'function') showToast('復元キーを入力してください', '⚠');
        return;
    }
    if (!confirm('復元キーのバックアップを、この端末の保存データと統合します。続けますか？')) {
        return;
    }
    const button = event && event.currentTarget ? event.currentTarget : null;
    if (button) {
        button.disabled = true;
        button.textContent = '復元中...';
    }
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
        if (typeof showToast === 'function') {
            const message = typeof MeimayUserBackup !== 'undefined'
                && MeimayUserBackup
                && typeof MeimayUserBackup._getRestoreErrorMessage === 'function'
                ? MeimayUserBackup._getRestoreErrorMessage(error)
                : (error?.message || 'バックアップ復元に失敗しました');
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
function toggleInappropriateSetting() {
    showInappropriateKanji = !showInappropriateKanji;
    saveSettings();
    renderSettingsScreen();
    showToast(`表示範囲を${showInappropriateKanji ? 'すべて' : 'おすすめ'}にしました`);
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
window.openTransferModal = openTransferModal;
window.closeTransferModal = closeTransferModal;
window.issueBackupRestoreKey = issueBackupRestoreKey;
window.copyBackupRestoreKey = copyBackupRestoreKey;
window.restoreBackupFromRestoreKey = restoreBackupFromRestoreKey;
window.showGuide = showGuide;

console.log("SETTINGS: Module loaded (v6.0 - Separate Screen)");
