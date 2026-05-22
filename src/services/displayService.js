const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const dataService = require('./dataService');

const QUEUE_DELAY_MS = 1000;
const UPDATE_TIMEOUT_MS = 10000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class DisplayService {
    constructor(options = {}) {
        this.client = null;
        this.updateQueue = new Map();
        this.isProcessing = false;
        this.dataService = options.dataService || dataService;
        this.queueDelayMs = options.queueDelayMs ?? QUEUE_DELAY_MS;
        this.updateTimeoutMs = options.updateTimeoutMs ?? UPDATE_TIMEOUT_MS;
    }

    setClient(client) {
        this.client = client;
    }

    async updateRoleDisplay(guild = null, specificMemberId = null) {
        const channelId = this.dataService.getChannelId();
        if (!channelId) {
            logger.warn('No display channel set, skipping update');
            return;
        }

        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            logger.error('Display channel not found. Auto-clearing invalid channel from DB to prevent further failures.');
            this.dataService.setChannelId(null);
            return;
        }

        const membersToDisplay = this.dataService.getMembers();

        if (specificMemberId && guild) {
            if (!Object.prototype.hasOwnProperty.call(membersToDisplay, specificMemberId)) {
                logger.debug(`Member ID ${specificMemberId} is not tracked. Skipping targeted display update.`);
                return;
            }
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
        // A Map keeps only the newest pending update per member during role bursts.
        this.updateQueue.set(memberId, { guild, channel, memberId, roleIds });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            while (this.updateQueue.size > 0) {
                const [key, task] = this.updateQueue.entries().next().value;
                this.updateQueue.delete(key);

                try {
                    await Promise.race([
                        this.updateMemberDisplay(task.guild, task.channel, task.memberId, task.roleIds),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Discord API fetch timed out')), this.updateTimeoutMs))
                    ]);
                } catch (err) {
                    logger.error(`Display update failed for member ${task.memberId}; continuing queue processing.`, err);
                }

                // Process one Discord message update per interval to reduce rate-limit pressure.
                if (this.queueDelayMs > 0) {
                    await delay(this.queueDelayMs);
                }
            }
        } finally {
            this.isProcessing = false;
        }
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
            .filter(role => this.dataService.isRoleManaged(role.id));

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
            const messageId = this.dataService.getMessageId(memberId);
            if (messageId) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [embed] });
                    logger.debug(`Updated display for member ${member.displayName}`);
                } else {
                    const newMessage = await channel.send({ embeds: [embed] });
                    this.dataService.setMessageId(memberId, newMessage.id);
                    logger.info(`Created new display for member ${member.displayName} (message was missing)`);
                }
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                this.dataService.setMessageId(memberId, newMessage.id);
                logger.info(`Created display for member ${member.displayName}`);
            }
        } catch (error) {
            logger.error(`Error updating display for member ${memberId}:`, error);
        }
    }
}

const displayService = new DisplayService();

module.exports = displayService;
module.exports.DisplayService = DisplayService;
