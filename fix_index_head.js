const fs = require('fs');

const css = `
<!-- KANJI CLASSIFICATION TAGS (DYNAMIC STYLES) -->
<style>
    .tag-hope{background-color:#FEF3C7 !important;color:#92400E !important;border-color:#FDE68A !important;}
    .tag-tradition{background-color:#FCE7F3 !important;color:#9D174D !important;border-color:#FBCFE8 !important;}
    .tag-music{background-color:#EDE9FE !important;color:#5B21B6 !important;border-color:#DDD6FE !important;}
    .tag-nature{background-color:#DCFCE7 !important;color:#166534 !important;border-color:#BBF7D0 !important;}
    .tag-dignity{background-color:#F3F4F6 !important;color:#374151 !important;border-color:#E5E7EB !important;}
    .tag-leap{background-color:#E0F2FE !important;color:#0369A1 !important;border-color:#BAE6FD !important;}
    .tag-affection{background-color:#FDF2F8 !important;color:#BE185D !important;border-color:#FCE7F3 !important;}
    .tag-colors{background-color:#FFEDD5 !important;color:#C2410C !important;border-color:#FED7AA !important;}
    .tag-aquatic{background-color:#CFFAFE !important;color:#0F766E !important;border-color:#A5F3FC !important;}
    .tag-harmony{background-color:#CCFBF1 !important;color:#0F766E !important;border-color:#99F6E4 !important;}
    .tag-conviction{background-color:#E2E8F0 !important;color:#334155 !important;border-color:#CBD5E1 !important;}
    .tag-bravery{background-color:#FEE2E2 !important;color:#B91C1C !important;border-color:#FECACA !important;}
    .tag-sky{background-color:#DBEAFE !important;color:#1E40AF !important;border-color:#BFDBFE !important;}
    .tag-intelligence{background-color:#E0E7FF !important;color:#4338CA !important;border-color:#C7D2FE !important;}
    .tag-fortune{background-color:#D1FAE5 !important;color:#047857 !important;border-color:#A7F3D0 !important;}
    .kanji-tag{border-width:1px !important;border-style:solid !important;padding:2px 8px !important;border-radius:9999px !important;font-weight:bold !important;font-size:0.75rem !important;display:inline-flex !important;align-items:center !important;gap:4px !important;box-shadow:0 1px 2px rgba(0,0,0,0.05) !important;}
</style>`;

try {
    let content = fs.readFileSync('index_head.html', 'utf16le');
    if (!content.includes('KANJI CLASSIFICATION TAGS (DYNAMIC STYLES)')) {
        content = content.replace('</head>', css + '\n</head>');
    }
    fs.writeFileSync('index_head_utf8.html', content, 'utf8');
    console.log('Successfully recreated index_head_utf8.html.');
} catch (e) {
    console.error(e);
}
