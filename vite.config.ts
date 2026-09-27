import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {build as viteBuild, defineConfig, Plugin} from 'vite';
import zlib from 'zlib';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Generates a minimal, Chrome-compatible 8-bit RGBA PNG containing ONLY IHDR, IDAT, and IEND chunks.
 */
function generateMinimalIconPng(size: number): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type (6)
  ihdr[10] = 0; // deflate compression (0)
  ihdr[11] = 0; // adaptive filter (0)
  ihdr[12] = 0; // non-interlaced (0)

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const center = (size - 1) / 2;
  const outerRadius = size * 0.45;
  const ringInner = size * 0.35;
  const coreRadius = size * 0.18;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // filter type 0 (None)
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > outerRadius) {
        // Dark slate background (#0f172a)
        raw[px] = 15;
        raw[px + 1] = 23;
        raw[px + 2] = 42;
        raw[px + 3] = 255;
      } else if (dist >= ringInner) {
        // Moroccan Emerald ring (#10b981)
        raw[px] = 16;
        raw[px + 1] = 185;
        raw[px + 2] = 129;
        raw[px + 3] = 255;
      } else if (dist <= coreRadius) {
        // Bright emerald core (#34d399)
        raw[px] = 52;
        raw[px + 1] = 211;
        raw[px + 2] = 153;
        raw[px + 3] = 255;
      } else {
        // Deep teal interior (#064e3b)
        raw[px] = 6;
        raw[px + 1] = 78;
        raw[px + 2] = 59;
        raw[px + 3] = 255;
      }
    }
  }

  const idat = zlib.deflateSync(raw, {level: 9});
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Full programmatic PNG validator:
 * Verifies signature, chunk structure (IHDR, IDAT, IEND only), CRC32 on every chunk,
 * dimensions, 8-bit RGBA format, and full zlib inflate decompression of pixel scanlines.
 */
function verifyMinimalPngBuffer(buf: Buffer, expectedSize: number): boolean {
  try {
    if (buf.length < 45) return false;
    const expectedSig = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (!buf.subarray(0, 8).equals(expectedSig)) return false;

    let offset = 8;
    const chunkTypes: string[] = [];
    const idatParts: Buffer[] = [];

    while (offset < buf.length) {
      if (offset + 8 > buf.length) return false;
      const length = buf.readUInt32BE(offset);
      const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
      if (offset + 12 + length > buf.length) return false;

      const data = buf.subarray(offset + 8, offset + 8 + length);
      const storedCrc = buf.readUInt32BE(offset + 8 + length);
      const calcCrc = crc32(buf.subarray(offset + 4, offset + 8 + length));
      if (storedCrc !== calcCrc) return false;

      chunkTypes.push(type);

      if (type === 'IHDR') {
        if (length !== 13) return false;
        const width = data.readUInt32BE(0);
        const height = data.readUInt32BE(4);
        const bitDepth = data[8];
        const colorType = data[9];
        const compression = data[10];
        const filter = data[11];
        const interlace = data[12];
        if (
          width !== expectedSize ||
          height !== expectedSize ||
          bitDepth !== 8 ||
          colorType !== 6 ||
          compression !== 0 ||
          filter !== 0 ||
          interlace !== 0
        ) {
          return false;
        }
      } else if (type === 'IDAT') {
        idatParts.push(data);
      } else if (type === 'IEND') {
        if (length !== 0) return false;
      } else {
        // Reject any non-minimal metadata/ancillary chunks (e.g. zTXt, cHRM, bKGD)
        return false;
      }

      offset += 12 + length;
    }

    if (offset !== buf.length) return false;
    if (
      chunkTypes[0] !== 'IHDR' ||
      chunkTypes[chunkTypes.length - 1] !== 'IEND' ||
      idatParts.length === 0
    ) {
      return false;
    }

    const decompressed = zlib.inflateSync(Buffer.concat(idatParts));
    const expectedRawBytes = expectedSize * (expectedSize * 4 + 1);
    if (decompressed.length !== expectedRawBytes) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Prepares public/icons/ before Vite copies public/ into dist/.
 * Leaves public/manifest.json untouched as the direct source file.
 */
function preparePublicExtensionAssets(): void {
  const staleRootManifest = path.resolve(rootDir, 'manifest.json');
  if (fs.existsSync(staleRootManifest)) {
    try {
      fs.unlinkSync(staleRootManifest);
    } catch {
      // ignore if locked
    }
  }

  const publicDir = path.resolve(rootDir, 'public');
  const publicIconsDir = path.resolve(publicDir, 'icons');
  fs.mkdirSync(publicIconsDir, {recursive: true});

  // Ensure clean minimal 8-bit RGBA PNG icons (16x16, 48x48, 128x128) in public/icons/
  for (const size of [16, 48, 128]) {
    const iconPath = path.resolve(publicIconsDir, `icon${size}.png`);
    const existingValid =
      fs.existsSync(iconPath) &&
      verifyMinimalPngBuffer(fs.readFileSync(iconPath), size);
    if (!existingValid) {
      const pngBuf = generateMinimalIconPng(size);
      if (!verifyMinimalPngBuffer(pngBuf, size)) {
        throw new Error(`Failed to generate valid ${size}x${size} PNG icon`);
      }
      fs.writeFileSync(iconPath, pngBuf);
    }
  }

  // Ensure public/assistant-avatar.png exists
  const publicAvatar = path.resolve(publicDir, 'assistant-avatar.png');
  if (!fs.existsSync(publicAvatar)) {
    fs.writeFileSync(publicAvatar, generateMinimalIconPng(128));
  }
}

function buildChromeExtensionScripts(): Plugin {
  return {
    name: 'build-chrome-extension-scripts',
    apply: 'build',
    buildStart() {
      const distDir = path.resolve(rootDir, 'dist');
      if (fs.existsSync(distDir)) {
        try {
          fs.rmSync(distDir, {recursive: true, force: true});
        } catch {
          // ignore if locked by browser
        }
      }
      preparePublicExtensionAssets();
    },
    async closeBundle() {
      const distDir = path.resolve(rootDir, 'dist');
      fs.mkdirSync(path.resolve(distDir, 'background'), {recursive: true});
      fs.mkdirSync(path.resolve(distDir, 'content'), {recursive: true});

      await viteBuild({
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        build: {
          emptyOutDir: false,
          outDir: path.resolve(distDir, 'background'),
          minify: true,
          target: 'es2022',
          lib: {
            entry: path.resolve(rootDir, 'src/background/service-worker.ts'),
            formats: ['es'],
            fileName: () => 'service-worker.js',
          },
        },
      });

      await viteBuild({
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        build: {
          emptyOutDir: false,
          outDir: path.resolve(distDir, 'content'),
          minify: true,
          target: 'es2022',
          lib: {
            entry: path.resolve(rootDir, 'src/content/content-script.ts'),
            name: 'M3akContentScript',
            formats: ['iife'],
            fileName: () => 'content-script.js',
          },
        },
      });

      // Verify dist/content/content-script.js is a self-contained classic script with no ES module import/export statements
      const distContentScriptPath = path.resolve(
        distDir,
        'content',
        'content-script.js'
      );
      if (!fs.existsSync(distContentScriptPath)) {
        throw new Error(
          'Post-build verification failed: dist/content/content-script.js is missing.'
        );
      }
      const contentScriptSource = fs.readFileSync(
        distContentScriptPath,
        'utf-8'
      );
      if (
        /^\s*import[\s{]|^\s*export[\s{]|from\s*["']\.\.\/assets\//m.test(
          contentScriptSource
        )
      ) {
        throw new Error(
          'Post-build verification failed: dist/content/content-script.js contains unresolved ES module import/export statements.'
        );
      }

      // Final post-build verification of dist/ icons and manifest
      for (const size of [16, 48, 128]) {
        const distIcon = path.resolve(distDir, 'icons', `icon${size}.png`);
        if (
          !fs.existsSync(distIcon) ||
          !verifyMinimalPngBuffer(fs.readFileSync(distIcon), size)
        ) {
          throw new Error(
            `Post-build verification failed for dist/icons/icon${size}.png`
          );
        }
      }

      // Verify dist/fetch-compat.js exists and dist/index.html has zero inline scripts for Chrome Extension MV3 CSP compliance
      const distFetchCompatPath = path.resolve(distDir, 'fetch-compat.js');
      if (!fs.existsSync(distFetchCompatPath)) {
        throw new Error(
          'Post-build verification failed: dist/fetch-compat.js is missing.'
        );
      }

      const distIndexHtmlPath = path.resolve(distDir, 'index.html');
      if (fs.existsSync(distIndexHtmlPath)) {
        const htmlContent = fs.readFileSync(distIndexHtmlPath, 'utf-8');
        const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
        let match: RegExpExecArray | null;
        while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
          const attrs = match[1] || '';
          const body = (match[2] || '').trim();
          if (!/\bsrc\s*=/i.test(attrs) || body.length > 0) {
            throw new Error(
              'CSP violation prevented: dist/index.html contains an inline script tag.'
            );
          }
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    publicDir: path.resolve(rootDir, 'public'),
    plugins: [react(), tailwindcss(), buildChromeExtensionScripts()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      emptyOutDir: true,
      copyPublicDir: true,
      chunkSizeWarningLimit: 700,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
