const { exec } = require('child_process');

console.log("==================================================");
console.log("⏰ ShredCater Auto-Scraper Scheduler Started! ⏰");
console.log("==================================================");
console.log("This terminal will now automatically pull new orders every 1 hour.\n");

function runScrapers() {
    console.log(`\n[${new Date().toLocaleString()}] 🚀 Launching background scrapers...`);
    
    // Launch the clubfeast scraper
    const scraperProcess = exec('node clubfeast_scraper.js');

    scraperProcess.stdout.on('data', (data) => {
        // We only print minimal lines to keep the terminal clean
        if (data.includes('Mission Accomplished') || data.includes('Mission Pipeline initialized')) {
            console.log("   " + data.trim());
        }
    });

    scraperProcess.stderr.on('data', (data) => {
        console.error(`   🚨 Error: ${data.trim()}`);
    });

    scraperProcess.on('close', (code) => {
        console.log(`[${new Date().toLocaleString()}] ✅ Auto-Scrape complete. Sleeping for 1 hour... Zzz...`);
    });
}

// Run immediately when started
runScrapers();

// Run automatically exactly every 60 minutes (3600000 ms)
setInterval(runScrapers, 3600000);
