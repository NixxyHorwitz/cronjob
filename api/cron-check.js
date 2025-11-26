// File: api/cron-check.js
// Deploy file ini ke folder api/ di project Vercel Anda
// File ini akan dipanggil oleh Vercel Cron setiap 1 menit

const {checkBotStatus, heartbeats} = require('./heartbeat.js');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET', 'POST'],
    });
  }

  try {
    console.log('🔍 Running scheduled check...');

    const now = Date.now();
    let checkedCount = 0;
    let downCount = 0;
    const results = [];

    // Loop semua bot yang terdaftar
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

    console.log(`✅ Check complete: ${checkedCount} bots, ${downCount} down`);

    return res.status(200).json({
      success: true,
      timestamp: now,
      checked: checkedCount,
      down: downCount,
      bots: results,
    });
  } catch (error) {
    console.error('❌ Cron check error:', error);
    return res.status(500).json({
      error: 'Cron check failed',
      message: error.message,
      timestamp: Date.now(),
    });
  }
};
