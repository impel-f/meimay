let currentLegalTabType = 'terms';

function openLegalScreen(type = 'terms') {
    changeScreen('scr-legal');
    switchLegalTab(type);
}

function switchLegalTab(type) {
    const normalizedType = ['terms', 'privacy', 'contact'].includes(type) ? type : 'terms';
    currentLegalTabType = normalizedType;
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
        if (normalizedType === 'contact' && typeof updateSupportCategoryHelp === 'function') {
            updateSupportCategoryHelp();
        }
    }

    const scrollArea = document.getElementById('legal-scroll-area');
    if (scrollArea) {
        scrollArea.scrollTop = 0;
    }
}

function getMeimaySupportEmail() {
    return window.MeimayLegalDocs?.supportEmail || 'meimay.app@gmail.com';
}

const MEIMAY_SUPPORT_CATEGORIES = {
    bug: {
        label: '不具合・表示崩れ',
        description: '動かない、表示がおかしい、操作できないとき',
        prompts: [
            '困っている画面や操作:',
            '期待した動き:',
            '実際の動き・表示された文言:',
            '再現しやすい手順:',
            '端末/OS（わかる範囲）:',
            'スクリーンショットの有無:'
        ]
    },
    purchase: {
        label: '購入・無料体験・復元',
        description: 'プレミアム、広告非表示、購入状態の確認',
        prompts: [
            '購入/無料体験/購入復元/広告表示のどれですか:',
            '購入したストア（App Store / Google Play）:',
            'プラン名（わかる範囲）:',
            '購入日または更新日（おおよそ）:',
            '同じApple ID / Googleアカウントで試したか:',
            '表示されている状態やエラー:',
            '試した操作:'
        ]
    },
    backup: {
        label: 'データ復元・機種変更',
        description: '復元キー、バックアップ、端末引き継ぎ',
        notes: [
            '復元キーの全文や個人情報は、必要な場合のみ案内に沿って送ってください。',
            '苗字だけでは本人確認や復元はできません。'
        ],
        prompts: [
            'やりたいこと（復元/機種変更/バックアップ/削除）:',
            '元の端末を操作できますか（はい/いいえ）:',
            '新しい端末と元の端末（iPhone/iPad/Androidなど）:',
            '復元キーの有無（全文はまだ書かないでください）:',
            '復元キーを発行/更新した時期（おおよそ）:',
            '表示されたエラーや失敗した操作:',
            'パートナー連携の有無（連携中/連携待ち/未連携）:',
            '消えて困っているデータ（保存名/ストック/メモなど）:'
        ]
    },
    pairing: {
        label: 'パートナー連携',
        description: 'コード共有、相手候補、一致候補の同期',
        notes: [
            '連携コードの全文は、必要な場合のみ案内に沿って送ってください。'
        ],
        prompts: [
            'やりたいこと（連携/解除/相手候補の同期/一致候補）:',
            '連携コードを作った側:',
            '参加した側:',
            '現在の状態（未連携/連携待ち/連携中）:',
            '連携コードの有無（全文はまだ書かないでください）:',
            '相手に見えている/見えていない内容:',
            '試した操作:',
            '表示されたエラー:'
        ]
    },
    'kanji-data': {
        label: '漢字・読みデータの追加/修正',
        description: '読み方追加、候補例、意味や画数の修正',
        prompts: [
            '追加/修正したい漢字・読み:',
            '読み方追加/意味/画数/名前例/人名用表示のどれですか:',
            '現在の表示内容:',
            '希望する表示内容:',
            '根拠や参考資料（あればURLや書籍名）:',
            '無料/プレミアム表示で気になった点:'
        ]
    },
    'ai-fortune': {
        label: 'AI・運勢・候補内容',
        description: '由来文、姓名判断、候補の出方への相談',
        prompts: [
            '気になった名前/漢字/読み:',
            '気になった画面（由来文/姓名判断/ランキング/AI深掘りなど）:',
            '気になった内容:',
            '期待する説明や候補:',
            '再生成や保存で試した操作:',
            '補足:'
        ]
    },
    privacy: {
        label: 'プライバシー・データ削除',
        description: '保存データの確認、削除、利用停止の依頼',
        notes: [
            '住所、電話番号、クレジットカード番号、本人確認書類などは送らないでください。'
        ],
        prompts: [
            '希望する内容（確認/訂正/削除/利用停止）:',
            '対象データ（端末内/クラウドバックアップ/復元キー/パートナー連携/購入状態など）:',
            '設定 > アプリデータを削除を試しましたか:',
            '元の端末を操作できますか:',
            '復元キーや連携コードの有無（全文はまだ書かないでください）:',
            '返信先メールアドレス（送信元と異なる場合）:',
            '補足:'
        ]
    },
    other: {
        label: 'その他',
        description: '上の分類に当てはまらない内容',
        prompts: [
            'お問い合わせ内容:',
            '困っている画面や操作（あれば）:',
            '補足:'
        ]
    }
};

function getSupportCategory(categoryKey) {
    return MEIMAY_SUPPORT_CATEGORIES[categoryKey] || MEIMAY_SUPPORT_CATEGORIES.other;
}

let currentSupportEmailPayload = null;

function escapeLegalHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function buildSupportMailtoHref(categoryKey = 'other') {
    return buildSupportEmailPayload(categoryKey).mailtoHref;
}

function buildSupportEmailPayload(categoryKey = 'other') {
    const category = getSupportCategory(categoryKey);
    const subject = `メイメーお問い合わせ: ${category.label}`;
    const notes = Array.isArray(category.notes) && category.notes.length > 0
        ? [...category.notes, '']
        : [];
    const body = [
        `カテゴリ: ${category.label}`,
        '',
        ...notes,
        ...category.prompts.flatMap((prompt) => [prompt, '']),
        '--- 自動入力された診断情報（必要に応じて削除できます） ---',
        getSupportDiagnostics()
    ].join('\n');
    return {
        categoryKey,
        category,
        to: getMeimaySupportEmail(),
        subject,
        body,
        mailtoHref: `mailto:${getMeimaySupportEmail()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    };
}

function openSupportEmail(categoryKey = 'other') {
    const payload = buildSupportEmailPayload(categoryKey);
    showSupportEmailSheet(payload);
}

function getSelectedSupportCategoryKey() {
    const select = document.getElementById('support-category-select');
    return select && typeof select.value === 'string' ? select.value : 'other';
}

function updateSupportCategoryHelp() {
    const help = document.getElementById('support-category-help');
    if (!help) return;
    const category = getSupportCategory(getSelectedSupportCategoryKey());
    help.textContent = category.description || '';
}

function openSupportEmailFromSelect() {
    openSupportEmail(getSelectedSupportCategoryKey());
}

function showSupportEmailSheet(payload) {
    currentSupportEmailPayload = payload;
    document.getElementById('support-email-sheet')?.remove();
    const modal = `
        <div class="overlay active modal-overlay-dark" id="support-email-sheet" onclick="if(event.target.id==='support-email-sheet')closeSupportEmailSheet()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeSupportEmailSheet()">✕</button>
                <h3 class="modal-title">メール内容を作成しました</h3>
                <p class="modal-desc">メールアプリが開かない環境では、宛先と本文をコピーして送信してください。</p>
                <div class="settings-sheet-list">
                    <div class="settings-sheet-row">
                        <span>宛先</span>
                        <strong>${escapeLegalHtml(payload.to)}</strong>
                    </div>
                    <div class="settings-sheet-row">
                        <span>件名</span>
                        <strong>${escapeLegalHtml(payload.subject)}</strong>
                    </div>
                </div>
                <textarea readonly class="mt-3 h-44 w-full resize-none rounded-2xl border border-[#eadfcd] bg-[#fffaf4] px-4 py-3 text-[11px] leading-relaxed text-[#5d5444] outline-none">${escapeLegalHtml(payload.body)}</textarea>
                <button type="button" onclick="launchSupportMailClientFromSheet()" class="mt-3 w-full rounded-2xl bg-[#bca37f] px-4 py-3 text-sm font-black text-white shadow-sm active:scale-95 transition-transform">メールアプリを開く</button>
                <div class="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onclick="copySupportEmailAddress()" class="rounded-2xl border border-[#d4c5af] bg-white px-4 py-3 text-xs font-black text-[#5d5444] active:scale-95 transition-transform">宛先をコピー</button>
                    <button type="button" onclick="copySupportEmailBody()" class="rounded-2xl border border-[#d4c5af] bg-white px-4 py-3 text-xs font-black text-[#5d5444] active:scale-95 transition-transform">本文をコピー</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
}

function closeSupportEmailSheet() {
    document.getElementById('support-email-sheet')?.remove();
}

function launchSupportMailClientFromSheet() {
    if (!currentSupportEmailPayload) return;
    const link = document.createElement('a');
    link.href = currentSupportEmailPayload.mailtoHref;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (typeof showToast === 'function') {
        showToast('開かない場合は本文をコピーしてください', '✉️');
    }
}

async function copySupportText(text, successMessage) {
    try {
        await navigator.clipboard.writeText(text);
        if (typeof showToast === 'function') {
            showToast(successMessage, '✓');
        } else {
            alert(successMessage);
        }
    } catch (error) {
        showSupportTextFallback(successMessage, text);
    }
}

function showSupportTextFallback(title, text) {
    document.getElementById('support-copy-fallback-sheet')?.remove();
    const modal = `
        <div class="overlay active modal-overlay-dark" id="support-copy-fallback-sheet" onclick="if(event.target.id==='support-copy-fallback-sheet')closeSupportTextFallback()">
            <div class="modal-sheet settings-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeSupportTextFallback()">✕</button>
                <h3 class="modal-title">${escapeLegalHtml(title)}</h3>
                <p class="modal-desc">コピーできない場合は、下の内容を選択して利用してください。</p>
                <textarea readonly class="mt-3 h-56 w-full resize-none rounded-2xl border border-[#eadfcd] bg-[#fffaf4] px-4 py-3 text-[11px] leading-relaxed text-[#5d5444] outline-none">${escapeLegalHtml(text)}</textarea>
                <button type="button" onclick="closeSupportTextFallback()" class="mt-3 w-full rounded-2xl bg-[#bca37f] px-4 py-3 text-sm font-black text-white shadow-sm active:scale-95 transition-transform">閉じる</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
}

function closeSupportTextFallback() {
    document.getElementById('support-copy-fallback-sheet')?.remove();
}

function copySupportEmailAddress() {
    if (!currentSupportEmailPayload) return;
    copySupportText(currentSupportEmailPayload.to, '宛先をコピーしました');
}

function copySupportEmailBody() {
    if (!currentSupportEmailPayload) return;
    copySupportText(`宛先: ${currentSupportEmailPayload.to}\n件名: ${currentSupportEmailPayload.subject}\n\n${currentSupportEmailPayload.body}`, '本文をコピーしました');
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
        showSupportTextFallback('診断情報をコピーしてください', diagnostics);
    }
}

window.openLegalScreen = openLegalScreen;
window.switchLegalTab = switchLegalTab;
window.openSupportEmail = openSupportEmail;
window.updateSupportCategoryHelp = updateSupportCategoryHelp;
window.openSupportEmailFromSelect = openSupportEmailFromSelect;
window.closeSupportEmailSheet = closeSupportEmailSheet;
window.launchSupportMailClientFromSheet = launchSupportMailClientFromSheet;
window.copySupportEmailAddress = copySupportEmailAddress;
window.copySupportEmailBody = copySupportEmailBody;
window.closeSupportTextFallback = closeSupportTextFallback;
window.copySupportInfo = copySupportInfo;
