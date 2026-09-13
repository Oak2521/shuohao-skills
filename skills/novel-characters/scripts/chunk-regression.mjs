import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHUNK_SIZE, CHUNK_OVERLAP, MAX_CHUNKS } from './novel-characters.mjs';
const cli = fileURLToPath(new URL('./novel-characters.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'novel-chunk-test-'));
const capacity = CHUNK_SIZE * MAX_CHUNKS - CHUNK_OVERLAP * (MAX_CHUNKS - 1);
try {
  const cases = [capacity + 1, 322200, 322201, 330000, 336000, capacity, CHUNK_SIZE * MAX_CHUNKS];
  const sources = cases.map(n => 'x'.repeat(n - 8) + 'TAIL_END');
  sources.push(('x'.repeat(Math.floor(CHUNK_SIZE * .85)) + '。').repeat(MAX_CHUNKS + 2) + 'TAIL_END');
  sources.push('  \r\n' + ('x\r\n').repeat(Math.floor(capacity / 2)) + 'TAIL_END\r\n ');
  sources.push(' \r\n ');
  for (const [i, source] of sources.entries()) {
    const book = join(root, `book-${i}.txt`), out = join(root, `out-${i}`);
    writeFileSync(book, source);
    const result = spawnSync(process.execPath, [cli, 'chunk', book, out], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const metadata = JSON.parse(result.stdout);
    const clean = source.replace(/\r\n/g, '\n').trim();
    const chunks = readdirSync(out).sort().map(p => readFileSync(join(out, p), 'utf8'));
    const tailMissing = !!clean && !chunks.some(c => c.includes('TAIL_END'));
    assert.equal(metadata.truncated, tailMissing, `case ${i}, chars ${source.length}: tail/truncated mismatch`);
    assert.equal(metadata.chars, source.length);
    assert.equal(metadata.normalizedChars, clean.length);
    assert.equal(metadata.truncated, metadata.coveredChars < metadata.normalizedChars);
    assert.equal(result.stderr.includes('尾部未扫描'), metadata.truncated);
  }
  console.log(`${sources.length} CLI chunk boundary/CRLF/early-break cases passed`);
} finally { rmSync(root, { recursive: true }); }

