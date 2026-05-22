const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { PermissionsBitField } = require('discord.js');
const { rootDir, loadFreshServices } = require('../helpers/moduleTools');

function listJavaScriptFiles(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!['.git', 'node_modules', 'test'].includes(entry.name)) {
                listJavaScriptFiles(path.join(dir, entry.name), files);
            }
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(path.join(dir, entry.name));
        }
    }

    return files;
}

test('project JavaScript files pass syntax validation through the check script', () => {
    const files = listJavaScriptFiles(rootDir);
    assert.ok(files.some(file => file.endsWith(path.join('src', 'services', 'dataService.js'))));
    assert.ok(files.length >= 20);
});

test('command modules export data and execute and require administrator permission', () => {
    loadFreshServices();
    const commandsRoot = path.join(rootDir, 'src', 'commands');
    const adminPermission = PermissionsBitField.Flags.Administrator;

    for (const folder of fs.readdirSync(commandsRoot)) {
        const folderPath = path.join(commandsRoot, folder);
        for (const file of fs.readdirSync(folderPath).filter(name => name.endsWith('.js'))) {
            const command = require(path.join(folderPath, file));
            const json = command.data?.toJSON();

            assert.ok(command.data, `${file} is missing data`);
            assert.equal(typeof command.execute, 'function', `${file} is missing execute`);
            assert.ok(json.name, `${file} is missing a slash command name`);
            assert.ok(json.default_member_permissions, `${file} is missing admin permission metadata`);
            assert.equal((BigInt(json.default_member_permissions) & adminPermission) === adminPermission, true);
        }
    }
});

test('event modules export name and execute', () => {
    loadFreshServices();
    const eventsRoot = path.join(rootDir, 'src', 'events');

    for (const file of fs.readdirSync(eventsRoot).filter(name => name.endsWith('.js'))) {
        const event = require(path.join(eventsRoot, file));

        assert.ok(event.name, `${file} is missing an event name`);
        assert.equal(typeof event.execute, 'function', `${file} is missing execute`);
    }
});
