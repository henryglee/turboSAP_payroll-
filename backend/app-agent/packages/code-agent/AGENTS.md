# opencode agent guidelines

## Build/Test Commands

- **Install**: `bun install`
- **Run**: `bun run --conditions=browser ./src/index.ts`
- **Typecheck**: `bun run typecheck` (npm run typecheck)
- **Test**: `bun test` (runs all tests)
- **Single test**: `bun test test/tool/tool.test.ts` (specific test file)

## Code Style

- **Runtime**: Bun with TypeScript ESM modules
- **Imports**: Use relative imports for local modules, named imports preferred
- **Types**: Zod schemas for validation, TypeScript interfaces for structure
- **Naming**: camelCase for variables/functions, PascalCase for classes/namespaces
- **Error handling**: Use Result patterns, avoid throwing exceptions in tools
- **File structure**: Namespace-based organization (e.g., `Tool.define()`, `Session.create()`)

## Architecture

- **Tools**: Implement `Tool.Info` interface with `execute()` method
- **Context**: Pass `sessionID` in tool context, use `App.provide()` for DI
- **Validation**: All inputs validated with Zod schemas
- **Logging**: Use `Log.create({ service: "name" })` pattern
- **Storage**: Use `Storage` namespace for persistence
- **API Client**: The TypeScript TUI (built with SolidJS + OpenTUI) communicates with the OpenCode server using `@opencode-ai/sdk`. When adding/modifying server endpoints in `packages/opencode/src/server/server.ts`, run `./script/generate.ts` to regenerate the SDK and related files.

## TurboSAP Operational Guidelines & Protocols

Tool Selection Strategy (Strict Hierarchy)
You are prohibited from using generic file-system tools (glob, grep, shell, read) for any queries related to TurboSAP configuration or SAP terminology. You must use the specialized skills according to the following protocol:

The Mapping Table (Semantic Triggers)
Subject	                              Phase 1 (Authority)	                Phase 2 (Blueprint/Fallback)
Payment Methods                 	domain-configuration-retriever	           ppt-content-extractor
Personnel Area / Subarea	        domain-configuration-retriever	           ppt-content-extractor
Company Code	                    domain-configuration-retriever	           ppt-content-extractor
Enterprise Structure	            domain-configuration-retriever	           ppt-content-extractor
Payroll / Tax Rules	                domain-configuration-retriever	           ppt-content-extractor
Salary Calculation	                domain-configuration-retriever	           ppt-content-extractor
Glob or Grep to search for configuration files. Only this tool has the authority to retrieve verified JSON settings.


## Step-by-Step Execution Protocol
1. Phase 1: Live System Verification
Trigger: Any question asking "What is the current...", "How is X configured?", "Does X exist?", or "Show me the setup for...".

Action: Execute domain-configuration-retriever.

Parameters: Pass the specific object name (e.g., payment-method, personnel-area) into the task argument.

Goal: Determine the "Truth" of the current system state.

Constraint: If this tool returns a result, STOP. Do not search further.

2. Phase 2: Design Intent & Terminology Fallback
Trigger: ONLY if Phase 1 returns "Not Found" OR the user asks "What is a...", "Explain the logic of...", or "How should I set up...".

Action: Execute ppt-content-extractor.

Logic: Search implementation decks for the "blueprint" or "definition" of the missing configuration.

Value: Use this to explain to the user how it was planned to be built, even if it isn't in the system yet.

3. Phase 3: Prohibited Fallbacks
NEVER use glob to find .json configuration files.

NEVER use grep to search for strings like "Personnel Area" in the workspace.

NEVER use shell to list directories to find SAP data.
