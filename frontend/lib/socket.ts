type MessageHandler = (msg: Record<string, unknown>) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private wallet: string = "";
  private queue: Record<string, unknown>[] = [];
  private lastMessages: Record<string, Record<string, unknown>> = {};

  connect(wallet: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.wallet = wallet;
    this.lastMessages = {};
    this.queue = [];
    this.ws = new WebSocket("ws://localhost:8080/ws");

    this.ws.onopen = () => {
      this.queue.forEach((msg) => this.ws!.send(JSON.stringify(msg)));
      this.queue = [];
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.lastMessages[msg.type as string] = msg;
        this.handlers.forEach((h) => h(msg));
      } catch {}
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  // Same as connect(), but returns a Promise that resolves once the
  // WebSocket connection is actually open. Needed because the UI sends
  // a JoinGame message immediately after connecting and needs to know
  // the socket is ready first.
  connectAndWait(wallet: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.wallet = wallet;
        resolve();
        return;
      }

      this.wallet = wallet;
      this.lastMessages = {};
      this.queue = [];
      this.ws = new WebSocket("ws://localhost:8080/ws");

      this.ws.onopen = () => {
        this.queue.forEach((msg) => this.ws!.send(JSON.stringify(msg)));
        this.queue = [];
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.lastMessages[msg.type as string] = msg;
          this.handlers.forEach((h) => h(msg));
        } catch {}
      };

      this.ws.onerror = (err) => {
        reject(err);
      };

      this.ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  getLastMessage(type: string): Record<string, unknown> | null {
    return this.lastMessages[type] ?? null;
  }

  getWallet() {
    return this.wallet;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
    this.queue = [];
    this.lastMessages = {};
  }
}

const socket = new SocketClient();
export default socket;