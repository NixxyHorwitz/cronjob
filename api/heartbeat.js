// File: api/heartbeat.js
// Deploy file ini ke folder api/ di project Vercel Anda

// In-memory storage untuk tracking heartbeats
const heartbeats = new Map();
const CHECK_INTERVAL = 60000; // 1 menit
const ALERT_COOLDOWN = 600000; // 10 menit cooldown antar alert

// Kirim notifikasi ke Telegram
async function sendTelegramNotification(botToken, userId, message) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error(`Failed to send to ${userId}:`, error.message);
    return false;
  }
}

// Check bot status dan kirim alert jika perlu
async function checkBotStatus(token, data) {
  const lastCheck = heartbeats.get(token);
  const now = Date.now();

  if (!lastCheck) {
    return;
  }

  const timeSinceLastBeat = now - lastCheck.timestamp;

  // Bot dian eeggap down jika tidak ada heartbeat > 1 menit
  if (timeSinceLastBeat > CHECK_INTERVAL && lastCheck.status !== 'down') {
    // Cek apakah sudah pernah kirim alert dalam 10 menit terakhir
    if (lastCheck.lastAlert && now - lastCheck.lastAlert < ALERT_COOLDOWN) {
      return;
    }

    console.log(`🚨 Bot down detected for token: ${token.substring(0, 8)}...`);

    // Update status
    lastCheck.status = 'down';
    lastCheck.lastAlert = now;

    // Kirim notifikasi ke semua user yang subscribe
    const downMinutes = Math.floor(timeSinceLastBeat / 60000);
    const message = `🚨 *ALERT: Bot Server Down!*\n\n` + `⚠️ Bot Telegram Cronjob telah mati\n` + `🕐 Waktu: ${new Date().toLocaleString('id-ID')}\n` + `⏱ Down sejak: ${downMinutes} menit yang lalu\n\n` + `❗️ Semua cronjob berhenti!\n` + `🔧 Silakan cek server Anda segera!`;

    const notifyUsers = lastCheck.notifyUsers || [];
    console.log(`Sending alerts to ${notifyUsers.length} users...`);

    for (const userId of notifyUsers) {
      await sendTelegramNotification(lastCheck.botToken, userId, message);
    }
  } else if (timeSinceLastBeat <= CHECK_INTERVAL && lastCheck.status === 'down') {
    // Bot kembali online
    console.log(`✅ Bot back online for token: ${token.substring(0, 8)}...`);

    lastCheck.status = 'online';

    // Kirim notifikasi recovery
    const message = `✅ *Bot Kembali Online!*\n\n` + `🎉 Bot Telegram Cronjob sudah berjalan kembali\n` + `🕐 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` + `✨ Semua cronjob aktif kembali!`;

    for (const userId of lastCheck.notifyUsers || []) {
      await sendTelegramNotification(lastCheck.botToken, userId, message);
    }
  }
}

// Main handler untuk POST request (menerima heartbeat)
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  try {
    const {token, botToken, timestamp, notifyUsers, status} = req.body;

    if (!token || !botToken) {
      return res.status(400).json({error: 'Missing required fields: token, botToken'});
    }

    const now = Date.now();

    // Update atau create heartbeat record
    const existing = heartbeats.get(token);

    heartbeats.set(token, {
      timestamp: now,
      botToken,
      notifyUsers: notifyUsers || [],
      status: status || (existing ? existing.status : 'online'),
      lastAlert: existing ? existing.lastAlert : null,
    });

    // Check status dari bot lain yang mungkin sudah down
    // (Ini akan jalan setiap kali ada heartbeat baru masuk)
    for (const [checkToken, data] of heartbeats.entries()) {
      if (checkToken !== token) {
        await checkBotStatus(checkToken, data);
      }
    }

    console.log(`💓 Heartbeat received from ${token.substring(0, 8)}... at ${new Date(now).toLocaleTimeString()}`);

    return res.status(200).json({
      success: true,
      message: 'Heartbeat recorded',
      timestamp: now,
      status: heartbeats.get(token).status,
      nextCheck: now + CHECK_INTERVAL,
    });
  } catch (error) {
    console.error('Error handling heartbeat:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Scheduled check (untuk dipanggil oleh Vercel Cron)
export async function scheduledCheck(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  console.log('🔍 Running scheduled check...');

  const now = Date.now();
  let checkedCount = 0;
  let downCount = 0;
  const results = [];

  for (const [token, data] of heartbeats.entries()) {
    checkedCount++;
    await checkBotStatus(token, data);

    const timeSinceLastBeat = now - data.timestamp;
    const isDown = data.status === 'down';

    if (isDown) {
      downCount++;
    }

    results.push({
      token: token.substring(0, 8) + '...',
      status: data.status,
      lastHeartbeat: Math.floor(timeSinceLastBeat / 1000) + 's ago',
      notifyUsers: data.notifyUsers.length,
    });
  }

  return res.status(200).json({
    success: true,
    timestamp: now,
    checked: checkedCount,
    down: downCount,
    bots: results,
  });
}
