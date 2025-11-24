# Discord Role Manager Bot 2.0

A modern Discord bot for managing and displaying member roles with slash commands.

## Features

✨ **Modern Slash Commands** - Uses Discord's native slash command system with auto-complete and validation

🎯 **Smart Display Updates** - Edits existing messages instead of recreating them (much more efficient!)

📝 **Comprehensive Logging** - Winston-powered logging to both console and file

🛡️ **Error Handling** - Proper error handling with clear user feedback

✅ **Input Validation** - Validates permissions, role hierarchy, and prevents duplicate operations

🎨 **Better UX** - Emoji feedback, clear error messages, and helpful confirmations

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   
   Make sure your `.env` file contains your bot token:
   ```
   token=YOUR_BOT_TOKEN_HERE
   ```

3. **Run the Bot**
   ```bash
   npm start
   ```

## Commands

All commands require Administrator permissions.

### Setup Commands

- `/setdisplaychannel` - Set the current channel as the role display channel
- `/managerole <role>` - Start managing a role (allows it to be tracked and displayed)
- `/unmanagerole <role>` - Stop managing a role

### Member Management

- `/addmember <user>` - Add a member to the role display tracking
- `/removemember <user>` - Remove a member from tracking

### Role Assignment

- `/addrole <user> <role>` - Add a managed role to a member
- `/removerole <user> <role>` - Remove a managed role from a member

### Utility Commands

- `/updatedisplay` - Manually refresh the role display
- `/listmanagedroles` - List all roles currently being managed
- `/listtrackedmembers` - List all members being tracked

## How It Works

1. **Set a display channel** where role embeds will appear
2. **Manage roles** you want to track (e.g., game roles, team roles)
3. **Add members** you want to display
4. **Assign roles** to members - the display updates automatically!

The bot creates beautiful embeds showing each member's avatar, name, and their managed roles. When roles change (either via bot commands or manually in Discord), the display updates automatically.

## Improvements from v1.0

- ✅ Migrated from prefix commands (`!command`) to slash commands (`/command`)
- ✅ Added proper environment variable loading with `dotenv`
- ✅ Smart message editing instead of bulk deletion (much faster!)
- ✅ Comprehensive error handling and logging
- ✅ Input validation and permission checks
- ✅ Better user feedback with emojis and clear messages
- ✅ Two new utility commands for listing managed roles and tracked members
- ✅ Stores message IDs for efficient updates
- ✅ Improved data file format with version field

## Logs

Check `bot.log` for detailed logging information including:
- Command usage
- Errors and stack traces
- Member and role updates
- System events

## Troubleshooting

**Commands not appearing?**
- Wait a few minutes after starting the bot for Discord to register commands
- Make sure the bot has the `applications.commands` scope

**Bot can't assign roles?**
- Ensure the bot's role is higher than the roles it's trying to manage
- Check that the bot has "Manage Roles" permission

**Display not updating?**
- Make sure you've set a display channel with `/setdisplaychannel`
- Check `bot.log` for any errors
