# JetStream Workbench

A small monolithic desktop devtool for NATS JetStream, built with Go + Wails v2 + a plain Vite frontend.

## Features

- Connect to NATS with URL, username/password, token, or a `.creds` file.
- Verify that JetStream is available.
- List, inspect, create, and delete streams.
- List, inspect, create, and delete durable pull consumers.
- Browse raw stream messages without changing consumer state.
- Fetch messages as a selected consumer.
- ACK, NAK, delayed NAK, TERM, and InProgress operations.
- Publish messages with payload and optional NATS headers.
- Local `docker-compose.yml` with JetStream enabled.

## Requirements

- Go 1.23+ recommended.
- Node.js + npm.
- Wails v2 CLI.
- Platform dependencies required by Wails/WebView.
- Docker is optional, only needed for the included local NATS instance.

Install Wails:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
export PATH="$PATH:$(go env GOPATH)/bin"
wails doctor
```

On Windows, make sure the Go bin directory (usually `%USERPROFILE%\\go\\bin`) is in PATH and run `wails doctor`.

## Quick start with a local NATS

```bash
docker compose up -d
wails dev
```

Then connect in the app to:

```text
nats://localhost:4223
```

Create a stream, for example:

- Name: `ORDERS`
- Subjects: `orders.>`
- Storage: `File`
- Retention: `Limits`

Create a consumer, for example:

- Name: `debug-consumer`
- Filter: `orders.>`
- Deliver policy: `All`
- Ack wait: `30`
- Max delivery: `5`

Then use the Publish tab with subject `orders.created`, fetch it as the consumer, and test ACK/NAK/TERM.

## Development

From the repository root:

```bash
wails dev
```

Wails generates frontend bindings under `frontend/wailsjs` and starts Vite automatically.

## Production build

```bash
wails build
```

The produced executable is placed under:

```text
build/bin/
```

For platform-specific packaging and dependencies, use:

```bash
wails doctor
wails build
```

on the target operating system.

## Notes about message ACK state

Fetched consumer messages are held in the Go process in an in-memory map until you choose ACK/NAK/TERM. This is deliberately local-session behavior for a developer tool. Closing the app does not ACK those messages; JetStream redelivery then follows the consumer's configured AckWait/MaxDeliver policy.

"Browse stream" uses JetStream raw stream reads and therefore does not affect consumer delivery/ACK state.

## Project structure

```text
jetstream-workbench/
├── app.go              # Wails-bound application/NATS logic
├── models.go           # DTOs exposed to frontend
├── main.go             # Wails bootstrap
├── frontend/
│   ├── src/main.js     # UI + calls to bound Go methods
│   └── src/style.css
├── docker-compose.yml
├── go.mod
├── wails.json
└── README.md
```

## Scope / next useful additions

This is intentionally a compact first implementation. Natural next steps are connection profiles, TLS/NKey configuration, stream update/purge, consumer reset/pause, JSON schema templates, saved publish payloads, subject filtering while browsing, and live subscriptions.
