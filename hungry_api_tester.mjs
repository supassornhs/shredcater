import fetch from 'node-fetch';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.HUNGRY_COOKIE;

let endpoints = [
    "https://api.tryhungry.com/chef-dashboard?start=03/01/2026&end=04/01/2026",
    "https://api.tryhungry.com/v1/chef-dashboard?start=03/01/2026&end=04/01/2026",
    "https://api.tryhungry.com/v2/chef-dashboard?start=03/01/2026&end=04/01/2026",
    "https://api.tryhungry.com/chef/dashboard?start=03/01/2026&end=04/01/2026",
    "https://api.tryhungry.com/api/chef-dashboard?start=03/01/2026&end=04/01/2026",
    "https://api.tryhungry.com/api/v1/chef-dashboard?start=03/01/2026&end=04/01/2026",
    "https://chefs.tryhungry.com/api/chef-dashboard?start=03/01/2026&end=04/01/2026"
];

(async () => {
    for (let ep of endpoints) {
        console.log("Testing: " + ep);
        try {
            const response = await fetch(ep, {
                headers: {
                    "Authorization": token,
                    "Accept": "application/json"
                }
            });
            console.log("Status:", response.status);
            if (response.status === 200 || response.status === 201) {
                let text = await response.text();
                console.log("SUCCESS length:", text.length);
                import('fs').then(fs => fs.writeFileSync('hungry_api_dump.json', text));
                return;
            }
        } catch(e) {}
    }
})();
