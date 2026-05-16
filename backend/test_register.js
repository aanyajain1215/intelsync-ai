const http = require('http');

// Test 1: Register new user
function testRegister(cb) {
  const body = JSON.stringify({
    name: 'Test Staff',
    email: 'teststaff_' + Date.now() + '@sepc.in',
    password: 'Test@1234',
    designation: 'Analyst',
    role: 'staff'
  });

  const opts = {
    hostname: 'localhost', port: 5000,
    path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  const req = http.request(opts, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('\n=== REGISTER TEST ===');
      console.log('Status:', res.statusCode);
      try {
        const parsed = JSON.parse(data);
        console.log('Success:', parsed.success);
        console.log('Message:', parsed.message || '(none)');
        if (parsed.data?.user) console.log('User created:', parsed.data.user.email, '| role:', parsed.data.user.role);
        if (parsed.data?.token) console.log('Token received: YES');
      } catch(e) {
        console.log('Raw response:', data);
      }
      cb && cb();
    });
  });
  req.on('error', e => {
    console.log('\n❌ CANNOT REACH BACKEND at port 5000!');
    console.log('Error:', e.message);
    console.log('\n👉 Make sure backend is running: cd backend && node index.js');
  });
  req.write(body);
  req.end();
}

// Test 2: Duplicate email
function testDuplicate() {
  const body = JSON.stringify({
    name: 'Admin Dupe',
    email: 'admin@sepc.in',  // already exists
    password: 'Admin@SEPC2026',
    role: 'staff'
  });

  const opts = {
    hostname: 'localhost', port: 5000,
    path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  const req = http.request(opts, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('\n=== DUPLICATE EMAIL TEST ===');
      console.log('Status:', res.statusCode, '(400 expected for duplicate)');
      const parsed = JSON.parse(data);
      console.log('Message:', parsed.message);
    });
  });
  req.on('error', e => console.log('Error:', e.message));
  req.write(body);
  req.end();
}

testRegister(() => setTimeout(testDuplicate, 500));
