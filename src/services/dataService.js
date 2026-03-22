const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

class DataService {
    constructor() {
        this.dataFile = path.join(__dirname, '../../bot_data.json');
        this.tempFile = path.join(__dirname, '../../bot_data.tmp.json');
        this.data = {
            version: '2.0.0',
            channel_id: null,
            members: {},
            managed_roles: {},
            message_ids: {}
        };
        this.isSaving = false;
        this.saveQueue = false;
        this.loadDataSync();
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
                    logger.error('CRITICAL FATAL: bot_data.json is corrupted and failed to parse!', parseError);
                    logger.error('ABORTING BOOT TO PREVENT CASCADING DATA ERASURE.');
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
            logger.debug('Data saved successfully (Atomic)');
        } catch (error) {
            logger.error('Error saving data atomicaly:', error);
        } finally {
            this.isSaving = false;
            // If another change occurred while saving, run it again to guarantee latest flush
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

module.exports = new DataService();
