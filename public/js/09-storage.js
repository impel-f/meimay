/* ============================================================
   MODULE 09: STORAGE (V13.0)
   LocalStorage永続化
   ============================================================ */

const StorageBox = {
    KEY_LIKED: 'naming_app_liked_chars',
    KEY_SAVED: 'naming_app_saved_names',
    KEY_SURNAME: 'naming_app_surname',
    KEY_SEGMENTS: 'naming_app_segments',
    KEY_SETTINGS: 'naming_app_settings',
    KEY_KANJI_AI_CACHE: 'naming_app_kanji_ai_cache',

    /**
     * 全状態を保存
     */
    saveAll: function() {
        try {
            localStorage.setItem(this.KEY_LIKED, JSON.stringify(liked));
            localStorage.setItem(this.KEY_SAVED, JSON.stringify(savedNames));
            localStorage.setItem(this.KEY_SURNAME, JSON.stringify({
                str: surnameStr,
                data: surnameData
            }));
            localStorage.setItem(this.KEY_SEGMENTS, JSON.stringify(segments));
            localStorage.setItem(this.KEY_SETTINGS, JSON.stringify({
                gender: gender,
                rule: rule,
                prioritizeFortune: prioritizeFortune
            }));
            
            console.log("STORAGE: State saved successfully");
            return true;
        } catch (e) {
            console.error("STORAGE: Save failed", e);
            return false;
        }
    },

    /**
     * 全状態を復元
     */
    loadAll: function() {
        try {
            // いいねした漢字
            const l = localStorage.getItem(this.KEY_LIKED);
            if (l) liked = JSON.parse(l);
            
            // 保存済み名前
            const s = localStorage.getItem(this.KEY_SAVED);
            if (s) savedNames = JSON.parse(s);
            
            // 名字
            const n = localStorage.getItem(this.KEY_SURNAME);
            if (n) {
                const parsedN = JSON.parse(n);
                surnameStr = parsedN.str || "";
                surnameData = parsedN.data || [];
                
                // UIに反映
                const input = document.getElementById('in-surname');
                if (input && surnameStr) {
                    input.value = surnameStr;
                }
            }
            
            // セグメント
            const seg = localStorage.getItem(this.KEY_SEGMENTS);
            if (seg) segments = JSON.parse(seg);
            
            // 設定
            const settings = localStorage.getItem(this.KEY_SETTINGS);
            if (settings) {
                const parsed = JSON.parse(settings);
                gender = parsed.gender || 'neutral';
                rule = parsed.rule || 'strict';
                prioritizeFortune = parsed.prioritizeFortune || false;
                
                // UIに反映
                if (typeof setGender === 'function') setGender(gender);
                if (typeof setRule === 'function') setRule(rule);
                
                const fortuneBtn = document.getElementById('btn-fortune');
                if (fortuneBtn && prioritizeFortune) {
                    fortuneBtn.classList.add('active');
                }
            }
            
            console.log("STORAGE: State restored successfully");
            console.log(`  - Liked: ${liked.length} items`);
            console.log(`  - Saved: ${savedNames.length} names`);
            console.log(`  - Surname: ${surnameStr || '(none)'}`);
            
            return true;
        } catch (e) {
            console.error("STORAGE: Load failed", e);
            return false;
        }
    },

    /**
     * 特定データの保存
     */
    saveLiked: function() {
        try {
            localStorage.setItem(this.KEY_LIKED, JSON.stringify(liked));
            return true;
        } catch (e) {
            console.error("STORAGE: Save liked failed", e);
            return false;
        }
    },

    saveSavedNames: function() {
        try {
            localStorage.setItem(this.KEY_SAVED, JSON.stringify(savedNames));
            return true;
        } catch (e) {
            console.error("STORAGE: Save savedNames failed", e);
            return false;
        }
    },

    saveKanjiAiCache: function(kanji, text) {
        try {
            const raw = localStorage.getItem(this.KEY_KANJI_AI_CACHE);
            const cache = raw ? JSON.parse(raw) : {};
            cache[kanji] = { text, savedAt: new Date().toISOString() };
            localStorage.setItem(this.KEY_KANJI_AI_CACHE, JSON.stringify(cache));
        } catch (e) {
            console.error("STORAGE: kanji AI cache save failed", e);
        }
    },

    getKanjiAiCache: function(kanji) {
        try {
            const raw = localStorage.getItem(this.KEY_KANJI_AI_CACHE);
            if (!raw) return null;
            const cache = JSON.parse(raw);
            return cache[kanji] || null;
        } catch (e) {
            return null;
        }
    },

    /**
     * データ完全リセット
     */
    clearAll: function() {
        if (confirm("全てのデータをリセットしますか？\n（保存した名前・ストックが削除されます）")) {
            localStorage.clear();
            console.log("STORAGE: All data cleared");
            location.reload();
        }
    },

    /**
     * エクスポート（将来的な機能）
     */
    exportData: function() {
        const data = {
            liked: liked,
            savedNames: savedNames,
            surname: { str: surnameStr, data: surnameData },
            segments: segments,
            settings: { gender, rule, prioritizeFortune },
            exportDate: new Date().toISOString()
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `meimay-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        console.log("STORAGE: Data exported");
    },

    /**
     * インポート（将来的な機能）
     */
    importData: function(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                liked = data.liked || [];
                savedNames = data.savedNames || [];
                surnameStr = data.surname?.str || "";
                surnameData = data.surname?.data || [];
                segments = data.segments || [];
                
                if (data.settings) {
                    gender = data.settings.gender || 'neutral';
                    rule = data.settings.rule || 'strict';
                    prioritizeFortune = data.settings.prioritizeFortune || false;
                }
                
                this.saveAll();
                alert('データをインポートしました');
                location.reload();
                
                console.log("STORAGE: Data imported");
            } catch (err) {
                console.error("STORAGE: Import failed", err);
                alert('インポートに失敗しました');
            }
        };
        reader.readAsText(file);
    }
};

/**
 * 名前を保存
 */
function saveName() {
    if (!currentBuildResult || !currentBuildResult.fullName) {
        alert('保存する名前が選択されていません');
        return;
    }
    
    // 重複チェック
    const exists = savedNames.some(n => n.fullName === currentBuildResult.fullName);
    if (exists) {
        if (!confirm('この名前は既に保存されています。\n上書きしますか？')) {
            return;
        }
        // 既存のものを削除
        savedNames = savedNames.filter(n => n.fullName !== currentBuildResult.fullName);
    }
    
    // 保存
    savedNames.push({
        ...currentBuildResult,
        savedAt: new Date().toISOString()
    });
    
    if (StorageBox.saveSavedNames()) {
        alert('✅ 名前を保存しました！');
        console.log(`STORAGE: Saved name "${currentBuildResult.fullName}"`);
    } else {
        alert('❌ 保存に失敗しました');
    }
}

// 定期的な自動保存（30秒ごと）
setInterval(() => {
    if (liked.length > 0 || savedNames.length > 0) {
        StorageBox.saveAll();
    }
}, 30000);

// ページ離脱時に保存
window.addEventListener('beforeunload', () => {
    StorageBox.saveAll();
});

/**
 * 夫婦シェア機能
 * データをJSON文字列としてエクスポート/インポート
 */
function shareData() {
    const data = {
        liked: liked.map(l => ({ '漢字': l['漢字'], '画数': l['画数'], slot: l.slot, sessionReading: l.sessionReading })),
        savedNames: getSavedNames ? getSavedNames() : savedNames,
        exportDate: new Date().toISOString(),
        version: 'meimay-share-v1'
    };

    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));

    // クリップボードにコピー
    const shareText = `meimay://${encoded}`;

    if (navigator.share) {
        navigator.share({
            title: 'メイメー - 名前候補を共有',
            text: `パートナーから名前候補が届きました！\nアプリで「データを受け取る」からこのテキストを貼り付けてください。`,
            url: ''
        }).catch(() => {
            copyShareToClipboard(shareText);
        });
    } else {
        copyShareToClipboard(shareText);
    }
}

function copyShareToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('共有データをコピーしました！\nパートナーに送って「データを受け取る」から貼り付けてもらってください。');
    }).catch(() => {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('共有データをコピーしました！');
    });
}

function receiveSharedData() {
    const input = prompt('パートナーから受け取ったデータを貼り付けてください：');
    if (!input) return;

    try {
        let json;
        if (input.startsWith('meimay://')) {
            const encoded = input.replace('meimay://', '');
            json = decodeURIComponent(escape(atob(encoded)));
        } else {
            json = input;
        }

        const data = JSON.parse(json);

        if (data.version !== 'meimay-share-v1') {
            alert('データ形式が正しくありません');
            return;
        }

        // 確認
        const likedCount = data.liked ? data.liked.length : 0;
        const savedCount = data.savedNames ? data.savedNames.length : 0;

        if (!confirm(`パートナーのデータを読み込みます：\n・ストック漢字：${likedCount}件\n・保存済み名前：${savedCount}件\n\n既存のデータとマージしますか？`)) {
            return;
        }

        // マージ（重複は除外）
        if (data.liked) {
            data.liked.forEach(item => {
                // masterから完全データを取得
                const full = master.find(k => k['漢字'] === item['漢字']);
                if (full) {
                    const exists = liked.some(l => l['漢字'] === item['漢字'] && l.slot === item.slot);
                    if (!exists) {
                        liked.push({ ...full, slot: item.slot || -1, sessionReading: item.sessionReading || 'SHARED' });
                    }
                }
            });
        }

        if (data.savedNames) {
            const existing = typeof getSavedNames === 'function' ? getSavedNames() : [];
            data.savedNames.forEach(name => {
                const exists = existing.some(n => n.fullName === name.fullName);
                if (!exists) {
                    existing.push(name);
                }
            });
            localStorage.setItem('meimay_saved', JSON.stringify(existing));
        }

        StorageBox.saveLiked();
        alert('データを読み込みました！');

    } catch (e) {
        console.error("SHARE: Import failed", e);
        alert('データの読み込みに失敗しました。\nコピーしたテキストが正しいか確認してください。');
    }
}

window.shareData = shareData;
window.receiveSharedData = receiveSharedData;

console.log("STORAGE: Module loaded (with sharing)");
