/* ============================================================
   MODULE 02: ENGINE (V13.0)
   読み分割エンジン・スタック生成・スコアリング
   ============================================================ */

/**
 * 読みの分割パターンを計算
 */
function calcSegments() {
    console.log("ENGINE: calcSegments() called");

    const inputEl = document.getElementById('in-name');
    if (!inputEl) {
        console.error("ENGINE: 'in-name' element not found");
        return;
    }

    const rawVal = inputEl.value.trim();
    const nameReading = toHira(rawVal);

    // 入力チェック
    if (!nameReading) {
        alert("名前の読みをひらがなで入力してください。\n例：はな、かな、ゆうと");
        return;
    }

    if (!/^[ぁ-ん]+$/.test(nameReading)) {
        alert("ひらがなのみで入力してください。");
        return;
    }

    // データ読み込みチェック
    if (!master || master.length === 0) {
        alert("漢字データを読み込み中です。\n3〜5秒待ってから再度お試しください。");
        return;
    }

    // オプションコンテナ取得
    const optionsContainer = document.getElementById('seg-options');
    if (!optionsContainer) {
        console.error("ENGINE: 'seg-options' element not found");
        return;
    }
    optionsContainer.innerHTML = '<div class="text-center text-[#bca37f] text-sm">分割パターンを計算中...</div>';

    // 分割パターンの探索
    let allPaths = [];

    function findPath(remaining, currentPath) {
        // 最大3文字まで
        if (currentPath.length > 3) return;

        // 完了
        if (remaining.length === 0) {
            if (currentPath.length >= 1) {
                allPaths.push([...currentPath]);
            }
            return;
        }

        // 1〜3文字ずつ試行
        for (let i = 1; i <= Math.min(3, remaining.length); i++) {
            let part = remaining.slice(0, i);

            // 辞書に存在する読みかチェック（柔軟モードなら全ての分割を許容、ただし辞書にあるものを優先するロジックは別途必要だが、ここでは簡易的にチェックパス）
            // 修正：柔軟モードでもデタラメな分割は避けたいが、辞書にない読み（人名特有の読みなど）がある場合は許可する必要がある。
            // ここでは簡易的に「厳格モードなら辞書チェック必須」「柔軟モードならチェックなし」とする
            const partSeion = typeof toSeion === 'function' ? toSeion(part) : part;
            if (rule === 'lax' || (validReadingsSet && (validReadingsSet.has(part) || validReadingsSet.has(partSeion)))) {
                currentPath.push(part);
                findPath(remaining.slice(i), currentPath);
                currentPath.pop();
            }
        }
    }

    try {
        findPath(nameReading, []);
        console.log(`ENGINE: Found ${allPaths.length} raw patterns`);
    } catch (e) {
        console.error("ENGINE: Search failed", e);
        alert("分割計算中にエラーが発生しました。");
        return;
    }

    // スコアリング
    const scoredSplits = allPaths.map(path => {
        let score = 0;

        // 文字数ボーナス（2文字が最優先）
        if (path.length === 2) score += 2000;
        else if (path.length === 3) score += 1800;
        else if (path.length === 1) score += 500;

        // 各パーツのスコア
        path.forEach(p => {
            if (p.length === 2) score += 500; // 2音読みは自然
            if (p.length === 1) {
                // 1音で完結しやすい読み
                if (["た", "ま", "と", "の", "か", "ほ", "ひ", "み", "な", "り", "さ", "こ", "あ"].includes(p)) {
                    score += 200;
                } else {
                    score += 50;
                }
            }
        });

        // 1音連続ペナルティ
        let singleCombo = 0;
        let maxSingleCombo = 0;
        path.forEach(p => {
            if (p.length === 1) singleCombo++;
            else singleCombo = 0;
            maxSingleCombo = Math.max(maxSingleCombo, singleCombo);
        });
        if (maxSingleCombo >= 3) score -= 3000; // 3連続1音は不自然

        return { path, score };
    });

    // スコア順にソート
    scoredSplits.sort((a, b) => b.score - a.score);

    // 重複排除
    const uniquePaths = [];
    const seenSet = new Set();
    scoredSplits.forEach(item => {
        let key = JSON.stringify(item.path);
        if (!seenSet.has(key) && item.score > -1000) {
            uniquePaths.push(item.path);
            seenSet.add(key);
        }
    });

    console.log(`ENGINE: ${uniquePaths.length} unique patterns after dedup`);

    // 結果なしの場合、1文字ずつの分割を強制追加
    if (uniquePaths.length === 0) {
        const charSplit = nameReading.split('');
        uniquePaths.push(charSplit);
        console.log("ENGINE: No patterns found, using character split");
    }

    // UI生成（上位5件）
    optionsContainer.innerHTML = '';
    uniquePaths.slice(0, 5).forEach((path, idx) => {
        const btn = document.createElement('button');
        btn.className = "w-full py-6 bg-white text-[#5d5444] font-black rounded-[40px] border-2 border-[#fdfaf5] shadow-sm transition-all text-xl mb-4 hover:border-[#bca37f] hover:shadow-md active:scale-98 flex items-center justify-center group";

        const displayParts = path.map(p =>
            `<span class="px-2">${p}</span>`
        ).join('<span class="text-[#d4c5af] text-sm px-2 opacity-40 group-hover:opacity-100 transition-opacity">/</span>');

        btn.innerHTML = displayParts;
        btn.onclick = () => selectSegment(path);

        // 最初の選択肢を強調（おすすめバッジは削除）
        if (idx === 0) {
            btn.classList.add('border-[#bca37f]');
            // バッジ削除要望により削除
            // btn.innerHTML += '<span class="ml-2 text-xs text-[#bca37f]">おすすめ</span>';
        }

        optionsContainer.appendChild(btn);
    });

    // 画面遷移
    changeScreen('scr-segment');
}

/**
 * 分割パターン選択
 */
function selectSegment(path) {
    console.log("ENGINE: Selected segments ->", path);
    segments = path;
    swipes = 0;
    currentPos = 0; // Reset position

    // 読みモードはイメージ選択をスキップ → 直接スワイプへ
    // （イメージ選択は「自由に漢字を探す」モードのみ使用）
    window.selectedImageTags = ['none'];
    isFreeSwipeMode = false;
    if (typeof startSwiping === 'function') startSwiping();
}

/**
 * スワイプ用スタックの生成
 */

/**
 * スワイプ用スタックの生成（性別＋イメージタグフィルター対応）
 */
function loadStack() {
    if (!segments || segments.length === 0) {
        console.error("ENGINE: Segments not defined");
        return;
    }

    const target = toHira(segments[currentPos]);
    console.log(`ENGINE: Loading stack for position ${currentPos + 1}: "${target}"`);

    // --- Free Stock Auto-Matching ---
    const freeItems = liked.filter(l => l.sessionReading === 'FREE');
    freeItems.forEach(freeItem => {
        // すでにこのスロットに登録済みならスキップ
        const isDuplicateLocal = liked.some(item =>
            item.slot === currentPos && item['漢字'] === freeItem['漢字']
        );
        if (isDuplicateLocal) return;

        const majorReadings = ((freeItem['音'] || '') + ',' + (freeItem['訓'] || ''))
            .split(/[、,，\s/]+/)
            .map(x => toHira(x)).filter(x => x);
        const minorReadings = (freeItem['伝統名のり'] || '')
            .split(/[、,，\s/]+/)
            .map(x => toHira(x)).filter(x => x);
        const readings = [...majorReadings, ...minorReadings];

        const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;
        const isExact = majorReadings.includes(target) || minorReadings.includes(target);
        const isSeionMatch = target !== targetSeion && readings.includes(targetSeion);
        const isPartial = readings.some(r => r.startsWith(target)) || readings.some(r => r.startsWith(targetSeion));

        let match = false;
        if (typeof rule !== 'undefined' && rule === 'strict') {
            match = isExact || isSeionMatch;
        } else {
            match = isExact || isSeionMatch || isPartial;
        }

        if (match) {
            liked.push({
                ...freeItem,
                slot: currentPos,
                sessionReading: segments.join(''),
                sessionSegments: [...segments]
            });
            console.log(`ENGINE: Auto-injected Free Stock => ${freeItem['漢字']} for slot ${currentPos}`);
        }
    });

    // インジケーター更新
    const indicator = document.getElementById('pos-indicator');
    if (indicator) {
        const totalSlots = segments.length;
        const slotLabel = totalSlots === 2 ?
            (currentPos === 0 ? '1文字目' : '2文字目') :
            (currentPos === 0 ? '1文字目' : currentPos === totalSlots - 1 ? `${totalSlots}文字目` : `${currentPos + 1}文字目`);

        indicator.innerText = `${slotLabel}：${target}`;
    }

    // ナビゲーションボタン更新
    const btnPrev = document.getElementById('btn-prev-char');
    const btnNext = document.getElementById('btn-next-char');

    if (btnPrev) {
        btnPrev.classList.remove('opacity-0', 'pointer-events-none');

        // 1文字目の場合は「戻る」表記にするなどの調整も可能だが、統一感のためアイコンのままでも可
        // ここでは特段の見た目変更はせず、機能のみ有効化
    }

    if (btnNext) {
        if (currentPos < segments.length - 1) {
            btnNext.innerHTML = '次へ &gt;';
            // Outline style
            btnNext.classList.remove('bg-[#bca37f]', 'text-white');
            btnNext.classList.add('bg-white', 'text-[#bca37f]', 'border-2', 'border-[#bca37f]');
        } else {
            // Solid style for Done
            btnNext.innerHTML = '完了 &gt;';
            btnNext.classList.remove('bg-white', 'text-[#bca37f]');
            btnNext.classList.add('bg-[#bca37f]', 'text-white', 'border-2', 'border-[#bca37f]');
        }
    }

    // フィルタリング
    stack = master.filter(k => {
        // 不適切フラグのハードフィルタ（設定でONにしない限り除外）
        const flag = k['不適切フラグ'];
        if (flag && flag !== '0' && flag !== 'false' && flag !== 'FALSE') {
            if (typeof showInappropriateKanji === 'undefined' || !showInappropriateKanji) return false;
        }

        // 同じ読みが続く場合は、seenチェックをスキップ
        const isSameReading = currentPos > 0 && segments[currentPos] === segments[currentPos - 1];

        if (!isSameReading && seen && seen.has(k['漢字'])) {
            // return false; // ユーザー要望により、既読・ストック済みでも再出現させる
        }

        // ユーザー要望：戻った時に、そのターンで選んだ（ストック済み）漢字は候補に出さない
        const alreadyLiked = liked.some(l => l.slot == currentPos && l['漢字'] === k['漢字']);
        if (alreadyLiked) {
            console.log(`ENGINE: Skipping ${k['漢字']} because it is already liked at slot ${currentPos}`);
            return false;
        }

        // NOPEした漢字は出さない（最初から選び直し時にリセット）
        if (typeof noped !== 'undefined' && noped.has(k['漢字'])) {
            return false;
        }

        // 読みデータの取得（メジャー/マイナー区分）
        // 全角括弧を除去してひらがなに正規化（例: あ（かり）→ あかり）
        const majorReadings = ((k['音'] || '') + ',' + (k['訓'] || ''))
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(x => x);
        const minorReadings = (k['伝統名のり'] || '')
            .split(/[、,，\s/]+/)
            .map(x => toHira(x).replace(/[^ぁ-んー]/g, ''))
            .filter(x => x);
        const readings = [...majorReadings, ...minorReadings];

        // 読みマッチング判定
        // 優先順位：メジャー完全一致 > マイナー完全一致 > 清音化一致 > 部分一致
        // ※ ぶった切り（isPartial）は名乗りを対象外にする（音読み・訓読みのみ）
        const targetSeion = typeof toSeion === 'function' ? toSeion(target) : target;

        const isMajorExact = majorReadings.includes(target);
        const isMinorExact = minorReadings.includes(target);
        const isExact = isMajorExact || isMinorExact;
        // 清音化一致：メジャー読みのみを対象（名乗りは除外）
        const isSeionMatch = target !== targetSeion && majorReadings.includes(targetSeion);
        // 部分一致（ぶった切り）：音読み・訓読みのみ（名乗りは除外）
        const isPartial = majorReadings.some(r => r.startsWith(target)) || majorReadings.some(r => r.startsWith(targetSeion));

        if (isMajorExact) {
            k.priority = 1;      // メジャー読み完全一致（最優先）
            k.readingTier = 1;
        } else if (isMinorExact) {
            k.priority = 1;      // マイナー（名乗り）完全一致
            k.readingTier = 2;   // メジャーの後に表示
        } else if (isSeionMatch) {
            k.priority = 2;
            k.readingTier = 3;
        } else if (isPartial) {
            k.priority = 3;
            k.readingTier = 4;
        } else {
            k.priority = 0;
            k.readingTier = 99;
        }

        // ルールに応じてフィルタ (priority=1:完全一致, priority=2:連濁一致)
        return rule === 'strict' ? (k.priority === 1 || k.priority === 2) : k.priority > 0;
    });

    // 々（同じ字点）の対応
    // 条件：前の文字と同じ、または濁点・半濁点の関係にある場合
    // 例：さ⇔ざ、か⇔が、は⇔ば⇔ぱ
    if (currentPos > 0) {
        const cur = segments[currentPos];
        const prev = segments[currentPos - 1];

        if (cur === prev || isDakutenMatch(cur, prev)) {
            const prevChoices = liked.filter(item => item.slot === currentPos - 1);

            if (prevChoices.length > 0) {
                stack.push({
                    '漢字': '々',
                    '画数': prevChoices[0]['画数'],
                    '音': '',
                    '訓': '',
                    '伝統名のり': '',
                    '意味': '前の漢字を繰り返す',
                    '名前のイメージ': '【繰り返し】',
                    '分類': '【記号】',
                    priority: 1,
                    score: 999999 // Ensure it appears first
                });
            }
        }
    }

    // 性別による優先順位付け (calculateKanjiScoreで考慮)
    // stack = applyGenderFilter(stack); 

    // イメージタグによる優先順位付け
    stack = applyImageTagFilter(stack);

    // 総合スコア計算
    stack.forEach(k => {
        k.score = calculateKanjiScore(k);
        if (k.imagePriority === 1) k.score += 1500; // イメージ一致ボーナス
    });

    // 優先度でソート（メジャー/マイナー区分対応）
    stack.sort((a, b) => {
        // 々（繰り返し記号）は最優先
        if (a['漢字'] === '々') return -1;
        if (b['漢字'] === '々') return 1;

        // まず読みの優先度 (1:完全一致, 2:清音一致, 3:部分一致)
        if (a.priority !== b.priority) return a.priority - b.priority;

        // 同じpriority内でメジャー/マイナー区分（readingTier）
        const tierA = a.readingTier || 99;
        const tierB = b.readingTier || 99;
        if (tierA !== tierB) return tierA - tierB;

        // 次に総合スコア（降順）
        return b.score - a.score;
    });

    console.log(`ENGINE: Stack loaded with ${stack.length} candidates`);

    currentIdx = 0;

    if (typeof render === 'function') {
        render();
    }
}
function calculateKanjiScore(k) {
    let score = 0;

    // 性別適性スコア（基本の「おすすめ度」に加え、男女別のおすすめ度を反映）
    if (gender === 'male') {
        score = (parseInt(k['男のおすすめ度']) || parseInt(k['おすすめ度']) || 0) * 10;
    } else if (gender === 'female') {
        score = (parseInt(k['女のおすすめ度']) || parseInt(k['おすすめ度']) || 0) * 10;
    } else {
        score = (parseInt(k['おすすめ度']) || 0) * 10;
    }

    // 不適切フラグ（名前にふさわしくない）
    if (k['不適切フラグ'] && !showInappropriateKanji) {
        score -= 10000; // 大きく減点して除外
    }

    // 画数適性（6〜15画が書きやすい）
    const strokes = parseInt(k['画数']) || 0;
    if (strokes >= 6 && strokes <= 15) {
        score += 100;
    }

    // 姓名判断優先モード
    if (prioritizeFortune && surnameData && surnameData.length > 0) {
        // 簡易的な相性チェック（実装は fortune.js 参照）
        score += 50;
    }

    return score;
}

console.log("ENGINE: Module loaded");

/**
 * 性別フィルター適用
 */
function applyGenderFilter(kanjis) {
    if (!gender || gender === 'neutral') {
        // 指定なしの場合は全て同じ優先度
        kanjis.forEach(k => k.genderPriority = 1);
        return kanjis;
    }

    // キーワードマッピング
    const maleKeywords = ['力強', '剛', '勇', '雄', '男', '太', '大', '翔', '斗', '輝', '陽', '壮大', 'リーダー', '成功'];
    const femaleKeywords = ['優', '美', '麗', '花', '菜', '子', '愛', '華', '彩', '音', '里', '柔', '優しさ', '慈愛', '清らか'];

    return kanjis.map(k => {
        const img = k['名前のイメージ'] || '';
        const meaning = k['意味'] || '';
        const combined = img + meaning;

        // キーワードマッチング
        const isMale = maleKeywords.some(kw => combined.includes(kw));
        const isFemale = femaleKeywords.some(kw => combined.includes(kw));

        if (gender === 'male') {
            k.genderPriority = isMale ? 1 : (isFemale ? 3 : 2);
        } else if (gender === 'female') {
            k.genderPriority = isFemale ? 1 : (isMale ? 3 : 2);
        } else {
            k.genderPriority = 1;
        }

        return k;
    });
}

/**
 * イメージタグフィルター適用
 */
function applyImageTagFilter(kanjis) {
    // selectedImageTagsが未定義または「こだわらない」が選択されている場合
    if (typeof selectedImageTags === 'undefined' || !selectedImageTags || selectedImageTags.includes('none')) {
        kanjis.forEach(k => k.imagePriority = 1);
        return kanjis;
    }

    // 04-ui-flow.js の VIBES 配列の id → #分類 値のマッピング
    // VIBES label が #分類 値と一致するものはそのまま、ずれているものはデータ側の値も併記
    const tagKeywords = {
        'nature':       ['#自然'],
        'sky':          ['#天空'],
        'water':        ['#水景', '#海・水'],       // データ側は #海・水 の場合あり
        'color':        ['#色彩', '#花・彩'],        // データ側は #花・彩 の場合あり
        'kindness':     ['#慈愛'],
        'strength':     ['#勇壮', '#勇気'],          // データ側は #勇気 の場合あり
        'intelligence': ['#知性'],
        'soar':         ['#飛躍', '#繁栄'],          // 近いカテゴリを代替
        'happiness':    ['#幸福'],
        'beauty':       ['#品格'],
        'hope':         ['#希望', '#幸福'],          // 近いカテゴリを代替
        'belief':       ['#信念', '#心・志'],        // データ側は #心・志 の場合あり
        'harmony':      ['#調和'],
        'tradition':    ['#伝統', '#品格'],          // 近いカテゴリを代替
        'music':        ['#奏楽'],
    };

    return kanjis.map(k => {
        const category = k['分類'] || '';

        // 選択されたタグのいずれかにマッチするかチェック
        const matches = selectedImageTags.some(tagId => {
            const keywords = tagKeywords[tagId] || [];
            return keywords.some(kw => category.includes(kw));
        });

        k.imagePriority = matches ? 1 : 2;
        return k;
    });
}

console.log("ENGINE: Module loaded (v13.1 - Gender + Image Tag filters)");

/**
 * 前の文字へ戻る
 */
function prevChar() {
    if (currentPos > 0) {
        currentPos--;
        currentIdx = 0; // スタックの先頭に戻す
        swipes = 0;
        loadStack();
    } else {
        // 1文字目の場合は分割選択画面に戻る（読みモードはvibe画面なし）
        if (confirm('分割選択画面に戻りますか？\n（現在の進行状況はリセットされます）')) {
            changeScreen('scr-segment');
        }
    }
}

/**
 * 次の文字へ進む（または完了）
 */
function nextChar() {
    if (currentPos < segments.length - 1) {
        // 次のスロットへ進む前に、引き継ぎ候補のチェックとモーダル表示を行う（04-ui-flow.jsで定義）
        if (typeof checkInheritForSlot === 'function') {
            checkInheritForSlot(currentPos + 1, () => {
                currentPos++;
                currentIdx = 0;
                swipes = 0;
                loadStack();
            });
        } else {
            // 定義されていなければそのまま進む
            currentPos++;
            currentIdx = 0;
            swipes = 0;
            loadStack();
        }
    } else {
        // 最後の文字ならストック確認してビルドへ
        if (liked.length === 0) {
            if (!confirm('まだストックがありませんが、名前作成に進みますか？')) return;
        }

        if (typeof openBuild === 'function') {
            openBuild();
        } else {
            console.error("ENGINE: openBuild function not found");
        }
    }
}

// グローバル公開
window.loadStack = loadStack;
window.prevChar = prevChar;
window.nextChar = nextChar;

/**
 * 濁点・半濁点の関係かどうか判定
 */
function isDakutenMatch(a, b) {
    if (!a || !b) return false;

    // ベース文字（清音）への変換マップ
    const normalize = (char) => {
        const map = {
            'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
            'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
            'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
            'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
            'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ',
            'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
            'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'
        };
        return map[char] || char;
    };

    return normalize(a) === normalize(b);
}
