const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setdisplaychannel')
        .setDescription('Set the current channel as the role display channel')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        dataService.setChannelId(interaction.channel.id);
        logger.info(`Display channel set to ${interaction.channel.name} (${interaction.channel.id})`);
        await interaction.reply({ content: `✅ Display channel set to ${interaction.channel.name}.`, ephemeral: true });
    },
};
