import * as net from "net";
import * as fs from "fs";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const CARRIAGE_RETURN = "\r";
const LINE_FEED = "\n";
const CRLF = CARRIAGE_RETURN + LINE_FEED;

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

const server = net.createServer((socket) => {
  socket.on("data", (buf) => {
    const req = buf.toString("utf8");
    console.log(`Received request:\n${req}`);
    const [reqLine, ...rest] = req.split(CRLF);
    // console.log(`Request Line: ${reqLine}`);
    const body = rest.pop();
    const headersMap = new Map<string, string>();
    for (const header of rest) {
      const [key, value] = header.split(": ");
      headersMap.set(key, value);
    }
    const [method, path] = reqLine.split(" ");
    const [_, endpoint, restPath] = path.split("/");
    console.log(`Endpoint: ${endpoint}, Rest Path: ${restPath}`);

    const acceptEncodingHeader = headersMap.get("Accept-Encoding");

    switch (endpoint) {
      case "":
        socket.write(OK_STATUS_CODE);
        break;
      case "echo":
        const echoText = path.split("/")[2];
        socket.write(OK_STATUS_CODE);
        socket.write(CRLF);
        socket.write(`Content-Type: text/plain`);
        socket.write(CRLF);
        socket.write(`Content-Length: ${echoText.length}`);
        socket.write(CRLF);
        if (acceptEncodingHeader?.split(',').map(el => el.trim()).includes('gzip')) {
          socket.write(`Content-Encoding: gzip`);
          socket.write(CRLF);
        }
        socket.write(CRLF);
        socket.write(echoText);
        break;
      case "user-agent":
        const userAgent = headersMap.get("User-Agent") || "";
        socket.write(OK_STATUS_CODE);
        socket.write(CRLF);
        socket.write(`Content-Type: text/plain`);
        socket.write(CRLF);
        socket.write(`Content-Length: ${userAgent.length}`);
        socket.write(CRLF);
        socket.write(CRLF);
        socket.write(userAgent);
        break;
      case "files":
        console.log(`Handling ${method} file request for path:`, restPath);
        const filePath = `${getDirectoryFromArgs()}${restPath}`;

        switch (method) {
          case "GET":
            if (fs.existsSync(filePath)) {
              console.log(`File found: ${filePath}`);
              const fileContent = fs.readFileSync(filePath);
              
              socket.write(OK_STATUS_CODE);
              socket.write(CRLF);
              socket.write(`Content-Type: application/octet-stream`);
              socket.write(CRLF);
              socket.write(`Content-Length: ${fileContent.length}`);
              socket.write(CRLF);
              socket.write(CRLF);
              socket.write(fileContent);
            } else {
              console.log(`File not found: ${filePath}`);
              socket.write(NOT_FOUND_STATUS_CODE);
            }
            break;
          case "POST":
            const contentLength = parseInt(headersMap.get("Content-Length") || '0', 10) || 0;
            const requestBody = body || "";

            const fileContentToWrite = requestBody.slice(0, contentLength);
            fs.writeFileSync(filePath, fileContentToWrite);
            console.log(`File written successfully: ${filePath}`);

            socket.write(CREATED_STATUS_CODE);
            break;
          default:
            socket.write(NOT_FOUND_STATUS_CODE);
        }
        break;
      default:
        socket.write(NOT_FOUND_STATUS_CODE);
    }

    socket.write(CRLF);
    socket.write(CRLF);
    socket.end();
  });
});

server.listen(4221, "localhost");
