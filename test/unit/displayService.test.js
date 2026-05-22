const assert = require('node:assert/strict');
const test = require('node:test');
const { createTempDataFile, waitForSaves } = require('../helpers/moduleTools');
const {
    createChannel,
    createEditableMessage,
    createGuild,
    createMember,
    createRole,
} = require('../helpers/discordMocks');

process.env.BOT_DATA_FILE = createTempDataFile('singleton-display.json').dataFile;
process.env.LOG_LEVEL = 'error';

const { DataService } = require('../../src/services/dataService');
const { DisplayService } = require('../../src/services/displayService');

async function waitForQueue(service) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        if (!service.isProcessing && service.updateQueue.size === 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    throw new Error('Timed out waiting for display queue');
}

function createService(dataService, client, options = {}) {
    const service = new DisplayService({
        dataService,
        queueDelayMs: options.queueDelayMs ?? 0,
        updateTimeoutMs: options.updateTimeoutMs ?? 50,
    });
    service.setClient(client);
    return service;
}

test('skips update when no display channel is configured', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    let fetchCount = 0;
    const service = createService(dataService, {
        channels: { fetch: async () => { fetchCount += 1; } },
        guilds: { cache: { first: () => null } },
    });

    await service.updateRoleDisplay();
    assert.equal(fetchCount, 0);
});

test('invalid display channel clears stored channel ID', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('missing-channel');
    await waitForSaves(dataService);

    const service = createService(dataService, {
        channels: { fetch: async () => null },
        guilds: { cache: { first: () => null } },
    });

    await service.updateRoleDisplay();
    assert.equal(dataService.getChannelId(), null);
});

test('creates a display message for a tracked member and filters unmanaged roles', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('channel-1');
    dataService.addMember('member-1');
    dataService.addManagedRole('role-1');
    dataService.updateMemberRoles('member-1', ['role-1', 'role-2']);

    const roleMap = new Map([
        ['role-1', createRole('role-1', 'Managed')],
        ['role-2', createRole('role-2', 'Unmanaged')],
    ]);
    const member = createMember('member-1', { displayName: 'Asha', roleIds: ['role-1', 'role-2'], roleMap });
    const guild = createGuild({ members: new Map([['member-1', member]]), roles: roleMap });
    const channel = createChannel();
    const service = createService(dataService, {
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateRoleDisplay(guild, 'member-1');
    await waitForQueue(service);

    assert.equal(channel.sent.length, 1);
    const embed = channel.sent[0].embeds[0].toJSON();
    assert.match(embed.description, /role-1/);
    assert.doesNotMatch(embed.description, /role-2/);
    assert.equal(dataService.getMessageId('member-1'), 'sent-1');
});

test('edits an existing display message when it still exists', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('channel-1');
    dataService.addMember('member-1');
    dataService.addManagedRole('role-1');
    dataService.updateMemberRoles('member-1', ['role-1']);
    dataService.setMessageId('member-1', 'message-1');

    const roleMap = new Map([['role-1', createRole('role-1', 'Managed')]]);
    const member = createMember('member-1', { roleIds: ['role-1'], roleMap });
    const guild = createGuild({ members: new Map([['member-1', member]]), roles: roleMap });
    const edited = [];
    const channel = createChannel({
        messages: [['message-1', createEditableMessage('message-1', edited)]],
    });
    const service = createService(dataService, {
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateRoleDisplay(guild, 'member-1');
    await waitForQueue(service);

    assert.equal(edited.length, 1);
    assert.equal(channel.sent.length, 0);
});

test('creates a replacement message when the stored message is missing', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('channel-1');
    dataService.addMember('member-1');
    dataService.setMessageId('member-1', 'missing-message');

    const member = createMember('member-1');
    const guild = createGuild({ members: new Map([['member-1', member]]) });
    const channel = createChannel();
    const service = createService(dataService, {
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateRoleDisplay(guild, 'member-1');
    await waitForQueue(service);

    assert.equal(channel.sent.length, 1);
    assert.equal(dataService.getMessageId('member-1'), 'sent-1');
});

test('skips display update when a guild member cannot be fetched', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    const guild = createGuild();
    const channel = createChannel();
    const service = createService(dataService, {
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateMemberDisplay(guild, channel, 'missing-member', []);
    assert.equal(channel.sent.length, 0);
});

test('targeted updates do not create displays for untracked members', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('channel-1');

    const member = createMember('member-1');
    const guild = createGuild({ members: new Map([['member-1', member]]) });
    const channel = createChannel();
    const service = createService(dataService, {
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateRoleDisplay(guild, 'member-1');
    await waitForQueue(service);

    assert.equal(channel.sent.length, 0);
    assert.equal(dataService.getMessageId('member-1'), undefined);
});

test('queue deduplicates pending updates for the same member', async () => {
    const service = new DisplayService({ queueDelayMs: 0, updateTimeoutMs: 100 });
    const calls = [];
    let releaseFirst;
    const firstUpdate = new Promise(resolve => {
        releaseFirst = resolve;
    });

    service.updateMemberDisplay = async (guild, channel, memberId, roleIds) => {
        calls.push({ memberId, roleIds });
        if (calls.length === 1) {
            await firstUpdate;
        }
    };

    service.queueMemberUpdate({}, {}, 'member-1', ['role-1']);
    service.queueMemberUpdate({}, {}, 'member-1', ['role-2']);
    service.queueMemberUpdate({}, {}, 'member-1', ['role-3']);
    releaseFirst();
    await waitForQueue(service);

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].roleIds, ['role-3']);
});

test('queue continues after failures and after timeout', async () => {
    const service = new DisplayService({ queueDelayMs: 0, updateTimeoutMs: 20 });
    const processed = [];

    service.updateMemberDisplay = async (guild, channel, memberId) => {
        processed.push(memberId);
        if (memberId === 'member-1') {
            throw new Error('simulated update failure');
        }
        if (memberId === 'member-2') {
            return new Promise(() => {});
        }
        return undefined;
    };

    service.queueMemberUpdate({}, {}, 'member-1', []);
    service.queueMemberUpdate({}, {}, 'member-2', []);
    service.queueMemberUpdate({}, {}, 'member-3', []);
    await waitForQueue(service);

    assert.deepEqual(processed, ['member-1', 'member-2', 'member-3']);
});
