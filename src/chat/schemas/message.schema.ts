import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class MessageItem {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  msg: string;

  @Prop({ required: true })
  date: Date;
}

@Schema()
export class UserMessages {
  @Prop({ required: true })
  userId: string;

  @Prop([MessageItem])
  messages: MessageItem[];
}

@Schema({ _id: false })
export class Message extends Document {
  @Prop({ required: true, unique: true })
  messageId: string;

  @Prop([UserMessages])
  users: UserMessages[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ messageId: 1 }, { unique: true });