# Copilot Instructions for CSMS

## Project Overview
- This is a TypeScript/Node.js backend for a CSMS (Central System Management Server) focused on OCPP (Open Charge Point Protocol) message handling.
- Main code is in `src/` with subfolders for server logic, database, utilities, and OCPP message handlers.
- BSON/JSON data dumps are in `dump/` for development and testing.

## Architecture & Data Flow
- Entry point: `src/server/index.ts` starts the server and wires up message routing.
- WebSocket server: `src/server/wsServer.ts` manages client connections.
- Message routing: `src/server/messageRouter.ts` dispatches OCPP messages to handler modules in `src/server/handlers/`.
- Handlers: Each OCPP action (e.g., `authorize`, `heartbeat`) has a dedicated handler in `src/server/handlers/`.
- Database: MongoDB via Mongoose, configured in `src/db/mongoose.ts`.
- Types: Auto-generated in `src/server/types/1.6/` using `scripts/generate-types.js` (do not edit manually).

## Developer Workflows
- **Type Generation:** Run `node scripts/generate-types.js` to update OCPP types. Do not manually edit files in `src/server/types/1.6/`.
- **Start Server:** Main server is started from `src/server/index.ts`.
- **Schema Validation:** JSON schemas for OCPP messages are in `src/utils/schemas/`. Validation logic is in `src/utils/ajvValidator.ts`.

## Conventions & Patterns
- Handlers follow a pattern: each exports a function for processing a specific OCPP message type.
- Message schemas are named `{MessageType}.json` and `{MessageType}Response.json`.
- Logging is centralized in `src/logger.ts`.
- Use only the provided scripts for type and schema generation.
- Do not modify auto-generated or dump files directly.

## Integration Points
- MongoDB is the primary data store (see `src/db/mongoose.ts`).
- WebSocket communication is the main external interface (see `src/server/wsServer.ts`).
- OCPP message schemas are strictly validated before processing.

## Examples
- To add a new OCPP message handler: create a new file in `src/server/handlers/`, add schema(s) in `src/utils/schemas/`, and update the router in `src/server/messageRouter.ts`.
- To update types: run `node scripts/generate-types.js` after changing schemas.

## Key Files & Directories
- `src/server/index.ts`: Server entry point
- `src/server/messageRouter.ts`: Message dispatch logic
- `src/server/handlers/`: OCPP message handlers
- `src/utils/schemas/`: JSON schemas for validation
- `src/db/mongoose.ts`: Database connection
- `scripts/generate-types.js`: Type generation script
- `dump/`: BSON/JSON data for development

---
For unclear or incomplete sections, please provide feedback to improve these instructions.