import fs from 'fs';

const text = fs.readFileSync('cater2me_dump.txt', 'utf8');

let contactMatch = text.match(/CONTACT:\s*(.+)/);
let companyMatch = text.match(/COMPANY:\s*(.+)/);
let contact = contactMatch ? contactMatch[1].trim() : "";
let company = companyMatch ? companyMatch[1].trim() : "";
let customerName = `${contact} (${company})`.trim();
if (customerName === "()") customerName = "Unknown Client";

let setupTimeMatch = text.match(/Set-Up Completed By:\s*(.+)/);
let setupTime = setupTimeMatch ? setupTimeMatch[1].trim() : "";

let addressMatch = text.match(/ADDRESS:([\s\S]+?)DELIVERY INSTRUCTIONS:/);
let addressArr = addressMatch ? addressMatch[1].trim().split('\n').map(l=>l.trim()).filter(l=>l) : [];
let address = addressArr.join(', ');

let instructionsMatch = text.match(/DELIVERY INSTRUCTIONS:([\s\S]+?)Order Instructions/);
if (!instructionsMatch) instructionsMatch = text.match(/DELIVERY INSTRUCTIONS:([\s\S]+?)Scheduled Order/);

let instructions = instructionsMatch ? instructionsMatch[1].trim().replace(/\n/g, ' ') : "";

console.log("Customer: ", customerName);
console.log("Setup Time: ", setupTime);
console.log("Address: ", address);
console.log("Instructions: ", instructions);
