const assert = require('node:assert/strict');
const test = require('node:test');
const { performance } = require('perf_hooks');
const { loadFreshServices } = require('../helpers/moduleTools');
const { createRole, createRoleCache } = require('../helpers/discordMocks');

function createRandom(seed) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function createEventMember(id, roleIds, roleMap) {
    return {
        id,
        displayName: `Member ${id}`,
        guild: { id: 'guild-1' },
        roles: { cache: createRoleCache(roleIds, roleMap) },
    };
}

test('simulates a 50-person server over one logical year of role changes', async () => {
    const started = performance.now();
    const random = createRandom(20260522);
    const { dataService, displayService } = loadFreshServices();
    const event = require('../../src/events/guildMemberUpdate');

    const metrics = {
        events: 0,
        queuedUpdates: 0,
        ignoredUnmanagedChanges: 0,
        manualChanges: 0,
        simulatedFailuresRecovered: 0,
    };

    displayService.updateRoleDisplay = async () => {
        metrics.queuedUpdates += 1;
        if (random() < 0.03) {
            metrics.simulatedFailuresRecovered += 1;
            throw new Error('simulated downstream display failure');
        }
    };

    const managedRoles = Array.from({ length: 8 }, (_, index) => `managed-${index}`);
    const unmanagedRoles = Array.from({ length: 5 }, (_, index) => `unmanaged-${index}`);
    const roleMap = new Map([...managedRoles, ...unmanagedRoles].map(roleId => [roleId, createRole(roleId)]));

    for (const roleId of managedRoles) {
        dataService.addManagedRole(roleId);
    }

    for (let memberIndex = 0; memberIndex < 50; memberIndex += 1) {
        dataService.addMember(`member-${memberIndex}`);
    }

    for (let day = 0; day < 365; day += 1) {
        for (let change = 0; change < 10; change += 1) {
            const memberId = `member-${Math.floor(random() * 50)}`;
            const oldManagedRoles = new Set(dataService.getMemberRoles(memberId));
            const visibleOldRoles = [...oldManagedRoles];
            const visibleNewRoles = new Set(visibleOldRoles);
            const isManagedChange = random() < 0.8;
            const rolePool = isManagedChange ? managedRoles : unmanagedRoles;
            const roleId = rolePool[Math.floor(random() * rolePool.length)];

            if (visibleNewRoles.has(roleId)) {
                visibleNewRoles.delete(roleId);
            } else {
                visibleNewRoles.add(roleId);
            }

            metrics.events += 1;
            try {
                await event.execute(
                    createEventMember(memberId, visibleOldRoles, roleMap),
                    createEventMember(memberId, [...visibleNewRoles], roleMap)
                );
            } catch (error) {
                metrics.simulatedFailuresRecovered += 1;
            }

            if (!isManagedChange) {
                metrics.ignoredUnmanagedChanges += 1;
            }
        }

        if (day % 30 === 0) {
            const memberId = `member-${Math.floor(random() * 50)}`;
            const roleId = managedRoles[Math.floor(random() * managedRoles.length)];
            dataService.updateMemberRoles(memberId, Array.from(new Set([...dataService.getMemberRoles(memberId), roleId])).sort());
            metrics.manualChanges += 1;
        }
    }

    for (const roles of Object.values(dataService.getMembers())) {
        assert.deepEqual(roles, [...roles].sort());
        assert.equal(roles.every(roleId => managedRoles.includes(roleId)), true);
    }

    const durationMs = performance.now() - started;
    console.log(JSON.stringify({ simulation: '50-person-one-year', durationMs: Math.round(durationMs), ...metrics }));
    assert.equal(metrics.events, 3650);
    assert.ok(metrics.queuedUpdates > 0);
});
