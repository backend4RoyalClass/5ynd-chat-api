import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ReadingMessageItem {
  @Prop({ required: true })
  id: string;
}

@Schema()
export class ReadingUser {
  @Prop({ required: true })
  userId: string;

  @Prop([ReadingMessageItem])
  messages: ReadingMessageItem[];
}

@Schema({ _id: false })
export class Reading extends Document {
  @Prop({ required: true, unique: true })
  readingId: string;

  @Prop([ReadingUser])
  users: ReadingUser[];
}

export const ReadingSchema = SchemaFactory.createForClass(Reading);
ReadingSchema.index({ readingId: 1 }, { unique: true });