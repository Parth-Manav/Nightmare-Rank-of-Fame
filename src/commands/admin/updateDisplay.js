const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const displayService = require('../../services/displayService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatedisplay')
        .setDescription('Manually update the role display')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        await displayService.updateRoleDisplay();
        await interaction.editReply({ content: 'Role display update queued successfully.' });
    },
};
