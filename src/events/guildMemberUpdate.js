const { Events } = require('discord.js');
const dataService = require('../services/dataService');
const displayService = require('../services/displayService');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        // Check if member is tracked
        const memberRoles = dataService.getMemberRoles(newMember.id);
        if (memberRoles.length === 0 && !dataService.getMembers()[newMember.id]) return;

        // Check for role changes relevant to managed roles
        const oldRoles = oldMember.roles.cache
            .filter(r => dataService.isRoleManaged(r.id))
            .map(r => r.id)
            .sort();

        const newRoles = newMember.roles.cache
            .filter(r => dataService.isRoleManaged(r.id))
            .map(r => r.id)
            .sort();

        if (JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) {
            // Update data
            dataService.updateMemberRoles(newMember.id, newRoles);
            logger.info(`Auto-updating display for ${newMember.displayName} due to role change`);

            // Update display
            await displayService.updateRoleDisplay();
        }
    },
};
