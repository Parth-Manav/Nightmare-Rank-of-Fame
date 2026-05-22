function createRole(id, name = `Role ${id}`, position = 1) {
    return { id, name, position };
}

function createRoleCache(roleIds, roleMap = new Map()) {
    const roles = roleIds.map(id => roleMap.get(id) || createRole(id));

    return {
        filter(predicate) {
            return roles.filter(predicate);
        },
        get(id) {
            return roleMap.get(id) || roles.find(role => role.id === id);
        },
    };
}

function createMember(id, options = {}) {
    const roleIds = new Set(options.roleIds || []);
    const roleMap = options.roleMap || new Map();

    return {
        id,
        displayName: options.displayName || `Member ${id}`,
        displayHexColor: options.displayHexColor || '#5865F2',
        user: {
            id,
            displayAvatarURL: () => `https://cdn.example.test/${id}.png`,
        },
        roles: {
            cache: {
                has: roleId => roleIds.has(roleId),
                filter: predicate => Array.from(roleIds)
                    .map(roleId => roleMap.get(roleId) || createRole(roleId))
                    .filter(predicate),
            },
            highest: { position: options.highestPosition || 1 },
            add: async role => {
                roleIds.add(role.id);
            },
            remove: async role => {
                roleIds.delete(role.id);
            },
        },
        getRoleIds: () => Array.from(roleIds),
    };
}

function createGuild({ members = new Map(), roles = new Map(), botPosition = 100 } = {}) {
    const botMember = createMember('bot', { highestPosition: botPosition });

    return {
        members: {
            fetch: async id => {
                if (id === 'bot') return botMember;
                const member = members.get(id);
                if (!member) throw new Error(`Missing member ${id}`);
                return member;
            },
        },
        roles: {
            cache: {
                get: id => roles.get(id),
            },
        },
    };
}

function createChannel(options = {}) {
    const messages = new Map(options.messages || []);
    const sent = [];
    const edited = [];
    const deleted = [];

    return {
        id: options.id || 'channel-1',
        name: options.name || 'display',
        sent,
        edited,
        deleted,
        messages: {
            fetch: async id => {
                if (options.fetchReject) throw new Error('message fetch failed');
                return messages.get(id) || null;
            },
        },
        send: async payload => {
            if (options.sendReject) throw new Error('message send failed');
            const id = `sent-${sent.length + 1}`;
            sent.push(payload);
            messages.set(id, {
                id,
                edit: async editPayload => {
                    edited.push(editPayload);
                },
                delete: async () => {
                    deleted.push(id);
                },
            });
            return { id };
        },
    };
}

function createEditableMessage(id, edited = [], options = {}) {
    return {
        id,
        edit: async payload => {
            if (options.editReject) throw new Error('message edit failed');
            edited.push(payload);
        },
        delete: async () => {},
    };
}

function createInteraction({ guild, channel, user, role, client } = {}) {
    const calls = [];

    return {
        guild,
        channel: channel || { id: 'channel-1', name: 'display' },
        client: client || {
            user: { id: 'bot' },
            channels: {
                fetch: async () => channel,
            },
        },
        options: {
            getUser: () => user,
            getRole: () => role,
        },
        replied: false,
        deferred: false,
        calls,
        reply: async payload => {
            calls.push({ method: 'reply', payload });
            return payload;
        },
        deferReply: async payload => {
            calls.push({ method: 'deferReply', payload });
        },
        editReply: async payload => {
            calls.push({ method: 'editReply', payload });
        },
        followUp: async payload => {
            calls.push({ method: 'followUp', payload });
        },
    };
}

module.exports = {
    createRole,
    createRoleCache,
    createMember,
    createGuild,
    createChannel,
    createEditableMessage,
    createInteraction,
};
