const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

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
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
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
        .alert {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            color: #856404;
        }
        .alert strong {
            display: block;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Cronjob Manager</h1>
            <p>Client-side Cronjob Runner</p>
        </div>
        <div class="content">
            <div class="alert">
                <strong>ℹ️ Info:</strong>
                Cronjob ini berjalan di browser Anda (client-side). Tab browser harus tetap terbuka agar cronjob berjalan.
            </div>

            <form id="cronForm">
                <div class="form-group">
                    <label for="url">Target URL:</label>
                    <input type="text" id="url" name="url" placeholder="https://example.com/api/endpoint" required>
                </div>
                <div class="form-group">
                    <label for="interval">Interval (detik):</label>
                    <input type="number" id="interval" name="interval" min="1" placeholder="60" value="60" required>
                </div>
                <div class="form-group">
                    <label for="jobName">Nama Job:</label>
                    <input type="text" id="jobName" name="jobName" placeholder="My Cronjob" required>
                </div>
                <button type="submit" class="btn" id="startBtn">🚀 Mulai Cronjob</button>
                <button type="button" class="btn btn-stop" onclick="stopAllJobs()" id="stopBtn">⏹️ Stop Semua</button>
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
        let cronJobs = {};
        let logs = [];

        function addLog(message, type = 'info') {
            const logsDiv = document.getElementById('logs');
            const time = new Date().toLocaleTimeString('id-ID');
            const logClass = 'log-' + type;
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry ' + logClass;
            logEntry.innerHTML = '<span class="log-time">[' + time + ']</span> ' + message;
            logsDiv.insertBefore(logEntry, logsDiv.firstChild);
            
            logs.unshift({ time, message, type });
            if (logs.length > 50) logs.pop();
            
            console.log('[' + time + '] ' + message);
        }

        async function executeCron(jobId, url) {
            try {
                addLog('🔄 Menjalankan cronjob: ' + jobId + ' ke ' + url, 'info');
                const startTime = Date.now();
                
                const response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const data = await response.json();
                const duration = Date.now() - startTime;
                
                if (data.success) {
                    cronJobs[jobId].executions++;
                    addLog('✅ Cronjob ' + jobId + ' berhasil (' + duration + 'ms) - Status: ' + data.status, 'success');
                } else {
                    addLog('❌ Cronjob ' + jobId + ' gagal: ' + data.error, 'error');
                }
                
                updateStatus();
            } catch (error) {
                addLog('❌ Cronjob ' + jobId + ' gagal: ' + error.message, 'error');
            }
        }

        document.getElementById('cronForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const url = document.getElementById('url').value;
            const interval = parseInt(document.getElementById('interval').value);
            const jobName = document.getElementById('jobName').value || 'Job-' + Date.now();

            if (cronJobs[jobName]) {
                clearInterval(cronJobs[jobName].timer);
                addLog('⚠️ Cronjob ' + jobName + ' sudah ada, akan direstart', 'info');
            }

            const timer = setInterval(() => executeCron(jobName, url), interval * 1000);
            
            cronJobs[jobName] = {
                timer,
                url,
                interval,
                executions: 0,
                startedAt: new Date().toLocaleTimeString('id-ID')
            };

            addLog('🚀 Cronjob ' + jobName + ' dimulai dengan interval ' + interval + ' detik', 'success');
            executeCron(jobName, url);
            updateStatus();
        });

        function stopAllJobs() {
            let count = 0;
            Object.keys(cronJobs).forEach(jobId => {
                clearInterval(cronJobs[jobId].timer);
                count++;
            });
            cronJobs = {};
            addLog('🛑 Semua cronjob dihentikan (' + count + ' job)', 'info');
            updateStatus();
        }

        function updateStatus() {
            const statusDiv = document.getElementById('jobStatus');
            const jobKeys = Object.keys(cronJobs);
            
            if (jobKeys.length === 0) {
                statusDiv.innerHTML = 'Tidak ada cronjob yang berjalan';
            } else {
                statusDiv.innerHTML = jobKeys.map(jobId => {
                    const job = cronJobs[jobId];
                    return '<div class="job-item">' +
                        '<strong>' + jobId + '</strong><br>' +
                        'URL: ' + job.url + '<br>' +
                        'Interval: ' + job.interval + ' detik<br>' +
                        'Eksekusi: ' + job.executions + ' kali<br>' +
                        'Dimulai: ' + job.startedAt +
                        '</div>';
                }).join('');
            }
        }

        // Peringatan sebelum menutup tab
        window.addEventListener('beforeunload', (e) => {
            if (Object.keys(cronJobs).length > 0) {
                e.preventDefault();
                e.returnValue = '';
                return 'Cronjob masih berjalan. Yakin ingin menutup?';
            }
        });

        addLog('✅ System ready', 'success');
    </script>
</body>
</html>
`;

// Route utama
app.get('/', (req, res) => {
  res.send(htmlTemplate);
});

// API Proxy untuk bypass CORS
app.post('/api/proxy', async (req, res) => {
  const {url} = req.body;

  if (!url) {
    return res.status(400).json({success: false, error: 'URL harus diisi'});
  }

  try {
    console.log(`[${new Date().toISOString()}] Proxy request to: ${url}`);

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'GET',
      timeout: 30000,
      headers: {
        'User-Agent': 'Cronjob-Manager/1.0',
      },
    });

    const text = await response.text();
    console.log(`[${new Date().toISOString()}] Response status: ${response.status}`);

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      data: text.substring(0, 500),
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// Export untuk Vercel
module.exports = app;
