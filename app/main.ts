import * as net from "net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

const server = net.createServer((socket) => {
  socket.on("data", (buf) => {
    const req = buf.toString("utf8");
    const [_, path] = req.split(" ");
    if (path === "/") {
      socket.write("HTTP/1.1 200 OK\r\n");
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n");
    }

    socket.end();
  });
});

server.listen(4221, "localhost");
