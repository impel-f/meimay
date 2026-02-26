const fs = require('fs');
const strokeData = require('./public/data/stroke_data.json');
const kanjiData = require('./public/data/kanji_data.json');

// Fake core.js logic for testing updateSurnameData
let surnameData = [];
function updateSurnameData(str) {
    const chars = str.split('');
    surnameData = chars.map(c => {
        const found = kanjiData.find(k => k['漢字'] === c);
        let strokes = 0;
        if (strokeData[c]) {
            strokes = strokeData[c];
        } else if (found) {
            strokes = parseInt(found['画数']) || 0;
        }
        return {
            kanji: c,
            strokes: strokes
        };
    });
}

// Test 齋藤 (Saito) - 齋 is not in Jinmei, 藤 is.
updateSurnameData('齋藤');
console.log("Surname data for 齋藤:", surnameData);

// Fake engine.js logic for testing calculateKanjiScore
let gender = 'male';
let prioritizeFortune = false;
function calculateKanjiScore(k) {
    let score = 0;
    if (gender === 'male') {
        score = (parseInt(k['男のおすすめ度']) || parseInt(k['おすすめ度']) || 0) * 10;
    } else if (gender === 'female') {
        score = (parseInt(k['女のおすすめ度']) || parseInt(k['おすすめ度']) || 0) * 10;
    } else {
        score = (parseInt(k['おすすめ度']) || 0) * 10;
    }

    if (k['不適切フラグ']) {
        score -= 10000;
    }

    const strokes = parseInt(k['画数']) || 0;
    if (strokes >= 6 && strokes <= 15) {
        score += 100;
    }
    return score;
}

// Test top characters for 'male'
const sortedKanjiMale = [...kanjiData].map(k => ({ ...k, score: calculateKanjiScore(k) })).sort((a, b) => b.score - a.score);
console.log("Top 3 Kanji for male:", sortedKanjiMale.slice(0, 3).map(k => `${k['漢字']} (Score: ${k.score}, MaleRec: ${k['男のおすすめ度']})`));

gender = 'female';
const sortedKanjiFemale = [...kanjiData].map(k => ({ ...k, score: calculateKanjiScore(k) })).sort((a, b) => b.score - a.score);
console.log("Top 3 Kanji for female:", sortedKanjiFemale.slice(0, 3).map(k => `${k['漢字']} (Score: ${k.score}, FemaleRec: ${k['女のおすすめ度']})`));

