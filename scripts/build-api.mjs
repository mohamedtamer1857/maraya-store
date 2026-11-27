import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outFile = path.join(rootDir, 'api', 'index.mjs');

let esbuildMod;
try {
  const imported = await import('esbuild');
  esbuildMod = imported.default ?? imported;
} catch (err) {
  if (fs.existsSync(outFile)) {
    console.log('esbuild not installed in current environment; keeping pre-built api/index.mjs.');
    process.exit(0);
  }
  throw err;
}

await esbuildMod.build({
  entryPoints: [path.join(rootDir, 'src', 'vercelHandler.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: '// Pre-bundled Vercel Serverless API handler (generated from src/vercelHandler.ts)',
  },
});
