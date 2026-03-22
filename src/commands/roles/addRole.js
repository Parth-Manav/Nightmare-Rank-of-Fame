const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const displayService = require('../../services/displayService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Add a managed role to a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add the role to')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to add')
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
                content: `❌ The role ${role.name} is not managed by the bot. Use \`/managerole\` first.`,
                ephemeral: true
            });
        }

        // Check if bot can manage this role hierarchy
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (role.position >= botMember.roles.highest.position) {
            return await interaction.reply({
                content: `❌ I cannot modify the role ${role.name} because it's higher than or equal to my highest role.`,
                ephemeral: true
            });
        }

        if (member.roles.cache.has(role.id)) {
            return await interaction.reply({
                content: `⚠️ ${member.displayName} already has the role ${role.name}.`,
                ephemeral: true
            });
        }

        await member.roles.add(role);

        // Fetch CURRENT database state ONLY AFTER Discord replies
        const finalRoles = dataService.getMemberRoles(member.id);
        if (dataService.getMembers()[member.id]) {
            const newRoles = Array.from(new Set([...finalRoles, role.id]));
            dataService.updateMemberRoles(member.id, newRoles);
        }

        logger.info(`Added role ${role.name} to member ${member.displayName}`);

        await interaction.reply({
            content: `✅ Added role ${role.name} to ${member.displayName}.`,
            ephemeral: true
        });

        // BUGFIX: Call targeted update on just this user and do not recalculate all
        await displayService.updateRoleDisplay(interaction.guild, member.id);
    },
};
