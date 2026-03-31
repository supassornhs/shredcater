import fs from 'fs';

let text = fs.readFileSync('cater_pdf_dump.txt', 'utf8');
let itemsList = [];
let lines = text.split('\n');

for (let j = 0; j < lines.length; j++) {
    let line = lines[j].trim();
    let catMatch = /(?:ENTR[ÉeÉE]E|SIDE|SAUCE|DRESSING|APPETIZER|BEVERAGE|SERVING\s*WARE):/i.exec(line);
    
    // Process only if category matches
    if (catMatch) {
        let catIndex = catMatch.index;
        let beforeCat = line.substring(0, catIndex).trim();
        let qty = 1;
        
        let foundNum = beforeCat.match(/(\d+)/);
        if (foundNum) {
            qty = parseInt(foundNum[1], 10);
        } else {
            // Search backwards up to 3 lines
            for (let b = 1; b <= 3; b++) {
                if (j - b >= 0 && /^\d+$/.test(lines[j-b].trim())) {
                    qty = parseInt(lines[j-b].trim(), 10);
                    break;
                }
            }
        }
        
        // Name is just the rest of the line, minus trailing (8 Serv.) dangling parenthesis
        let colonIndex = line.indexOf(':', catIndex);
        let rawName = line.substring(colonIndex + 1).trim();
        let cleanName = rawName.replace(/\(\d*\s*Serv\.\)/i, '').replace(/\(\d*$/i, '').trim();
        
        itemsList.push({ Item_Name: cleanName, Item_Amount: qty, Item_Total: 0 });
    }
}

fs.writeFileSync('cater_items_dump_clean.json', JSON.stringify(itemsList, null, 2));
