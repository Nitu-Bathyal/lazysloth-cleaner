const fs = require('fs');
const http = require('http');

const fileBuffer = fs.readFileSync('assets/mascot/Whimsical Sloth Broom Wizard.png');
const boundary = '----WebKitFormBoundary1234567890';
const header = Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="Whimsical Sloth Broom Wizard.png"\r\n` +
  `Content-Type: image/png\r\n\r\n`
);
const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
const payload = Buffer.concat([header, fileBuffer, footer]);

const req = http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/classify',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': payload.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Response Body:', JSON.stringify(JSON.parse(body), null, 2));
  });
});

req.on('error', console.error);
req.write(payload);
req.end();
