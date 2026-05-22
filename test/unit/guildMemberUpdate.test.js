const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFreshServices } = require('../helpers/moduleTools');
const { createRole, createRoleCache } = require('../helpers/discordMocks');

function createEventMember(id, roleIds, roleMap) {
    return {
        id,
        displayName: `Member ${id}`,
        guild: { id: 'guild-1' },
        roles: {
            cache: createRoleCache(roleIds, roleMap),
        },
    };
}

function setup() {
    const { dataService, displayService } = loadFreshServices();
    const event = require('../../src/events/guildMemberUpdate');
    const calls = [];

    displayService.updateRoleDisplay = async (guild, memberId) => {
        calls.push({ guild, memberId });
    };

    return { dataService, event, calls };
}

test('ignores updates for members that are not tracked', async () => {
    const { dataService, event, calls } = setup();
    dataService.addManagedRole('role-1');

    const roleMap = new Map([['role-1', createRole('role-1')]]);
    await event.execute(
        createEventMember('member-1', [], roleMap),
        createEventMember('member-1', ['role-1'], roleMap)
    );

    assert.equal(calls.length, 0);
});

test('ignores updates when managed roles did not change', async () => {
    const { dataService, event, calls } = setup();
    dataService.addMember('member-1');
    dataService.addManagedRole('role-1');

    const roleMap = new Map([
        ['role-1', createRole('role-1')],
        ['unmanaged', createRole('unmanaged')],
    ]);
    await event.execute(
        createEventMember('member-1', ['role-1'], roleMap),
        createEventMember('member-1', ['role-1', 'unmanaged'], roleMap)
    );

    assert.equal(calls.length, 0);
});

test('triggers targeted update when a managed role is added', async () => {
    const { dataService, event, calls } = setup();
    dataService.addMember('member-1');
    dataService.addManagedRole('role-1');

    const roleMap = new Map([['role-1', createRole('role-1')]]);
    await event.execute(
        createEventMember('member-1', [], roleMap),
        createEventMember('member-1', ['role-1'], roleMap)
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].memberId, 'member-1');
    assert.deepEqual(dataService.getMemberRoles('member-1'), ['role-1']);
});

test('triggers targeted update when a managed role is removed', async () => {
    const { dataService, event, calls } = setup();
    dataService.addMember('member-1');
    dataService.updateMemberRoles('member-1', ['role-1']);
    dataService.addManagedRole('role-1');

    const roleMap = new Map([['role-1', createRole('role-1')]]);
    await event.execute(
        createEventMember('member-1', ['role-1'], roleMap),
        createEventMember('member-1', [], roleMap)
    );

    assert.equal(calls.length, 1);
    assert.deepEqual(dataService.getMemberRoles('member-1'), []);
});

test('stores sorted managed role IDs consistently', async () => {
    const { dataService, event } = setup();
    dataService.addMember('member-1');
    dataService.addManagedRole('role-a');
    dataService.addManagedRole('role-b');

    const roleMap = new Map([
        ['role-a', createRole('role-a')],
        ['role-b', createRole('role-b')],
    ]);
    await event.execute(
        createEventMember('member-1', [], roleMap),
        createEventMember('member-1', ['role-b', 'role-a'], roleMap)
    );

    assert.deepEqual(dataService.getMemberRoles('member-1'), ['role-a', 'role-b']);
});
