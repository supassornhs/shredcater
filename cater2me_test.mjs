import fs from 'fs';
import { PDFExtract } from 'pdf.js-extract';

const extract = new PDFExtract();

extract.extract('cater2me_order.pdf', {}).then(data => {
    let text = "";
    data.pages.forEach(page => {
        let lastY = -1;
        page.content.forEach(item => {
            if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
                text += "\n";
            }
            text += item.str + " ";
            lastY = item.y;
        });
        text += "\n";
    });
    fs.writeFileSync('cater2me_dump.txt', text);
    console.log("Extracted successfully!");
}).catch(e => console.log(e));
