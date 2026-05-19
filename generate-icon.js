// Generate apple-touch-icon.png — a 180x180 pink-purple icon with a star
const zlib = require('zlib');
const fs = require('fs');

const SIZE = 180;
const BG_R = 0xE8, BG_G = 0x91, BG_B = 0xA0; // pink #E891A0
const STAR_R = 0xFF, STAR_G = 0xFF, STAR_B = 0xFF; // white star

function dist(cx, cy, x, y) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

// Star path test: rough 5-pointed star centered at (cx, cy) with radius r
function inStar(cx, cy, r, x, y) {
  const dx = x - cx, dy = y - cy;
  const angle = Math.atan2(dy, dx) + Math.PI / 2; // rotate so top point is up
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  const normDist = distFromCenter / r;
  if (normDist > 1.2) return false;

  // 5-pointed star: outer radius r, inner radius ~0.4r
  const outerR = r;
  const innerR = r * 0.38;
  const points = 5;
  const anglePerPoint = (2 * Math.PI) / points;
  const halfAngle = anglePerPoint / 2;

  // Find which "segment" the angle is in
  let a = ((angle % anglePerPoint) + anglePerPoint) % anglePerPoint;
  if (a > halfAngle) a = anglePerPoint - a;

  // Interpolate radius based on how close to the point vs valley
  const t = a / halfAngle;
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

const rawData = Buffer.alloc(SIZE * SIZE * 4 + SIZE); // +SIZE for filter bytes

for (let py = 0; py < SIZE; py++) {
  const rowOffset = py * (SIZE * 4 + 1);
  rawData[rowOffset] = 0; // filter: none

  for (let px = 0; px < SIZE; px++) {
    const pixelOffset = rowOffset + 1 + px * 4;

    // Background: rounded rectangle (slightly smaller than canvas)
    const inBg = inRoundedRect(SIZE/2, SIZE/2, SIZE - 8, SIZE - 8, 36, px, py);

    // Star in center
    const inStarResult = inStar(SIZE/2, SIZE/2 - 2, 48, px, py);

    let r = BG_R, g = BG_G, b = BG_B, a = 255;

    if (!inBg) {
      // Transparent outside rounded rect
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
  // CRC-32 lookup table
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

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);  // width
ihdr.writeUInt32BE(SIZE, 4);  // height
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type: RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

// Compress raw data
const compressed = zlib.deflateSync(rawData);

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync('img/apple-touch-icon.png', png);
console.log('Generated apple-touch-icon.png (' + png.length + ' bytes)');
