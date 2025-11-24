const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class DataService {
    constructor() {
        this.dataFile = path.join(__dirname, '../../bot_data.json');
        this.data = {
            version: '2.0.0',
            channel_id: null,
            members: {},
            managed_roles: {},
            message_ids: {}
        };
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                const loadedData = JSON.parse(fileContent);
                this.data = { ...this.data, ...loadedData };
                logger.info('Data loaded successfully');
            } else {
                logger.info('No existing data file found, starting fresh');
                this.saveData();
            }
        } catch (error) {
            logger.error('Error loading data:', error);
        }
    }

    saveData() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
            logger.debug('Data saved successfully');
        } catch (error) {
            logger.error('Error saving data:', error);
        }
    }

    getChannelId() {
        return this.data.channel_id;
    }

    setChannelId(id) {
        this.data.channel_id = id;
        this.saveData();
    }

    getMembers() {
        return this.data.members;
    }

    addMember(memberId) {
        if (!this.data.members[memberId]) {
            this.data.members[memberId] = [];
            this.saveData();
            return true;
        }
        return false;
    }

    removeMember(memberId) {
        if (this.data.members[memberId]) {
            delete this.data.members[memberId];
            this.saveData();
            return true;
        }
        return false;
    }

    getMemberRoles(memberId) {
        return this.data.members[memberId] || [];
    }

    updateMemberRoles(memberId, roles) {
        this.data.members[memberId] = roles;
        this.saveData();
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
            this.saveData();
            return true;
        }
        return false;
    }

    removeManagedRole(roleId) {
        if (this.data.managed_roles[roleId]) {
            delete this.data.managed_roles[roleId];
            this.saveData();
            return true;
        }
        return false;
    }

    getMessageId(memberId) {
        return this.data.message_ids[memberId];
    }

    setMessageId(memberId, messageId) {
        this.data.message_ids[memberId] = messageId;
        this.saveData();
    }

    removeMessageId(memberId) {
        if (this.data.message_ids[memberId]) {
            delete this.data.message_ids[memberId];
            this.saveData();
        }
    }
}

module.exports = new DataService();
