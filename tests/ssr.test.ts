import { describe, it, expect } from 'bun:test';
import { ZyteSSR } from '../src/index';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TMP_DIR = join(process.cwd(), 'tests', 'tmp');
const APP_DIR = join(TMP_DIR, 'src', 'app');
const APP_TS = join(APP_DIR, 'app.ts');
const APP_HTML = join(APP_DIR, 'app.html');

function setupAppFiles() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
  writeFileSync(APP_TS, `export function appPage() { return '<h1>Hello SSR</h1>'; }`);
  writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><body>{{ appPage() }}</body></html>`);
}
function cleanupAppFiles() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('SSR Framework', () => {
  it('renders a simple SSR template', async () => {
    setupAppFiles();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<h1>Hello SSR</h1>');
    cleanupAppFiles();
  });

  it('throws if template is missing', async () => {
    cleanupAppFiles();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    await expect(ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } }))
      .rejects.toThrow('HTML template not found');
  });
}); 