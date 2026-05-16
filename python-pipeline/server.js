const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

app.post('/enrich', (req, res) => {
  const { name, websiteUrl, companyId } = req.body;

  if (!name || !companyId) {
    return res.status(400).json({ success: false, message: 'name and companyId required' });
  }

  console.log(`\n🔬 ENRICHMENT REQUEST: ${name} (ID: ${companyId})`);

  const args = [
    '-m', 'enrichment.enrich_company',
    '--name', name,
    '--company_id', companyId,
  ];
  if (websiteUrl) args.push('--website', websiteUrl);

  const proc = spawn('python', args, {
    cwd: __dirname,
    env: { ...process.env, PYTHONPATH: __dirname, PYTHONIOENCODING: 'utf-8' },
    timeout: 300000,
  });

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    process.stdout.write(text);
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    process.stderr.write(text);
  });

  proc.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ Enrichment complete for ${name}`);
      res.json({ success: true, message: `Enrichment complete for ${name}` });
    } else {
      console.error(`❌ Enrichment failed for ${name} (exit code ${code})`);
      res.status(500).json({ success: false, message: `Pipeline error (exit ${code})`, stderr });
    }
  });

  proc.on('error', (err) => {
    console.error(`❌ Spawn error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  });
});

app.post('/freshness', (req, res) => {
  console.log(`\n🔄 FRESHNESS ENGINE REQUEST`);

  const proc = spawn('python', [
    path.join(__dirname, 'enrichment', 'freshness_engine.py'),
  ], {
    cwd: __dirname,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    timeout: 600000,
  });

  let stdout = '';
  proc.stdout.on('data', (data) => { stdout += data.toString(); process.stdout.write(data.toString()); });
  proc.stderr.on('data', (data) => { process.stderr.write(data.toString()); });

  proc.on('close', (code) => {
    res.json({ success: code === 0, message: code === 0 ? 'Freshness check complete' : 'Freshness check failed', output: stdout });
  });
});

app.post('/ingest', (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ success: false, message: 'rawText required' });

  console.log(`\n📋 INGESTION REQUEST (Raw Text Parsing)`);

  const proc = spawn('python', [
    '-m', 'enrichment.ingest_parser',
    '--text', rawText
  ], {
    cwd: __dirname,
    env: { ...process.env, PYTHONPATH: __dirname, PYTHONIOENCODING: 'utf-8' },
  });

  let stdout = '';
  proc.stdout.on('data', (data) => { stdout += data.toString(); });
  proc.on('close', (code) => {
    try {
      const parsed = JSON.parse(stdout);
      res.json({ success: code === 0, data: parsed });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Parsing failed', error: e.message });
    }
  });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`🐍 Python Pipeline Bridge running on port ${PORT}`);
});
