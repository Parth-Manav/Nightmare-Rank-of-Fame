const { Events } = require('discord.js');
const logger = require('../utils/logger');
const dataService = require('../services/dataService');
const displayService = require('../services/displayService');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`✅ ${client.user.tag} has connected to Discord!`);

        // Initialize services
        displayService.setClient(client);

        // Register commands
        const commandHandler = client.commandHandler;
        if (commandHandler) {
            await commandHandler.registerCommands();
        }
    },
};
