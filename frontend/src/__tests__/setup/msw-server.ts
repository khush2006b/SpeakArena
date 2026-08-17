/**
 * MSW (Mock Service Worker) server instance.
 *
 * Used by jest.setup.ts to intercept all HTTP requests during tests.
 * Individual tests can add handlers via server.use() to override
 * or extend the defaults defined in handlers/index.ts.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
