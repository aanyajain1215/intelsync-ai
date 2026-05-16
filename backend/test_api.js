const http = require('http');

const body = JSON.stringify({ email: 'admin@sepc.in', password: 'Admin@SEPC2026' });

const opts = {
  hostname: 'localhost', port: 5000, path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = http.request(opts, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    if (parsed.success) {
      console.log('✅ LOGIN OK  — role:', parsed.data.user.role, '| token:', parsed.data.token.slice(0,30) + '...');
    } else {
      console.log('❌ LOGIN FAILED:', parsed.message);
    }
  });
});
req.on('error', e => console.log('❌ Connection error:', e.message));
req.write(body);
req.end();
