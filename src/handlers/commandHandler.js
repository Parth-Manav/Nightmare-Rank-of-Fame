const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');

class CommandHandler {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, '../commands');
        const commandFolders = fs.readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    this.client.commands.set(command.data.name, command);
                    this.commands.set(command.data.name, command.data.toJSON());
                    logger.debug(`Loaded command: ${command.data.name}`);
                } else {
                    logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }
    }

    async registerCommands() {
        const rest = new REST({ version: '10' }).setToken(process.env.token);
        const commands = Array.from(this.commands.values());

        try {
            logger.info(`Started refreshing ${commands.length} application (/) commands.`);

            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands },
            );

            logger.info('Successfully reloaded application (/) commands.');
        } catch (error) {
            logger.error('Error registering commands:', error);
        }
    }
}

module.exports = CommandHandler;
