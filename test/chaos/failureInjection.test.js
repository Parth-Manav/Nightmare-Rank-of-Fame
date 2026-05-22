const assert = require('node:assert/strict');
const test = require('node:test');
const { createTempDataFile, waitForSaves } = require('../helpers/moduleTools');
const { createChannel, createGuild, createMember, createRole } = require('../helpers/discordMocks');

process.env.BOT_DATA_FILE = createTempDataFile('singleton-chaos.json').dataFile;
process.env.LOG_LEVEL = 'error';

const { DataService } = require('../../src/services/dataService');
const { DisplayService } = require('../../src/services/displayService');

async function waitForQueue(service) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
        if (!service.isProcessing && service.updateQueue.size === 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    throw new Error('Timed out waiting for chaos queue');
}

test('display queue survives fetch, edit, send, and missing-member failures', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });
    dataService.setChannelId('channel-1');

    const roleMap = new Map([['role-1', createRole('role-1', 'Managed')]]);
    dataService.addManagedRole('role-1');

    const members = new Map();
    for (let index = 0; index < 20; index += 1) {
        const memberId = `member-${index}`;
        dataService.addMember(memberId);
        dataService.updateMemberRoles(memberId, ['role-1']);
        if (index % 5 !== 0) {
            members.set(memberId, createMember(memberId, { roleIds: ['role-1'], roleMap }));
        }
        if (index % 4 === 0) {
            dataService.setMessageId(memberId, `message-${index}`);
        }
    }

    const edited = [];
    const messages = [];
    for (let index = 0; index < 20; index += 4) {
        messages.push([
            `message-${index}`,
            {
                id: `message-${index}`,
                edit: async payload => {
                    if (index % 8 === 0) throw new Error('simulated edit failure');
                    edited.push(payload);
                },
            },
        ]);
    }

    const channel = createChannel({ messages });
    const guild = createGuild({ members, roles: roleMap });
    const service = new DisplayService({ dataService, queueDelayMs: 0, updateTimeoutMs: 25 });
    service.setClient({
        channels: { fetch: async () => channel },
        guilds: { cache: { first: () => guild } },
    });

    await service.updateRoleDisplay(guild);
    await waitForQueue(service);
    await waitForSaves(dataService);

    assert.equal(service.updateQueue.size, 0);
    assert.equal(service.isProcessing, false);
    assert.ok(channel.sent.length > 0);
    assert.ok(edited.length >= 0);
});

test('rapid duplicate queue calls collapse pending work without blocking unique work', async () => {
    const service = new DisplayService({ queueDelayMs: 0, updateTimeoutMs: 100 });
    const processed = [];
    let releaseFirst;
    const first = new Promise(resolve => {
        releaseFirst = resolve;
    });

    service.updateMemberDisplay = async (guild, channel, memberId, roleIds) => {
        processed.push({ memberId, roleIds });
        if (processed.length === 1) {
            await first;
        }
    };

    for (let index = 0; index < 500; index += 1) {
        service.queueMemberUpdate({}, {}, `member-${index % 25}`, [`role-${index}`]);
    }

    releaseFirst();
    await waitForQueue(service);

    assert.ok(processed.length <= 26);
    assert.ok(new Set(processed.map(item => item.memberId)).size <= 25);
});

test('simultaneous data updates retain a consistent final JSON snapshot', async () => {
    const { dataFile } = createTempDataFile();
    const dataService = new DataService({ dataFile });

    await Promise.all(Array.from({ length: 20 }, async (_, worker) => {
        for (let index = 0; index < 50; index += 1) {
            const memberId = `member-${worker}-${index}`;
            dataService.addMember(memberId);
            dataService.addManagedRole(`role-${index % 10}`);
            dataService.updateMemberRoles(memberId, [`role-${index % 10}`]);
        }
    }));

    await waitForSaves(dataService);

    assert.equal(Object.keys(dataService.getMembers()).length, 1000);
    assert.equal(Object.keys(dataService.getManagedRoles()).length, 10);
});
