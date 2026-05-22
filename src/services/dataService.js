const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_DATA = {
    version: '2.0.0',
    channel_id: null,
    members: {},
    managed_roles: {},
    message_ids: {}
};

function createDefaultData() {
    return {
        version: DEFAULT_DATA.version,
        channel_id: DEFAULT_DATA.channel_id,
        members: {},
        managed_roles: {},
        message_ids: {}
    };
}

function getTempFilePath(dataFile) {
    const parsed = path.parse(dataFile);
    return path.join(parsed.dir, `${parsed.name}.tmp${parsed.ext}`);
}

class DataService {
    constructor(options = {}) {
        const defaultDataFile = path.join(__dirname, '../../bot_data.json');

        this.dataFile = options.dataFile || process.env.BOT_DATA_FILE || defaultDataFile;
        this.tempFile = options.tempFile || getTempFilePath(this.dataFile);
        this.data = createDefaultData();
        this.isSaving = false;
        this.saveQueue = false;

        if (options.load !== false) {
            this.loadDataSync();
        }
    }

    loadDataSync() {
        try {
            if (fs.existsSync(this.dataFile)) {
                try {
                    const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                    const loadedData = JSON.parse(fileContent);
                    this.data = { ...this.data, ...loadedData };
                    logger.info('Data loaded successfully');
                } catch (parseError) {
                    logger.error('Runtime data file bot_data.json is corrupted and failed to parse.', parseError);
                    logger.error('Startup aborted to avoid overwriting existing runtime state.');
                    process.exit(1);
                }
            } else {
                logger.info('No existing data file found, starting fresh');
                this.saveDataAsync();
            }
        } catch (error) {
            logger.error('Error loading data:', error);
        }
    }

    async saveDataAsync() {
        if (this.isSaving) {
            this.saveQueue = true;
            return;
        }
        this.isSaving = true;
        this.saveQueue = false;

        try {
            const tempStr = JSON.stringify(this.data, null, 2);
            await fsPromises.writeFile(this.tempFile, tempStr, 'utf8');
            try {
                await fsPromises.rename(this.tempFile, this.dataFile);
            } catch (renameErr) {
                if (renameErr.code === 'EXDEV') {
                    await fsPromises.copyFile(this.tempFile, this.dataFile);
                    await fsPromises.unlink(this.tempFile).catch(() => {});
                } else throw renameErr;
            }
            logger.debug('Data saved successfully with atomic file replacement');
        } catch (error) {
            logger.error('Error saving data atomically:', error);
        } finally {
            this.isSaving = false;
            // If state changed during a write, immediately flush the newest snapshot.
            if (this.saveQueue) {
                await this.saveDataAsync();
            }
        }
    }

    getChannelId() {
        return this.data.channel_id;
    }

    setChannelId(id) {
        this.data.channel_id = id;
        this.saveDataAsync();
    }

    getMembers() {
        return this.data.members;
    }

    addMember(memberId) {
        if (!this.data.members[memberId]) {
            this.data.members[memberId] = [];
            this.saveDataAsync();
            return true;
        }
        return false;
    }

    removeMember(memberId) {
        if (this.data.members[memberId]) {
            delete this.data.members[memberId];
            this.saveDataAsync();
            return true;
        }
        return false;
    }

    getMemberRoles(memberId) {
        return this.data.members[memberId] || [];
    }

    updateMemberRoles(memberId, roles) {
        this.data.members[memberId] = roles;
        this.saveDataAsync();
    }

    getManagedRoles() {
        return this.data.managed_roles;
    }

    isRoleManaged(roleId) {
        return !!this.data.managed_roles[roleId];
    }

    addManagedRole(roleId) {
        if (!this.data.managed_roles[roleId]) {
            this.data.managed_roles[roleId] = true;
            this.saveDataAsync();
            return true;
        }
        return false;
    }

    removeManagedRole(roleId) {
        if (this.data.managed_roles[roleId]) {
            delete this.data.managed_roles[roleId];
            this.saveDataAsync();
            return true;
        }
        return false;
    }

    getMessageId(memberId) {
        return this.data.message_ids[memberId];
    }

    setMessageId(memberId, messageId) {
        this.data.message_ids[memberId] = messageId;
        this.saveDataAsync();
    }

    removeMessageId(memberId) {
        if (this.data.message_ids[memberId]) {
            delete this.data.message_ids[memberId];
            this.saveDataAsync();
        }
    }
}

const dataService = new DataService();

module.exports = dataService;
module.exports.DataService = DataService;
module.exports.DEFAULT_DATA = DEFAULT_DATA;
