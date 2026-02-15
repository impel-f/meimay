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

console.log("STORAGE: Module loaded");
