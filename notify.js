/**
 * 🔔 ShredCater Notification System
 * 
 * Sends email alerts when platform tokens expire.
 * Uses a Firebase cooldown to avoid spamming (max 1 email per platform per 6 hours).
 */
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const ALERT_RECIPIENT = 'supassorn@holyshred.co';
const COOLDOWN_HOURS = 6; // Don't re-send for the same platform within this window

// Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

/**
 * Check if we're within the cooldown window for a given platform.
 * Returns true if we should SKIP sending (i.e., already notified recently).
 */
async function isOnCooldown(db, platform) {
  try {
    const ref = db.collection('notifications').doc(`${platform}_token_expired`);
    const snap = await ref.get();
    if (!snap.exists) return false;

    const data = snap.data();
    if (!data.last_sent) return false;

    const lastSent = data.last_sent.toDate ? data.last_sent.toDate() : new Date(data.last_sent);
    const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
    return hoursSince < COOLDOWN_HOURS;
  } catch (err) {
    console.error('⚠️ Cooldown check error:', err.message);
    return false; // If we can't check, better to send than not
  }
}

/**
 * Record that we just sent a notification for this platform.
 */
async function markNotificationSent(db, platform, admin) {
  try {
    await db.collection('notifications').doc(`${platform}_token_expired`).set({
      platform,
      last_sent: admin.firestore.FieldValue.serverTimestamp(),
      type: 'token_expired',
    });
  } catch (err) {
    console.error('⚠️ Failed to record notification timestamp:', err.message);
  }
}

/**
 * Send a token expiry alert email.
 * 
 * @param {object} db - Firestore database instance
 * @param {object} admin - Firebase admin instance (for FieldValue)
 * @param {string} platform - Platform name (e.g. "ClubFeast", "Cater2.me")
 * @param {string} [dashboardUrl] - Optional link to the dashboard for quick action
 */
export async function sendTokenExpiryAlert(db, admin, platform, dashboardUrl) {
  // Cooldown guard — don't spam
  const onCooldown = await isOnCooldown(db, platform.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (onCooldown) {
    console.log(`📧 Token expiry alert for ${platform} skipped (already notified within ${COOLDOWN_HOURS}h).`);
    return false;
  }

  const subject = `🚨 ${platform} Token Expired — Action Required`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0d0d0d; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #222;">
      
      <div style="background: linear-gradient(135deg, #ff3131, #cc0000); padding: 32px 28px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
          ⚠️ Token Expired
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">
          Your <strong>${platform}</strong> session token has expired and the scraper cannot pull new orders.
        </p>
      </div>

      <div style="padding: 28px;">
        <p style="color: #999; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          The automated scraper attempted to connect to <strong style="color: #fff;">${platform}</strong> 
          but was redirected to the login page. Until the token is refreshed, 
          <strong style="color: #ff3131;">new orders will not sync</strong> to your dashboard.
        </p>

        <div style="background: #161616; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #ff3131;">
            How to Fix
          </h3>
          <ol style="margin: 0; padding-left: 18px; color: #ccc; font-size: 13px; line-height: 1.8;">
            <li>Open <a href="${platform === 'ClubFeast' ? 'https://restaurant.clubfeast.com' : '#'}" style="color: #ff6b6b; text-decoration: none;">${platform}</a> in your browser and log in</li>
            <li>Open DevTools → Application → Cookies</li>
            <li>Copy the <code style="background: #222; padding: 2px 6px; border-radius: 4px; font-size: 12px;">token</code> cookie value</li>
            <li>Go to your <strong>Dashboard → Platform Connections</strong></li>
            <li>Click <strong>"Update Cookie Token"</strong> for ${platform}</li>
            <li>Paste the new token and save</li>
          </ol>
        </div>

        ${dashboardUrl ? `
        <a href="${dashboardUrl}" 
           style="display: block; text-align: center; background: #ff3131; color: #fff; font-weight: 700; font-size: 14px; 
                  padding: 14px; border-radius: 10px; text-decoration: none; letter-spacing: 0.3px;">
          Open Dashboard →
        </a>` : ''}
      </div>

      <div style="padding: 16px 28px; border-top: 1px solid #1a1a1a; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #555;">
          ShredCater Auto-Notification · This alert won't repeat for ${COOLDOWN_HOURS} hours
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ShredCater Alert" <${process.env.EMAIL_USER}>`,
      to: ALERT_RECIPIENT,
      subject,
      html,
    });

    // Record cooldown
    await markNotificationSent(db, platform.toLowerCase().replace(/[^a-z0-9]/g, ''), admin);
    console.log(`📧 Token expiry alert sent to ${ALERT_RECIPIENT} for ${platform}.`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send token expiry email for ${platform}:`, err.message);
    return false;
  }
}
