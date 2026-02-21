function openLegalScreen(type = 'terms') {
    changeScreen('scr-legal');
    switchLegalTab(type);
}

function switchLegalTab(type) {
    const btnTerms = document.getElementById('legal-tab-terms');
    const btnPrivacy = document.getElementById('legal-tab-privacy');
    const contentArea = document.getElementById('legal-content');

    // Reset styles
    if (type === 'terms') {
        btnTerms.className = 'flex-1 py-1.5 rounded-[10px] text-[11px] font-bold bg-[#bca37f] text-white shadow-sm transition-all';
        btnPrivacy.className = 'flex-1 py-1.5 rounded-[10px] text-[11px] font-bold bg-transparent text-[#bca37f] hover:bg-[#bca37f]/10 transition-all';
    } else {
        btnTerms.className = 'flex-1 py-1.5 rounded-[10px] text-[11px] font-bold bg-transparent text-[#bca37f] hover:bg-[#bca37f]/10 transition-all';
        btnPrivacy.className = 'flex-1 py-1.5 rounded-[10px] text-[11px] font-bold bg-[#bca37f] text-white shadow-sm transition-all';
    }

    // Set content
    if (type === 'terms') {
        contentArea.innerHTML = window.MeimayLegalDocs.termsOfService;
    } else {
        contentArea.innerHTML = window.MeimayLegalDocs.privacyPolicy;
    }

    // Scroll to top
    const scrollArea = document.getElementById('legal-scroll-area');
    if (scrollArea) {
        scrollArea.scrollTop = 0;
    }
}
