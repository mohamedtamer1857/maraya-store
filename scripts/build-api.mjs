import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src', 'vercelHandler.ts')],
  outfile: path.join(rootDir, 'api', 'index.mjs'),
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
