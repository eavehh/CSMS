export class ClientManager {  // Переименуй в ClientManager (class, не manager)
  private format: 'json' | 'binary' = 'json';
  private lastSentTime = 0;
  private interval = 60; // дефолт

  setFormat(format: 'json' | 'binary') {
    this.format = format;
  }

  getFormat() {
    return this.format;
  }

  updateInterval(newInterval: number) {
    this.interval = newInterval;
  }

  updateLastSentTime() {
    this.lastSentTime = Date.now();
  }

  shouldSendHeartbeat(): boolean {
    const timePassed = Date.now() - this.lastSentTime;
    return timePassed >= this.interval * 1000;  // Если прошло >= interval секунд — отправь
  }
}