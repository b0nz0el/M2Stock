import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, renderFn) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = renderFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);

    return Buffer.concat([len, typeAndData, crc]);
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function renderAquaStockIcon(x, y, width, height) {
  // Normalize to 100x100 space
  const nx = (x / width) * 100;
  const ny = (y / height) * 100;

  // Background rounded rect: [10, 10, 80, 80], rx=22
  const rx = 22;
  const left = 10, right = 90, top = 10, bottom = 90;

  let insideRect = false;
  if (nx >= left && nx <= right && ny >= top && ny <= bottom) {
    const dx = Math.max(left + rx - nx, 0, nx - (right - rx));
    const dy = Math.max(top + rx - ny, 0, ny - (bottom - rx));
    if (dx * dx + dy * dy <= rx * rx) {
      insideRect = true;
    }
  }

  if (!insideRect) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Linear gradient: #32ADE6 (50, 173, 230) to #0088CC (0, 136, 204)
  const t = (nx + ny) / 200;
  const bgR = Math.round(50 * (1 - t) + 0 * t);
  const bgG = Math.round(173 * (1 - t) + 136 * t);
  const bgB = Math.round(230 * (1 - t) + 204 * t);

  // White dot: cx=50, cy=72, r=3.5
  const dDotSq = (nx - 50) * (nx - 50) + (ny - 72) * (ny - 72);
  if (dDotSq <= 3.5 * 3.5) {
    return [255, 255, 255, 255];
  }

  // A-glyph outer triangle: peak (50, 26), bottom-left (32, 66), bottom-right (68, 66)
  // Inner triangle hole: (50, 42), (45, 53), (55, 53)
  // Leg bottom cutouts:
  // Left leg: polygon (50, 26) -> (32, 66) -> (38, 66) -> (42, 58) -> (58, 58) -> (62, 66) -> (68, 66) -> (50, 26)
  // Check if point is inside polygon
  const aPoly = [
    [50, 26], [32, 66], [38, 66], [42, 58], [58, 58], [62, 66], [68, 66]
  ];
  const hole = [
    [50, 42], [45, 53], [55, 53]
  ];

  function pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > pt[1]) !== (yj > pt[1]))
          && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const inA = pointInPoly([nx, ny], aPoly);
  const inHole = pointInPoly([nx, ny], hole);

  if (inA && !inHole) {
    return [255, 255, 255, 255]; // White glyph
  }

  return [bgR, bgG, bgB, 255];
}

const outDir = path.resolve('public/assets/images/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const buf = createPng(size, size, renderAquaStockIcon);
  const target = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(target, buf);
  console.log(`Wrote ${target} (${buf.length} bytes)`);
}
