import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

const defaultRpcUrl = "https://api.devnet.solana.com";
const configuredProgramId =
  process.env.NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID ??
  "H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA";
const encoder = new TextEncoder();
const initializeGameDiscriminator = [44, 62, 102, 247, 126, 208, 130, 215];
const depositStakeDiscriminator = [160, 167, 9, 220, 74, 243, 228, 43];
const settleGameDiscriminator = [96, 54, 24, 189, 239, 198, 86, 29];

export function lamportsToSol(lamports: number) {
  return lamports / 1_000_000_000;
}

function getConnection() {
  return new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? defaultRpcUrl, "confirmed");
}

export async function connectSolanaWallet() {
  if (typeof window === "undefined") {
    throw new Error("Solana wallet not found");
  }

  if (window.solana) {
    const response = await window.solana.connect();
    return response.publicKey.toString();
  }

  const stored = window.sessionStorage.getItem("amongsol.localWallet");
  if (stored) {
    return stored;
  }

  const localWallet = `local_${crypto.randomUUID().slice(0, 12)}`;
  window.sessionStorage.setItem("amongsol.localWallet", localWallet);
  return localWallet;
}

function roomSeed(roomId: string) {
  return encoder.encode(roomId.toUpperCase().slice(0, 8).padEnd(8, "\0"));
}

function u64Le(value: number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(value), true);
  return new Uint8Array(buffer);
}

export function deriveStakeAccounts(roomId: string, programIdText = configuredProgramId) {
  if (!programIdText || programIdText.startsWith("Set ")) {
    throw new Error("staking program is not configured");
  }

  const programId = new PublicKey(programIdText);
  const seed = roomSeed(roomId);
  const [game] = PublicKey.findProgramAddressSync([encoder.encode("game"), seed], programId);
  const [vault] = PublicKey.findProgramAddressSync([encoder.encode("vault"), game.toBuffer()], programId);

  return { programId, game, vault, seed };
}

export async function sendStake(roomId: string, lamports: number, isHost: boolean, programIdText = configuredProgramId) {
  if (typeof window === "undefined" || !window.solana) {
    throw new Error("Solana wallet not found");
  }

  const provider = window.solana;
  const from = provider.publicKey ? new PublicKey(provider.publicKey.toString()) : new PublicKey(await connectSolanaWallet());
  const { programId, game, vault, seed } = deriveStakeAccounts(roomId, programIdText);
  const connection = getConnection();

  const transaction = new Transaction();

  if (isHost) {
    transaction.add(
      new TransactionInstruction({
        programId,
        keys: [
          { pubkey: game, isSigner: false, isWritable: true },
          { pubkey: from, isSigner: true, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([...initializeGameDiscriminator, ...seed, ...u64Le(lamports)]),
      })
    );
  }

  transaction.add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: game, isSigner: false, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: from, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(depositStakeDiscriminator),
    })
  );

  transaction.feePayer = from;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signature = await provider.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function settleStake(
  roomId: string,
  payouts: { wallet: string; lamports: number }[],
  programIdText = configuredProgramId
) {
  if (typeof window === "undefined" || !window.solana) {
    throw new Error("Solana wallet not found");
  }

  const provider = window.solana;
  const host = provider.publicKey ? new PublicKey(provider.publicKey.toString()) : new PublicKey(await connectSolanaWallet());
  const { programId, game, vault } = deriveStakeAccounts(roomId, programIdText);
  const connection = getConnection();
  const payoutBytes = payouts.flatMap((payout) => [
    ...new PublicKey(payout.wallet).toBytes(),
    ...u64Le(payout.lamports),
  ]);
  const len = new ArrayBuffer(4);
  new DataView(len).setUint32(0, payouts.length, true);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: game, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: host, isSigner: true, isWritable: false },
        ...payouts.map((payout) => ({
          pubkey: new PublicKey(payout.wallet),
          isSigner: false,
          isWritable: true,
        })),
      ],
      data: Buffer.from([...settleGameDiscriminator, ...new Uint8Array(len), ...payoutBytes]),
    })
  );

  transaction.feePayer = host;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signature = await provider.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
