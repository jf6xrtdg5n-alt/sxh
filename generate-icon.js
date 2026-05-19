// Generate apple-touch-icon.png — white bg with light purple 4-pointed star
const zlib = require('zlib');
const fs = require('fs');

const SIZE = 180;
const BG_R = 0xFF, BG_G = 0xFF, BG_B = 0xFF; // white
const STAR_R = 0xC7, STAR_G = 0x7D, STAR_B = 0xBA; // light purple #C77DBA

// 4-pointed sparkle star centered at (cx, cy) with radius r
// Points at 45°, 135°, 225°, 315° (diagonal cross / sparkle shape)
function inSparkle(cx, cy, r, x, y) {
  const dx = x - cx, dy = y - cy;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  if (distFromCenter > r * 1.05) return false;
  if (distFromCenter < r * 0.06) return true; // tiny solid center

  // Rotate by 45° so points are on axes, then check 4-pointed star
  // 4-pointed star: narrow in one axis, wide in the perpendicular
  const angle = Math.atan2(dy, dx) + Math.PI / 4; // rotate 45° so points are diagonal
  const absAngle = Math.abs(angle);

  // 4-pointed: each point spans PI/4, valleys between them at PI/2 intervals
  const halfPeriod = Math.PI / 2;
  let a = ((absAngle % halfPeriod) + halfPeriod) % halfPeriod; // 0 to PI/2

  // At a=0 (axis direction): full radius
  // At a=PI/4 (diagonal, halfway between axes): inner radius
  const outerR = r;
  const innerR = r * 0.15;
  const t = a / (Math.PI / 4); // 0 at axis, 1 at diagonal
  const maxR = outerR * (1 - t) + innerR * t;

  return distFromCenter <= maxR;
}

// Rounded rect: check if pixel is inside rounded rectangle
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
    const inStarResult = inSparkle(SIZE/2, SIZE/2 - 2, 52, px, py);

    let r = BG_R, g = BG_G, b = BG_B, a = 255;

    if (!inBg) {
      a = 0;
    } else if (inStarResult) {
      r = STAR_R; g = STAR_G; b = STAR_B;
    }

    rawData[pixelOffset] = r;
    rawData[pixelOffset + 1] = g;
    rawData[pixelOffset + 2] = b;
    rawData[pixelOffset + 3] = a;
  }
}

// Build PNG
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
