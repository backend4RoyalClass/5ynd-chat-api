import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class PendingMessageItem {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  msg: string;

  @Prop({ required: true })
  date: Date;
}

@Schema({ _id: false })
export class PendingMessage extends Document {
  @Prop({ required: true, unique: true })
  pendingId: string;

  @Prop([PendingMessageItem])
  messages: PendingMessageItem[];
}

export const PendingMessageSchema = SchemaFactory.createForClass(PendingMessage);
PendingMessageSchema.index({ pendingId: 1 }, { unique: true });