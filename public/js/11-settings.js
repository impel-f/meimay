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
            <!-- 読み方（最上部） -->
            <div class="settings-item-unified" onclick="editReadingFull()">
                <div class="item-icon-circle" style="background: #eff6ff;">
                    <span style="color: #60a5fa;">あ</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">読み方</div>
                    <div class="item-value-unified">${currentReading}</div>
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
                    <div class="item-title-unified">性別</div>
                    <div class="item-value-unified">${genderText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
            <!-- イメージ -->
            <div class="settings-item-unified" onclick="editImageTags()">
                <div class="item-icon-circle" style="background: #fef9c3;">
                    <span style="color: #facc15;">🎨</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">イメージ</div>
                    <div class="item-value-unified">${tagCount}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
            <!-- 読みの厳密さ -->
            <div class="settings-item-unified" onclick="openReadingStyleInput()">
                <div class="item-icon-circle" style="background: #f5f3ff;">
                    <span style="color: #a78bfa;">🔍</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">読みの厳密さ</div>
                    <div class="item-value-unified">${strictText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
            <!-- 姓名判断 -->
            <div class="settings-item-unified" onclick="editFortunePriority()">
                <div class="item-icon-circle" style="background: #fef3c7;">
                    <span style="color: #f59e0b;">⭐</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">姓名判断</div>
                    <div class="item-value-unified">${fortuneText}</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
            <div class="settings-divider-unified"></div>
            
            <!-- 履歴・保存済み -->
            <div class="settings-item-unified" onclick="openHistory()">
                <div class="item-icon-circle" style="background: #fef3f2;">
                    <span style="color: #f97316;">📚</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">履歴・保存済み</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
            
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
            
            <!-- モードを変える -->
            <div class="settings-item-unified" onclick="resetToTop()">
                <div class="item-icon-circle" style="background: #faf5ff;">
                    <span style="color: #a855f7;">🔄</span>
                </div>
                <div class="item-content-unified">
                    <div class="item-title-unified">モードを変える</div>
                    <div class="item-value-unified">最初から選び直す</div>
                </div>
                <div class="item-arrow-unified">›</div>
            </div>
        </div>
    `;
}

/**
 * 読み方編集（現在の読み表示 + 変更ボタン）
 */
function editReadingFull() {
    const currentReading = segments.join('') || '未設定';

    const modal = `
        <div class="overlay active modal-overlay-dark" id="reading-modal" onclick="if(event.target.id==='reading-modal')closeReadingModal()">
            <div class="modal-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="closeReadingModal()">✕</button>
                <h3 class="modal-title">読み方</h3>
                <div class="modal-body">
                    <div class="current-reading-display">
                        <div class="current-reading-label">現在の読み方</div>
                        <div class="current-reading-value">${currentReading}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="changeReading()" class="btn-modal-primary">変更する</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
}

function closeReadingModal() {
    document.getElementById('reading-modal')?.remove();
}

function changeReading() {
    closeReadingModal();

    // ビルド画面をリセット
    if (typeof clearBuildSelection === 'function') {
        clearBuildSelection();
    }

    // 読み方入力画面に戻る
    changeScreen('scr-input-reading');
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
 * 読みの厳密さ
 */
function openReadingStyleInput() {
    showChoiceModal('読みの厳密さ', '', [
        { label: '厳格モード（読み一致）', value: 'strict', desc: '読みが完全一致する漢字のみ表示' },
        { label: '柔軟モード（ぶった切り）', value: 'flexible', desc: '読みの一部が一致すれば表示' }
    ], rule, (value) => {
        rule = value;
        saveSettings();
        renderSettingsScreen();
    });
}

/**
 * イメージタグ編集
 */
function editImageTags() {
    const tagsHTML = IMAGE_TAGS.map(tag => {
        const isSelected = selectedImageTags.includes(tag.id);
        return `
            <button onclick="toggleImageTag('${tag.id}')" 
                    class="tag-button-unified ${isSelected ? 'selected' : ''}">
                <span class="tag-icon">${tag.icon}</span>
                <span class="tag-label">${tag.label}</span>
                ${isSelected ? '<span class="tag-check">✓</span>' : ''}
            </button>
        `;
    }).join('');

    const tagSelector = `
        <div class="overlay active modal-overlay-dark" id="tag-selector" onclick="if(event.target.id==='tag-selector')cancelTagSelection()">
            <div class="modal-sheet" onclick="event.stopPropagation()">
                <button class="modal-close-x" onclick="cancelTagSelection()">✕</button>
                <h3 class="modal-title">名前のイメージ</h3>
                <p class="modal-desc">複数選択できます<br>選んだイメージの漢字が優先表示されます</p>
                <div class="tag-grid">${tagsHTML}</div>
                <div class="modal-footer">
                    <button onclick="saveImageTags()" class="btn-modal-primary">完了</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', tagSelector);
}

function toggleImageTag(tagId) {
    if (tagId === 'none') {
        selectedImageTags = ['none'];
    } else {
        const index = selectedImageTags.indexOf(tagId);
        if (index > -1) {
            selectedImageTags.splice(index, 1);
        } else {
            selectedImageTags.push(tagId);
        }
        const noneIndex = selectedImageTags.indexOf('none');
        if (noneIndex > -1) selectedImageTags.splice(noneIndex, 1);
        if (selectedImageTags.length === 0) selectedImageTags = ['none'];
    }
    editImageTags();
}

function saveImageTags() {
    document.getElementById('tag-selector')?.remove();
    saveSettings();
    renderSettingsScreen();
}

function cancelTagSelection() {
    document.getElementById('tag-selector')?.remove();
}

/**
 * 姓名判断優先度
 */
function editFortunePriority() {
    showChoiceModal('姓名判断', '', [
        { label: '重視する', value: true, desc: '良い運勢の組み合わせを優先表示' },
        { label: '参考程度', value: false, desc: '運勢も表示するが、並び順に影響しない' }
    ], prioritizeFortune, (value) => {
        prioritizeFortune = value;
        saveSettings();
        renderSettingsScreen();
    });
}

/**
 * モードを変える（TOP画面に戻る）
 */
function resetToTop() {
    if (confirm('最初の画面に戻りますか？\n現在のストックは保持されます。')) {
        changeScreen('scr-mode');
    }
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
        segments: segments
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
            console.log('SETTINGS: Loaded', settings);
        } catch (e) {
            console.error('SETTINGS: Failed to load', e);
        }
    }
}

loadSettings();

console.log("SETTINGS: Module loaded (v6.0 - Separate Screen)");
