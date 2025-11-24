const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const dataService = require('./dataService');

class DisplayService {
    constructor() {
        this.client = null;
    }

    setClient(client) {
        this.client = client;
    }

    async updateRoleDisplay() {
        const channelId = dataService.getChannelId();
        if (!channelId) {
            logger.warn('No display channel set, skipping update');
            return;
        }

        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            logger.error('Display channel not found');
            return;
        }

        const guild = channel.guild;
        const membersToDisplay = dataService.getMembers();

        for (const [memberId, roleIds] of Object.entries(membersToDisplay)) {
            await this.updateMemberDisplay(guild, channel, memberId, roleIds);
        }
    }

    async updateMemberDisplay(guild, channel, memberId, roleIds) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (!member) {
            logger.warn(`Member ID ${memberId} not found in server`);
            return;
        }

        const roles = roleIds
            .map(roleId => guild.roles.cache.get(roleId))
            .filter(Boolean)
            .filter(role => dataService.isRoleManaged(role.id));

        const embed = new EmbedBuilder()
            .setTitle(`${member.displayName}'s Roles`)
            .setColor(member.displayHexColor || '#5865F2')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (roles.length > 0) {
            const roleList = roles.map(role => `<@&${role.id}>`).join('\n');
            embed.setDescription(roleList);
            embed.setFooter({ text: `${roles.length} role${roles.length !== 1 ? 's' : ''}` });
        } else {
            embed.setDescription('*No displayed roles for this user.*');
        }

        try {
            const messageId = dataService.getMessageId(memberId);
            if (messageId) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [embed] });
                    logger.debug(`Updated display for member ${member.displayName}`);
                } else {
                    const newMessage = await channel.send({ embeds: [embed] });
                    dataService.setMessageId(memberId, newMessage.id);
                    logger.info(`Created new display for member ${member.displayName} (message was missing)`);
                }
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                dataService.setMessageId(memberId, newMessage.id);
                logger.info(`Created display for member ${member.displayName}`);
            }
        } catch (error) {
            logger.error(`Error updating display for member ${memberId}:`, error);
        }
    }
}

module.exports = new DisplayService();
