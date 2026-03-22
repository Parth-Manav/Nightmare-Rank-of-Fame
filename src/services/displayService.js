const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const dataService = require('./dataService');

class DisplayService {
    constructor() {
        this.client = null;
        this.updateQueue = new Map();
        this.isProcessing = false;
    }

    setClient(client) {
        this.client = client;
    }

    async updateRoleDisplay(guild = null, specificMemberId = null) {
        const channelId = dataService.getChannelId();
        if (!channelId) {
            logger.warn('No display channel set, skipping update');
            return;
        }

        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            logger.error('Display channel not found. Auto-clearing invalid channel from DB to prevent further failures.');
            dataService.setChannelId(null);
            return;
        }

        const membersToDisplay = dataService.getMembers();

        if (specificMemberId && guild) {
            const roleIds = membersToDisplay[specificMemberId] || [];
            this.queueMemberUpdate(guild, channel, specificMemberId, roleIds);
        } else {
            for (const [memberId, roleIds] of Object.entries(membersToDisplay)) {
                const fallbackGuild = guild || this.client.guilds.cache.first();
                if (fallbackGuild) {
                    this.queueMemberUpdate(fallbackGuild, channel, memberId, roleIds);
                }
            }
        }
    }

    queueMemberUpdate(guild, channel, memberId, roleIds) {
        // Enqueue update to map (deduplicates rapid changes for the same member)
        this.updateQueue.set(memberId, { guild, channel, memberId, roleIds });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.updateQueue.size > 0) {
            const [key, task] = this.updateQueue.entries().next().value;
            this.updateQueue.delete(key);

            try {
                await Promise.race([
                    this.updateMemberDisplay(task.guild, task.channel, task.memberId, task.roleIds),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Discord Fetch API Hang Timeout')), 10000))
                ]);
            } catch (err) {
                logger.error(`Update timeout/failed for ${task.memberId}, releasing queue loop:`, err);
            }
            
            // Wait 1 second between processing elements to strictly obey Discord rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.isProcessing = false;
    }

    async updateMemberDisplay(guild, channel, memberId, roleIds) {
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (!member) {
            logger.warn(`Member ID ${memberId} not found in server. Skipping embed display.`);
            return;
        }

        const roles = roleIds
            .map(roleId => guild.roles.cache.get(roleId))
            .filter(Boolean)
            .filter(role => dataService.isRoleManaged(role.id));

        const embed = new EmbedBuilder()
            .setTitle(`${member.displayName}'s Roles`)
            .setColor(member.displayHexColor || '#5865F2')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        if (roles.length > 0) {
            const roleList = roles.map(role => `<@&${role.id}>`).join('\n');
            embed.setDescription(roleList);
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
