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

/**
 * 設定画面を開く（別画面として）
 */
function openSettings() {
    renderSettingsScreen();
    changeScreen('scr-settings');
}

/**
 * 設定画面のレンダリング
 */
function renderSettingsScreen() {
    const container = document.getElementById('settings-screen-content');
    if (!container) return;

    const genderText = gender === 'male' ? '男の子' :
        gender === 'female' ? '女の子' : '指定なし';

    const tagCount = selectedImageTags.includes('none') ?
        'こだわらない' :
        `${selectedImageTags.length}個選択`;

    const strictText = rule === 'strict' ? '厳格' : '柔軟';
    const fortuneText = prioritizeFortune ? '重視する' : '参考程度';

    const currentReading = segments.join('') || '未設定';

    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const nicknameText = wizData?.username || '未設定';
    const roleText = wizData?.role === 'papa' ? 'パパ👨' : wizData?.role === 'mama' ? 'ママ👩' : '未設定';

    // Partner linking status
    let pairingStatusText = '未連携';
    let pairingStatusColor = '#a6967a';
    if (typeof MeimayPairing !== 'undefined' && MeimayPairing.roomCode) {
        pairingStatusText = `連携中（${MeimayPairing.roomCode}）`;
        pairingStatusColor = '#4ade80';
    }

    container.innerHTML = `
        <div class="settings-screen-content">
            <!-- ニックネーム -->
            <div class="settings-item-unified" onclick="openNicknameInput()">
                <div class="item-icon-circle" style="background: #fef9f0;">
                    <span style="color: #bca37f;">😊</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">ニックネーム</div>
                    <div class="item-value-unified">${nicknameText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>

            <!-- 役割 -->
            <div class="settings-item-unified" onclick="openRoleInput()">
                <div class="item-icon-circle" style="background: #fef9f0;">
                    <span style="color: #bca37f;">👪</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">役割</div>
                    <div class="item-value-unified">${roleText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>

            <!-- 苗字 -->
            <div class="settings-item-unified" onclick="openSurnameInput()">
                <div class="item-icon-circle" style="background: #fef2f2;">
                    <span style="color: #f87171;">👤</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">苗字</div>
                    <div class="item-value-unified">${surnameStr || '未設定'}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>

            <!-- 性別 -->
            <div class="settings-item-unified" onclick="openGenderInput()">
                <div class="item-icon-circle" style="background: #f0fdf4;">
                    <span style="color: #4ade80;">👶</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">赤ちゃんの性別</div>
                    <div class="item-value-unified">${genderText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>

            <div class="settings-divider-unified"></div>

            <!-- パートナーと連携 -->
            <div class="settings-item-unified" onclick="changeScreen('scr-login')">
                <div class="item-icon-circle" style="background: #f0fdf4;">
                    <span style="color: #4ade80;">💑</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">パートナーと連携</div>
                    <div class="item-value-unified" style="color: ${pairingStatusColor};">${pairingStatusText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>

            <div class="settings-divider-unified"></div>

            <!-- 不適切漢字の表示設定 -->
            <div class="settings-item-unified" onclick="toggleInappropriateSetting()">
                <div class="item-icon-circle" style="background: #fff7ed;">
                    <span style="color: #f97316;">⚠️</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">人名に使える漢字すべてを表示</div>
                    <div class="item-value-unified text-[10px] leading-tight">不適切な意味を持つ漢字も表示されます</div>
                </div>
                <div class="item-arrow-unified">
                    <div class="w-10 h-6 rounded-full relative transition-colors ${showInappropriateKanji ? 'bg-[#bca37f]' : 'bg-gray-200'}">
                        <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showInappropriateKanji ? 'translate-x-4' : ''}"></div>
                    </div>
                </div>
            </div>

            <div class="settings-divider-unified" style="margin-top:40px;"></div>
            <div class="text-[10px] text-center font-black text-[#f28b82] tracking-widest opacity-60 uppercase mb-4">Danger Zone</div>

            <button onclick="deleteAllStocks()" class="w-full py-4 bg-white border border-[#f28b82] text-[#f28b82] rounded-2xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm shadow-sm">
                <span>🗑️</span> ストックをすべて消去する
            </button>
            <p class="text-[10px] text-[#a6967a] mt-2 text-center px-4 leading-relaxed">
                ※これまでに「いいね」した全ての漢字ストックが削除されます。（保存済みの名前一覧は消去されません）
            </p>
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
    const current = wizData?.username || '';
    showInputModal('ニックネームを入力', 'text', current, '例：さくらママ', (value) => {
        if (typeof WizardData !== 'undefined') {
            const data = WizardData.get() || {};
            data.username = value;
            WizardData.save(data);
            if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        }
        renderSettingsScreen();
    });
}

/**
 * 役割選択
 */
function openRoleInput() {
    const wizData = (typeof WizardData !== 'undefined') ? WizardData.get() : null;
    const current = wizData?.role || 'other';
    showChoiceModal('役割を選択', '', [
        { label: 'ママ👩', value: 'mama' },
        { label: 'パパ👨', value: 'papa' },
        { label: 'その他', value: 'other' }
    ], current, (value) => {
        if (typeof WizardData !== 'undefined') {
            const data = WizardData.get() || {};
            data.role = value;
            WizardData.save(data);
            if (typeof updateDrawerProfile === 'function') updateDrawerProfile();
        }
        renderSettingsScreen();
    });
}

/**
 * 苗字入力
 */
function openSurnameInput() {
    showSurnameModal(surnameStr, surnameReading, (kanji, reading) => {
        surnameStr = kanji || '';
        surnameReading = reading || '';
        if (typeof updateSurnameData === 'function') {
            const input = document.getElementById('in-surname');
            if (input) {
                input.value = surnameStr;
                updateSurnameData();
            }
        }
        saveSettings();
        renderSettingsScreen();
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



/**
 * 使い方ガイド
 */
function showGuide() {
    alert('使い方ガイドは今後実装予定です');
}

/**
 * 不適切設定の切り替え
 */
function toggleInappropriateSetting() {
    showInappropriateKanji = !showInappropriateKanji;
    saveSettings();
    renderSettingsScreen();
    showToast(`不適切漢字の表示を${showInappropriateKanji ? 'ON' : 'OFF'}にしました`);
}

/**
 * 汎用入力モーダル
 */
function showInputModal(title, type, currentValue, placeholder, onSave) {
    const modal = `
        <div class="overlay active modal-overlay-dark" id="input-modal" onclick="if(event.target.id==='input-modal')closeInputModal()">
            <div class="modal-sheet" onclick="event.stopPropagation()">
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
            <div class="modal-sheet" onclick="event.stopPropagation()">
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
            <button onclick="selectChoiceOption(${JSON.stringify(opt.value).replace(/"/g, '&quot;')})" 
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
        <div class="overlay active modal-overlay-dark" id="choice-modal" onclick="if(event.target.id==='choice-modal')closeChoiceModal()">
            <div class="modal-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeChoiceModal()">✕</button>
                <h3 class="modal-title">${title}</h3>
                ${description ? `<p class="modal-desc">${description}</p>` : ''}
                <div class="modal-body">
                    ${optionsHTML}
                </div>
                <div class="modal-footer">
                    <button onclick="saveChoiceModal()" class="btn-modal-primary">完了</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    window.choiceModalValue = currentValue;
    window.choiceModalCallback = onSave;
}

function selectChoiceOption(value) {
    window.choiceModalValue = value;
    document.querySelectorAll('.choice-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('.choice-radio').forEach(radio => radio.classList.remove('checked'));
    event.target.closest('.choice-option').classList.add('selected');
    event.target.closest('.choice-option').querySelector('.choice-radio').classList.add('checked');
}

function saveChoiceModal() {
    if (window.choiceModalCallback) {
        window.choiceModalCallback(window.choiceModalValue);
    }
    closeChoiceModal();
}

function closeChoiceModal() {
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

console.log("SETTINGS: Module loaded (v6.0 - Separate Screen)");

