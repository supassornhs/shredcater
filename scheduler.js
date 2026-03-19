import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function runSync() {
  console.log(`\n========================================`);
  console.log(`⏰ [${new Date().toLocaleString()}] Starting Hourly Sync Cycle...`);
  console.log(`========================================`);

  try {
    console.log("➡️ Running Platform Scraper (index.js)...");
    const { stdout: stdoutPlat, stderr: stderrPlat } = await execPromise('node index.js');
    console.log(stdoutPlat);
    if (stderrPlat) console.error(stderrPlat);

    console.log("➡️ Running Email API Sync (email_sync.js)...");
    const { stdout: stdoutEmail, stderr: stderrEmail } = await execPromise('node email_sync.js');
    console.log(stdoutEmail);
    if (stderrEmail) console.error(stderrEmail);

    console.log(`✅ [${new Date().toLocaleString()}] Sync Cycle Finished Successfully.`);
  } catch (err) {
    console.error(`❌ Sync Cycle Error:`, err);
  }
}

// Run immediately on start
runSync();

// Then run every 1 hour (3600000 milliseconds)
const ONE_HOUR_MS = 60 * 60 * 1000;
setInterval(runSync, ONE_HOUR_MS);

console.log("🚀 ShredCater Scheduler is active. Operations will sync every 1 hour.");
