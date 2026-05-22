const assert = require('node:assert/strict');
const fs = require('fs');
const fsPromises = require('fs/promises');
const { spawnSync } = require('child_process');
const test = require('node:test');
const { createTempDataFile, rootDir, waitForSaves } = require('../helpers/moduleTools');

process.env.BOT_DATA_FILE = createTempDataFile('singleton-data.json').dataFile;
process.env.LOG_LEVEL = 'error';
const { DataService } = require('../../src/services/dataService');

test('fresh startup creates the expected data shape', async () => {
    const { dataFile } = createTempDataFile();
    const service = new DataService({ dataFile });
    await waitForSaves(service);

    assert.deepEqual(service.data, {
        version: '2.0.0',
        channel_id: null,
        members: {},
        managed_roles: {},
        message_ids: {},
    });
    assert.ok(fs.existsSync(dataFile));
});

test('member, role, channel, and message ID operations update memory and disk', async () => {
    const { dataFile } = createTempDataFile();
    const service = new DataService({ dataFile });

    assert.equal(service.addMember('member-1'), true);
    assert.equal(service.addMember('member-1'), false);
    service.updateMemberRoles('member-1', ['role-2', 'role-1']);
    service.setChannelId('channel-1');
    assert.equal(service.addManagedRole('role-1'), true);
    assert.equal(service.addManagedRole('role-1'), false);
    service.setMessageId('member-1', 'message-1');
    service.removeMessageId('member-1');
    assert.equal(service.removeManagedRole('role-1'), true);
    assert.equal(service.removeMember('member-1'), true);
    await waitForSaves(service);

    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(saved.channel_id, 'channel-1');
    assert.deepEqual(saved.members, {});
    assert.deepEqual(saved.managed_roles, {});
    assert.deepEqual(saved.message_ids, {});
});

test('rapid repeated writes persist the latest complete snapshot', async () => {
    const { dataFile } = createTempDataFile();
    const service = new DataService({ dataFile });

    for (let index = 0; index < 100; index += 1) {
        service.addMember(`member-${index}`);
        service.updateMemberRoles(`member-${index}`, [`role-${index % 5}`]);
        service.addManagedRole(`role-${index % 5}`);
    }

    await waitForSaves(service);
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    assert.equal(Object.keys(saved.members).length, 100);
    assert.equal(Object.keys(saved.managed_roles).length, 5);
    assert.deepEqual(saved.members['member-99'], ['role-4']);
});

test('EXDEV rename fallback copies data and removes the temp file', async () => {
    const { dataFile } = createTempDataFile();
    const service = new DataService({ dataFile, load: false });
    const originalRename = fsPromises.rename;

    fsPromises.rename = async () => {
        const error = new Error('cross-device link not permitted');
        error.code = 'EXDEV';
        throw error;
    };

    try {
        service.data.members['member-1'] = [];
        await service.saveDataAsync();
    } finally {
        fsPromises.rename = originalRename;
    }

    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.ok(saved.members['member-1']);
    assert.equal(fs.existsSync(service.tempFile), false);
});

test('corrupted JSON aborts startup instead of overwriting state', () => {
    const { dataFile } = createTempDataFile();
    fs.writeFileSync(dataFile, '{ this is not json', 'utf8');

    const result = spawnSync(process.execPath, ['-e', 'require("./src/services/dataService")'], {
        cwd: rootDir,
        env: {
            ...process.env,
            BOT_DATA_FILE: dataFile,
            LOG_LEVEL: 'error',
        },
        encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /corrupted and failed to parse/);
});
