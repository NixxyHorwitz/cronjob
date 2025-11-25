const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Storage untuk cronjob (dalam memory)
let cronJobs = {};
let cronLogs = [];
const MAX_LOGS = 50;

// HTML Template
const htmlTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cronjob Manager</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }
        input[type="text"], input[type="number"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus, input[type="number"]:focus {
            outline: none;
            border-color: #667eea;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-stop {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            margin-left: 10px;
        }
        .status {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        .status h2 {
            color: #333;
            margin-bottom: 15px;
        }
        .job-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #667eea;
        }
        .job-item strong {
            color: #667eea;
        }
        .logs {
            background: #1e1e1e;
            color: #00ff00;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        .log-entry {
            margin-bottom: 5px;
            padding: 5px;
            border-bottom: 1px solid #333;
        }
        .log-time {
            color: #888;
        }
        .log-success {
            color: #00ff00;
        }
        .log-error {
            color: #ff4444;
        }
        .log-info {
            color: #44aaff;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Cronjob Manager</h1>
            <p>Kelola cronjob Anda dengan mudah</p>
        </div>
        <div class="content">
            <form id="cronForm">
                <div class="form-group">
                    <label for="url">Target URL:</label>
                    <input type="text" id="url" name="url" placeholder="https://example.com/api/endpoint" required>
                </div>
                <div class="form-group">
                    <label for="interval">Interval (detik):</label>
                    <input type="number" id="interval" name="interval" min="1" placeholder="60" required>
                </div>
                <div class="form-group">
                    <label for="jobName">Nama Job (opsional):</label>
                    <input type="text" id="jobName" name="jobName" placeholder="My Cronjob">
                </div>
                <button type="submit" class="btn">🚀 Mulai Cronjob</button>
                <button type="button" class="btn btn-stop" onclick="stopAllJobs()">⏹️ Stop Semua</button>
            </form>

            <div class="status">
                <h2>📊 Status Cronjob</h2>
                <div id="jobStatus">Tidak ada cronjob yang berjalan</div>
            </div>

            <div class="status">
                <h2>📝 Console Logs</h2>
                <div class="logs" id="logs">
                    <div class="log-entry log-info">Menunggu cronjob dimulai...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function addLog(message, type = 'info') {
            const logsDiv = document.getElementById('logs');
            const time = new Date().toLocaleTimeString('id-ID');
            const logClass = 'log-' + type;
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry ' + logClass;
            logEntry.innerHTML = '<span class="log-time">[' + time + ']</span> ' + message;
            logsDiv.insertBefore(logEntry, logsDiv.firstChild);
        }

        document.getElementById('cronForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                url: document.getElementById('url').value,
                interval: parseInt(document.getElementById('interval').value),
                jobName: document.getElementById('jobName').value || 'Job-' + Date.now()
            };

            try {
                const response = await fetch('/api/start-cron', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const data = await response.json();
                addLog('✅ ' + data.message, 'success');
                updateStatus();
            } catch (error) {
                addLog('❌ Error: ' + error.message, 'error');
            }
        });

        async function stopAllJobs() {
            try {
                const response = await fetch('/api/stop-all', { method: 'POST' });
                const data = await response.json();
                addLog('🛑 ' + data.message, 'info');
                updateStatus();
            } catch (error) {
                addLog('❌ Error: ' + error.message, 'error');
            }
        }

        async function updateStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                const statusDiv = document.getElementById('jobStatus');
                
                if (data.jobs.length === 0) {
                    statusDiv.innerHTML = 'Tidak ada cronjob yang berjalan';
                } else {
                    statusDiv.innerHTML = data.jobs.map(job => 
                        '<div class="job-item">' +
                        '<strong>' + job.name + '</strong><br>' +
                        'URL: ' + job.url + '<br>' +
                        'Interval: ' + job.interval + ' detik<br>' +
                        'Eksekusi: ' + job.executions + ' kali' +
                        '</div>'
                    ).join('');
                }
            } catch (error) {
                addLog('❌ Error updating status: ' + error.message, 'error');
            }
        }

        async function fetchLogs() {
            try {
                const response = await fetch('/api/logs');
                const data = await response.json();
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = data.logs.map(log => 
                    '<div class="log-entry log-' + log.type + '">' +
                    '<span class="log-time">[' + log.time + ']</span> ' + log.message +
                    '</div>'
                ).join('');
            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        }

        // Update status setiap 3 detik
        setInterval(updateStatus, 3000);
        setInterval(fetchLogs, 2000);
        
        // Initial load
        updateStatus();
    </script>
</body>
</html>
`;

// Fungsi untuk menambahkan log
function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString('id-ID');
  const log = {time, message, type};
  cronLogs.unshift(log);
  if (cronLogs.length > MAX_LOGS) cronLogs.pop();
  console.log(`[${time}] ${message}`);
}

// Route utama
app.get('/', (req, res) => {
  res.send(htmlTemplate);
});

// API untuk memulai cronjob
app.post('/api/start-cron', async (req, res) => {
  const {url, interval, jobName} = req.body;

  if (!url || !interval) {
    return res.status(400).json({error: 'URL dan interval harus diisi'});
  }

  const jobId = jobName || `job-${Date.now()}`;

  // Hentikan job lama jika ada
  if (cronJobs[jobId]) {
    clearInterval(cronJobs[jobId].timer);
  }

  // Fungsi untuk eksekusi cronjob
  const executeCron = async () => {
    try {
      addLog(`🔄 Menjalankan cronjob: ${jobId} ke ${url}`, 'info');
      const startTime = Date.now();

      const response = await axios.get(url, {timeout: 30000});
      const duration = Date.now() - startTime;

      cronJobs[jobId].executions++;
      addLog(`✅ Cronjob ${jobId} berhasil (${duration}ms) - Status: ${response.status}`, 'success');
    } catch (error) {
      addLog(`❌ Cronjob ${jobId} gagal: ${error.message}`, 'error');
    }
  };

  // Buat timer untuk cronjob
  const timer = setInterval(executeCron, interval * 1000);

  cronJobs[jobId] = {
    timer,
    url,
    interval,
    name: jobId,
    executions: 0,
    startedAt: new Date().toISOString(),
  };

  addLog(`🚀 Cronjob ${jobId} dimulai dengan interval ${interval} detik`, 'success');

  // Eksekusi pertama kali
  executeCron();

  res.json({
    message: `Cronjob ${jobId} berhasil dimulai`,
    jobId,
  });
});

// API untuk stop semua cronjob
app.post('/api/stop-all', (req, res) => {
  let count = 0;
  Object.keys(cronJobs).forEach(jobId => {
    clearInterval(cronJobs[jobId].timer);
    count++;
  });
  cronJobs = {};
  addLog(`🛑 Semua cronjob dihentikan (${count} job)`, 'info');
  res.json({message: `${count} cronjob berhasil dihentikan`});
});

// API untuk status cronjob
app.get('/api/status', (req, res) => {
  const jobs = Object.keys(cronJobs).map(jobId => ({
    name: cronJobs[jobId].name,
    url: cronJobs[jobId].url,
    interval: cronJobs[jobId].interval,
    executions: cronJobs[jobId].executions,
    startedAt: cronJobs[jobId].startedAt,
  }));
  res.json({jobs, total: jobs.length});
});

// API untuk logs
app.get('/api/logs', (req, res) => {
  res.json({logs: cronLogs});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
  addLog(`🚀 Server dimulai di port ${PORT}`, 'success');
});

module.exports = app;
