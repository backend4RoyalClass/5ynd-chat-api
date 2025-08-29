import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ConversationMessage {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  message: string; // Encrypted for recipient

  @Prop({ required: true })
  messageBack: string; // Encrypted for sender

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  deliveredAt: Date;

  @Prop()
  seenAt: Date;

  @Prop({ default: 'sent' })
  status: string; // 'sent', 'delivered', 'seen'
}

@Schema()
export class Conversation extends Document {
  @Prop({ required: true, unique: true })
  conversationId: string; // Generated conversation ID

  @Prop({ type: [String], required: true })
  participants: string[]; // Array of user IDs

  @Prop([ConversationMessage])
  messages: ConversationMessage[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ conversationId: 1 });
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ 'messages.from': 1, 'messages.to': 1 });