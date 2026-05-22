const { Events } = require('discord.js');
const dataService = require('../services/dataService');
const displayService = require('../services/displayService');
const logger = require('../utils/logger');

function haveSameRoleIds(left, right) {
    return left.length === right.length && left.every((roleId, index) => roleId === right[index]);
}

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        // Verify member is actually tracked
        const isTracked = !!dataService.getMembers()[newMember.id];
        if (!isTracked) return;

        // Check for role changes relevant specifically to managed roles
        const oldRoles = oldMember.roles.cache
            .filter(r => dataService.isRoleManaged(r.id))
            .map(r => r.id)
            .sort();

        const newRoles = newMember.roles.cache
            .filter(r => dataService.isRoleManaged(r.id))
            .map(r => r.id)
            .sort();

        // Only persist data and queue display work when managed roles visibly change.
        if (!haveSameRoleIds(oldRoles, newRoles)) {
            dataService.updateMemberRoles(newMember.id, newRoles);
            logger.info(`Auto-updating display for ${newMember.displayName} due to role change`);
            await displayService.updateRoleDisplay(newMember.guild, newMember.id);
        }
    },
};
