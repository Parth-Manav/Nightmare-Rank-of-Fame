const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.join(__dirname, '../..');

function createTempDataFile(name = 'bot_data.json') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'role-display-service-'));
    return {
        dir,
        dataFile: path.join(dir, name),
    };
}

function clearProjectModules() {
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.startsWith(path.join(rootDir, 'src'))) {
            delete require.cache[modulePath];
        }
    }
}

async function waitForSaves(dataService) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (!dataService.isSaving && !dataService.saveQueue) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    throw new Error('Timed out waiting for DataService writes to finish');
}

function loadFreshServices() {
    const temp = createTempDataFile();
    process.env.BOT_DATA_FILE = temp.dataFile;
    process.env.LOG_LEVEL = 'error';
    clearProjectModules();

    const dataService = require('../../src/services/dataService');
    const displayService = require('../../src/services/displayService');

    return { ...temp, dataService, displayService };
}

module.exports = {
    rootDir,
    createTempDataFile,
    clearProjectModules,
    waitForSaves,
    loadFreshServices,
};
