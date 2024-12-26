const express = require('express');
const app = express();

app.listen(3000, () => {
  console.log('Server is running on port 3000');
})

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const Discord = require('discord.js');
//const client = new Discord.Client({ intents: ['Guilds', 'GuildMessages'] });



const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

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

let ROLE_DISPLAY_CHANNEL_ID = null;
let MEMBERS_TO_DISPLAY = {};
let MANAGED_ROLES = {};
const DATA_FILE = 'bot_data.json';

function saveData() {
  const data = { 
    channel_id: ROLE_DISPLAY_CHANNEL_ID, 
    members: MEMBERS_TO_DISPLAY,
    managed_roles: MANAGED_ROLES
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    ROLE_DISPLAY_CHANNEL_ID = data.channel_id;
    MEMBERS_TO_DISPLAY = data.members || {};
    MANAGED_ROLES = data.managed_roles || {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Error loading data:', error);
  }
}

client.once('ready', () => {
  console.log(`${client.user.tag} has connected to Discord!`);
  loadData();
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    if (args[0]?.toLowerCase() === client.user.username.toLowerCase()) {
      sendHelpMessage(message);
    }
    return;
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("You don't have permission to use this command.");
  }

  switch (command) {
    case 'setdisplaychannel':
      ROLE_DISPLAY_CHANNEL_ID = message.channel.id;
      saveData();
      message.reply(`Display channel set to ${message.channel.name}.`);
      break;
    case 'addmember':
      await addMember(message, args);
      break;
    case 'removemember':
      await removeMember(message, args);
      break;
    case 'addrole':
      await addRole(message, args);
      break;
    case 'removerole':
      await removeRole(message, args);
      break;
    case 'managerole':
      await manageRole(message, args);
      break;
    case 'unmanagerole':
      await unmanageRole(message, args);
      break;
    case 'updatedisplay':
      await updateRoleDisplay();
      message.reply('Role display updated.');
      break;
    default:
      message.reply('Unknown command. Use !help for a list of available commands.');
  }
});

async function addMember(message, args) {
  if (args.length < 1) {
    return message.reply('Usage: !addmember @username');
  }

  const member = message.mentions.members.first();
  if (!member) {
    return message.reply('Please mention a valid member.');
  }

  MEMBERS_TO_DISPLAY[member.id] = [];
  saveData();

  message.reply(`Added ${member.displayName} to the role display.`);
  updateRoleDisplay();
}

async function removeMember(message, args) {
  if (args.length !== 1) {
    return message.reply('Usage: !removemember @username');
  }

  const member = message.mentions.members.first();
  if (!member) {
    return message.reply('Please mention a valid member.');
  }

  if (MEMBERS_TO_DISPLAY[member.id]) {
    delete MEMBERS_TO_DISPLAY[member.id];
    saveData();
    message.reply(`Removed ${member.displayName} from the role display.`);
    updateRoleDisplay();
  } else {
    message.reply(`${member.displayName} was not in the role display.`);
  }
}

async function addRole(message, args) {
  if (args.length < 2) {
    return message.reply('Usage: !addrole @username @role1 @role2 ... (or role names)');
  }

  const member = message.mentions.members.first();
  if (!member) {
    return message.reply('Please mention a valid member.');
  }

  const roleInputs = args.slice(1);
  const roles = roleInputs.map(input => {
    const mentionedRole = message.mentions.roles.find(r => r.toString() === input);
    if (mentionedRole) return mentionedRole;
    return message.guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
  }).filter(Boolean);

  if (roles.length === 0) {
    return message.reply('No valid roles specified.');
  }

  const managedRoles = roles.filter(role => MANAGED_ROLES[role.id]);
  if (managedRoles.length === 0) {
    return message.reply('None of the specified roles are managed by the bot.');
  }

  try {
    await member.roles.add(managedRoles);
    MEMBERS_TO_DISPLAY[member.id] = Array.from(new Set([
      ...(MEMBERS_TO_DISPLAY[member.id] || []),
      ...managedRoles.map(r => r.id)
    ]));
    saveData();

    message.reply(`Added roles to ${member.displayName}: ${managedRoles.map(role => role.name).join(', ')}`);
    updateRoleDisplay();
  } catch (error) {
    console.error('Error adding roles:', error);
    message.reply('An error occurred while adding roles. Please check the bot\'s permissions and try again.');
  }
}

async function removeRole(message, args) {
  if (args.length < 2) {
    return message.reply('Usage: !removerole @username @role1 @role2 ... (or role names)');
  }

  const member = message.mentions.members.first();
  if (!member) {
    return message.reply('Please mention a valid member.');
  }

  const roleInputs = args.slice(1);
  const roles = roleInputs.map(input => {
    const mentionedRole = message.mentions.roles.find(r => r.toString() === input);
    if (mentionedRole) return mentionedRole;
    return message.guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
  }).filter(Boolean);

  if (roles.length === 0) {
    return message.reply('No valid roles specified.');
  }

  const managedRoles = roles.filter(role => MANAGED_ROLES[role.id]);
  if (managedRoles.length === 0) {
    return message.reply('None of the specified roles are managed by the bot.');
  }

  try {
    await member.roles.remove(managedRoles);
    MEMBERS_TO_DISPLAY[member.id] = (MEMBERS_TO_DISPLAY[member.id] || []).filter(id => !managedRoles.map(r => r.id).includes(id));
    saveData();

    message.reply(`Removed roles from ${member.displayName}: ${managedRoles.map(role => role.name).join(', ')}`);
    updateRoleDisplay();
  } catch (error) {
    console.error('Error removing roles:', error);
    message.reply('An error occurred while removing roles. Please check the bot\'s permissions and try again.');
  }
}

async function manageRole(message, args) {
  if (args.length !== 1) {
    return message.reply('Usage: !managerole @role (or role name)');
  }

  const roleInput = args[0];
  const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());

  if (!role) {
    return message.reply('Role not found.');
  }

  MANAGED_ROLES[role.id] = true;
  saveData();

  message.reply(`Now managing role: ${role.name}`);
}

async function unmanageRole(message, args) {
  if (args.length !== 1) {
    return message.reply('Usage: !unmanagerole @role (or role name)');
  }

  const roleInput = args[0];
  const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());

  if (!role) {
    return message.reply('Role not found.');
  }

  delete MANAGED_ROLES[role.id];
  saveData();

  message.reply(`No longer managing role: ${role.name}`);
}

function sendHelpMessage(message) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`${client.user.username} Help`)
    .setDescription('Here are the available commands:')
    .addFields(
      { name: '!help', value: 'Show this help message' },
      { name: '!setdisplaychannel', value: 'Set the current channel as the role display channel' },
      { name: '!addmember @username', value: 'Add a member to the role display' },
      { name: '!removemember @username', value: 'Remove a member from the role display' },
      { name: '!addrole @username @role1 @role2 ... (or role names)', value: 'Add managed roles to a member and update the display' },
      { name: '!removerole @username @role1 @role2 ... (or role names)', value: 'Remove managed roles from a member and update the display' },
      { name: '!managerole @role (or role name)', value: 'Start managing a role' },
      { name: '!unmanagerole @role (or role name)', value: 'Stop managing a role' },
      { name: '!updatedisplay', value: 'Manually update the role display' }
    )
    .setFooter({ text: 'Only administrators can use these commands.' });

  message.channel.send({ embeds: [embed] });
}

async function updateRoleDisplay() {
  if (!ROLE_DISPLAY_CHANNEL_ID) return;
  const channel = await client.channels.fetch(ROLE_DISPLAY_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const guild = channel.guild;

  // Clear previous messages
  const messages = await channel.messages.fetch({ limit: 100 });
  await channel.bulkDelete(messages.filter(m => m.author.id === client.user.id));

  // Create and send embeds for each member
  for (const [memberId, roleIds] of Object.entries(MEMBERS_TO_DISPLAY)) {
    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      console.log(`Member ID ${memberId} not found in server`);
      continue;
    }

    const roles = roleIds
      .map(roleId => guild.roles.cache.get(roleId))
      .filter(Boolean)
      .filter(role => MANAGED_ROLES[role.id]);

    const embed = new EmbedBuilder()
      .setTitle(`${member.displayName}'s Roles`)
      .setColor(member.displayHexColor)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

    if (roles.length > 0) {
      const roleList = roles.map(role => `<@&${role.id}>`).join('\n');
      embed.setDescription(roleList);
    } else {
      embed.setDescription('No displayed roles for this user.');
    }

    await channel.send({ embeds: [embed] });
  }
}

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (MEMBERS_TO_DISPLAY[newMember.id]) {
    const oldRoles = oldMember.roles.cache.filter(r => MANAGED_ROLES[r.id]).map(r => r.id).sort();
    const newRoles = newMember.roles.cache.filter(r => MANAGED_ROLES[r.id]).map(r => r.id).sort();
    if (JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) {
      MEMBERS_TO_DISPLAY[newMember.id] = newRoles;
      saveData();
      updateRoleDisplay();
    }
  }
});

client.login(process.env.token);