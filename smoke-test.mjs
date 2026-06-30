import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const post = await client.callTool({
  name: "bridge_post",
  arguments: { channel: "smoke", from: "claude", body: "hello from claude" },
});
console.log("POST:", post.content[0].text);

const read = await client.callTool({
  name: "bridge_read",
  arguments: { channel: "smoke", since: 0 },
});
console.log("READ:", read.content[0].text);

await client.close();
process.exit(0);
