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

    container.innerHTML = `
        <div class="settings-screen-content">
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
                    <div class="item-title-unified">性別</div>
                    <div class="item-value-unified">${genderText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
            <div class="settings-divider-unified"></div>
            
            <!-- 使い方ガイド -->
            <div class="settings-item-unified" onclick="showGuide()">
                <div class="item-icon-circle" style="background: #f0f9ff;">
                    <span style="color: #0ea5e9;">📖</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">使い方ガイド</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
        </div>
    `;
}



/**
 * 苗字入力
 */
function openSurnameInput() {
    showInputModal('苗字を入力', 'text', surnameStr, '', (value) => {
        if (value) {
            surnameStr = value;
            if (typeof updateSurnameData === 'function') {
                const input = document.getElementById('in-surname');
                if (input) {
                    input.value = surnameStr;
                    updateSurnameData();
                }
            }
            saveSettings();
            renderSettingsScreen();
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



/**
 * 使い方ガイド
 */
function showGuide() {
    alert('使い方ガイドは今後実装予定です');
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
        gender: gender,
        imageTags: selectedImageTags,
        rule: rule,
        prioritizeFortune: prioritizeFortune,
        segments: segments,
        shareMode: shareMode
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
            gender = settings.gender || 'neutral';
            selectedImageTags = settings.imageTags || ['none'];
            rule = settings.rule || 'flexible';
            prioritizeFortune = settings.prioritizeFortune !== undefined ? settings.prioritizeFortune : false;
            segments = settings.segments || [];
            shareMode = settings.shareMode || 'auto';
            console.log('SETTINGS: Loaded', settings);
        } catch (e) {
            console.error('SETTINGS: Failed to load', e);
        }
    }
}

loadSettings();

console.log("SETTINGS: Module loaded (v6.0 - Separate Screen)");

