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

  it('adds a new route with zyte add-route', () => {
    if (!existsSync(EXAMPLE_DIR)) {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    }
    execSync(`bun ${CLI} add-route about`, { cwd: EXAMPLE_DIR });
    const aboutDir = join(EXAMPLE_DIR, 'src', 'routes', 'about');
    expect(existsSync(join(aboutDir, 'about.ts'))).toBe(true);
    expect(existsSync(join(aboutDir, 'about.html'))).toBe(true);
    expect(existsSync(join(aboutDir, 'about.css'))).toBe(true);
  });

  it('fails gracefully on duplicate project name', () => {
    if (!existsSync(EXAMPLE_DIR)) {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    }
    let error = null;
    try {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR, stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
    expect((error as any)?.stdout?.toString() || '' + (error as any)?.stderr?.toString() || '').toMatch(/already exists|Failed to create project/);
  });

  it('fails gracefully on duplicate route name', () => {
    if (!existsSync(EXAMPLE_DIR)) {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    }
    execSync(`bun ${CLI} add-route dupe`, { cwd: EXAMPLE_DIR });
    let error = null;
    try {
      execSync(`bun ${CLI} add-route dupe`, { cwd: EXAMPLE_DIR, stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
    expect((error as any)?.stdout?.toString() || '' + (error as any)?.stderr?.toString() || '').toMatch(/already exists|Failed to create route/);
  });

  it('fails gracefully on missing arguments', () => {
    let error = null;
    try {
      execSync(`bun ${CLI} new`, { cwd: TESTS_DIR, stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
    expect((error as any)?.stdout?.toString() || '' + (error as any)?.stderr?.toString() || '').toMatch(/required|Usage/);

    error = null;
    try {
      execSync(`bun ${CLI} add-route`, { cwd: EXAMPLE_DIR, stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
    expect((error as any)?.stdout?.toString() || '' + (error as any)?.stderr?.toString() || '').toMatch(/required|Usage/);
  });

  it('fails gracefully on invalid route name', () => {
    if (!existsSync(EXAMPLE_DIR)) {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    }
    let error = null;
    try {
      execSync(`bun ${CLI} add-route "invalid name"`, { cwd: EXAMPLE_DIR, stdio: 'pipe' });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBe(null);
    const output = ((error as any)?.stdout?.toString() || '') + ((error as any)?.stderr?.toString() || '');
    expect(output).toContain('Only letters, numbers, dashes, and underscores');
  });

  it('builds the project with zyte build', () => {
    if (!existsSync(EXAMPLE_DIR)) {
      execSync(`bun ${CLI} new zyte-example`, { cwd: TESTS_DIR });
    }
    execSync(`bun ${CLI} build`, { cwd: EXAMPLE_DIR });
    expect(existsSync(join(EXAMPLE_DIR, 'dist', 'server.js'))).toBe(true);
  });
}); 