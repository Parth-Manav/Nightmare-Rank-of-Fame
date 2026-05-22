const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const ignoredDirs = new Set(['.git', 'node_modules']);

function collectJavaScriptFiles(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) {
                collectJavaScriptFiles(path.join(dir, entry.name), files);
            }
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(path.join(dir, entry.name));
        }
    }

    return files;
}

const files = collectJavaScriptFiles(rootDir);
let failed = false;

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) {
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}

console.log(`Syntax validation passed for ${files.length} JavaScript files.`);
