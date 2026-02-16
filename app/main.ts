import * as net from "net";
import * as fs from "fs";
import { gzipSync } from "zlib";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const CARRIAGE_RETURN = "\r";
const LINE_FEED = "\n";
const CRLF = CARRIAGE_RETURN + LINE_FEED;
const HEADERS_DELIMITER = CRLF + CRLF;

const NOT_FOUND_STATUS_CODE = "HTTP/1.1 404 Not Found";
const OK_STATUS_CODE = "HTTP/1.1 200 OK";
const CREATED_STATUS_CODE = "HTTP/1.1 201 Created";

function getDirectoryFromArgs(): string | undefined {
  const argv = Bun.argv;
  let directory: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--directory") directory = argv[i + 1];
    if (a.startsWith("--directory=")) directory = a.slice("--directory=".length);
  }

  return directory;
}

type HttpReq = {
  method: string;
  path: string;
  headers: Map<string, string>;
  keepAlive: boolean;
  body: Buffer<ArrayBufferLike>;
};

function tryParseRequest(buffer: Buffer): { req: HttpReq; consumed: number } | null {
  const headerEnd = buffer.indexOf(HEADERS_DELIMITER);
  if (headerEnd === -1) return null;

  const headText = buffer.subarray(0, headerEnd).toString("utf8");
  const lines = headText.split(CRLF);
  const [method, path] = lines[0].split(" ");

  const headers: Map<string, string> = new Map();
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(":");
    if (idx === -1) continue;
    const k = lines[i].slice(0, idx).trim().toLowerCase();
    const v = lines[i].slice(idx + 1).trim();
    headers.set(k, v);
  }

  const contentLengthHeader = headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
  const headersDelimiterLength = Buffer.byteLength(HEADERS_DELIMITER, "utf8");
  const total = headerEnd + headersDelimiterLength + contentLength;
  if (buffer.length < total) return null;

  const body = buffer.subarray(headerEnd + headersDelimiterLength, total);

  // HTTP/1.1 is keep-alive by default unless Connection: close
  const keepAlive = (headers.get("connection")?.toLowerCase() ?? "") !== "close";

  return { req: { method, path, headers, body, keepAlive }, consumed: total };
}

function writeResponse(socket: net.Socket, statusCode: string, headers: Record<string, string> = {}, body: string | Buffer = '') {
  socket.write(statusCode);
  socket.write(CRLF);
  for (const [key, value] of Object.entries(headers)) {
    socket.write(`${key}: ${value}`);
    socket.write(CRLF);
  }
  socket.write(CRLF);
  socket.write(body);
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const parsed = tryParseRequest(buffer);
      if (!parsed) break;

      const { req: request, consumed } = parsed;

      buffer = buffer.slice(consumed);

      const { method, path, headers: headersMap, body } = request;

      const [_, endpoint, restPath] = path.split("/");
      console.log(`Endpoint: ${endpoint}, Rest Path: ${restPath}`);

      const acceptEncodingHeader = headersMap.get("accept-Encoding");

      switch (endpoint) {
        case "":
          writeResponse(socket, OK_STATUS_CODE);
          break;
        case "echo":
          const encodeWithGzip = acceptEncodingHeader?.split(',').map(el => el.trim()).includes('gzip');
          const echoText = path.split("/")[2];
          const responseText = encodeWithGzip ? gzipSync(echoText) : echoText;

          writeResponse(socket, OK_STATUS_CODE, {
            "Content-Type": "text/plain",
            "Content-Length": responseText.length.toString(),
            ...(encodeWithGzip ? { "Content-Encoding": "gzip" } : {})
          }, responseText);
          break;
        case "user-agent":
          const userAgent = headersMap.get("user-Agent") || "";

          writeResponse(socket, OK_STATUS_CODE, {
            "Content-Type": "text/plain",
            "Content-Length": userAgent.length.toString()
          }, userAgent);
          break;
        case "files":
          console.log(`Handling ${method} file request for path:`, restPath);
          const filePath = `${getDirectoryFromArgs()}${restPath}`;

          switch (method) {
            case "GET":
              if (fs.existsSync(filePath)) {
                console.log(`File found: ${filePath}`);
                const fileContent = fs.readFileSync(filePath);

                writeResponse(socket, OK_STATUS_CODE, {
                  "Content-Type": "application/octet-stream",
                  "Content-Length": fileContent.length.toString()
                }, fileContent);
              } else {
                console.log(`File not found: ${filePath}`);

                writeResponse(socket, NOT_FOUND_STATUS_CODE);
              }
              break;
            case "POST":
              const contentLength = parseInt(headersMap.get("content-Length") || '0', 10) || 0;
              const requestBody = body || "";

              const fileContentToWrite = requestBody.slice(0, contentLength);
              fs.writeFileSync(filePath, fileContentToWrite);
              console.log(`File written successfully: ${filePath}`);

              writeResponse(socket, CREATED_STATUS_CODE);
              break;
            default:
              writeResponse(socket, NOT_FOUND_STATUS_CODE);
          }
          break;
        default:
          writeResponse(socket, NOT_FOUND_STATUS_CODE);
      }

      if (!request.keepAlive) {
        socket.end();
        break;  
      }
    }
  });
});

server.listen(4221, "localhost");
