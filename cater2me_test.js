const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('cater2me_order.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('cater2me_dump.txt', data.text);
    console.log("PDF text extracted to cater2me_dump.txt");
}).catch(function(err) {
    console.error("Error reading PDF:", err);
});
