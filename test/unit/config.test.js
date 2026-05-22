const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const test = require('node:test');
const { clearProjectModules, createTempDataFile, rootDir } = require('../helpers/moduleTools');

function loadConfigWithEnv(env) {
    const previous = {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        token: process.env.token,
        PORT: process.env.PORT,
        LOG_LEVEL: process.env.LOG_LEVEL,
    };

    delete process.env.DISCORD_TOKEN;
    delete process.env.token;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    Object.assign(process.env, env);

    clearProjectModules();
    delete require.cache[require.resolve('../../src/config')];
    const config = require('../../src/config');

    for (const key of Object.keys(previous)) {
        if (previous[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = previous[key];
        }
    }

    return config;
}

test('DISCORD_TOKEN is preferred over legacy token', () => {
    const config = loadConfigWithEnv({ DISCORD_TOKEN: 'preferred', token: 'legacy' });
    assert.equal(config.discordToken, 'preferred');
    assert.equal(config.isUsingLegacyTokenName, false);
});

test('legacy token still works when DISCORD_TOKEN is missing', () => {
    const config = loadConfigWithEnv({ token: 'legacy' });
    assert.equal(config.discordToken, 'legacy');
    assert.equal(config.isUsingLegacyTokenName, true);
});

test('PORT parsing falls back to 3000 for invalid values and parses valid values', () => {
    assert.equal(loadConfigWithEnv({ PORT: 'not-a-port' }).port, 3000);
    assert.equal(loadConfigWithEnv({ PORT: '-1' }).port, 3000);
    assert.equal(loadConfigWithEnv({ PORT: '8080' }).port, 8080);
});

test('LOG_LEVEL defaults to info', () => {
    assert.equal(loadConfigWithEnv({}).logLevel, 'info');
    assert.equal(loadConfigWithEnv({ LOG_LEVEL: 'debug' }).logLevel, 'debug');
});

test('startup exits clearly when Discord token is missing', () => {
    const { dataFile } = createTempDataFile();
    const result = spawnSync(process.execPath, ['index.js'], {
        cwd: rootDir,
        env: {
            ...process.env,
            BOT_DATA_FILE: dataFile,
            DISCORD_TOKEN: '',
            token: '',
            LOG_LEVEL: 'error',
        },
        encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Missing Discord token/);
});
