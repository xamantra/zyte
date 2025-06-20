import { describe, it, expect, afterAll } from 'bun:test';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const TESTS_DIR = join(process.cwd(), 'tests');
const EXAMPLE_DIR = join(TESTS_DIR, 'zyte-example');
const CLI = join(process.cwd(), 'bin', 'zyte');

function cleanupExample() {
  if (existsSync(EXAMPLE_DIR)) rmSync(EXAMPLE_DIR, { recursive: true, force: true });
}

afterAll(() => {
  cleanupExample();
});

describe('Zyte CLI', () => {
  it('creates a new project with zyte new', () => {
    cleanupExample();
    execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    expect(existsSync(join(EXAMPLE_DIR, 'package.json'))).toBe(true);
    expect(existsSync(join(EXAMPLE_DIR, 'src', 'app', 'app.ts'))).toBe(true);
    expect(existsSync(join(EXAMPLE_DIR, 'src', 'routes', 'counter', 'counter.ts'))).toBe(true);
  });
}); 