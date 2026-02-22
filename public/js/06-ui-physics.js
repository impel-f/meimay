/* ============================================================
   MODULE 06: UI PHYSICS (V13.0)
   GPU加速スワイプ物理演算
   ============================================================ */

/**
 * カードに物理演算を設定
 */
function setupPhysics(card, data) {
    let sx, sy, dx = 0, dy = 0, active = false;

    const bL = document.getElementById('badge-like');
    const bN = document.getElementById('badge-nope');
    const bS = document.getElementById('badge-super');

    // ポインターダウン
    card.onpointerdown = e => {
        // 既にスワイプ中の場合は無視
        if (card.classList.contains('swipe-right') ||
            card.classList.contains('swipe-left') ||
            card.classList.contains('swipe-up')) {
            return;
        }

        sx = e.clientX;
        sy = e.clientY;
        dx = 0;
        dy = 0;

        card.setPointerCapture(e.pointerId);
        active = true;

        // GPU加速を有効化
        card.style.willChange = 'transform, opacity';
        card.style.transition = 'none';
        card.style.zIndex = '1000';
    };

    // ポインター移動
    card.onpointermove = e => {
        if (!active) return;

        dx = e.clientX - sx;
        dy = e.clientY - sy;

        // フレーム最適化
        requestAnimationFrame(() => {
            if (!active) return;

            // translate3dでハードウェアアクセラレーション
            const rotate = dx / 15;
            card.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg) scale(1.03)`;

            // バッジ表示（閾値調整済み）
            if (bS) {
                bS.style.opacity = dy < -40 ? Math.min(0.9, (Math.abs(dy) - 40) / 80) : 0;
            }
            if (bL) {
                bL.style.opacity = dx > 30 ? Math.min(0.9, (dx - 30) / 80) : 0;
            }
            if (bN) {
                bN.style.opacity = dx < -30 ? Math.min(0.9, (Math.abs(dx) - 30) / 80) : 0;
            }
        });
    };

    // ポインターアップ
    card.onpointerup = e => {
        if (!active) return;

        active = false;
        card.releasePointerCapture(e.pointerId);
        card.style.willChange = 'auto'; // GPU解放

        // バッジを非表示
        [bL, bN, bS].forEach(b => {
            if (b) b.style.opacity = 0;
        });

        const threshold = 100; // スワイプ判定閾値

        // タップ判定（ほぼ動いていない）
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            if (typeof showDetailByData === 'function') {
                showDetailByData(data);
            }
            resetCard();
        }
        // 上スワイプ（SUPER）
        else if (dy < -threshold) {
            executeSwipe('up', data);
        }
        // 右スワイプ（LIKE）
        else if (dx > threshold) {
            executeSwipe('right', data);
        }
        // 左スワイプ（NOPE）
        else if (dx < -threshold) {
            executeSwipe('left', data);
        }
        // 戻る
        else {
            resetCard();
        }
    };

    /**
     * カードを元の位置に戻す
     */
    function resetCard() {
        card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        card.style.transform = 'translate3d(0,0,0) rotate(0) scale(1)';
    }
}

/**
 * ボタンからの手動スワイプ
 */
function manual(dir) {
    const data = stack[currentIdx];
    if (data) {
        executeSwipe(dir, data);
    } else {
        console.warn("PHYSICS: No data available for manual swipe");
    }
}

/**
 * スワイプの実行
 */
function executeSwipe(dir, data) {
    const el = document.querySelectorAll('.card')[0];
    if (!el) {
        console.error("PHYSICS: Card element not found");
        return;
    }

    // 既にスワイプ中なら無視（重複防止）
    if (el.classList.contains('swipe-right') ||
        el.classList.contains('swipe-left') ||
        el.classList.contains('swipe-up')) {
        return;
    }

    // アニメーション開始
    el.style.transition = 'transform 0.5s ease-in, opacity 0.4s';
    el.classList.add('swipe-' + dir);

    // NOPEの場合はnopedセットに追加
    if (data && dir === 'left') {
        noped.add(data['漢字']);
    }

    // データ処理（左以外はストック）
    if (data && dir !== 'left') {
        // 重複チェック：既に同じ漢字が同じスロットに存在しないか確認
        const isDuplicate = liked.some(item =>
            item.slot === currentPos && item['漢字'] === data['漢字']
        );

        if (!isDuplicate) {
            seen.add(data['漢字']);
            liked.push({
                ...data,
                slot: currentPos,
                isSuper: (dir === 'up'),
                sessionReading: segments.join(''), // どの読み方で選ばれたかを記録
                sessionSegments: [...segments] // セグメント配列も記録してグループ化バグを防ぐ
            });
        } else {
            console.log(`PHYSICS: Duplicate detected - ${data['漢字']} already in slot ${currentPos}`);
        }
    }

    // DOM削除と次のカード表示
    setTimeout(() => {
        el.remove();
        currentIdx++;

        if (typeof render === 'function') {
            render();
        }

        if (typeof handleSwipeProgress === 'function') {
            handleSwipeProgress();
        }

        swipes++;
        console.log(`PHYSICS: Swipe ${dir} executed (total: ${swipes})`);

        // 10枚スワイプ（nopeも含む）でポップアップ
        if (swipes > 0 && swipes % 10 === 0) {
            console.log(`CHOICE: ${swipes} swipes reached for slot ${currentPos}`);
            if (typeof openChoiceModal === 'function') {
                openChoiceModal(currentPos);
            }
        }
    }, 400);
}

/**
 * スワイプ進行状況の処理（オプション）
 */
function handleSwipeProgress() {
    // 将来的な拡張用（アナリティクスなど）
}

console.log("PHYSICS: Module loaded");
