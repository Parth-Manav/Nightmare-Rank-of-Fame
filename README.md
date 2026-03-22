# 🏆 Nightmare Rank of Fame Bot
![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![Node.js](https://img.shields.io/badge/node.js-%3E%3D16.9.0-blue) ![Discord.js](https://img.shields.io/badge/discord.js-v14-indigo) ![License](https://img.shields.io/badge/license-MIT-green)

The **Nightmare Rank of Fame** bot is an autonomous, highly-resilient Discord utility designed to manage, track, and visually broadcast specific user roles in a dedicated display channel. It dynamically tracks opted-in members and renders a live, auto-updating embed widget reflecting their current rank and managed roles, acting as a real-time leaderboard or "Hall of Fame".

---

## ⚡ Features
* **Live Role Tracking**: Automatically synchronizes member roles against a predefined "managed roles" list.
* **Auto-Updating Embeds**: Dynamically generates and edits Discord Embed widgets in a designated showcase channel when a user's relevant roles change.
* **Atomic JSON Storage**: Employs non-blocking, memory-safe data persistence backed by temporary write-swap protection to eliminate corruption.
* **API Rate-Limit Protection**: Dedupes multi-event spam and utilizes a strict 1000ms batched queue array to prevent Discord API bans.
* **Native Fallback Server**: Runs a lightweight Express web server on port 3000 to maintain continuous uptime signaling (ideal for Docker or UptimeRobot).
* **Robust Admin Controls**: Fully equipped with Discord Slash (`/`) Commands locked securely behind the `Administrator` permission bitfield.

---

## 🛠 Tech Stack
* **Language**: Node.js / JavaScript
* **Discord API**: `discord.js`
* **Web Server**: `express` (v4 framework)
* **Environment Configuration**: `dotenv`

---

## 🏗 Folder Structure
```text
Nightmare-Rank-of-Fame-main/
│
├── src/
│   ├── commands/
│   │   ├── admin/      # Configuration commands
│   │   ├── members/    # Tracking/Untracking users
│   │   └── roles/      # Granting/Revoking roles natively
│   ├── events/         # Discord Event Listeners (GuildMemberUpdate, Ready)
│   ├── handlers/       # Dynamic Slash Command and Event Loaders
│   ├── services/       # Core Logic (DataService, DisplayService)
│   └── utils/          # Winston/Logger formatting utilities
│
├── bot_data.json       # Live Database State (Auto-generated)
├── index.js            # Main Application Entry Point
├── package.json        
└── README.md           # Documentation
```

---

## ⚙️ Installation

**1. Clone the repository**
```bash
git clone https://github.com/Username/Nightmare-Rank-of-Fame.git
cd Nightmare-Rank-of-Fame
```

**2. Install runtime dependencies**
```bash
npm install
```

---

## 🔐 Configuration
You must configure the bot's environment variables to authenticate with the Discord API.

Create a `.env` file in the root directory (alongside `index.js`) containing your bot token gathered from the [Discord Developer Portal](https://discord.com/developers/applications):

```env
token=DISCORD_API_TOKEN_OBTAINED_FROM_DEVELOPER_PORTAL
```

*(Note: Ensure your Bot Application has the `Server Members Intent` and `Message Content Intent` enabled on the Developer Portal to successfully fetch guild members).*

---

## 🚀 Usage
Start the bot using Node.js. It will immediately connect to the Gateway API and boot the Express ping server.

```bash
node index.js
```

**Expected Console Output:**
```text
[INFO] Server is running on port 3000
[INFO] Data loaded successfully
[INFO] ✅ Nightmare-Rank-of-Fame#1234 has connected to Discord!
[INFO] Started refreshing 10 application (/) commands.
[INFO] Successfully reloaded application (/) commands.
```

---

## 🧠 Architecture / How It Works
The system follows a Service-Oriented Model divided into two primary loops:

1. **`DataService` (Storage Mutex)**
   Utilizes an asynchronous boolean lock (`isSaving`) tied to a queue flag. All writes are dumped into a `bot_data.tmp.json` file and injected via atomic OS `rename` commands, absolutely ensuring no multi-threaded data wipe can occur if power fails mid-stride.
2. **`DisplayService` (Map Deduplication Queue)**
   When Discord emits a `GuildMemberUpdate` event, the bot evaluates the state delta pre-API and post-API. If an update is required, it injects an update task into an active `Map`. The map inherently deduplicates hyper-speed spam (updating a user 100 times per second yields precisely 1 queued API task). A background `while` loop securely flushes this queue, rigidly pausing 1000 milliseconds between API hits to dodge HTTP 429 blockades.

---

## 💻 Commands

All commands are restricted strictly to the `Administrator` server permission.

### Global Configuration
* `/setdisplaychannel` – Designates the current channel as the central rendering pipeline for role embeds.
* `/updatedisplay` – Manually clears the internal rendering queue and refreshes all active tracked members.

### Tracking
* `/addmember <user>` – Opts a user into the DB and paints their embed into the display channel.
* `/removemember <user>` – Drops the user from the DB and garbage-collects their display message.
* `/listtrackedmembers` – Spits out a console digest of actively tracked accounts.

### Roles Management
* `/managerole <role>` – Instructs the bot to actively listen for and display this given role.
* `/unmanagerole <role>` – Marks the role as untracked.
* `/listmanagedroles` – Spits out the tracked IDs natively.
* `/addrole <user> <role>` – Assigns a managed role directly, evaluating Discord hierarchies, and targets the specific embed cleanly.
* `/removerole <user> <role>` – Revokes the role identically to addrole.

---

## 🛡️ Error Handling & Safety
1. **Boot Parse Halting**: In the extreme event of disk-level JSON invalidation, `loadDataSync()` throws a fatal `process.exit(1)`, deliberately nuking the bootloader to prevent the bot from assuming the database is blank and cascading empty overwrites.
2. **Deadlock Immunity**: Internal Discord fetched-waits (`await channel.messages.fetch(...)`) are forcefully walled behind a 10,000ms `Promise.race()`. If the Discord Gateway TCP socket hangs infinitely, the bot self-heals, terminates the iteration, outputs an error, and un-sticks the main queue.
3. **Partition Redundancy (EXDEV)**: The atomic rename fallback utilizes `copyFile` logic catching cross-device link blocks to ensure containerized mount compatibility.

---

## 🚧 Limitations
* **Propagation Latency**: Because the throttle strictly applies a `1000ms` cycle lock to mathematically obey Discord HTTP 429 constraints, queueing 50 mass edits natively forces the 50th user to wait 50 seconds for their display update.
* **Memory Constraints**: Relies entirely on native memory representations and `JSON.stringify`. Supporting over 100,000 tracked users will eventually result in a V8 maximum heap allocation (OOM) failure without swapping architecture.

---

## 🔮 Future Improvements
* **SQLite / PostgreSQL Migration**: Transitioning off `.json` natively replaces the manual file-swapping sequence with ACID-compliant driver transactions allowing theoretically limitless horizontal scale.
* **Sharding Native Support**: Incorporating `discord.js` Webhook cross-communication or native cluster threading for bots expanding beyond 2,500 Discord servers.

---

## 📄 License
Released under the MIT License. Feel free to copy, modify, and distribute this software accordingly via standard open-source constraints.
