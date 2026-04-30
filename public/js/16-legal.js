function openLegalScreen(type = 'terms') {
    changeScreen('scr-legal');
    switchLegalTab(type);
}

function switchLegalTab(type) {
    const normalizedType = ['terms', 'privacy', 'contact'].includes(type) ? type : 'terms';
    const buttons = {
        terms: document.getElementById('legal-tab-terms'),
        privacy: document.getElementById('legal-tab-privacy'),
        contact: document.getElementById('legal-tab-contact')
    };
    const contentArea = document.getElementById('legal-content');

    Object.entries(buttons).forEach(([key, button]) => {
        if (!button) return;
        const active = key === normalizedType;
        button.className = active
            ? 'flex-1 py-1.5 rounded-[10px] text-[10px] font-bold bg-[#bca37f] text-white shadow-sm transition-all'
            : 'flex-1 py-1.5 rounded-[10px] text-[10px] font-bold bg-transparent text-[#bca37f] hover:bg-[#bca37f]/10 transition-all';
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (contentArea) {
        const legalDocs = window.MeimayLegalDocs || {};
        const contentByType = {
            terms: legalDocs.termsOfService || '',
            privacy: legalDocs.privacyPolicy || '',
            contact: legalDocs.contactGuide || ''
        };
        contentArea.innerHTML = contentByType[normalizedType] || contentByType.terms;
    }

    const scrollArea = document.getElementById('legal-scroll-area');
    if (scrollArea) {
        scrollArea.scrollTop = 0;
    }
}

function getMeimaySupportEmail() {
    return window.MeimayLegalDocs?.supportEmail || 'meimay.app@gmail.com';
}

function getSupportDiagnostics() {
    const lines = [
        `日時: ${new Date().toISOString()}`,
        `URL: ${window.location.href}`,
        `UserAgent: ${navigator.userAgent}`
    ];

    const currentUser = (typeof MeimayAuth !== 'undefined' && MeimayAuth && typeof MeimayAuth.getCurrentUser === 'function')
        ? MeimayAuth.getCurrentUser()
        : (typeof firebaseAuth !== 'undefined' && firebaseAuth ? firebaseAuth.currentUser : null);
    if (currentUser?.uid) {
        lines.push(`匿名ID: ${currentUser.uid}`);
    }

    if (typeof WizardData !== 'undefined' && WizardData && typeof WizardData.get === 'function') {
        const wizard = WizardData.get() || {};
        const roleLabel = { mama: 'ママ', papa: 'パパ', other: 'その他' }[wizard.role] || wizard.role || '未設定';
        lines.push(`ニックネーム: ${wizard.username || '未設定'}`);
        lines.push(`役割: ${roleLabel}`);
    }

    if (typeof PremiumManager !== 'undefined' && PremiumManager && typeof PremiumManager.getPublicPremiumSnapshot === 'function') {
        const premium = PremiumManager.getPublicPremiumSnapshot() || {};
        lines.push(`プレミアム: ${premium.status || premium.planType || (premium.isPremium ? '有効' : '無効')}`);
        if (premium.expiresAt) lines.push(`有効期限: ${premium.expiresAt}`);
    }

    if (typeof MeimayPairing !== 'undefined' && MeimayPairing) {
        lines.push(`パートナー連携: ${MeimayPairing.roomCode ? '連携中' : '未連携'}`);
    }

    return lines.join('\n');
}

function buildSupportMailtoHref() {
    const subject = encodeURIComponent('メイメーお問い合わせ');
    const body = encodeURIComponent([
        'お問い合わせ内容:',
        '',
        '',
        '--- 診断情報 ---',
        getSupportDiagnostics()
    ].join('\n'));
    return `mailto:${getMeimaySupportEmail()}?subject=${subject}&body=${body}`;
}

function openSupportEmail() {
    window.location.href = buildSupportMailtoHref();
}

async function copySupportInfo() {
    const diagnostics = getSupportDiagnostics();
    try {
        await navigator.clipboard.writeText(diagnostics);
        if (typeof showToast === 'function') {
            showToast('診断情報をコピーしました', '✓');
        } else {
            alert('診断情報をコピーしました');
        }
    } catch (error) {
        console.warn('LEGAL: Failed to copy support diagnostics', error);
        window.prompt('診断情報をコピーしてください', diagnostics);
    }
}

window.openLegalScreen = openLegalScreen;
window.switchLegalTab = switchLegalTab;
window.openSupportEmail = openSupportEmail;
window.copySupportInfo = copySupportInfo;
