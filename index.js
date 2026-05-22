const { ReadableStream } = require('stream/web');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const CommandHandler = require('./src/handlers/commandHandler');
const EventHandler = require('./src/handlers/eventHandler');

if (!config.discordToken) {
  logger.error('Missing Discord token. Set DISCORD_TOKEN in .env before starting the service.');
  process.exit(1);
}

if (config.isUsingLegacyTokenName) {
  logger.warn('Using legacy environment variable "token". Prefer DISCORD_TOKEN for new deployments.');
}

// Lightweight health endpoint for uptime checks and container probes.
const app = express();
app.get('/', (req, res) => res.send('Discord Role Display Automation Service is running.'));
app.listen(config.port, () => logger.info(`Health server listening on port ${config.port}`));

// Initialize Discord client.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

const commandHandler = new CommandHandler(client);
const eventHandler = new EventHandler(client);

commandHandler.loadCommands();
eventHandler.loadEvents();

client.commandHandler = commandHandler;

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

client.login(config.discordToken).catch(error => {
  logger.error('Failed to login to Discord:', error);
  process.exit(1);
});
