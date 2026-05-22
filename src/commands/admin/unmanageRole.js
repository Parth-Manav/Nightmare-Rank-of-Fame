const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const displayService = require('../../services/displayService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmanagerole')
        .setDescription('Stop managing a role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to stop managing')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');

        if (!dataService.isRoleManaged(role.id)) {
            return await interaction.reply({
                content: `Not currently managing role: ${role.name}`,
                ephemeral: true
            });
        }

        dataService.removeManagedRole(role.id);
        logger.info(`No longer managing role ${role.name} (${role.id})`);

        await interaction.reply({
            content: `No longer managing role: ${role.name}`,
            ephemeral: true
        });

        await displayService.updateRoleDisplay();
    },
};
