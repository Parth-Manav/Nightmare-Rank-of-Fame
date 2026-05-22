# Discord Role Display Automation Service

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.17-339933)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)
![Tests](https://img.shields.io/badge/tests-node%3Atest-passing-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)

A Node.js Discord automation service that tracks selected server members, watches administrator-managed role changes, and keeps a display channel updated with live rank/role embeds. It is a portfolio backend project that demonstrates event-driven design, Discord API integration, slash command workflows, file-backed persistence, queue-based processing, structured logging, and local reliability testing.

This repository is also known as **Nightmare Rank of Fame**, but the technical framing is intentionally professional: it is a scoped backend automation service, not an enterprise production platform.

## Screenshots / Demo

Screenshots can be added after connecting the bot to a test Discord server. This repository does not include generated screenshots or fake demo images.

## Why This Project Exists

Discord communities often want a single channel that shows selected members and their current rank or important roles. Manually editing those messages is easy to forget and becomes noisy when roles change.

This service automates that workflow:

- Admins choose which roles are managed.
- Admins choose which members are displayed.
- The bot listens for member role updates from the Discord Gateway.
- Relevant role changes are persisted and queued for display updates.
- The display channel stays synchronized through embeds.

## Features

- Role display channel configured through a slash command.
- Tracked member list for deciding who appears in the display.
- Managed role list for deciding which roles are shown.
- Administrator-only slash commands for setup and maintenance.
- Automatic role update handling through `guildMemberUpdate`.
- Queue-based display processing with per-member deduplication.
- Atomic JSON persistence using temporary writes and file replacement.
- Express health endpoint at `/`.
- Structured Winston logging with configurable log level.

## Architecture

```text
                          +--------------------+
                          | Express health /   |
                          | GET /              |
                          +--------------------+

Discord Gateway events           Slash commands
        |                              |
        v                              v
src/handlers/eventHandler.js   src/handlers/commandHandler.js
        |                              |
        v                              v
src/events/guildMemberUpdate.js src/commands/*
        |                              |
        +--------------+---------------+
                       |
                       v
          +-------------------------+
          | Role/display workflow   |
          +-------------------------+
             |                   |
             v                   v
src/services/dataService.js  src/services/displayService.js
             |                   |
             v                   v
      bot_data.json       Discord embed edit/send queue
```

For more detail, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technical Highlights

- Event-driven design using Discord Gateway member update events.
- Discord REST/Gateway integration through `discord.js`.
- Dynamic slash command discovery and registration.
- Role-delta detection limited to administrator-managed roles.
- Rate-limit-aware display queue that collapses repeated updates for the same member.
- Atomic JSON writes to reduce the chance of corrupted runtime state.
- Startup protection when runtime JSON cannot be parsed.
- Small testability refactor that keeps runtime singleton exports while allowing isolated tests.
- Local mocks, failure injection, and simulations that test behavior without a real Discord token.

## Testing

The project uses Node's built-in test runner and does not require a live Discord server.

```bash
npm run check
npm test
npm run test:chaos
npm run test:simulation
```

| Script | What it checks |
| --- | --- |
| `npm run check` | Syntax validation for JavaScript files. |
| `npm test` | Unit tests for config, command metadata, command behavior, event handling, `DataService`, and `DisplayService`. |
| `npm run test:chaos` | Failure-injection tests for missing members/channels, edit failures, duplicate queue bursts, and concurrent data updates. |
| `npm run test:simulation` | Local simulations including a 50-person one-year role-change run and a 1000-person burst queue run. |

See [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md) for the full test plan, results, bugs found, and remaining risks.

## Setup

### Prerequisites

- Node.js `>=18.17`
- A Discord application with a bot token
- Permission to invite and configure the bot in a Discord server
- Discord Developer Portal setting: enable **Server Members Intent**

The bot currently uses only these Gateway intents in code:

- `Guilds`
- `GuildMembers`

`Message Content Intent` and `Presence Intent` are not required.

### Install

```bash
git clone https://github.com/Parth-Manav/Nightmare-Rank-of-Fame.git
cd Nightmare-Rank-of-Fame-main
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set `DISCORD_TOKEN` in `.env`, then start the service:

```bash
npm start
```

On startup, the service starts the Express health endpoint and connects to Discord. If no runtime state exists, it creates `bot_data.json`.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | None | Discord bot token from the Discord Developer Portal. |
| `PORT` | No | `3000` | Port for the local Express health endpoint. |
| `LOG_LEVEL` | No | `info` | Winston log level, such as `debug`, `info`, `warn`, or `error`. |
| `BOT_DATA_FILE` | No | `bot_data.json` | Optional custom runtime data path. Mostly useful for tests or custom deployments. |

Backward compatibility: the legacy `token` variable is still accepted, but `DISCORD_TOKEN` is preferred.

## Commands

All slash commands are restricted to members with the Discord `Administrator` permission.

| Command | Purpose |
| --- | --- |
| `/setdisplaychannel` | Sets the current channel as the display channel. |
| `/updatedisplay` | Queues a manual display refresh for tracked members. |
| `/managerole <role>` | Adds a role to the managed-role list. |
| `/unmanagerole <role>` | Removes a role from the managed-role list and refreshes displays. |
| `/listmanagedroles` | Lists managed roles. |
| `/addmember <user>` | Adds a server member to the display tracker. |
| `/removemember <user>` | Removes a tracked member and deletes their display message when possible. |
| `/listtrackedmembers` | Lists tracked members. |
| `/addrole <user> <role>` | Assigns a managed role to a member, respecting Discord role hierarchy. |
| `/removerole <user> <role>` | Removes a managed role from a member, respecting Discord role hierarchy. |

## Data Model

Runtime state is stored in `bot_data.json`, which is ignored by Git. The repository includes [bot_data.example.json](bot_data.example.json) as a safe template.

```json
{
  "version": "2.0.0",
  "channel_id": null,
  "members": {},
  "managed_roles": {},
  "message_ids": {}
}
```

| Field | Meaning |
| --- | --- |
| `channel_id` | Discord channel ID used for role display embeds. |
| `members` | Tracked member IDs mapped to their current managed role IDs. |
| `managed_roles` | Role IDs selected by administrators for tracking/display. |
| `message_ids` | Tracked member IDs mapped to their display message IDs. |

## Reliability Decisions

- JSON writes use a temp file followed by replacement of the live runtime file.
- Corrupted runtime JSON aborts startup instead of silently resetting state.
- Display updates are queued and processed one member at a time.
- Repeated pending updates for the same member collapse into the latest update.
- Slow display update tasks have a timeout so the queue can continue.
- Missing display messages are recreated and their new IDs are persisted.
- Slash command access is gated with Discord administrator permissions.

## Limitations

- JSON persistence is appropriate for a single-process portfolio project, but not for multi-process deployments.
- Large manual refreshes can be slow because display updates are intentionally paced.
- Local mocks and simulations are useful, but they are not a replacement for validation in a real Discord test server.
- Configuration is not yet guild-scoped for multi-server use.
- The health endpoint is minimal and does not expose queue depth or data health.

## Ethics and Scope

This bot is intended for servers where the owner or an authorized administrator has approved it. It uses official Discord bot APIs and does not require user tokens, self-bot behavior, or scraping.

## Resume-Friendly Summary

**Project description:** Built a Node.js Discord automation service that tracks selected members, detects managed role changes, and synchronizes a display channel through role/rank embeds. The project demonstrates backend event handling, API integration, persistence, queueing, and local reliability testing.

Resume bullets:

- Developed an event-driven Discord automation service using Node.js, `discord.js`, slash commands, and Gateway member update events.
- Implemented JSON-backed runtime persistence with atomic writes, startup corruption protection, and structured Winston logging.
- Designed a queue-based display update flow that deduplicates repeated member updates and reduces unnecessary Discord API calls.
- Added unit tests, failure-injection tests, and local simulations covering command workflows, persistence, event handling, and burst queue behavior.

Skills demonstrated:

- Backend development
- API integration
- Event-driven systems
- Automation engineering
- File-backed persistence
- Operational logging
- Testing with mocks and simulations

## Future Improvements

- Add GitHub Actions CI for `npm run check`, `npm test`, `npm run test:chaos`, and `npm run test:simulation`.
- Add a Dockerfile and deployment notes.
- Add health endpoint details such as queue depth, service version, and data file status.
- Move persistence to SQLite or PostgreSQL if the project grows beyond single-process JSON storage.
- Add guild-scoped configuration for multi-server use.
- Validate behavior against a dedicated Discord test server and add screenshots.

## Repository Hygiene

Do not commit:

- `.env`
- `bot_data.json`
- `bot_data.tmp.json`
- `*.log`
- Discord tokens
- Server-specific runtime IDs

The committed example files are safe to share publicly.

## License

ISC
