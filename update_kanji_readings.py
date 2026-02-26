import re
import pykakasi
import json

kks = pykakasi.kakasi()

def get_hira(text):
    result = kks.convert(text)
    return ''.join(r['hira'] for r in result)

try:
    with open('public/js/data/todays-kanji-data.js', 'r', encoding='utf-8') as f:
        content = f.read()

    start_idx = content.find('{')
    end_idx = content.rfind('}') + 1
    js_obj = content[start_idx:end_idx]

    lines = []
    for line in js_obj.split('\n'):
        line = line.split('//')[0]
        lines.append(line)
    clean_js = '\n'.join(lines)
    
    data = {}
    for m in re.finditer(r'\"(\d{2}-\d{2})\"\s*:\s*\{\s*\"kanji\":\s*\"(.*?)\",\s*\"person\":\s*\"(.*?)\"', clean_js):
        date, kanji, person = m.groups()
        data[date] = {'kanji': kanji, 'person': person}

    with open('public/data/kanji_data.json', 'r', encoding='utf-8') as f:
        master_json = json.load(f)
    
    kanji_readings = {}
    for k in master_json:
        r = []
        for key in ['音', '訓', '伝統名のり']:
            if key in k and k[key] and k[key] != 'ー':
                parts = re.split(r'[,、・\/]+', k[key])
                r.extend(parts)
        clean_r = []
        for x in r:
            x = x.strip().split('（')[0]
            x = ''.join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in x])
            if x: clean_r.append(x)
        
        # Sort by length descending
        clean_r.sort(key=len, reverse=True)
        kanji_readings[k['漢字']] = list(dict.fromkeys(clean_r)) # keep order, remove dups

    hit_count = 0
    for date, info in data.items():
        kanji = info['kanji']
        person_name = info['person'].split('（')[0].strip().replace(' ', '').replace('　', '')
        hira_name = get_hira(person_name)
        
        reading = ""
        possible_readings = kanji_readings.get(kanji, [])
        if possible_readings:
            reading = possible_readings[0]
            for pr in possible_readings:
                if pr in hira_name:
                    reading = pr
                    hit_count += 1
                    break
        
        info['reading'] = reading

    print(f"Matched {hit_count}/{len(data)} exactly.")

    out_json = json.dumps(data, ensure_ascii=False, indent=2)
    new_content = 'const TodaysKanjiData = ' + out_json + ';\n'
    with open('public/js/data/todays-kanji-data.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('done')
except Exception as e:
    import traceback
    traceback.print_exc()
