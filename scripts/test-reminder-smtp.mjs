import net from 'node:net';
import assert from 'node:assert/strict';

if (process.env.NODE_ENV === 'production') throw new Error('Do not run SMTP fixture in production');
const messages = [];
const sockets = new Set();
let rejectRecipient = false;
const server = net.createServer(socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.write('220 localhost SMTP fixture\r\n');
  let buffer = '', data = false, message = '';
  socket.on('data', chunk => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 2);
      if (data) {
        if (line === '.') { messages.push(message); message = ''; data = false; socket.write('250 accepted\r\n'); }
        else message += line + '\r\n';
      } else if (/^DATA$/i.test(line)) { data = true; socket.write('354 send data\r\n'); }
      else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
      else if (/^RCPT TO:/i.test(line) && rejectRecipient) socket.write('550 rejected by fixture\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  // Override every SMTP setting: this test can only hand mail to its own loopback fixture.
  Object.assign(process.env, { NODE_ENV: 'test', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASSWORD: '', MAIL_FROM: 'Test <test@example.test>', APP_ORIGIN: 'https://example.test' });
  const { Mailer } = await import('../dist-server/mailer.js');
  const mailer = new Mailer();
  for (const language of ['ru', 'kk', 'en']) await mailer.sendReminder('learner@example.test', language, `fixture-${language}`);
  assert.equal(messages.length, 3);
  for (const message of messages) {
    assert.ok(message.includes('To: learner@example.test'));
    const separator = message.indexOf('\r\n\r\n');
    const headers = message.slice(0, separator);
    const body = message.slice(separator + 4);
    const decoded = /Content-Transfer-Encoding: base64/i.test(headers)
      ? Buffer.from(body, 'base64').toString('utf8')
      : body.replace(/=\r\n/g, '').replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    assert.ok(decoded.includes('https://example.test/#/profile'));
    assert.ok(message.includes('Message-ID: <reminder-fixture-'));
  }
  rejectRecipient = true;
  await assert.rejects(() => mailer.sendReminder('learner@example.test', 'en', 'rejected'));
  assert.equal(messages.length, 3);
  console.log('Local SMTP fixture accepted 3 localized reminders; rejected recipient propagates failure. No external email sent.');
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
