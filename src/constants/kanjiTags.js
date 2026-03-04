// src/constants/kanjiTags.js
export const KANJI_TAG_STYLES = {
    "#希望": {
        label: "希望",
        emoji: "🌟",
        bgColor: "#FEF3C7", // bg-amber-100
        textColor: "#92400E", // text-amber-900
        borderColor: "#FDE68A", // border-amber-200
    },
    "#伝統": {
        label: "伝統",
        emoji: "⛩️",
        bgColor: "#FCE7F3", // bg-pink-100
        textColor: "#9D174D", // text-pink-900
        borderColor: "#FBCFE8", // border-pink-200
    },
    "#奏楽": {
        label: "奏楽",
        emoji: "🎵",
        bgColor: "#EDE9FE", // bg-violet-100
        textColor: "#5B21B6", // text-violet-900
        borderColor: "#DDD6FE", // border-violet-200
    },
    "#自然": {
        label: "自然",
        emoji: "🌿",
        bgColor: "#DCFCE7", // bg-green-100
        textColor: "#166534", // text-green-900
        borderColor: "#BBF7D0", // border-green-200
    },
    "#品格": {
        label: "品格",
        emoji: "🕊️",
        bgColor: "#F3F4F6", // bg-gray-100
        textColor: "#374151", // text-gray-700
        borderColor: "#E5E7EB", // border-gray-200
    },
    "#飛躍": {
        label: "飛躍",
        emoji: "🦅",
        bgColor: "#E0F2FE", // bg-sky-100
        textColor: "#0369A1", // text-sky-900
        borderColor: "#BAE6FD", // border-sky-200
    },
    "#慈愛": {
        label: "慈愛",
        emoji: "💖",
        bgColor: "#FDF2F8", // bg-pink-50
        textColor: "#BE185D", // text-pink-700
        borderColor: "#FCE7F3", // border-pink-100
    },
    "#色彩": {
        label: "色彩",
        emoji: "🎨",
        bgColor: "#FFEDD5", // bg-orange-100
        textColor: "#C2410C", // text-orange-700
        borderColor: "#FED7AA", // border-orange-200
    },
    "#水景": {
        label: "水景",
        emoji: "🌊",
        bgColor: "#CFFAFE", // bg-cyan-100
        textColor: "#0F766E", // text-teal-800
        borderColor: "#A5F3FC", // border-cyan-200
    },
    "#調和": {
        label: "調和",
        emoji: "🤝",
        bgColor: "#CCFBF1", // bg-teal-100
        textColor: "#0F766E", // text-teal-800
        borderColor: "#99F6E4", // border-teal-200
    },
    "#信念": {
        label: "信念",
        emoji: "⛰️",
        bgColor: "#E2E8F0", // bg-slate-200
        textColor: "#334155", // text-slate-700
        borderColor: "#CBD5E1", // border-slate-300
    },
    "#勇壮": {
        label: "勇壮",
        emoji: "🦁",
        bgColor: "#FEE2E2", // bg-red-100
        textColor: "#B91C1C", // text-red-700
        borderColor: "#FECACA", // border-red-200
    },
    "#天空": {
        label: "天空",
        emoji: "🌌",
        bgColor: "#DBEAFE", // bg-blue-100
        textColor: "#1E40AF", // text-blue-800
        borderColor: "#BFDBFE", // border-blue-200
    },
    "#知性": {
        label: "知性",
        emoji: "🎓",
        bgColor: "#E0E7FF", // bg-indigo-100
        textColor: "#4338CA", // text-indigo-700
        borderColor: "#C7D2FE", // border-indigo-200
    },
    "#幸福": {
        label: "幸福",
        emoji: "🍀",
        bgColor: "#D1FAE5", // bg-emerald-100
        textColor: "#047857", // text-emerald-800
        borderColor: "#A7F3D0", // border-emerald-200
    },
};

export const getTagStyle = (tag) => {
    // Extract just the valid tag part in case multiple tags are joined or missing #
    const key = tag.startsWith("#") ? tag : "#" + tag;
    const match = Object.keys(KANJI_TAG_STYLES).find((k) => key.includes(k));

    if (match) {
        return KANJI_TAG_STYLES[match];
    }

    // Minimal fallback gray styling for unmapped tags
    return {
        label: tag.replace("#", ""),
        emoji: "✨",
        bgColor: "#F3F4F6",
        textColor: "#4B5563",
        borderColor: "#E5E7EB",
    };
};
