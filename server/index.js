const ws = require('ws');
const http = require('http')
const msgpack = require('@msgpack/msgpack');
const uuid = require('uuid').v4;

const Charger = require("../src/types/Charger")
const Session = require("../src/types/Session")
const Message = require("../src/types/Message")
const ConnContext = require("./ConnContext")
const { handleMessage, handleClose } = require("./handlers")

const server = http.createServer();
const wsServer = new ws.Server({ server }) // HTTP server 

const PORT = 8000;


wsServer.on("connection", (conn) => {
    conn.ctx = new ConnContext(new Charger(uuid()), new Message()) // create a new context for each connection 
    console.log(`Connnected a client with a ${conn.protocol} protocol`);
    try {

        conn.on("message", (data) => handleMessage(data, conn)) //data is a Buffer from a client   
        conn.on("close", () => handleClose(conn))

    } catch (error) {

        console.log(`Error connection: ${error}`);
        console.log(`protocol: ${conn.protocol}`);

    }
})

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})