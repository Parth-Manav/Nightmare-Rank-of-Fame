const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const displayService = require('../../services/displayService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addmember')
        .setDescription('Add a member to the role display')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return await interaction.reply({ content: '❌ Could not find that member in this server.', ephemeral: true });
        }

        if (!dataService.addMember(member.id)) {
            return await interaction.reply({ content: `⚠️ ${member.displayName} is already being tracked.`, ephemeral: true });
        }

        logger.info(`Added member ${member.displayName} (${member.id}) to tracking`);

        await interaction.reply({ content: `✅ Added ${member.displayName} to the role display.`, ephemeral: true });
        await displayService.updateRoleDisplay();
    },
};
