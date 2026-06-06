/**
 * Eager barrel that imports every module which calls `intent(...)`.
 *
 * Modules that define server intents register themselves into the runtime
 * registry on first evaluation. Routes/handlers that need the registry
 * populated (notably `/api/intents`) import this file as a side effect so
 * the catalog is complete by the time it's queried.
 *
 * Add new intent-defining modules here as they're created.
 */
export {};
