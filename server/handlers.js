const Message = require("../src/types/Message")

const handleMessage = (data, conn) => {
    try {
        if (typeof data === 'string' || data instanceof String) {
            conn.ctx.message = Message.fromJSON(data);  
        } else {
            conn.ctx.message = Message.fromMsgPack(data);
        }
    } catch (error) {
        console.log(`Failed to parse message: ${error}`);
        return;
    }

    console.log("Received message: ", conn.ctx.message);
}

const handleClose = (conn) => {
    console.log(`${conn.ctx.charger} disconnected`);
    conn.close();
}

module.exports = { handleMessage, handleClose };