const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const dataService = require('../../services/dataService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listtrackedmembers')
        .setDescription('List all members currently being tracked in the display')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const membersMap = dataService.getMembers();
        const memberIds = Object.keys(membersMap);

        if (memberIds.length === 0) {
            return await interaction.reply({
                content: 'No members are currently being tracked.',
                ephemeral: true
            });
        }

        const members = [];
        for (const id of memberIds) {
            const member = await interaction.guild.members.fetch(id).catch(() => null);
            if (member) {
                const roleCount = (membersMap[id] || []).length;
                members.push(`- ${member.displayName} (${roleCount} role${roleCount !== 1 ? 's' : ''})`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('Tracked Members')
            .setDescription(members.join('\n') || 'No valid members found.')
            .setColor('#5865F2')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
