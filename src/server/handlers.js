
const handleMessage = (data, isBinary, conn) => {
    let message;
    try {
        if (isBinary) {
            message = Message.fromMsgPack(data);
        } else {
            message = Message.fromJSON(data);
        }
    } catch (error) {
        console.log(`Failed to parse message: ${error}`);
        return;
    }

    if (message.type === 2) {
        switch (message.action) {
            case "BoostNotification":
                conn.send(JSON.stringify([
                    3,
                    message.id,
                    {
                        status: "Accepted",
                        currentTime: new Date().toISOString(),
                        interval: 60
                    }
                ]))
                break
            case "Heartbeat":
                conn.send(JSON.stringify([
                    3,
                    message.id,
                    {
                        currentTime: new Date().toISOString(),
                    }
                ]))
                break
            case "StartTransaction":
                conn.send(JSON.stringify([
                    3,
                    message.id,
                    {
                        transactionId: 1001,
                        idTaginfo: { status: "Accepted" }
                    }
                ]))
                break
            case "StopTransaction":
                conn.send(JSON.stringify([
                    3,
                    message.id,
                    {
                        idTaginfo: { status: "Accepted" }
                    }
                ]))
                break
            default:
                conn.send(JSON.stringify([
                    4,
                    message.id,
                    "NotImplemented",
                    `Action ${action} not supported`,
                    {}
                ]))
                break
        }
    }
}


module.exports = { handleMessage };