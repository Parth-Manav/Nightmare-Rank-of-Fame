const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const dataService = require('../../services/dataService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listmanagedroles')
        .setDescription('List all roles currently being managed by the bot')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const managedRolesMap = dataService.getManagedRoles();
        const managedRoleIds = Object.keys(managedRolesMap);

        if (managedRoleIds.length === 0) {
            return await interaction.reply({
                content: '📋 No roles are currently being managed.',
                ephemeral: true
            });
        }

        const roles = managedRoleIds
            .map(id => interaction.guild.roles.cache.get(id))
            .filter(Boolean)
            .map(role => `• ${role.name}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📋 Managed Roles')
            .setDescription(roles || 'No valid roles found.')
            .setColor('#5865F2')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
