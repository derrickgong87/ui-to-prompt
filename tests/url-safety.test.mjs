import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSafeUrl,
  createRequestGuard,
} from '../packages/core/url-safety.mjs';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('accepts an HTTP(S) URL whose DNS answers are public', async () => {
  const url = await assertSafeUrl('https://Example.COM/a/../page?q=1#hero', {
    lookup: publicLookup,
  });

  assert.equal(url.href, 'https://example.com/page?q=1#hero');
});

test('rejects protocols other than HTTP(S)', async () => {
  await assert.rejects(
    assertSafeUrl('file:///etc/passwd', { lookup: publicLookup }),
    (error) => error?.code === 'URL_PROTOCOL_NOT_ALLOWED',
  );
});

test('rejects URLs containing credentials', async () => {
  await assert.rejects(
    assertSafeUrl('https://user:secret@example.com/', { lookup: publicLookup }),
    (error) => error?.code === 'URL_CREDENTIALS_NOT_ALLOWED',
  );
});

test('rejects localhost and metadata hostnames before DNS resolution', async () => {
  const forbiddenHosts = [
    'http://localhost/',
    'http://LOCALHOST./',
    'http://api.localhost/',
    'http://metadata.google.internal/',
    'http://metadata.goog/',
    'http://instance-data.ec2.internal/',
  ];

  for (const input of forbiddenHosts) {
    await assert.rejects(
      assertSafeUrl(input, {
        lookup: async () => {
          throw new Error('DNS must not run for an explicitly forbidden hostname');
        },
      }),
      (error) => error?.code === 'URL_HOSTNAME_NOT_ALLOWED',
      input,
    );
  }
});

test('rejects loopback, private, link-local, metadata, and non-public IPv4 literals', async () => {
  const forbiddenAddresses = [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '127.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '2130706433',
    '224.0.0.1',
  ];

  for (const address of forbiddenAddresses) {
    await assert.rejects(
      assertSafeUrl(`http://${address}/`, { lookup: publicLookup }),
      (error) => error?.code === 'URL_IP_NOT_ALLOWED',
      address,
    );
  }
});

test('rejects unsafe IPv6 literals, including IPv4-mapped forms', async () => {
  const forbiddenAddresses = [
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fd00:ec2::254',
    'fe80::1',
    'ff02::1',
  ];

  for (const address of forbiddenAddresses) {
    await assert.rejects(
      assertSafeUrl(`http://[${address}]/`, { lookup: publicLookup }),
      (error) => error?.code === 'URL_IP_NOT_ALLOWED',
      address,
    );
  }
});

test('accepts public IPv4 and IPv6 literals without delegating their safety to DNS', async () => {
  const failIfCalled = async () => {
    throw new Error('DNS must not run for IP literals');
  };

  assert.equal(
    (await assertSafeUrl('https://93.184.216.34/', { lookup: failIfCalled })).hostname,
    '93.184.216.34',
  );
  assert.equal(
    (
      await assertSafeUrl('https://[2606:4700:4700::1111]/', {
        lookup: failIfCalled,
      })
    ).hostname,
    '[2606:4700:4700::1111]',
  );
});

test('rejects a hostname if any DNS answer is unsafe', async () => {
  await assert.rejects(
    assertSafeUrl('https://public.example/', {
      lookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ],
    }),
    (error) => error?.code === 'URL_DNS_ADDRESS_NOT_ALLOWED',
  );
});

test('reports empty and failed DNS resolution precisely', async () => {
  await assert.rejects(
    assertSafeUrl('https://empty.example/', { lookup: async () => [] }),
    (error) => error?.code === 'URL_DNS_NO_ADDRESSES',
  );

  await assert.rejects(
    assertSafeUrl('https://failure.example/', {
      lookup: async () => {
        throw new Error('synthetic DNS failure');
      },
    }),
    (error) =>
      error?.code === 'URL_DNS_LOOKUP_FAILED' &&
      error?.cause?.message === 'synthetic DNS failure',
  );
});

test('request guard performs a fresh DNS safety check on every request', async () => {
  let calls = 0;
  const validateRequest = createRequestGuard({
    lookup: async () => {
      calls += 1;
      return [
        {
          address: calls === 1 ? '93.184.216.34' : '127.0.0.1',
          family: 4,
        },
      ];
    },
  });

  await validateRequest('https://rebind.example/first');
  await assert.rejects(
    validateRequest('https://rebind.example/redirect'),
    (error) => error?.code === 'URL_DNS_ADDRESS_NOT_ALLOWED',
  );
  assert.equal(calls, 2);
});
