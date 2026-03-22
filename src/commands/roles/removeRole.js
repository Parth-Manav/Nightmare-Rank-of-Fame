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

        // BUGFIX: Check if bot can manage this role first BEFORE calling API, which prevents fatal runtime errors
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (role.position >= botMember.roles.highest.position) {
            return await interaction.reply({
                content: `❌ I cannot modify the role ${role.name} because it's higher than or equal to my highest role.`,
                ephemeral: true
            });
        }

        if (!member.roles.cache.has(role.id)) {
            return await interaction.reply({
                content: `⚠️ ${member.displayName} doesn't have the role ${role.name}.`,
                ephemeral: true
            });
        }

        // Safely remove after validation
        await member.roles.remove(role);

        // Fetch CURRENT database state ONLY AFTER Discord replies
        const finalRoles = dataService.getMemberRoles(member.id);
        if (dataService.getMembers()[member.id]) {
            const newRoles = finalRoles.filter(id => id !== role.id);
            dataService.updateMemberRoles(member.id, newRoles);
        }

        logger.info(`Removed role ${role.name} from member ${member.displayName}`);

        await interaction.reply({
            content: `✅ Removed role ${role.name} from ${member.displayName}.`,
            ephemeral: true
        });

        // BUGFIX: Optimization to exclusively queue the individual member role recalculation
        await displayService.updateRoleDisplay(interaction.guild, member.id);
    },
};
