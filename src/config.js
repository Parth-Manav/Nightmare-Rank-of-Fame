const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DEFAULT_PORT = 3000;

function parsePort(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

const hasDiscordToken = Boolean(process.env.DISCORD_TOKEN);
const hasLegacyToken = Boolean(process.env.token);

module.exports = {
    discordToken: process.env.DISCORD_TOKEN || process.env.token,
    isUsingLegacyTokenName: !hasDiscordToken && hasLegacyToken,
    logLevel: process.env.LOG_LEVEL || 'info',
    port: parsePort(process.env.PORT),
};
