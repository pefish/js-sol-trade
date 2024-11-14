import { Connection } from "@solana/web3.js";
import "dotenv/config";
import { Order } from "../constants";
export declare function placeOrder(connection: Connection, priv: string, type: "buy" | "sell", amount: string, tokenAddress: string, abortSignal: AbortSignal, nodeUrls: string[]): Promise<Order>;
