/* ============================================================
   MODULE 13: DRAWER & WIZARD (V17.1)
   サイドメニュー（X風ドロワー）& 初期ウィザード
   ============================================================ */

// ==========================================
// WIZARD STATE
// ==========================================

const WizardData = {
    KEY: 'meimay_wizard',

    get: function () {
        try {
            const saved = localStorage.getItem(this.KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    },

    save: function (data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
            console.error("WIZARD: Save failed", e);
        }
    },

    isCompleted: function () {
        const data = this.get();
        return data && data.completed === true;
    }
};

let wizRole = '';
let wizGender = '';
let wizBirthOrder = 1;
let wizChildDate = '';
let wizHasReadingCandidate = null;

function parseWizBirthOrder(value, fallback = 1) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ==========================================
// WIZARD FUNCTIONS
// ==========================================

function selectWizRole(role) {
    wizRole = role;
    // Update UI
    document.querySelectorAll('.wiz-role-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.getAttribute('data-role') === role);
    });
}

function selectWizGender(gender) {
    wizGender = gender;
    document.querySelectorAll('[data-gender]').forEach(btn => {
        const isSelected = btn.getAttribute('data-gender') === gender;
        btn.classList.toggle('selected', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function selectWizBirthOrder(order) {
    wizBirthOrder = parseWizBirthOrder(order, 1);
    const select = document.getElementById('wiz-birth-order');
    if (select) {
        select.value = String(wizBirthOrder);
    }
}

function selectWizReadingCandidate(hasCandidate) {
    wizHasReadingCandidate = !!hasCandidate;
    document.querySelectorAll('[data-reading-candidate]').forEach(btn => {
        const isSelected = btn.getAttribute('data-reading-candidate') === (hasCandidate ? 'yes' : 'no');
        btn.classList.toggle('selected', isSelected);
    });
}

function syncWizardReadingChoiceCopy() {
    const yesCopy = document.querySelector('[data-reading-candidate="yes"] .wiz-reading-choice-copy');
    if (yesCopy) {
        const spans = yesCopy.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = '読み候補がある';
        if (spans[1]) spans[1].innerHTML = '希望の読みから<br>理想の漢字をさがします';
    }

    const noCopy = document.querySelector('[data-reading-candidate="no"] .wiz-reading-choice-copy');
    if (noCopy) {
        const spans = noCopy.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = 'まだない';
        if (spans[1]) spans[1].innerHTML = '響きから<br>読みの候補をさがします';
    }
}

function wizNext(currentStep) {
    // Validation
    if (currentStep === 1) {
        // Username is optional, role is optional
    }
    if (currentStep === 2) {
        // Surname is optional
        const surname = document.getElementById('wiz-surname');
        const surnameReadingInput = document.getElementById('wiz-surname-reading');
        if (surname && surname.value.trim()) {
            surnameStr = surname.value.trim();
            const input = document.getElementById('in-surname');
            if (input) input.value = surnameStr;
        }
        surnameReading = surnameReadingInput && surnameReadingInput.value.trim()
            ? toHira(surnameReadingInput.value.trim())
            : '';
        if (typeof updateSurnameData === 'function') updateSurnameData();
    }
    if (currentStep === 3) {
        const birthOrderSelect = document.getElementById('wiz-birth-order');
        const childDateInput = document.getElementById('wiz-child-date');
        wizBirthOrder = parseWizBirthOrder(birthOrderSelect && birthOrderSelect.value, wizBirthOrder || 1);
        wizChildDate = childDateInput ? String(childDateInput.value || '').trim() : (wizChildDate || '');
    }
    if (currentStep === 3 && !wizGender) {
        wizGender = 'neutral';
        document.querySelectorAll('[data-gender]').forEach(btn => {
            const isSelected = btn.getAttribute('data-gender') === 'neutral';
            btn.classList.toggle('selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }
    if (currentStep === 4 && wizHasReadingCandidate === null) {
        wizHasReadingCandidate = false;
    }

    // Hide current step
    const current = document.getElementById(`wiz-step-${currentStep}`);
    if (current) current.classList.remove('active');

    // Show next step
    const next = document.getElementById(`wiz-step-${currentStep + 1}`);
    if (next) next.classList.add('active');

    if (currentStep + 1 === 3) {
        const childDateInput = document.getElementById('wiz-child-date');
        selectWizBirthOrder(wizBirthOrder);
        if (childDateInput) {
            childDateInput.value = wizChildDate || '';
        }
        if (!wizGender) {
            wizGender = 'neutral';
        }
        document.querySelectorAll('[data-gender]').forEach(btn => {
            const isSelected = btn.getAttribute('data-gender') === wizGender;
            btn.classList.toggle('selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    // Update dots
    updateWizardDots(currentStep + 1);
}

function updateWizardDots(step) {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`wiz-dot-${i}`);
        if (dot) {
            dot.classList.toggle('active', i === step);
        }
    }
}

function wizFinish(mode) {
    // Save wizard data
    const username = document.getElementById('wiz-username');
    const surname = document.getElementById('wiz-surname');
    const surnameReadingInput = document.getElementById('wiz-surname-reading');
    const childDateInput = document.getElementById('wiz-child-date');
    const existingData = WizardData.get() || {};
    const selectedRole = wizRole || existingData.role || '';
    const birthOrder = parseWizBirthOrder(wizBirthOrder || existingData.birthOrder || 1, 1);
    const profileName = username ? username.value.trim().slice(0, 10) : '';
    const childDate = childDateInput
        ? String(childDateInput.value || '').trim()
        : String(wizChildDate || existingData.dueDate || existingData.birthDate || '').trim();
    wizChildDate = childDate;

    const data = {
        completed: true,
        username: profileName,
        role: selectedRole,
        birthOrder,
        surname: surname ? surname.value.trim() : '',
        surnameReading: surnameReadingInput && surnameReadingInput.value.trim()
            ? toHira(surnameReadingInput.value.trim())
            : (existingData.surnameReading || ''),
        dueDate: childDate,
        hasReadingCandidate: wizHasReadingCandidate === true,
        gender: wizGender || existingData.gender || 'neutral',
        themeId: existingData.themeId || '',
        themeCustomized: !!existingData.themeCustomized,
        completedAt: new Date().toISOString()
    };

    if (typeof resolveProfileThemeForRoleChange === 'function') {
        data.themeId = resolveProfileThemeForRoleChange(data, selectedRole, existingData.role);
    }

    WizardData.save(data);
    // Apply to global state
    if (data.surname) {
        surnameStr = data.surname;
        const surnameInput = document.getElementById('in-surname');
        if (surnameInput) surnameInput.value = surnameStr;
    }
    surnameReading = data.surnameReading || '';
    if (typeof updateSurnameData === 'function') updateSurnameData();
    gender = data.gender;

    if (typeof MeimayShare !== 'undefined' && typeof MeimayShare.syncProfileAppearance === 'function') {
        MeimayShare.syncProfileAppearance();
    }
    if (typeof MeimayChildWorkspaces !== 'undefined'
        && MeimayChildWorkspaces
        && typeof MeimayChildWorkspaces.applyWizardSelection === 'function') {
        MeimayChildWorkspaces.applyWizardSelection({
            birthOrder: data.birthOrder,
            gender: data.gender,
            dueDate: data.dueDate
        });
    }

    // Update drawer profile
    updateDrawerProfile();
    if (typeof updateHomeGreeting === 'function') updateHomeGreeting();
    if (typeof renderHomeProfile === 'function') renderHomeProfile();
    if (typeof refreshPartnerAwareUI === 'function') refreshPartnerAwareUI();
    if (typeof window !== 'undefined') {
        window.MeimayHomeStageFocusSource = 'auto';
    }

    const nextMode = ['reading', 'sound', 'nickname', 'free'].includes(mode) ? mode : null;
    if (nextMode) {
        startMode(nextMode);
        return;
    }

    changeScreen('scr-mode');
    if (typeof maybeShowFirstRunTutorial === 'function') {
        maybeShowFirstRunTutorial();
    }
}

function wizStartNaming() {
    wizFinish();
}

window.selectWizReadingCandidate = selectWizReadingCandidate;
window.selectWizGender = selectWizGender;
window.selectWizBirthOrder = selectWizBirthOrder;
window.wizStartNaming = wizStartNaming;

const DRAWER_EDGE_SWIPE_ZONE = 24;
const DRAWER_SWIPE_START_THRESHOLD = 10;
const DRAWER_SWIPE_SETTLE_THRESHOLD = 72;
const DRAWER_SWIPE_LOCK_RATIO = 1.15;

const DrawerSwipeState = {
    active: false,
    locked: false,
    touchId: null,
    mode: '',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0
};

let drawerOverlayHideTimer = null;

function getDrawerElements() {
    return {
        drawer: document.getElementById('side-drawer'),
        overlay: document.getElementById('drawer-overlay')
    };
}

function getTrackedTouch(touchList, touchId) {
    if (!touchList) return null;
    for (let i = 0; i < touchList.length; i++) {
        if (touchList[i].identifier === touchId) return touchList[i];
    }
    return null;
}

function clearDrawerOverlayHideTimer() {
    if (drawerOverlayHideTimer !== null) {
        clearTimeout(drawerOverlayHideTimer);
        drawerOverlayHideTimer = null;
    }
}

function resetDrawerSwipeStyles(drawer, overlay) {
    if (drawer) {
        drawer.style.transition = '';
    }
    if (overlay) {
        overlay.style.transition = '';
        overlay.style.opacity = '';
    }
}

function updateDrawerSwipePreview(positionPx, widthPx) {
    const { drawer, overlay } = getDrawerElements();
    if (!drawer) return;

    clearDrawerOverlayHideTimer();

    const clampedPosition = Math.max(-widthPx, Math.min(0, positionPx));
    const progress = Math.max(0, Math.min(1, 1 + (clampedPosition / widthPx)));

    drawer.style.setProperty('--drawer-x', `${clampedPosition}px`);
    drawer.style.transition = 'none';

    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('open');
        overlay.style.transition = 'none';
        overlay.style.opacity = String(progress);
    }
}

function settleDrawerSwipe(shouldOpen, widthPx) {
    const { drawer, overlay } = getDrawerElements();
    if (!drawer) return;

    clearDrawerOverlayHideTimer();
    resetDrawerSwipeStyles(drawer, overlay);
    drawer.style.setProperty('--drawer-x', shouldOpen ? '0px' : `${-widthPx}px`);

    if (shouldOpen) {
        drawer.classList.add('open');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('open');
            overlay.style.opacity = '1';
        }
        updateDrawerProfile();
    } else {
        drawer.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('open');
            overlay.style.opacity = '0';
            drawerOverlayHideTimer = setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.style.opacity = '';
                drawerOverlayHideTimer = null;
            }, 300);
        }
    }

    setTimeout(() => {
        drawer.style.removeProperty('--drawer-x');
        drawer.style.transition = '';
        if (overlay) {
            overlay.style.transition = '';
            overlay.style.opacity = '';
        }
    }, 300);
}

function setupDrawerSwipeGestures() {
    if (document._drawerSwipeGesturesSetup) return;
    document._drawerSwipeGesturesSetup = true;

    document.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;

        const touch = e.touches[0];
        const { drawer, overlay } = getDrawerElements();
        if (!drawer || !overlay) return;

        const drawerOpen = drawer.classList.contains('open');
        const targetInsideDrawer = drawer.contains(e.target);
        const targetIsOverlay = e.target === overlay;
        const startNearEdge = !drawerOpen && touch.clientX <= DRAWER_EDGE_SWIPE_ZONE;

        if (!drawerOpen && !startNearEdge) {
            DrawerSwipeState.active = false;
            DrawerSwipeState.locked = false;
            DrawerSwipeState.touchId = null;
            DrawerSwipeState.mode = '';
            return;
        }

        if (drawerOpen && !targetInsideDrawer && !targetIsOverlay) {
            DrawerSwipeState.active = false;
            DrawerSwipeState.locked = false;
            DrawerSwipeState.touchId = null;
            DrawerSwipeState.mode = '';
            return;
        }

        DrawerSwipeState.active = true;
        DrawerSwipeState.locked = false;
        DrawerSwipeState.touchId = touch.identifier;
        DrawerSwipeState.mode = drawerOpen ? 'close' : 'open';
        DrawerSwipeState.startX = touch.clientX;
        DrawerSwipeState.startY = touch.clientY;
        DrawerSwipeState.lastX = touch.clientX;
        DrawerSwipeState.lastY = touch.clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!DrawerSwipeState.active || DrawerSwipeState.touchId === null) return;

        const touch = getTrackedTouch(e.touches, DrawerSwipeState.touchId);
        if (!touch) return;

        const dx = touch.clientX - DrawerSwipeState.startX;
        const dy = touch.clientY - DrawerSwipeState.startY;

        if (!DrawerSwipeState.locked) {
            if (Math.abs(dx) < DRAWER_SWIPE_START_THRESHOLD || Math.abs(dx) < Math.abs(dy) * DRAWER_SWIPE_LOCK_RATIO) {
                return;
            }
            DrawerSwipeState.locked = true;
        }

        const { drawer } = getDrawerElements();
        if (!drawer) return;

        const widthPx = drawer.getBoundingClientRect().width || 288;
        const positionPx = DrawerSwipeState.mode === 'open'
            ? (-widthPx + Math.max(0, dx))
            : Math.min(0, dx);

        updateDrawerSwipePreview(positionPx, widthPx);
        DrawerSwipeState.lastX = touch.clientX;
        DrawerSwipeState.lastY = touch.clientY;
        e.preventDefault();
    }, { passive: false });

    const finishSwipe = () => {
        if (!DrawerSwipeState.active) return;

        const { drawer } = getDrawerElements();
        if (!drawer) {
            DrawerSwipeState.active = false;
            DrawerSwipeState.locked = false;
            DrawerSwipeState.touchId = null;
            DrawerSwipeState.mode = '';
            return;
        }

        const widthPx = drawer.getBoundingClientRect().width || 288;
        const dx = DrawerSwipeState.lastX - DrawerSwipeState.startX;
        const settleThreshold = Math.max(DRAWER_SWIPE_SETTLE_THRESHOLD, widthPx * 0.25);
        let shouldOpen = drawer.classList.contains('open');

        if (DrawerSwipeState.locked) {
            shouldOpen = DrawerSwipeState.mode === 'open'
                ? dx >= settleThreshold
                : dx > -settleThreshold;
        }

        settleDrawerSwipe(shouldOpen, widthPx);

        DrawerSwipeState.active = false;
        DrawerSwipeState.locked = false;
        DrawerSwipeState.touchId = null;
        DrawerSwipeState.mode = '';
    };

    document.addEventListener('touchend', finishSwipe, { passive: true });
    document.addEventListener('touchcancel', finishSwipe, { passive: true });
}

// ==========================================
// DRAWER FUNCTIONS
// ==========================================

function openDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    clearDrawerOverlayHideTimer();
    if (drawer) {
        drawer.classList.add('open');
        drawer.style.removeProperty('--drawer-x');
        drawer.style.transition = '';
    }
    if (overlay) {
        overlay.classList.remove('hidden');
        // Trigger reflow for transition
        overlay.offsetHeight;
        overlay.classList.add('open');
        overlay.style.opacity = '';
        overlay.style.transition = '';
    }
    updateDrawerProfile();
}

function closeDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    clearDrawerOverlayHideTimer();
    if (drawer) {
        drawer.classList.remove('open');
        drawer.style.removeProperty('--drawer-x');
        drawer.style.transition = '';
    }
    if (overlay) {
        overlay.classList.remove('open');
        overlay.style.opacity = '';
        overlay.style.transition = '';
        drawerOverlayHideTimer = setTimeout(() => {
            overlay.classList.add('hidden');
            drawerOverlayHideTimer = null;
        }, 300);
    }
}

function drawerNavigate(target) {
    closeDrawer();

    setTimeout(() => {
        switch (target) {
            case 'home':
                changeScreen('scr-mode');
                break;
            case 'direct-swipe':
                if (typeof startDirectKanjiSwipe === 'function') startDirectKanjiSwipe();
                break;
            case 'stock':
                if (typeof openStock === 'function') openStock();
                break;
            case 'build':
                if (typeof openBuild === 'function') openBuild();
                break;
            case 'history':
                if (typeof openEncounteredLibrary === 'function') openEncounteredLibrary('reading');
                else if (typeof openReadingHistory === 'function') openReadingHistory();
                break;
            case 'encountered':
                if (typeof openEncounteredLibrary === 'function') openEncounteredLibrary();
                break;
            case 'saved':
                if (typeof openSavedNames === 'function') openSavedNames();
                break;
            case 'search':
                if (typeof openKanjiSearch === 'function') openKanjiSearch();
                break;
            case 'ranking':
                if (typeof openRanking === 'function') openRanking();
                break;
            case 'diagnosis':
                startMode('diagnosis');
                break;
            case 'akinator':
                if (typeof openAkinator === 'function') openAkinator();
                break;
            case 'mode-reading':
                startMode('reading');
                break;
            case 'mode-nickname':
                startMode('nickname');
                break;
            case 'mode-sound':
                startMode('sound');
                break;
            case 'mode-free':
                startMode('free');
                break;
            case 'share':
                if (typeof shareData === 'function') shareData();
                break;
            case 'receive':
                if (typeof receiveSharedData === 'function') receiveSharedData();
                break;
            case 'settings':
                if (typeof openSettings === 'function') openSettings();
                break;
            case 'legal-terms':
                if (typeof openLegalScreen === 'function') openLegalScreen('terms');
                break;
            case 'legal-privacy':
                if (typeof openLegalScreen === 'function') openLegalScreen('privacy');
                break;
            case 'legal-contact':
                if (typeof openLegalScreen === 'function') openLegalScreen('contact');
                break;
        }
    }, 200);
}

function applyDrawerStatusButtonTone(button, active) {
    if (!button) return;
    button.style.background = active ? 'rgba(255, 255, 255, 0.84)' : 'rgba(244, 244, 241, 0.98)';
    button.style.borderColor = active ? '#d4c5af' : '#d9d4ca';
    button.style.color = active ? '#8b7e66' : '#a39b8d';
    button.style.whiteSpace = 'pre-line';
    button.style.lineHeight = '1.15';
}

function renderDrawerMenu() {
    const nav = document.querySelector('#side-drawer nav');
    if (!nav) return;

    const sections = [
        {
            title: 'メイン',
            items: [
                { id: 'drawer-home', target: 'home', icon: '🏠', label: 'ホーム' },
                { id: 'drawer-mode-sound', target: 'mode-sound', icon: '🪄', label: '響き・読みを探す' },
                { id: 'drawer-mode-reading', target: 'mode-reading', icon: '🔤', label: '読みから漢字を探す' }
            ]
        },
        {
            title: '保存・整理',
            items: [
                { id: 'drawer-stock', target: 'stock', icon: '📋', label: 'ストック' },
                { id: 'drawer-build', target: 'build', icon: '🛠️', label: 'ビルド' },
                { id: 'drawer-saved', target: 'saved', icon: '💾', label: '保存済み' },
                { id: 'drawer-encountered', target: 'encountered', icon: '🗂️', label: '出会った候補' }
            ]
        },
        {
            title: 'ツール',
            items: [
                { id: 'drawer-search', target: 'search', icon: '📖', label: '漢字検索' },
                { id: 'drawer-ranking', target: 'ranking', icon: '👑', label: 'ランキング' }
            ]
        },
        {
            title: '設定・情報',
            items: [
                { id: 'drawer-settings', target: 'settings', icon: '⚙️', label: '設定' },
                { id: 'drawer-legal-terms', target: 'legal-terms', icon: '📘', label: '利用規約' },
                { id: 'drawer-legal-privacy', target: 'legal-privacy', icon: '🔒', label: 'プライバシーポリシー' },
                { id: 'drawer-legal-contact', target: 'legal-contact', icon: '✉️', label: 'お問い合わせ' }
            ]
        }
    ];

    nav.innerHTML = sections.map((section, sectionIndex) => {
        const headerHtml = `
            <div class="px-6 py-2">
                <p class="text-[10px] font-bold text-[#a6967a] tracking-widest uppercase mb-2">${section.title}</p>
            </div>
        `;

        const itemsHtml = section.items.map((item) => `
            <button onclick="drawerNavigate('${item.target}')" class="drawer-menu-item" id="${item.id}">
                <span class="drawer-icon">${item.icon}</span>
                <span>${item.label}</span>
            </button>
        `).join('');

        const dividerHtml = sectionIndex < sections.length - 1
            ? '<div class="h-px bg-[#eee5d8] mx-6 my-3"></div>'
            : '';

        return `${headerHtml}${itemsHtml}${dividerHtml}`;
    }).join('');
}

// ==========================================
// HOME SCREEN GREETING
// ==========================================

function updateHomeGreeting() {
    const data = WizardData.get();
    const greetingEl = document.getElementById('home-greeting-text');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let timeGreeting = 'こんにちは';
    if (hour < 6) timeGreeting = 'おやすみ前に';
    else if (hour < 11) timeGreeting = 'おはようございます';
    else if (hour < 17) timeGreeting = 'こんにちは';
    else timeGreeting = 'こんばんは';

    if (data && data.username) {
        greetingEl.innerText = `${timeGreeting}、${data.username}さん！`;
    } else if (data && data.role) {
        const roleName = { papa: 'パパ', mama: 'ママ', other: '' }[data.role];
        greetingEl.innerText = roleName ? `${timeGreeting}、${roleName}！` : `${timeGreeting}！`;
    } else {
        greetingEl.innerText = `${timeGreeting}！`;
    }
}

// ==========================================
// TOP BAR TITLE UPDATE
// ==========================================

function updateTopBarTitle(screenId) {
    const title = document.getElementById('top-bar-title');
    if (!title) return;

    if (screenId === 'scr-ranking') {
        title.innerText = 'ランキング';
        return;
    }

    const titles = {
        'scr-mode': 'メイメー',
        'scr-wizard': 'メイメー',
        'scr-main': 'スワイプ',
        'scr-stock': 'ストック',
        'scr-build': 'ビルド',
        'scr-settings': '設定',
        'scr-input-reading': '読み入力',
        'scr-gender': '性別選択',
        'scr-vibe': 'イメージ',
        'scr-input-nickname': 'ニックネーム',
        'scr-segment': '分け方選択',
        'scr-surname-settings': '苗字入力',
        'scr-swipe-universal': 'スワイプ',
        'scr-free-mode': '自由モード',
        'scr-kanji-search': '漢字検索',
        'scr-diagnosis-input': '姓名判断',
        'scr-saved': '保存済み',
        'scr-history': '検索履歴',
        'scr-encountered': '出会った候補',
        'scr-login': 'パートナー連携',
        'scr-akinator': 'AIおすすめ'
    };

    title.innerText = titles[screenId] || 'メイメー';
}

// ==========================================
// INITIALIZATION
// ==========================================

function initDrawerWizard() {
    syncWizardReadingChoiceCopy();
    renderDrawerMenu();
    setupDrawerSwipeGestures();

    // Check if wizard has been completed
    if (!WizardData.isCompleted()) {
        // Show wizard as first screen
        if (typeof changeScreen === 'function') {
            changeScreen('scr-wizard');
        } else {
            const modeScreen = document.getElementById('scr-mode');
            if (modeScreen) modeScreen.classList.remove('active');
            const wizScreen = document.getElementById('scr-wizard');
            if (wizScreen) wizScreen.classList.add('active');
        }
    } else {
        // Wizard completed - show home
        if (typeof changeScreen === 'function') {
            changeScreen('scr-mode');
        } else {
            const modeScreen = document.getElementById('scr-mode');
            if (modeScreen) modeScreen.classList.add('active');
        }

        updateDrawerProfile();
        updateHomeGreeting();
    }
}

// Hook into changeScreen to update top bar
const _originalChangeScreen = window.changeScreen;
if (_originalChangeScreen) {
    window.changeScreen = function (id) {
        _originalChangeScreen(id);
        updateTopBarTitle(id);

        // Show/hide top bar on swipe screen
        const topBar = document.getElementById('top-bar');
        if (topBar) {
            const hideTopBarScreens = [];
            if (hideTopBarScreens.includes(id)) {
                document.body.classList.add('hide-top-bar');
            } else {
                document.body.classList.remove('hide-top-bar');
            }
        }

        // History button visibility
        const historyBtn = document.getElementById('btn-history-float');
        if (historyBtn) {
            const hideScreens = ['scr-mode', 'scr-main', 'scr-stock', 'scr-build', 'scr-settings', 'scr-swipe-universal', 'scr-wizard', 'scr-ranking'];
            historyBtn.classList.toggle('hidden', hideScreens.includes(id));
        }
    };
}

function formatDrawerPremiumDate(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildDrawerPremiumLabelLines(state) {
    if (!state) return ['無料プラン'];
    if (state.expired) return ['プレミアム期限切れ'];
    if (!state.active) return ['無料プラン'];

    const expiresLabel = formatDrawerPremiumDate(state.expiresAt);
    if (state.source === 'partner') {
        return expiresLabel
            ? ['👑 プレミアム', `パートナー特典・${expiresLabel}まで`]
            : ['👑 プレミアム', 'パートナー特典'];
    }

    return expiresLabel
        ? ['👑 プレミアム', `${expiresLabel}まで有効`]
        : ['👑 プレミアム'];
}

function updateDrawerProfile() {
    const data = (typeof WizardData !== 'undefined' && typeof WizardData.get === 'function')
        ? (WizardData.get() || {})
        : {};
    const avatar = document.getElementById('drawer-avatar');
    const usernameText = document.getElementById('drawer-username-text');
    const premiumCrown = document.getElementById('drawer-premium-crown');
    const surnameDisplay = document.getElementById('drawer-surname-display');
    const sideProfile = document.getElementById('side-profile');
    const drawer = document.getElementById('side-drawer');
    const drawerPartnerStatusButton = document.getElementById('drawer-partner-status-button');
    const settingsButton = document.getElementById('drawer-settings-button');
    const pairingConnected = !!(typeof MeimayPairing !== 'undefined'
        && MeimayPairing
        && MeimayPairing.roomCode
        && MeimayPairing.partnerUid);
    const palette = typeof applyProfileTheme === 'function' ? applyProfileTheme(data.themeId) : null;
    const premiumManager = typeof PremiumManager !== 'undefined' ? PremiumManager : null;
    const premiumState = premiumManager && typeof premiumManager.getMembershipState === 'function'
        ? premiumManager.getMembershipState()
        : null;
    const premiumActive = !!(premiumState && premiumState.active)
        || !!(premiumManager && typeof premiumManager.isPremium === 'function' && premiumManager.isPremium());
    const premiumDisplay = premiumManager && typeof premiumManager.getDisplayStatus === 'function'
        ? premiumManager.getDisplayStatus()
        : null;
    const premiumLines = premiumDisplay && Array.isArray(premiumDisplay.drawerLines)
        ? premiumDisplay.drawerLines
        : buildDrawerPremiumLabelLines(premiumState);

    if (drawer) {
        drawer.style.background = '';
    }

    if (sideProfile) {
        sideProfile.style.background = '';
        sideProfile.style.borderColor = '';
    }

    if (usernameText) {
        usernameText.textContent = data.username || 'ゲスト';
    }

    if (premiumCrown) {
        premiumCrown.classList.toggle('hidden', !premiumActive);
    }

    if (data.username && avatar) {
        avatar.innerText = data.username.charAt(0).toUpperCase();
    }

    if (data.role && avatar && !data.username) {
        const roleEmoji = { papa: '👨', mama: '👩', other: '🙂' };
        avatar.innerText = roleEmoji[data.role] || 'P';
    }

    if (surnameDisplay) {
        surnameDisplay.innerText = data.surname ? `@${data.surname}` : '@未設定';
        if (palette) surnameDisplay.style.color = palette.text;
    }

    if (settingsButton) {
        settingsButton.replaceChildren();

        if (premiumLines.length > 1) {
            const primaryLine = document.createElement('span');
            primaryLine.className = 'block text-[11px] leading-tight';
            primaryLine.textContent = premiumLines[0];

            const secondaryLine = document.createElement('span');
            secondaryLine.className = 'block text-[9px] font-medium leading-tight';
            secondaryLine.textContent = premiumLines.slice(1).join(' ');

            settingsButton.append(primaryLine, secondaryLine);
        } else {
            settingsButton.textContent = premiumLines[0] || '';
        }

        settingsButton.setAttribute('aria-label', premiumLines.join(' '));
    }

    if (avatar && palette) {
        avatar.style.background = `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentStrong} 100%)`;
        avatar.style.boxShadow = `0 12px 24px ${palette.shadow}`;
        avatar.style.color = '#ffffff';
        avatar.style.border = 'none';
    }

    applyDrawerStatusButtonTone(settingsButton, premiumDisplay ? premiumDisplay.active : premiumActive);
    applyDrawerStatusButtonTone(drawerPartnerStatusButton, pairingConnected);
}

function openDrawerProfileAppearance() {
    closeDrawer();
    setTimeout(() => {
        if (typeof openProfileAppearanceModal === 'function') {
            openProfileAppearanceModal();
        }
    }, 320);
}

// Expose functions
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.drawerNavigate = drawerNavigate;
window.openDrawerProfileAppearance = openDrawerProfileAppearance;
window.selectWizRole = selectWizRole;
window.selectWizGender = selectWizGender;
window.wizNext = wizNext;
window.wizFinish = wizFinish;
window.updateDrawerProfile = updateDrawerProfile;
window.updateHomeGreeting = updateHomeGreeting;

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawerWizard);
} else {
    // DOM already loaded, run on next tick to ensure other modules are loaded
    setTimeout(initDrawerWizard, 100);
}

console.log("DRAWER_WIZARD: Module loaded (v17.1)");
