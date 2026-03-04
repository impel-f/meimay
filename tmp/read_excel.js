const xlsx = require('xlsx');
const wb = xlsx.readFile('読み方リスト.xlsx');
wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet: ${name}`);
    console.log(data.slice(0, 5));
});
