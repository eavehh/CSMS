const ws = require('ws');
const http = require('http')
const msgpack = require('@msgpack/msgpack');

const { handleMessage } = require("./handlers")

const server = http.createServer();
const wsServer = new ws.Server({ server }) // HTTP server 

const PORT = 8000;


wsServer.on("connection", (conn) => {
    try {
        conn.on("message", (data, isBinary) => handleMessage(data, isBinary, conn)) //data is a Buffer from a client   
    } catch (error) {
        console.log(`Error connection: ${error}`);
    }

})

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})