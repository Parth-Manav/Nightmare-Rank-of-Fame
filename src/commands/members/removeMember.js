const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const dataService = require('../../services/dataService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removemember')
        .setDescription('Remove a member from the role display')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return await interaction.reply({ content: '❌ Could not find that member in this server.', ephemeral: true });
        }

        if (!dataService.removeMember(member.id)) {
            return await interaction.reply({ content: `⚠️ ${member.displayName} is not being tracked.`, ephemeral: true });
        }

        // Delete the member's display message if it exists
        const messageId = dataService.getMessageId(member.id);
        if (messageId) {
            try {
                const channelId = dataService.getChannelId();
                const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(messageId).catch(() => null);
                    if (message) await message.delete();
                }
            } catch (error) {
                logger.error(`Error deleting message for member ${member.id}:`, error);
            } finally {
                // BUGFIX: Always clear the message ID even if fetch/delete failed
                dataService.removeMessageId(member.id);
            }
        }

        logger.info(`Removed member ${member.displayName} (${member.id}) from tracking`);

        await interaction.reply({ content: `✅ Removed ${member.displayName} from the role display.`, ephemeral: true });
    },
};
