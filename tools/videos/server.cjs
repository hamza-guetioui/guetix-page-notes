const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, 'sites');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/svg+xml' };
http.createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0];
  if (host === 'guetix.com' || host === 'www.guetix.com') {
    const p = http.request({ host: '127.0.0.1', port: +(process.env.SITE_PORT || 3100), path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:' + (process.env.SITE_PORT || 3100) } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end(); });
    return req.pipe(p);
  }
  let u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let f = path.join(ROOT, host, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, host, 'index.html');
  if (u.endsWith('favicon.ico')) f = path.join(ROOT, host, 'favicon.svg');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(80, () => console.log('up'));
