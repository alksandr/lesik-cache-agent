# 🔌 Lesik Cache Agent

Local cache agent for Neptune Web IDE — serves your OSRS cache to the web editor through a secure WebSocket tunnel.

## Why?

OSRS caches are large (500MB+). Instead of uploading to the cloud, run this agent locally and edit your cache through the browser. Changes save directly to your local files.

## Quick Start

```bash
# Using npx (no install needed)
npx lesik-cache-agent ./path/to/cache

# Or clone and run
git clone https://github.com/alksandr/lesik-cache-agent.git
cd lesik-cache-agent
npm install
node src/index.js ./path/to/cache
```

## How It Works

1. **Run the agent** pointing to your cache folder
2. **Get a session token** (e.g., `A3BX9K`)
3. **Enter the token** in Neptune IDE's "Connect Local" dialog
4. **Edit your interfaces** — changes save back to your local cache

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Your Browser   │ ◄─────► │  Neptune Server │ ◄─────► │  Cache Agent    │
│  (Neptune IDE)  │   HTTPS │ (WebSocket Hub) │   WSS   │  (Your Machine) │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                                               │
                                                               ▼
                                                        ┌─────────────────┐
                                                        │  Your Cache     │
                                                        │  (Local Files)  │
                                                        └─────────────────┘
```

## Usage

```bash
lesik-cache-agent <cache-path>

# Examples
lesik-cache-agent ./cache
lesik-cache-agent /home/user/rsps/cache
lesik-cache-agent "C:\Users\You\cache"
```

## Output

```
═══════════════════════════════════════════════════════════
  🚀 Lesik Cache Agent v0.1.0
═══════════════════════════════════════════════════════════
  Cache path: /home/user/cache
  Server: wss://neptune.lesik.site/agent

  ✨ Agent registered successfully!

  Your session token: A3BX9K

  Open Neptune IDE and enter this token to connect
  to your local cache.
═══════════════════════════════════════════════════════════

📡 Waiting for requests...
📥 Request: getCacheInfo
📤 Response sent for getCacheInfo
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEPTUNE_SERVER` | WebSocket server URL | `wss://neptune.lesik.site/agent` |

## Local Development

For testing with a local Neptune server:

```bash
NEPTUNE_SERVER=ws://localhost:8080/agent lesik-cache-agent ./cache
```

## Security

- **No port forwarding required** — agent connects outbound only
- **Path traversal protection** — agent only serves files within the cache directory
- **Session tokens** — 6-character tokens valid only while agent is running
- **Files stay local** — your cache never uploads to any server

## Requirements

- Node.js 18+
- An OSRS cache folder

## License

MIT
