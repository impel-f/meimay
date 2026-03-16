/* ============================================================
   MODULE 13: DRAWER & WIZARD (V17.0)
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
let wizGender = 'neutral';
let wizHasReadingCandidate = null;

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

    wizFinish(null);
}

function selectWizReadingCandidate(hasCandidate) {
    wizHasReadingCandidate = !!hasCandidate;
    document.querySelectorAll('[data-reading-candidate]').forEach(btn => {
        const isSelected = btn.getAttribute('data-reading-candidate') === (hasCandidate ? 'yes' : 'no');
        btn.classList.toggle('selected', isSelected);
    });
}

function wizNext(currentStep) {
    // Validation
    if (currentStep === 1) {
        // Username is optional, role is optional
    }
    if (currentStep === 2) {
        // Surname is optional
        const surname = document.getElementById('wiz-surname');
        if (surname && surname.value.trim()) {
            surnameStr = surname.value.trim();
            const input = document.getElementById('in-surname');
            if (input) input.value = surnameStr;
            if (typeof updateSurnameData === 'function') updateSurnameData();
        }
    }
    if (currentStep === 3 && wizHasReadingCandidate === null) {
        wizHasReadingCandidate = false;
    }

    // Hide current step
    const current = document.getElementById(`wiz-step-${currentStep}`);
    if (current) current.classList.remove('active');

    // Show next step
    const next = document.getElementById(`wiz-step-${currentStep + 1}`);
    if (next) next.classList.add('active');

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
    const dueDate = document.getElementById('wiz-due-date');

    const data = {
        completed: true,
        username: username ? username.value.trim() : '',
        role: wizRole,
        surname: surname ? surname.value.trim() : '',
        dueDate: dueDate ? dueDate.value : '',
        hasReadingCandidate: wizHasReadingCandidate === true,
        gender: wizGender,
        completedAt: new Date().toISOString()
    };

    WizardData.save(data);

    // Apply to global state
    if (data.surname) {
        surnameStr = data.surname;
        const surnameInput = document.getElementById('in-surname');
        if (surnameInput) surnameInput.value = surnameStr;
        if (typeof updateSurnameData === 'function') updateSurnameData();
    }
    gender = data.gender;

    // Update drawer profile
    updateDrawerProfile();

    // Set flag so Firebase auth state change knows where to route next
    window.isWizardLoginFlow = true;

    // Navigate to Login/Signup screen instead of Home
    changeScreen('scr-login');
}

window.selectWizReadingCandidate = selectWizReadingCandidate;

// ==========================================
// DRAWER FUNCTIONS
// ==========================================

function openDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) {
        overlay.classList.remove('hidden');
        // Trigger reflow for transition
        overlay.offsetHeight;
        overlay.classList.add('open');
    }
    updateDrawerProfile();
}

function closeDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.classList.add('hidden'), 300);
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
        }
    }, 200);
}

function updateDrawerProfile() {
    const data = WizardData.get();
    if (!data) return;

    const avatar = document.getElementById('drawer-avatar');
    const username = document.getElementById('drawer-username');
    const surnameDisplay = document.getElementById('drawer-surname-display');

    if (data.username && username) {
        username.innerText = data.username;
        if (avatar) {
            avatar.innerText = data.username.charAt(0).toUpperCase();
        }
    }

    if (data.role && avatar) {
        const roleEmoji = { papa: '👨', mama: '👩', other: '👤' };
        if (!data.username) {
            avatar.innerText = roleEmoji[data.role] || 'P';
        }
    }

    if (surnameDisplay) {
        surnameDisplay.innerText = data.surname ? `@${data.surname}` : '@苗字未設定';
    }
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
                { id: 'drawer-mode-reading', target: 'mode-reading', icon: '🔤', label: '読みから漢字を探す' },
                { id: 'drawer-direct-swipe', target: 'direct-swipe', icon: '👆', label: '直感スワイプ' }
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
                { id: 'drawer-search', target: 'search', icon: '🔎', label: '漢字検索' },
                { id: 'drawer-ranking', target: 'ranking', icon: '👑', label: 'ランキング' },
                { id: 'drawer-diagnosis', target: 'diagnosis', icon: '🔮', label: '姓名判断' }
            ]
        },
        {
            title: '設定・情報',
            items: [
                { id: 'drawer-settings', target: 'settings', icon: '⚙️', label: '設定' },
                { id: 'drawer-legal-terms', target: 'legal-terms', icon: '📘', label: '利用規約' },
                { id: 'drawer-legal-privacy', target: 'legal-privacy', icon: '🔒', label: 'プライバシーポリシー' }
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
        'scr-akinator': 'AIおすすめ'
    };

    title.innerText = titles[screenId] || 'メイメー';
}

// ==========================================
// INITIALIZATION
// ==========================================

function initDrawerWizard() {
    renderDrawerMenu();

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

    // Handle swipe gesture to open drawer (edge swipe)
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isEdgeSwipe = false;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        // Only trigger if starting from left edge (first 20px)
        isEdgeSwipe = touchStartX < 20;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isEdgeSwipe) return;
        touchCurrentX = e.touches[0].clientX;
        const diff = touchCurrentX - touchStartX;
        if (diff > 60) {
            openDrawer();
            isEdgeSwipe = false;
        }
    }, { passive: true });
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
            const hideScreens = ['scr-mode', 'scr-main', 'scr-stock', 'scr-build', 'scr-settings', 'scr-swipe-universal', 'scr-wizard'];
            historyBtn.classList.toggle('hidden', hideScreens.includes(id));
        }
    };
}

// Expose functions
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.drawerNavigate = drawerNavigate;
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

console.log("DRAWER_WIZARD: Module loaded (v17.0)");
