export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  messageBack: string;
  type?: string;
  createdAt: Date;
  isWeb: boolean;
  delivered?: boolean;
}

export interface MessageResponse {
  success: boolean;
  data?: {
    status: string;
    chatId: string;
    createdAt: Date;
    deliveredAt?: Date;
    seenAt?: Date;
  };
  error?: string;
}