const { ReadableStream } = require('stream/web');
global.ReadableStream = ReadableStream;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const logger = require('./src/utils/logger');
const CommandHandler = require('./src/handlers/commandHandler');
const EventHandler = require('./src/handlers/eventHandler');

// Initialize Express server for uptime
const app = express();
app.get('/', (req, res) => res.send('Discord Role Manager Bot is running!'));
app.listen(3000, () => logger.info('Server is running on port 3000'));

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
});

// Attach collections for handlers
client.commands = new Collection();

// Initialize Handlers
const commandHandler = new CommandHandler(client);
const eventHandler = new EventHandler(client);

// Load Commands and Events
commandHandler.loadCommands();
eventHandler.loadEvents();

// Attach handlers to client for access in events
client.commandHandler = commandHandler;

// Handle process errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

// Login
client.login(process.env.token).catch(error => {
  logger.error('Failed to login:', error);
  process.exit(1);
});