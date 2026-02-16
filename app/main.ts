import * as net from "net";
import * as fs from "fs";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const NOT_FOUND_RESPONSE = "HTTP/1.1 404 Not Found\r\n\r\n";

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
    const [_, path] = reqLine.split(" ");
    const [__, endpoint, restPath] = path.split("/");
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
        console.log('Handling file request for path:', restPath);
        const filename = restPath;
        // Check if file exists in tmp folder
        const filePath = `/tmp/${filename}`;
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
      default:
        socket.write(NOT_FOUND_RESPONSE);
    }

    socket.end();
  });
});

server.listen(4221, "localhost");
