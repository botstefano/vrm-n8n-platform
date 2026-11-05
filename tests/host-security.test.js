import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicIp, normalizeScanHost, resolvePublicHost } from '../server/host-security.js';

test('rejects private, loopback, link-local, documentation and multicast IPv4 ranges', () => {
  for (const ip of ['10.0.0.1','127.0.0.1','169.254.1.1','172.16.0.1','192.168.1.1','192.0.2.1','198.51.100.1','203.0.113.1','224.0.0.1']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test('allows routable IPv4 and global IPv6 while rejecting local IPv6', () => {
  assert.equal(isPublicIp('1.1.1.1'), true);
  assert.equal(isPublicIp('8.8.8.8'), true);
  assert.equal(isPublicIp('2606:4700:4700::1111'), true);
  assert.equal(isPublicIp('::1'), false);
  assert.equal(isPublicIp('fc00::1'), false);
  assert.equal(isPublicIp('fe80::1'), false);
  assert.equal(isPublicIp('2001:db8::1'), false);
});

test('normalizes ordinary hostnames and rejects local or URL-injection forms', () => {
  assert.equal(normalizeScanHost('https://WWW.Example.com/'), 'www.example.com');
  assert.throws(() => normalizeScanHost('http://localhost'));
  assert.throws(() => normalizeScanHost('https://example.com/path'));
  assert.throws(() => normalizeScanHost('https://user:pass@example.com'));
});

test('accepts public IPv6 literals without triggering a DNS lookup', async () => {
  assert.equal(normalizeScanHost('2606:4700:4700::1111'), '2606:4700:4700::1111');
  const result = await resolvePublicHost('2606:4700:4700::1111', async () => {
    throw new Error('literal IP should not trigger DNS');
  });
  assert.equal(result.ok, true);
  assert.equal(result.family, 6);
  assert.equal(result.ip, '2606:4700:4700::1111');
});

test('resolves a hostname and prefers a validated IPv4 address', async () => {
  const result = await resolvePublicHost('example.com', async () => [
    { address: '2606:4700:4700::1111', family: 6 },
    { address: '1.1.1.1', family: 4 }
  ]);
  assert.deepEqual(result, { ok: true, host: 'example.com', ip: '1.1.1.1', family: 4 });
});

test('rejects a mixed public/private DNS response to prevent DNS rebinding', async () => {
  const result = await resolvePublicHost('example.com', async () => [
    { address: '1.1.1.1', family: 4 },
    { address: '192.168.1.20', family: 4 }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'private_or_reserved');
});

test('does not call DNS for local hostnames', async () => {
  let lookupCalled = false;
  const result = await resolvePublicHost('internal.example.local', async () => {
    lookupCalled = true;
    return [{ address: '1.1.1.1', family: 4 }];
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'local_host');
  assert.equal(lookupCalled, false);
});
