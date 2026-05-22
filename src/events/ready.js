const { Events } = require('discord.js');
const logger = require('../utils/logger');
const displayService = require('../services/displayService');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`${client.user.tag} connected to Discord.`);

        displayService.setClient(client);

        const commandHandler = client.commandHandler;
        if (commandHandler) {
            await commandHandler.registerCommands();
        }
    },
};
