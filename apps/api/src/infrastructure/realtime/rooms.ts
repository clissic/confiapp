export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function transactionRoom(transactionId: string): string {
  return `transaction:${transactionId}`;
}

export function chatRoom(chatId: string): string {
  return `chat:${chatId}`;
}
