import { startMcpServer } from './server.js';

startMcpServer().catch((err: unknown) => {
  process.stderr.write(`lexia-mcp failed to start: ${err}\n`);
  process.exit(1);
});
