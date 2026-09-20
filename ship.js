#!/usr/bin/env node
/* ============================================================================
   ship.js — build + publish Stack Casino.

     node ship.js setup <github-user> <repo>   one-time: wire the launcher up
     node ship.js "what changed"               stamp a build, commit, push
     node ship.js --local "what changed"       build into dist/ but don't push
     node ship.js status                       what's shipped vs what's local

   Shipping does, in order:
     1. node devkit.js check      (refuses to ship a broken or undocumented file)
     2. stamp a new version into stack-casino.html
     3. copy it to dist/ alongside dist/version.json
     4. git commit + push

   Your mate's launcher.html reads dist/version.json, notices the new version,
   downloads dist/stack-casino.html and caches it. Nothing to re-send, ever.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT     = __dirname;
const GAME     = path.join(ROOT, 'stack-casino.html');
const LAUNCHER = path.join(ROOT, 'launcher.html');
const DIST     = path.join(ROOT, 'dist');
const VER_RE   = /<meta name="stack-version" content="([^"]*)">/;

const read  = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s);
const die   = m => { console.error('\n  ' + m + '\n'); process.exit(1); };

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitSoft(...args) {
  try { return git(...args); } catch (e) { return null; }
}

/* This project lives on a USB stick. exFAT/FAT record no ownership, so git treats
   the repo as "dubious" and refuses every command until the path is allow-listed.
   Do it once, automatically, rather than making Alex decode a git security error. */
function trustRepo() {
  const probe = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return probe;
}
function ensureTrusted() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) return;
  try { trustRepo(); return; } catch (e) {
    if (!/dubious ownership/i.test(String(e.stderr || ''))) return;
    const p = ROOT.replace(/\\/g, '/');
    console.log(`  allow-listing ${p} with git (removable drive, no ownership recorded)`);
    try { execFileSync('git', ['config', '--global', '--add', 'safe.directory', p], { stdio: 'ignore' }); } catch (e2) {}
  }
}

/* ---------- version numbers: YYYY.MM.DD.N, N resets each day ---------- */
function nextVersion(current) {
  const d = new Date();
  const today = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('.');
  const m = /^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/.exec(current || '');
  return (m && m[1] === today) ? `${today}.${+m[2] + 1}` : `${today}.1`;
}

/* The last version we actually published. Deliberately read from dist/, not from
   the source file: stamping the source would bump its mtime on every ship and make
   devkit's staleness check cry wolf. The source stays "0.0.0-dev" forever, which is
   also what you want the Account modal to say when you open it straight off disk. */
function currentVersion() {
  if (!VER_RE.test(read(GAME))) die('stack-casino.html has no <meta name="stack-version"> tag. Put it back in <head>.');
  const f = path.join(DIST, 'version.json');
  return fs.existsSync(f) ? JSON.parse(read(f)).version : null;
}

/* ---------- setup ---------- */
function setup(user, repo) {
  if (!user || !repo) die('Usage: node ship.js setup <github-user> <repo-name>');

  let L = read(LAUNCHER);
  if (!/user:\s*'[^']*'/.test(L) || !/repo:\s*'[^']*'/.test(L))
    die('Could not find the SRC block in launcher.html. Did it get edited?');
  // Rewrite unconditionally: re-running setup must be safe, so "already correct"
  // is a no-op, not an error.
  write(LAUNCHER, L.replace(/user:\s*'[^']*'/, `user:   '${user}'`)
                   .replace(/repo:\s*'[^']*'/, `repo:   '${repo}'`));

  ensureTrusted();
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    git('init');
    ensureTrusted();
    console.log('  git repo initialised');
  }
  // Always normalise the branch: launcher.html fetches from "main", and a repo
  // left on "master" would 404 every update check without saying why.
  if ((gitSoft('rev-parse', '--abbrev-ref', 'HEAD') || '') !== 'main') {
    gitSoft('branch', '-M', 'main');
    console.log('  branch -> main');
  }
  if (!gitSoft('remote', 'get-url', 'origin')) {
    git('remote', 'add', 'origin', `https://github.com/${user}/${repo}.git`);
    console.log(`  remote origin -> github.com/${user}/${repo}`);
  }

  console.log(`
  Launcher now points at github.com/${user}/${repo}

  Next, one time only:
    1. Create an EMPTY public repo named "${repo}" at github.com/new
       (no README, no .gitignore - this folder supplies them)
    2. node ship.js "first build"
    3. Send launcher.html to your mate. That's the only file he ever needs.
`);
}

/* ---------- status ---------- */
function status() {
  const cur = currentVersion();
  console.log('\n  shipped build  ' + (cur || '(nothing shipped yet)'));
  console.log('  next ship      ' + nextVersion(cur));
  const dirty = gitSoft('status', '--porcelain');
  console.log('  uncommitted    ' + (dirty ? dirty.split('\n').length + ' file(s)' : 'none'));
  const L = read(LAUNCHER);
  const u = /user:\s*'([^']*)'/.exec(L), r = /repo:\s*'([^']*)'/.exec(L);
  console.log('  launcher       ' + (u && u[1] !== 'USER' ? `${u[1]}/${r[1]}` : 'NOT CONFIGURED - run: node ship.js setup <user> <repo>'));
  console.log('');
}

/* ---------- ship ---------- */
function ship(notes, local) {
  // 1. never ship something that doesn't pass its own checks.
  // process.execPath, not 'node': a freshly installed Node is missing from PATH in
  // already-open shells, and the .cmd shortcuts launch us by full path.
  try {
    execFileSync(process.execPath, ['devkit.js', 'check'], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    die('devkit check failed. Fix that first - a broken build would auto-install on your mate.');
  }

  // 2. stamp (into the published copy only — see currentVersion)
  const version = nextVersion(currentVersion());
  const html = read(GAME).replace(VER_RE, `<meta name="stack-version" content="${version}">`);

  // 3. dist
  fs.mkdirSync(DIST, { recursive: true });
  write(path.join(DIST, 'stack-casino.html'), html);
  write(path.join(DIST, 'version.json'), JSON.stringify({
    version,
    notes: notes || '',
    bytes: Buffer.byteLength(html),
    at: new Date().toISOString()
  }, null, 2) + '\n');
  console.log(`\n  built ${version}  (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);

  if (local) {
    console.log('  --local: stopped before git. dist/ is up to date.\n');
    return;
  }

  // 4. publish
  if (!fs.existsSync(path.join(ROOT, '.git'))) die('No git repo yet. Run: node ship.js setup <github-user> <repo>');
  ensureTrusted();
  git('add', '-A');
  const staged = gitSoft('diff', '--cached', '--name-only');
  if (!staged) { console.log('  nothing changed since the last ship.\n'); return; }
  git('commit', '-m', `${version}${notes ? ' - ' + notes : ''}`);

  const branch = gitSoft('rev-parse', '--abbrev-ref', 'HEAD') || 'main';
  try {
    git('push', '-u', 'origin', branch);
  } catch (e) {
    die('Commit made, but the push failed:\n  ' + String(e.stderr || e.message).trim() +
        '\n\n  Usually: the GitHub repo does not exist yet, or you are not signed in to git.');
  }

  console.log(`  pushed ${version}. Your mate gets it next time he opens launcher.html.\n`);
}

/* ---------- dispatch ---------- */
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'setup')       setup(rest[0], rest[1]);
else if (cmd === 'status') status();
else if (cmd === '--local') ship(rest.join(' '), true);
else if (!cmd)             die('Say what changed:  node ship.js "fixed the balloon"');
else                       ship([cmd, ...rest].join(' '), false);
