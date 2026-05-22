const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');
const { loadFreshServices, rootDir } = require('../helpers/moduleTools');
const {
    createChannel,
    createGuild,
    createInteraction,
    createMember,
    createRole,
} = require('../helpers/discordMocks');

function loadCommand(relativePath) {
    return require(path.join(rootDir, 'src', 'commands', relativePath));
}

function setup() {
    const { dataService, displayService } = loadFreshServices();
    const displayCalls = [];
    displayService.updateRoleDisplay = async (guild, memberId) => {
        displayCalls.push({ guild, memberId });
    };
    return { dataService, displayService, displayCalls };
}

function lastCall(interaction) {
    return interaction.calls.at(-1);
}

test('/setdisplaychannel stores the current channel and replies ephemerally', async () => {
    const { dataService } = setup();
    const command = loadCommand('admin/setDisplayChannel.js');
    const interaction = createInteraction({ channel: { id: 'channel-1', name: 'display' } });

    await command.execute(interaction);

    assert.equal(dataService.getChannelId(), 'channel-1');
    assert.equal(lastCall(interaction).payload.ephemeral, true);
    assert.match(lastCall(interaction).payload.content, /Display channel set/);
});

test('/updatedisplay defers and edits an ephemeral response', async () => {
    const { displayCalls } = setup();
    const command = loadCommand('admin/updateDisplay.js');
    const interaction = createInteraction();

    await command.execute(interaction);

    assert.equal(interaction.calls[0].method, 'deferReply');
    assert.equal(interaction.calls[0].payload.ephemeral, true);
    assert.equal(interaction.calls[1].method, 'editReply');
    assert.equal(displayCalls.length, 1);
});

test('/managerole handles success and duplicate paths', async () => {
    const { dataService } = setup();
    const command = loadCommand('admin/manageRole.js');
    const role = createRole('role-1', 'Captain');

    const first = createInteraction({ role });
    await command.execute(first);
    assert.equal(dataService.isRoleManaged('role-1'), true);
    assert.equal(lastCall(first).payload.ephemeral, true);

    const second = createInteraction({ role });
    await command.execute(second);
    assert.match(lastCall(second).payload.content, /Already managing/);
    assert.equal(lastCall(second).payload.ephemeral, true);
});

test('/unmanagerole removes a role and queues display refresh', async () => {
    const { dataService, displayCalls } = setup();
    const command = loadCommand('admin/unmanageRole.js');
    const role = createRole('role-1', 'Captain');
    dataService.addManagedRole('role-1');

    const interaction = createInteraction({ role });
    await command.execute(interaction);

    assert.equal(dataService.isRoleManaged('role-1'), false);
    assert.equal(displayCalls.length, 1);
    assert.equal(lastCall(interaction).payload.ephemeral, true);
});

test('/addmember handles missing member and success paths', async () => {
    const { dataService, displayCalls } = setup();
    const command = loadCommand('members/addMember.js');
    const user = { id: 'member-1' };

    const missingGuild = createGuild();
    const missingInteraction = createInteraction({ guild: missingGuild, user });
    await command.execute(missingInteraction);
    assert.match(lastCall(missingInteraction).payload.content, /Could not find/);

    const member = createMember('member-1', { displayName: 'Asha' });
    const guild = createGuild({ members: new Map([['member-1', member]]) });
    const successInteraction = createInteraction({ guild, user });
    await command.execute(successInteraction);

    assert.ok(dataService.getMembers()['member-1']);
    assert.equal(displayCalls.length, 1);
    assert.equal(lastCall(successInteraction).payload.ephemeral, true);
});

test('/removemember removes tracked member and clears stale message IDs', async () => {
    const { dataService } = setup();
    const command = loadCommand('members/removeMember.js');
    const user = { id: 'member-1' };
    const member = createMember('member-1', { displayName: 'Asha' });
    const channel = createChannel();
    const guild = createGuild({ members: new Map([['member-1', member]]) });

    dataService.addMember('member-1');
    dataService.setChannelId('channel-1');
    dataService.setMessageId('member-1', 'message-1');

    const interaction = createInteraction({
        guild,
        user,
        channel,
        client: {
            user: { id: 'bot' },
            channels: { fetch: async () => channel },
        },
    });

    await command.execute(interaction);

    assert.equal(dataService.getMembers()['member-1'], undefined);
    assert.equal(dataService.getMessageId('member-1'), undefined);
    assert.equal(lastCall(interaction).payload.ephemeral, true);
});

test('/listtrackedmembers and /listmanagedroles return ephemeral embeds', async () => {
    const { dataService } = setup();
    const memberCommand = loadCommand('members/listTrackedMembers.js');
    const roleCommand = loadCommand('roles/listManagedRoles.js');
    const role = createRole('role-1', 'Captain');
    const member = createMember('member-1', { displayName: 'Asha' });
    const guild = createGuild({
        members: new Map([['member-1', member]]),
        roles: new Map([['role-1', role]]),
    });

    dataService.addMember('member-1');
    dataService.addManagedRole('role-1');

    const memberInteraction = createInteraction({ guild });
    await memberCommand.execute(memberInteraction);
    assert.equal(lastCall(memberInteraction).payload.ephemeral, true);
    assert.equal(lastCall(memberInteraction).payload.embeds.length, 1);

    const roleInteraction = createInteraction({ guild });
    await roleCommand.execute(roleInteraction);
    assert.equal(lastCall(roleInteraction).payload.ephemeral, true);
    assert.equal(lastCall(roleInteraction).payload.embeds.length, 1);
});

test('/addrole rejects unmanaged and high roles, then succeeds for valid managed role', async () => {
    const { dataService, displayCalls } = setup();
    const command = loadCommand('roles/addRole.js');
    const user = { id: 'member-1' };
    const role = createRole('role-1', 'Captain', 10);
    const member = createMember('member-1', { displayName: 'Asha' });

    let guild = createGuild({
        members: new Map([['member-1', member]]),
        roles: new Map([['role-1', role]]),
        botPosition: 100,
    });
    let interaction = createInteraction({ guild, user, role });
    await command.execute(interaction);
    assert.match(lastCall(interaction).payload.content, /not managed/);

    dataService.addManagedRole('role-1');
    guild = createGuild({
        members: new Map([['member-1', member]]),
        roles: new Map([['role-1', role]]),
        botPosition: 10,
    });
    interaction = createInteraction({ guild, user, role });
    await command.execute(interaction);
    assert.match(lastCall(interaction).payload.content, /cannot modify/);

    dataService.addMember('member-1');
    guild = createGuild({
        members: new Map([['member-1', member]]),
        roles: new Map([['role-1', role]]),
        botPosition: 100,
    });
    interaction = createInteraction({ guild, user, role });
    await command.execute(interaction);

    assert.deepEqual(dataService.getMemberRoles('member-1'), ['role-1']);
    assert.equal(displayCalls.length, 1);
    assert.equal(lastCall(interaction).payload.ephemeral, true);
});

test('/removerole rejects invalid paths and succeeds for valid managed role', async () => {
    const { dataService, displayCalls } = setup();
    const command = loadCommand('roles/removeRole.js');
    const user = { id: 'member-1' };
    const role = createRole('role-1', 'Captain', 10);
    const member = createMember('member-1', { displayName: 'Asha', roleIds: ['role-1'] });
    const guild = createGuild({
        members: new Map([['member-1', member]]),
        roles: new Map([['role-1', role]]),
        botPosition: 100,
    });

    let interaction = createInteraction({ guild, user, role });
    await command.execute(interaction);
    assert.match(lastCall(interaction).payload.content, /not managed/);

    dataService.addMember('member-1');
    dataService.updateMemberRoles('member-1', ['role-1']);
    dataService.addManagedRole('role-1');

    interaction = createInteraction({ guild, user, role });
    await command.execute(interaction);

    assert.deepEqual(dataService.getMemberRoles('member-1'), []);
    assert.equal(displayCalls.length, 1);
    assert.equal(lastCall(interaction).payload.ephemeral, true);
});
