import fs from 'fs';
import { PDFExtract } from 'pdf.js-extract';

const extract = new PDFExtract();

(async () => {
    try {
        const data = await extract.extract('remote_test.pdf', {});
        let text = "";
        data.pages.forEach(page => {
            let lastY = -1;
            page.content.forEach(item => {
                if (lastY !== -1 && Math.abs(item.y - lastY) > 5) text += "\n";
                text += item.str + " ";
                lastY = item.y;
            });
            text += "\n";
        });
        
        // Debug
        fs.writeFileSync('remote_test_dump.txt', text);
        console.log("PDF generated! Length: " + text.length);
    } catch(e) {
        console.log(e);
    }
})();
