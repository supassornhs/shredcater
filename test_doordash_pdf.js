import fs from 'fs';
import pdf from 'pdf-parse';

const pdfFile = 'C:\\Users\\User\\Downloads\\HolyShred Mail - New Catering Order for Monica Y - ebe4261d.pdf';

async function parse() {
    try {
        let dataBuffer = fs.readFileSync(pdfFile);
        let data = await pdf(dataBuffer);
        fs.writeFileSync('C:\\Users\\User\\Desktop\\ShredCater\\doordash_dump.txt', data.text, 'utf8');
        console.log("✅ PDF Successfully extracted to doordash_dump.txt!");
    } catch(err) {
        console.log("❌ Error reading PDF:", err);
    } finally {
        process.exit(0);
    }
}
parse();
