# Architecture

This document explains how the Discord Role Display Automation Service is organized. The project is intentionally small: the goal is to show clean backend automation patterns without turning the bot into a larger platform than it is.

## High-Level Flow

```text
index.js
  |
  +-- loads config from src/config.js
  +-- starts Express health endpoint
  +-- creates discord.js client
  +-- loads command and event modules

Discord Gateway
  |
  v
src/events/guildMemberUpdate.js
  |
  +-- checks whether the member is tracked
  +-- compares old/new managed role IDs
  +-- updates stored member role state
  +-- asks DisplayService to refresh that member

Slash commands
  |
  v
src/commands/*
  |
  +-- update tracked members
  +-- update managed roles
  +-- set display channel
  +-- queue display refreshes
```

## Runtime Components

### Entry Point

`index.js` is responsible for process startup:

- validates that a Discord token exists
- starts the Express health endpoint at `/`
- creates the Discord client
- enables only `Guilds` and `GuildMembers` Gateway intents
- loads slash commands and event handlers
- logs Discord client and process-level errors

### CommandHandler

`src/handlers/commandHandler.js` dynamically loads command modules from `src/commands/*` and registers slash commands through Discord REST APIs.

Command groups:

- `admin`: display channel and managed-role configuration
- `members`: tracked member lifecycle
- `roles`: managed role assignment/removal and listing

Every command uses Discord's administrator permission metadata through `setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)`.

### EventHandler

`src/handlers/eventHandler.js` loads event modules from `src/events`. The most important event for the service is `guildMemberUpdate`, which is used for role-delta detection.

### DataService

`src/services/dataService.js` owns local runtime state:

- configured display channel ID
- tracked member IDs and their managed role IDs
- managed role IDs
- display message IDs

Persistence is JSON-backed. Writes go to a temporary file first and then replace the live runtime file. If state changes during a write, another save is queued so the newest snapshot is flushed.

The default runtime file is `bot_data.json`. Tests and custom deployments can override this path with `BOT_DATA_FILE`.

### DisplayService

`src/services/displayService.js` owns display-channel synchronization:

- fetches the configured display channel
- builds embeds for tracked members
- edits existing display messages
- creates replacement messages when stored message IDs are stale
- queues updates using a `Map` to deduplicate pending work per member
- waits between production updates to reduce Discord API pressure

The service exports both the runtime singleton and the class. The class export exists so tests can inject fake data services, fake clients, and short queue timings.

## Data Flow Diagram

```text
                 +----------------------+
                 | Discord Gateway      |
                 | guildMemberUpdate    |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | Role-delta detection |
                 +----------+-----------+
                            |
              +-------------+-------------+
              |                           |
              v                           v
   +----------------------+     +----------------------+
   | DataService          |     | DisplayService       |
   | bot_data.json        |     | queue + embed update |
   +----------------------+     +----------+-----------+
                                           |
                                           v
                                +----------------------+
                                | Discord display      |
                                | channel messages     |
                                +----------------------+

                 +----------------------+
                 | Slash commands       |
                 +----------+-----------+
                            |
                            v
              +-------------+-------------+
              |                           |
              v                           v
   +----------------------+     +----------------------+
   | DataService          |     | DisplayService       |
   +----------------------+     +----------------------+
```

## Persistence Format

`bot_data.json` is generated at runtime and ignored by Git. The repository includes `bot_data.example.json`:

```json
{
  "version": "2.0.0",
  "channel_id": null,
  "members": {},
  "managed_roles": {},
  "message_ids": {}
}
```

This storage approach is simple and inspectable, which fits the current project scope. If the service grows, SQLite or PostgreSQL would be better choices.

## Reliability Notes

- Startup fails if the runtime JSON file is corrupted.
- Display queue errors are logged and do not stop later queued updates.
- Slow display tasks time out so the queue can continue.
- Targeted display updates are skipped for untracked members.
- Missing display messages are recreated and the replacement message ID is stored.

## Current Boundaries

- Single-process runtime state.
- One configured display channel.
- No guild-scoped database yet.
- No live Discord integration tests in this repository.
- Local mocks and simulations cover behavior without contacting Discord.
