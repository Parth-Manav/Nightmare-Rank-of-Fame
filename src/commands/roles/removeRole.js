const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const displayService = require('../../services/displayService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a managed role from a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove the role from')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return await interaction.reply({ content: '❌ Could not find that member in this server.', ephemeral: true });
        }

        if (!dataService.isRoleManaged(role.id)) {
            return await interaction.reply({
                content: `❌ The role ${role.name} is not managed by the bot.`,
                ephemeral: true
            });
        }

        if (!member.roles.cache.has(role.id)) {
            return await interaction.reply({
                content: `⚠️ ${member.displayName} doesn't have the role ${role.name}.`,
                ephemeral: true
            });
        }

        await member.roles.remove(role);

        // Remove from tracked roles if member is being tracked
        const currentRoles = dataService.getMemberRoles(member.id);
        if (dataService.getMembers()[member.id]) {
            const newRoles = currentRoles.filter(id => id !== role.id);
            dataService.updateMemberRoles(member.id, newRoles);
        }

        logger.info(`Removed role ${role.name} from member ${member.displayName}`);

        await interaction.reply({
            content: `✅ Removed role ${role.name} from ${member.displayName}.`,
            ephemeral: true
        });

        await displayService.updateRoleDisplay();
    },
};
