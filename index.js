const http = require('http');
const fs = require('fs');
const path = require('path');
const dnsPacket = require('dns-packet');
const dgram = require('dgram');

const { DNS_RECORDS_FILE = 'data.json' } = process.env;
const PORT = parseInt(process.env.PORT) || 3000;

let dnsRecords = {};
try {
  dnsRecords = JSON.parse(fs.readFileSync(DNS_RECORDS_FILE));
} catch (err) {
  console.error('Error reading DNS records file:', err);
}

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  try {
    const request = dnsPacket.decode(msg);
    if (request.questions.length === 1 && request.questions[0].type === 'A') {
      const question = request.questions[0];
      const domain = question.name;
      const response = dnsPacket.encode({
        type: 'response',
        id: request.id,
        flags:
          dnsPacket.RECURSION_DESIRED |
          dnsPacket.RECURSION_AVAILABLE |
          dnsPacket.AUTHORITATIVE_ANSWER,
        questions: [question],
        answers: dnsRecords[domain]
          ? [
              {
                type: 'A',
                class: 'IN',
                name: domain,
                ttl: 3600,
                data: dnsRecords[domain],
              },
            ]
          : [],
      });
      server.send(response, rinfo.port, rinfo.address);
    }
  } catch (err) {
    console.error('Error processing DNS request:', err);
  }
});

server.on('error', (err) => {
  console.error('DNS server error:', err);
});

const httpServer = http.createServer((req, res) => {
  const { method, url } = req;
  if (method === 'GET' && url === '/records') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dnsRecords));
  } else if (method === 'POST' && url === '/records') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        Object.assign(dnsRecords, data);
        fs.writeFileSync(DNS_RECORDS_FILE, JSON.stringify(dnsRecords, null, 4));
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('DNS records updated successfully');
      } catch (err) {
        console.error('Error updating DNS records:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  } else if (method === 'PUT' && url.startsWith('/records/')) {
    const domain = url.substring(9); // Remove '/records/'
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        dnsRecords[domain] = data.ipAddress;
        fs.writeFileSync(DNS_RECORDS_FILE, JSON.stringify(dnsRecords, null, 4));
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`DNS record for domain ${domain} updated successfully`);
      } catch (err) {
        console.error('Error updating DNS record:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  } else if (method === 'DELETE' && url.startsWith('/records/')) {
    const domain = url.substring(9); // Remove '/records/'
    if (dnsRecords.hasOwnProperty(domain)) {
      delete dnsRecords[domain];
      fs.writeFileSync(DNS_RECORDS_FILE, JSON.stringify(dnsRecords, null, 4));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`DNS record for domain ${domain} deleted successfully`);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('DNS record not found');
    }
  } else if (method === 'GET' && url === '/') {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

httpServer.listen(PORT, () => {
  console.log('Web UI server is running on port 3000');
});

server.bind(53, '0.0.0.0', () => {
  console.log('DNS server is running on port 53');
});
