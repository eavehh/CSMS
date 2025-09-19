const { encode, decode } = require('@msgpack/msgpack');


class Message {
    constructor(type, id, action, payload) {
        this.type = type; // 2 - CALL; 3-CALLRESULT; 3-CALLERROR
        this.id = id
        this.action = action
        this.payload = payload
    }

    toJSON() {
        return JSON.stringify([this.type, this.id, this.action, this.payload])
    }

    toMsgPack() {
        return encode([this.type, this.id, this.action, this.payload])
    }

    static fromJSON(mess) {
        const [type, id, action, payload] = JSON.parse(mess)
        return new Message(type, id, action, payload)
    }

    static fromMsgPack(mess) {
        const [type, id, action, payload] = decode(mess)
        return new Message(type, id, action, payload)
    }
}

module.exports = Message;