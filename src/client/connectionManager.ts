export class ClientManager {  // Переименуй в ClientManager (class, не manager)
  private format: 'json' | 'binary' = 'json';

  setFormat(format: 'json' | 'binary') {
    this.format = format;
  }

  getFormat() {
    return this.format;
  }
}