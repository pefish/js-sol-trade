import { Connection, ParsedInstruction, ParsedTransactionWithMeta, PartiallyDecodedInstruction, PublicKey } from "@solana/web3.js";
import { Order } from "./constants";
import { ILogger } from "@pefish/js-logger";
export declare function findInnerInstructions(transaction: ParsedTransactionWithMeta, instructionIndex: number): (ParsedInstruction | PartiallyDecodedInstruction)[];
export declare function sendRawTransactionByMultiNode(logger: ILogger, urls: string[], rawTransaction: Buffer | Uint8Array | Array<number>): Promise<string>;
export declare function parseOrderTransaction(logger: ILogger, connection: Connection, txId: string): Promise<Order | null>;
export declare function getTweetMetrics(keyword: string, token: string): Promise<number>;
export declare function getMetadataAccount(connection: Connection, tokenAddress: string): string;
export declare function getTokenMetadata(connection: Connection, tokenAddress: string): Promise<{
    model: string;
    address: PublicKey;
    mintAddress: PublicKey;
    updateAuthorityAddress: PublicKey;
    json: any | null;
    jsonLoaded: boolean;
    name: string;
    symbol: string;
    uri: string;
    isMutable: boolean;
    primarySaleHappened: boolean;
    sellerFeeBasisPoints: number;
    editionNonce: number;
    creators: PublicKey[];
    tokenStandard: number;
    collection: any | null;
    collectionDetails: any | null;
    uses: any | null;
    programmableConfig: any | null;
}>;
export declare function getCreateInfoFromMetadataAccount(connection: Connection, metadataAccount: string): Promise<{
    creator: string;
    timestamp: number;
}>;
export declare function getLPInfoFromLpAddress(connection: Connection, lpAddress: string): Promise<{
    tokenAddress: string;
    initTokenAmountInLP: string;
    initSOLAmountInLP: string;
}>;
export declare function getLPInfoFromAddLPTx(connection: Connection, txId: string): Promise<{
    tokenAddress: string;
    initTokenAmountInLP: string;
    initSOLAmountInLP: string;
    pairAddress: string;
    solPoolAddress: string;
    tokenPoolAddress: string;
}>;
export declare function getRedditToken(clientId: string, clientSecret: string): Promise<{
    access_token: string;
    expires_in: number;
}>;
export declare function getRedditScore(keyword: string, token: string): Promise<number>;
