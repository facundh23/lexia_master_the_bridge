import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LexiaApiClient } from './apiClient.js';
import { createSearchCorpusTool } from './tools/searchCorpus.js';
import { createComputeEligibilityTool } from './tools/computeEligibility.js';
import { createGetProcedureRequirementsTool } from './tools/getProcedureRequirements.js';

export async function startMcpServer(): Promise<void> {
  const apiUrl = process.env['LEXIA_API_URL'];
  const pat = process.env['LEXIA_PAT'];

  if (!apiUrl || !pat) {
    process.stderr.write(
      'Error: LEXIA_API_URL y LEXIA_PAT son requeridos.\n' +
        'Configuralos en claude_desktop_config.json bajo "env".\n',
    );
    process.exit(1);
  }

  const client = new LexiaApiClient({ baseUrl: apiUrl, pat });

  const server = new McpServer({
    name: 'lexia',
    version: '0.1.0',
  });

  const searchTool = createSearchCorpusTool(client);
  const eligibilityTool = createComputeEligibilityTool(client);
  const requirementsTool = createGetProcedureRequirementsTool(client);

  server.registerTool(
    searchTool.name,
    {
      description: searchTool.description,
      inputSchema: searchTool.inputSchema,
    },
    (input) => searchTool.execute(input),
  );

  server.registerTool(
    eligibilityTool.name,
    {
      description: eligibilityTool.description,
      inputSchema: eligibilityTool.inputSchema,
    },
    (input) => eligibilityTool.execute(input),
  );

  server.registerTool(
    requirementsTool.name,
    {
      description: requirementsTool.description,
      inputSchema: requirementsTool.inputSchema,
    },
    (input) => requirementsTool.execute(input),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
