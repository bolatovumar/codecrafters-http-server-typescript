import * as net from "net";
import * as fs from "fs";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const NOT_FOUND_RESPONSE = "HTTP/1.1 404 Not Found\r\n\r\n";

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
    const [reqLine, ...rest] = req.split("\r\n");
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
    switch (endpoint) {
      case "":
        socket.write("HTTP/1.1 200 OK\r\n\r\n");
        break;
      case "echo":
        const echoText = path.split("/")[2];
        socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${echoText.length}\r\n\r\n${echoText}`);
        break;
      case "user-agent":
        const userAgent = headersMap.get("User-Agent") || "";
        socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`);
        break;
      case "files":
        console.log(`Handling ${method} file request for path:`, restPath);
        const filePath = `${getDirectoryFromArgs()}${restPath}`;

        switch (method) {
          case "GET":
            if (fs.existsSync(filePath)) {
              console.log(`File found: ${filePath}`);
              const fileContent = fs.readFileSync(filePath);
              socket.write(`HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${fileContent.length}\r\n\r\n`);
              socket.write(fileContent);
            } else {
              console.log(`File not found: ${filePath}`);
              socket.write(NOT_FOUND_RESPONSE);
            }
            break;
          case "POST":
            // $ curl -v --data "12345" -H "Content-Type: application/octet-stream" http://localhost:4221/files/file_123

            // write the file content to the specified file in the directory
            const contentLength = parseInt(headersMap.get("Content-Length") || '0', 10) || 0;
            const requestBody = body || "";

            const fileContentToWrite = requestBody.slice(0, contentLength);
            fs.writeFileSync(filePath, fileContentToWrite);
            console.log(`File written successfully: ${filePath}`);

            socket.write("HTTP/1.1 201 Created\r\n\r\n");
            break;
          default:
            socket.write(NOT_FOUND_RESPONSE);
        }
        break;
      default:
        socket.write(NOT_FOUND_RESPONSE);
    }

    socket.end();
  });
});

server.listen(4221, "localhost");
