/* ============================================================
   MODULE 10: CHOICE (V13.1 - スワイプ回数ベース)
   進捗管理・10枚完了時のモーダル
   ============================================================ */

/**
 * 選択数チェック（10枚ごとにモーダル表示）
 */
function checkChoiceLimit(forceCount) {
    const currentReading = segments.join('');
    const count = forceCount || liked.filter(item =>
        item.slot === currentPos &&
        (!item.sessionReading || item.sessionReading === currentReading)
    ).length;

    if (count > 0 && count % 10 === 0) {
        console.log(`CHOICE: ${count} items reached for slot ${currentPos}`);
        openChoiceModal(currentPos);
    }
}

/**
 * スワイプ回数ベースで選択肢を表示（新機能）
 */
function openChoice() {
    console.log("CHOICE: Opening choice modal (swipe-based)");

    const modal = document.getElementById('modal-choice');
    const countLabel = document.getElementById('choice-count-label');
    const message = document.getElementById('choice-message');
    const mainBtn = document.getElementById('choice-main-btn');

    if (!modal) {
        console.error("CHOICE: Modal not found");
        return;
    }

    if (countLabel) countLabel.innerText = `${swipes}`;

    const isLastSlot = currentPos >= segments.length - 1;
    const nextStep = isLastSlot ? "ビルド画面" : `${currentPos + 2}文字目`;
    const currentChar = segments[currentPos] || '';

    if (message) {
        message.innerHTML = `
            <div class="mb-4">
                <span class="text-2xl font-black text-[#bca37f]">${swipes}枚</span>
                <span class="text-sm">スワイプしました</span>
            </div>
            <p class="text-sm text-[#7a6f5a] leading-relaxed">
                <b class="text-[#5d5444]">${currentPos + 1}文字目「${currentChar}」</b>の候補を見ています。<br>
                このまま<b class="text-[#8b7e66]">${nextStep}</b>に進みますか？
            </p>
            <p class="text-xs text-[#a6967a] mt-4 italic">
                ${isLastSlot ? '全ての文字が揃ったら、名前を組み立てましょう' : 'もちろん、さらに候補を探すこともできます'}
            </p>
        `;
    }

    if (mainBtn) {
        mainBtn.onclick = () => {
            if (currentPos < segments.length - 1) {
                closeChoiceModal();
                currentPos++;
                currentIdx = 0;
                swipes = 0;
                if (typeof loadStack === 'function') {
                    loadStack();
                }
                changeScreen('scr-main');
            } else {
                closeChoiceModal();
                // ニックネーム漢字キューが有効な場合 → 次のsuffix読みへ
                if (typeof isNicknameKanjiQueueActive === 'function' && isNicknameKanjiQueueActive()) {
                    if (typeof advanceNicknameKanjiQueue === 'function') {
                        advanceNicknameKanjiQueue();
                    }
                } else if (typeof openBuild === 'function') {
                    openBuild();
                }
            }
        };
    }

    modal.classList.add('active');
}

/**
 * 選択完了モーダルを開く（元の関数）
 */
function openChoiceModal(slotIdx) {
    const modal = document.getElementById('modal-choice');
    const label = document.getElementById('choice-count-label');
    const msg = document.getElementById('choice-message');
    const btn = document.getElementById('choice-main-btn');

    if (!modal) {
        console.error("CHOICE: Modal not found");
        return;
    }

    if (typeof isFreeSwipeMode !== 'undefined' && isFreeSwipeMode) {
        const itemCount = liked.filter(item => item.sessionReading === 'FREE').length;
        if (label) label.innerText = itemCount;
        if (msg) {
            msg.innerHTML = `
                <div class="mb-4">
                    <span class="text-2xl font-black text-[#bca37f]">${itemCount}個</span>
                    <span class="text-sm">フリーストックに保存しました</span>
                </div>
                <p class="text-sm text-[#7a6f5a] leading-relaxed">
                    引き続き気に入った漢字を探しますか？<br>
                </p>
                <div class="flex flex-col gap-3 mt-8">
                    <button onclick="closeChoiceAndRefetch()" class="btn-premium-select !mb-0 w-full shadow-md">探し続ける</button>
                    <button onclick="finishFreeModeToHome()" class="btn-gold w-full shadow-md !py-4">ホームへ戻る</button>
                </div>
            `;
        }
        if (btn) btn.style.display = 'none'; // Custom buttons used instead
        modal.classList.add('active');
        console.log(`CHOICE: Modal opened in Free Mode (${itemCount} items)`);
        return;
    }

    if (btn) btn.style.display = 'block';

    const currentReading = segments.join('');
    const itemCount = liked.filter(item =>
        item.slot === slotIdx &&
        (!item.sessionReading || item.sessionReading === currentReading)
    ).length;

    // カウント表示
    if (label) label.innerText = itemCount;

    // 最終スロット判定
    const isLastSlot = (slotIdx === segments.length - 1);
    const nextStep = isLastSlot ? "姓名判断・ビルド" : `${slotIdx + 2}文字目`;
    const currentChar = segments[slotIdx] || '';

    // メッセージ作成
    if (msg) {
        msg.innerHTML = `
            <div class="mb-4">
                <span class="text-2xl font-black text-[#bca37f]">${itemCount}個</span>
                <span class="text-sm">候補を選びました</span>
            </div>
            <p class="text-sm text-[#7a6f5a] leading-relaxed">
                <b class="text-[#5d5444]">${slotIdx + 1}文字目「${currentChar}」</b>の候補が十分に揃いました。<br>
                このまま<b class="text-[#8b7e66]">${nextStep}</b>に進みますか？
            </p>
            <p class="text-xs text-[#a6967a] mt-4 italic">
                ${isLastSlot ? '全ての文字が揃ったら、名前を組み立てましょう' : 'もちろん、さらに候補を探すこともできます'}
            </p>
        `;
    }

    // ボタンの動作設定
    if (btn) {
        btn.onclick = () => {
            closeChoiceModal();

            if (isLastSlot) {
                // ニックネーム漢字キューが有効な場合 → 次のsuffix読みへ
                if (typeof isNicknameKanjiQueueActive === 'function' && isNicknameKanjiQueueActive()) {
                    // 先頭スロット（slot 0）の選択済みを保存
                    if (typeof nicknameSharedPrefixLiked !== 'undefined' && nicknameSharedPrefixLiked.length === 0) {
                        const currentReading = segments.join('');
                        const slot0Items = liked.filter(l => l.slot === 0 && (!l.sessionReading || l.sessionReading === currentReading));
                        if (typeof nicknameSharedPrefixLiked !== 'undefined') {
                            slot0Items.forEach(item => nicknameSharedPrefixLiked.push(item));
                        }
                    }
                    if (typeof advanceNicknameKanjiQueue === 'function') {
                        advanceNicknameKanjiQueue();
                    }
                } else {
                    // 通常：ビルド画面へ
                    openBuild();
                }
            } else {
                // 次のスロットへ
                currentPos++;
                currentIdx = 0;

                if (typeof loadStack === 'function') {
                    loadStack();
                }

                changeScreen('scr-main');
            }
        };
    }

    // モーダル表示
    modal.classList.add('active');

    console.log(`CHOICE: Modal opened for slot ${slotIdx} (${itemCount} items)`);
}

/**
 * モーダルを閉じる
 */
function closeChoiceModal() {
    const modal = document.getElementById('modal-choice');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * モーダルを閉じて続行
 */
function closeChoiceAndRefetch() {
    console.log("CHOICE: User chose to continue searching");
    // モーダルを閉じる前に現在のスワイプ画面を判定する
    const isUniversal = document.getElementById('scr-swipe-universal')?.classList.contains('active');
    closeChoiceModal();
    // スワイプ画面に戻る（ユニバーサルスワイプ使用中の場合はそちらへ）
    changeScreen(isUniversal ? 'scr-swipe-universal' : 'scr-main');
}

/**
 * 進捗状況の取得
 */
function getProgress() {
    const progress = segments.map((seg, idx) => {
        const items = liked.filter(item => item.slot === idx);
        return {
            slot: idx,
            segment: seg,
            count: items.length,
            completed: items.length >= 10
        };
    });

    return progress;
}

/**
 * 全スロット完了チェック
 */
function isAllSlotsCompleted() {
    return segments.every((seg, idx) => {
        const items = liked.filter(item => item.slot === idx);
        return items.length >= 1; // 最低1つずつ
    });
}

/**
 * 進捗状況の表示（デバッグ用）
 */
function showProgress() {
    const progress = getProgress();
    console.log("=== PROGRESS REPORT ===");
    progress.forEach(p => {
        console.log(`  Slot ${p.slot + 1} (${p.segment}): ${p.count} items ${p.completed ? '✓' : ''}`);
    });
    console.log("=======================");
}

console.log("CHOICE: Module loaded (v13.1)");
