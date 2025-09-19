class ConnectionContext {
    constructor(Charger, Message) {
        this.charger = Charger;
        this.message = Message;
        this.session = null;
    }
}
module.exports = ConnectionContext;