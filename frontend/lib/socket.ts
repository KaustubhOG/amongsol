type MessageHandler = (msg: Record<string, unknown>) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private wallet: string = "";
  private queue: Record<string, unknown>[] = [];
  private lastMessages: Record<string, Record<string, unknown>> = {};
  private hydrated = false;

  private hydrateFromStorage() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;

    const wallet = window.localStorage.getItem("amongsol.wallet");
    if (wallet) {
      this.wallet = wallet;
    }

    const rawMessages = window.localStorage.getItem("amongsol.lastMessages");
    if (rawMessages) {
      try {
        this.lastMessages = JSON.parse(rawMessages) as Record<string, Record<string, unknown>>;
      } catch {
        this.lastMessages = {};
      }
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("amongsol.wallet", this.wallet);
    window.localStorage.setItem("amongsol.lastMessages", JSON.stringify(this.lastMessages));
  }

  connect(wallet: string) {
    this.hydrateFromStorage();
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.wallet = wallet;
    this.lastMessages = {};
    this.queue = [];
    this.persist();
    this.ws = new WebSocket("ws://localhost:8080/ws");

    this.ws.onopen = () => {
      this.queue.forEach((msg) => this.ws!.send(JSON.stringify(msg)));
      this.queue = [];
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.lastMessages[msg.type as string] = msg;
        this.persist();
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
      this.hydrateFromStorage();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.wallet = wallet;
        this.persist();
        resolve();
        return;
      }

      this.wallet = wallet;
      this.lastMessages = {};
      this.queue = [];
       this.persist();
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
          this.persist();
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
    this.hydrateFromStorage();
    return this.lastMessages[type] ?? null;
  }

  getWallet() {
    this.hydrateFromStorage();
    return this.wallet;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
    this.queue = [];
    this.lastMessages = {};
    this.wallet = "";
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("amongsol.wallet");
      window.localStorage.removeItem("amongsol.lastMessages");
    }
  }
}

const socket = new SocketClient();
export default socket;
