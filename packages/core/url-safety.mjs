import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UrlSafetyError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'UrlSafetyError';
    this.code = code;
  }
}

const defaultLookup = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

const FORBIDDEN_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data.ec2.internal',
];

const IPV4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV6_RANGES = [
  ['::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

function ipv4ToInteger(address) {
  return address
    .split('.')
    .reduce((value, part) => (value << 8n) | BigInt(Number(part)), 0n);
}

function expandEmbeddedIpv4(address) {
  if (!address.includes('.')) return address;
  const lastColon = address.lastIndexOf(':');
  const integer = ipv4ToInteger(address.slice(lastColon + 1));
  return `${address.slice(0, lastColon)}:${(integer >> 16n).toString(16)}:${(
    integer & 0xffffn
  ).toString(16)}`;
}

function ipv6ToInteger(input) {
  const address = expandEmbeddedIpv4(input.toLowerCase());
  const halves = address.split('::');
  if (halves.length > 2) throw new Error('Invalid IPv6 address');

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const omitted = 8 - left.length - right.length;
  const groups =
    halves.length === 2
      ? [...left, ...Array(omitted).fill('0'), ...right]
      : left;

  if (groups.length !== 8) throw new Error('Invalid IPv6 address');
  return groups.reduce(
    (value, group) => (value << 16n) | BigInt(`0x${group || '0'}`),
    0n,
  );
}

function isInRange(value, base, prefix, bits) {
  const shift = BigInt(bits - prefix);
  return value >> shift === base >> shift;
}

function isBlockedIpv4(address) {
  const value = ipv4ToInteger(address);
  return IPV4_RANGES.some(([base, prefix]) =>
    isInRange(value, ipv4ToInteger(base), prefix, 32),
  );
}

function isBlockedIpv6(address) {
  const value = ipv6ToInteger(address);

  // IPv4-mapped IPv6 is deliberately reduced to the embedded address so that
  // an alternate spelling cannot bypass the IPv4 policy.
  const mappedBase = ipv6ToInteger('::ffff:0:0');
  if (isInRange(value, mappedBase, 96, 128)) {
    const embedded = [24n, 16n, 8n, 0n]
      .map((shift) => Number((value >> shift) & 0xffn))
      .join('.');
    return isBlockedIpv4(embedded);
  }

  return IPV6_RANGES.some(([base, prefix]) =>
    isInRange(value, ipv6ToInteger(base), prefix, 128),
  );
}

export function isBlockedIp(input) {
  const address = String(input).replace(/^\[|\]$/g, '');
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

function isForbiddenHostname(hostname) {
  const canonical = hostname.toLowerCase().replace(/\.+$/, '');
  return FORBIDDEN_HOSTNAMES.some(
    (forbidden) =>
      canonical === forbidden || canonical.endsWith(`.${forbidden}`),
  );
}

function normalizeDnsAnswers(result) {
  const answers = Array.isArray(result) ? result : [result];
  return answers
    .map((answer) => (typeof answer === 'string' ? answer : answer?.address))
    .filter(Boolean);
}

export async function assertSafeUrl(input, { lookup = defaultLookup } = {}) {
  let url;
  try {
    url = new URL(input);
  } catch (cause) {
    throw new UrlSafetyError('URL_INVALID', 'URL must be an absolute HTTP(S) URL.', {
      cause,
    });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlSafetyError(
      'URL_PROTOCOL_NOT_ALLOWED',
      'Only HTTP(S) URLs are allowed.',
    );
  }

  if (url.username || url.password) {
    throw new UrlSafetyError(
      'URL_CREDENTIALS_NOT_ALLOWED',
      'URLs containing credentials are not allowed.',
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isForbiddenHostname(hostname)) {
    throw new UrlSafetyError(
      'URL_HOSTNAME_NOT_ALLOWED',
      `Hostname is not allowed: ${hostname}`,
    );
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new UrlSafetyError(
        'URL_IP_NOT_ALLOWED',
        `IP address is not publicly routable: ${hostname}`,
      );
    }
    return url;
  }

  let result;
  try {
    result = await lookup(hostname, { all: true, verbatim: true });
  } catch (cause) {
    throw new UrlSafetyError(
      'URL_DNS_LOOKUP_FAILED',
      `DNS lookup failed for ${hostname}.`,
      { cause },
    );
  }

  const addresses = normalizeDnsAnswers(result);
  if (addresses.length === 0) {
    throw new UrlSafetyError(
      'URL_DNS_NO_ADDRESSES',
      `DNS lookup returned no addresses for ${hostname}.`,
    );
  }

  for (const address of addresses) {
    if (!isIP(address)) {
      throw new UrlSafetyError(
        'URL_DNS_INVALID_ADDRESS',
        `DNS lookup returned an invalid address for ${hostname}.`,
      );
    }
    if (isBlockedIp(address)) {
      throw new UrlSafetyError(
        'URL_DNS_ADDRESS_NOT_ALLOWED',
        `DNS for ${hostname} resolved to a non-public address.`,
      );
    }
  }

  return url;
}

export function createRequestGuard(options) {
  return (input) => assertSafeUrl(input, options);
}
