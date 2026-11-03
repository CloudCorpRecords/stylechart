/**
 * stylechart MCP server. Tools: word_analyze, word_lookup,
 * word_list, style_get, word_status.
 *
 * Why the low-level Server instead of McpServer: the
 * high-level helper converts zod schemas to JSON Schema and
 * injects keys that are not in this tool set's documented
 * spec ("$schema" and "additionalProperties"), which breaks
 * exact tool-list/schema parity with the spec. This file
 * serves tools/list with the spec's exact input schemas as
 * explicit literals, and the core validates every tools/call
 * argument set itself.
 *
 * Every tool returns a single text item holding the tool's
 * JSON result text; validation and upstream failures come
 * back as isError results carrying the documented error
 * strings.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { styleGet, wordAnalyze, wordList, wordLookup, wordStatus, VERSION } from "./style.js";

const TOOLS = [
  {
    name: "word_analyze",
    description:
      "One sentence → the best-matching visual styles + the feeling words behind them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        styles: {
          description: "How many visual styles to return (1-30, default 12).",
          type: "integer",
        },
        text: {
          description: "A colloquial sentence describing a mood or scene (max 500 characters).",
          type: "string",
        },
        words: {
          description: "How many feeling words to return (1-12, default 8).",
          type: "integer",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "word_lookup",
    description:
      "Look up a single feeling word: definition, near-synonyms, landing styles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        word: { type: "string" , description: "The word for this call." },
      },
      required: ["word"],
    },
  },
  {
    name: "word_list",
    description: "Browse / search the full feeling-word lexicon.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          description: "Optional substring filter over words and style names.",
          type: "string",
        },
      },
    },
  },
  {
    name: "style_get",
    description:
      "One style in full: definition, parent style, member words, reference images.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          description: "The style id, e.g. synthwave.",
          type: "string",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "word_status",
    description: "Lexicon coverage — use it to check the data is fresh.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "stylechart", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;
  try {
    let out: string;
    switch (name) {
      case "word_analyze":
        out = await wordAnalyze(a as never);
        break;
      case "word_lookup":
        out = await wordLookup(a as never);
        break;
      case "word_list":
        out = await wordList(a as never);
        break;
      case "style_get":
        out = await styleGet(a as never);
        break;
      case "word_status":
        out = await wordStatus();
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(out);
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
