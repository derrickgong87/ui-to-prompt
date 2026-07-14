const ALLOWED_MIME_TYPES = new Map([
  ['image/png', 'PNG'],
  ['image/jpeg', 'JPEG'],
  ['image/webp', 'WebP'],
]);

function invalidImage(mimeType) {
  const label = ALLOWED_MIME_TYPES.get(mimeType) ?? 'PNG, JPEG, or WebP';
  return Object.assign(new Error(`image must be a valid ${label} file.`), { status: 400 });
}

function decodeBase64(value, maxBytes) {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error('image.base64 is required.'), { status: 400 });
  }
  const normalized = value.trim();
  const maxEncodedBytes = Math.ceil(maxBytes / 3) * 4;
  if (normalized.length > maxEncodedBytes || normalized.length % 4 !== 0) {
    throw Object.assign(new Error(`image exceeds the ${maxBytes}-byte limit.`), { status: 413 });
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (!bytes.length || bytes.toString('base64') !== normalized) {
    throw Object.assign(new Error('image.base64 must be canonical base64.'), { status: 400 });
  }
  if (bytes.length > maxBytes) {
    throw Object.assign(new Error(`image exceeds the ${maxBytes}-byte limit.`), { status: 413 });
  }
  return bytes;
}

function jpegDimensions(bytes) {
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (startOfFrame.has(marker) && length >= 7) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3), format: 'jpeg' };
    }
    offset += length;
  }
  return undefined;
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      format: 'webp',
    };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f && bytes.length >= 25) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      format: 'webp',
    };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
      format: 'webp',
    };
  }
  return undefined;
}

function dimensionsFor(bytes) {
  if (
    bytes.length >= 24
    && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.readUInt32BE(8) === 13
    && bytes.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

export function validateImageInput(image, {
  maxBytes = 8 * 1024 * 1024,
  maxPixels = 20_000_000,
} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer.');
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1) throw new TypeError('maxPixels must be a positive integer.');
  if (image === null || typeof image !== 'object' || Array.isArray(image)) {
    throw Object.assign(new Error('image is required.'), { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(image.mimeType)) {
    throw Object.assign(new Error('image.mimeType must be image/png, image/jpeg, or image/webp.'), { status: 400 });
  }

  const bytes = decodeBase64(image.base64, maxBytes);
  const dimensions = dimensionsFor(bytes);
  const expectedFormat = image.mimeType.slice('image/'.length).replace('jpeg', 'jpeg');
  if (!dimensions || dimensions.format !== expectedFormat || !dimensions.width || !dimensions.height) {
    throw invalidImage(image.mimeType);
  }
  const pixels = dimensions.width * dimensions.height;
  if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
    throw Object.assign(new Error(`image exceeds the ${maxPixels}-pixel limit.`), { status: 413 });
  }

  return Object.freeze({
    base64: image.base64.trim(),
    mimeType: image.mimeType,
    bytes: bytes.length,
    width: dimensions.width,
    height: dimensions.height,
    pixels,
  });
}
