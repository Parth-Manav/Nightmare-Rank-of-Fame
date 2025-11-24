const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('managerole')
        .setDescription('Start managing a role (allows it to be tracked and displayed)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to manage')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const role = interaction.options.getRole('role');

        if (dataService.isRoleManaged(role.id)) {
            return await interaction.reply({
                content: `⚠️ Already managing role: ${role.name}`,
                ephemeral: true
            });
        }

        dataService.addManagedRole(role.id);
        logger.info(`Now managing role ${role.name} (${role.id})`);

        await interaction.reply({
            content: `✅ Now managing role: ${role.name}`,
            ephemeral: true
        });
    },
};
