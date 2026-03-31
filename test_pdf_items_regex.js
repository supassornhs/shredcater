import fs from 'fs';

let text = fs.readFileSync('cater_pdf_dump.txt', 'utf8');

// Regex to capture multiline:
// 1. Quantity: (\d+)
// 2. Category: ENTRÉE:|SIDE:|SAUCE:|DRESSING: ...
// 3. Name: The following text up to (X Serv.)
// Wait, the newlines might break `.` so use `[\s\S]`
// Let's iterate using a while loop over a global regex
let itemRegex = /(\d+)\s*\n+(?:ENTR[Ée]E|SIDE|SAUCE|DRESSING|APPETIZER|BEVERAGE):\s*([\s\S]+?)\(\d*\s*Serv\.\)\s*\n+\d+\s*of\s*\d+/gi;
let results = [];
let match;
while ((match = itemRegex.exec(text)) !== null) {
    let qty = parseInt(match[1].trim(), 10);
    // Replace newlines inside the name with spaces
    let rawName = match[2].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    results.push({ Qty: qty, Name: rawName });
}

console.log(results);
