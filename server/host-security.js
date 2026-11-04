import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';

const blockedV4 = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]) blockedV4.addSubnet(network, prefix, 'ipv4');

const globalV6 = new net.BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new net.BlockList();
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
  ['3fff::', 20], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
]) blockedV6.addSubnet(network, prefix, 'ipv6');

export function isPublicIp(ip) {
  const family = net.isIP(String(ip || ''));
  if (family === 4) return !blockedV4.check(ip, 'ipv4');
  if (family === 6) return globalV6.check(ip, 'ipv6') && !blockedV6.check(ip, 'ipv6');
  return false;
}

export function normalizeScanHost(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 253 || /[\s\u0000-\u001f]/.test(raw)) throw new Error('invalid_host');
  let parsed;
  try { parsed = new URL(raw.includes('://') ? raw : 'https://' + raw); }
  catch { throw new Error('invalid_host'); }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!host || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('invalid_host');
  }
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.test)$/i.test(host)) {
    throw new Error('local_host');
  }
  if (net.isIP(host) === 0 && (!host.includes('.') || host.startsWith('.') || host.includes('..'))) {
    throw new Error('invalid_host');
  }
  return host;
}

export async function resolvePublicHost(value, lookup = dnsLookup) {
  let host;
  try { host = normalizeScanHost(value); }
  catch (error) {
    return { ok: false, host: String(value || ''), reason: error.message === 'local_host' ? 'local_host' : 'invalid_host' };
  }

  try {
    const addresses = net.isIP(host)
      ? [{ address: host, family: net.isIP(host) }]
      : await lookup(host, { all: true, verbatim: true });
    if (!Array.isArray(addresses) || addresses.length === 0) return { ok: false, host, reason: 'dns_resolution_failed' };
    if (addresses.some((entry) => !isPublicIp(entry.address))) return { ok: false, host, reason: 'private_or_reserved' };
    const selected = addresses.find((entry) => entry.family === 4) || addresses[0];
    return { ok: true, host, ip: selected.address, family: selected.family };
  } catch {
    return { ok: false, host, reason: 'dns_resolution_failed' };
  }
}
