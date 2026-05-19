// Generate apple-touch-icon.png — white bg with ✶ (light purple 4-pointed sparkle star)
const zlib = require('zlib');
const fs = require('fs');

const SIZE = 180;
const BG_R = 0xFF, BG_G = 0xFF, BG_B = 0xFF; // white
const STAR_R = 0xC7, STAR_G = 0x7D, STAR_B = 0xBA; // light purple #C77DBA

// ✶ shape: 4 stretched ellipses (N/S/E/W arms) + center dot
function inSparkleStar(cx, cy, r, x, y) {
  const dx = x - cx, dy = y - cy;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  // Center dot
  const dotR = r * 0.12;
  if (distFromCenter <= dotR) return true;

  const armLen = r * 0.72;
  const armHalfW = r * 0.085;

  // Horizontal arm (E-W)
  if (Math.abs(dy) <= armHalfW + 1 && Math.abs(dx) <= armLen) {
    const ex = dx / armLen;
    const ey = dy / armHalfW;
    if (ex * ex + ey * ey <= 1) return true;
  }

  // Vertical arm (N-S)
  if (Math.abs(dx) <= armHalfW + 1 && Math.abs(dy) <= armLen) {
    const ex = dx / armHalfW;
    const ey = dy / armLen;
    if (ex * ex + ey * ey <= 1) return true;
  }

  // Diagonal inner fill: soften the intersection
  if (distFromCenter <= r * 0.16) return true;

  return false;
}

// Rounded rect
function inRoundedRect(cx, cy, w, h, r, x, y) {
  const hw = w / 2, hh = h / 2;
  const rx = Math.max(Math.abs(x - cx) - hw + r, 0);
  const ry = Math.max(Math.abs(y - cy) - hh + r, 0);
  return rx * rx + ry * ry <= r * r;
}

const rawData = Buffer.alloc(SIZE * SIZE * 4 + SIZE);

for (let py = 0; py < SIZE; py++) {
  const rowOffset = py * (SIZE * 4 + 1);
  rawData[rowOffset] = 0; // filter: none

  for (let px = 0; px < SIZE; px++) {
    const pixelOffset = rowOffset + 1 + px * 4;

    const inBg = inRoundedRect(SIZE/2, SIZE/2, SIZE - 8, SIZE - 8, 36, px, py);
    const inStar = inSparkleStar(SIZE/2, SIZE/2, 52, px, py);

    let r = BG_R, g = BG_G, b = BG_B, a = 255;

    if (!inBg) {
      a = 0;
    } else if (inStar) {
      r = STAR_R; g = STAR_G; b = STAR_B;
    }

    rawData[pixelOffset] = r;
    rawData[pixelOffset + 1] = g;
    rawData[pixelOffset + 2] = b;
    rawData[pixelOffset + 3] = a;
  }
}

// PNG builder
function crc32(buf) {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const compressed = zlib.deflateSync(rawData);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('img/apple-touch-icon.png', png);
console.log('Generated apple-touch-icon.png (' + png.length + ' bytes)');
