import { build } from 'esbuild';
// Bundle the command-line simulator in memory; no TS loader service or user-profile access needed.
const output = await build({ entryPoints: ['scripts/simulate.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
