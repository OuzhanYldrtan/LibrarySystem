import path from 'node:path';
import { existsSync } from 'node:fs';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

@Injectable()
export class McpClientService implements OnModuleDestroy {
  private client?: Client;
  private connecting?: Promise<Client>;

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const configuredPath = process.env.MCP_SERVER_PATH;
      const candidates = configuredPath
        ? [path.resolve(process.cwd(), configuredPath), path.resolve(process.cwd(), '../..', configuredPath)]
        : [path.resolve(process.cwd(), '../mcp/dist/index.js'), path.resolve(process.cwd(), 'apps/mcp/dist/index.js')];
      const serverPath = candidates.find(existsSync) || candidates[0];
      const client = new Client({ name: 'raf-nest-api', version: '1.0.0' });
      const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
      await client.connect(transport);
      this.client = client;
      return client;
    })();
    try { return await this.connecting; } finally { this.connecting = undefined; }
  }

  async listTools() {
    return (await (await this.getClient()).listTools()).tools;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return (await this.getClient()).callTool({ name, arguments: args });
  }

  async onModuleDestroy() {
    await this.client?.close();
  }
}
