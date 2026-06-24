import { getBackendWsUrl } from "./backend";

type MessageHandler = (msg: Record<string, unknown>) => void;

const walletKey = "amongsol.wallet";
const lastMessagesKey = "amongsol.lastMessages";

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

    window.localStorage.removeItem(walletKey);
    window.localStorage.removeItem(lastMessagesKey);

    const wallet = window.sessionStorage.getItem(walletKey);
    if (wallet) {
      this.wallet = wallet;
    }

    const rawMessages = window.sessionStorage.getItem(lastMessagesKey);
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
    window.sessionStorage.setItem(walletKey, this.wallet);
    window.sessionStorage.setItem(lastMessagesKey, JSON.stringify(this.lastMessages));
    window.localStorage.removeItem(walletKey);
    window.localStorage.removeItem(lastMessagesKey);
  }

  private createWallet() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `crew_${crypto.randomUUID().slice(0, 8)}`;
    }

    return `crew_${Math.random().toString(36).slice(2, 10)}`;
  }

  ensureWallet() {
    this.hydrateFromStorage();
    if (!this.wallet) {
      this.wallet = this.createWallet();
      this.persist();
    }
    return this.wallet;
  }

  setWallet(wallet: string) {
    this.hydrateFromStorage();
    this.wallet = wallet;
    this.persist();
  }

  connect(wallet: string) {
    this.hydrateFromStorage();
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.wallet = wallet;
    this.lastMessages = {};
    this.queue = [];
    this.persist();
    this.ws = new WebSocket(getBackendWsUrl("/ws"));

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
      this.ws = new WebSocket(getBackendWsUrl("/ws"));

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

  async joinGame(gameId: string, wallet: string) {
    await this.connectAndWait(wallet);

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        unsub();
        reject(new Error("server did not confirm room join"));
      }, 5000);

      const unsub = this.onMessage((msg) => {
        if (msg.type === "GameJoined" && msg.game_id === gameId) {
          window.clearTimeout(timeout);
          unsub();
          resolve(msg);
        }

        if (msg.type === "Error") {
          window.clearTimeout(timeout);
          unsub();
          reject(new Error((msg.message as string | undefined) ?? "failed to join room"));
        }
      });

      this.send({ type: "JoinGame", game_id: gameId, wallet });
    });
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

  getCurrentRoomState() {
    this.hydrateFromStorage();

    if (this.lastMessages.GameOver) return "ended";
    if (this.lastMessages.VotingStarted || this.lastMessages.VoteUpdate) return "voting";
    if (this.lastMessages.MeetingCalled) return "meeting";
    if (this.lastMessages.CodeLocked) return "code_locked";
    if (this.lastMessages.GameStarted) return "playing";

    return (this.lastMessages.GameJoined?.state as string | undefined) ?? "lobby";
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
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(lastMessagesKey);
      window.localStorage.removeItem(walletKey);
      window.localStorage.removeItem(lastMessagesKey);
    }
  }
}

const socket = new SocketClient();
export default socket;
