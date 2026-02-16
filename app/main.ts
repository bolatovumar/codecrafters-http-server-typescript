import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const server = net.createServer((socket) => {
  socket.on("data", (buf) => {
    const req = buf.toString("utf8");
    const [reqLine, ...rest] = req.split("\r\n");
    // console.log(`Request Line: ${reqLine}`);
    const body = rest.pop();
    const headersMap = new Map<string, string>();
    for (const header of rest) {
      const [key, value] = header.split(": ");
      headersMap.set(key, value);
    }
    const [_, path] = reqLine.split(" ");
    if (path === "/") {
      socket.write("HTTP/1.1 200 OK\r\n\r\n");
    } else if (path.split('/')[1] === 'echo') {
      const echoText = path.split('/')[2];
      socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${echoText.length}\r\n\r\n${echoText}`);
    } else if (path.split("/")[1] === 'user-agent') {
      const userAgent = headersMap.get("User-Agent") || "";
      socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`);
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    }

    socket.end();
  });
});

server.listen(4221, "localhost");
