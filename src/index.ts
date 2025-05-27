import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Create an MCP server
const server = new McpServer({
    name: "mcp-sse-server",
    version: "1.0.0",
});

// Define a tool to get customer details
// This tool simulates fetching customer details from an external service
const getCustomerDetails = server.tool(
    "get-customer-details",
    "Get customer details",
    {
        customerNo: z.string().describe("Customer ID"),
    },
    async (params: { customerNo: string }) => {
        // Simulate fetching customer details from a database or external service
        const response = await fetch(
            `https://www.youngsinc.com/yis7beta_service/api/config/getCustomerDetails/${params.customerNo}`,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch customer details");
        }

        const data = await response.json();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
)

const app = express();
app.use(express.json());

// Store transports for each session type
const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>
};

// Modern Streamable HTTP endpoint
app.all('/mcp', async (req, res) => {
    // Handle Streamable HTTP transport for modern clients
    // Implementation as shown in the "With Session Management" example
    // ...
});

// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on("close", () => {
        delete transports.sse[transport.sessionId];
    });

    await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res, req.body);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MCP SSE Server running on http://localhost:${PORT}/sse`);
});