#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const zipArg = process.argv[2] ?? 'skyshare-favicons.zip';
const zipPath = resolve(projectRoot, zipArg);
const targetDir = resolve(projectRoot, 'public');
const zipDisplay = relative(projectRoot, zipPath);
const targetDisplay = relative(projectRoot, targetDir);

if (!existsSync(zipPath)) {
  console.error(`Zip archive not found at \"${zipDisplay}\".`);
  console.error('Download the archive and provide its path, e.g.');
  console.error('  node scripts/import-favicons.mjs ~/Downloads/skyshare-favicons.zip');
  process.exit(1);
}

const ignoredEntries = new Set(['__MACOSX']);

async function main() {
  const extractionRoot = await mkdtemp(join(tmpdir(), 'skyshare-favicons-'));
  console.log(`Importing ${zipDisplay} into ${targetDisplay}…`);

  try {
    await runCommand('unzip', ['-o', zipPath, '-d', extractionRoot]);
    const payloadRoot = await resolvePayloadRoot(extractionRoot);
    await copyPayload(payloadRoot, targetDir);
    console.log('Favicons imported. Review the changes with `git status` and commit when ready.');
    return 0;
  } catch (error) {
    console.error(error.message ?? error);
    return 1;
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

async function resolvePayloadRoot(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const filtered = entries.filter((entry) => !ignoredEntries.has(entry.name));

  const publicDir = filtered.find((entry) => entry.isDirectory() && entry.name === 'public');
  if (publicDir) {
    return resolve(rootDir, publicDir.name);
  }

  if (filtered.length === 1 && filtered[0].isDirectory()) {
    return resolve(rootDir, filtered[0].name);
  }

  return rootDir;
}

async function copyPayload(sourceDir, destinationDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const filtered = entries.filter((entry) => !ignoredEntries.has(entry.name));

  if (filtered.length === 0) {
    throw new Error('No files found in the extracted archive. Confirm the ZIP contents match expectations.');
  }

  for (const entry of filtered) {
    const fromPath = resolve(sourceDir, entry.name);
    const toPath = resolve(destinationDir, entry.name);
    await cp(fromPath, toPath, { recursive: true, force: true });
  }
}

function runCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        rejectPromise(new Error(`Required command \"${command}\" not found. Install it (e.g. \"brew install unzip\" on macOS) and retry.`));
      } else {
        rejectPromise(error);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`\"${command}\" exited with status ${code}.`));
      }
    });
  });
}

const exitCode = await main();
process.exit(exitCode);
