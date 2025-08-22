import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from './schemas/message.schema';
import { PendingMessage } from './schemas/pending-message.schema';
import { Reading } from './schemas/reading.schema';

@Injectable()
export class MessageDbService {
  private readonly logger = new Logger(MessageDbService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(PendingMessage.name) private pendingMessageModel: Model<PendingMessage>,
    @InjectModel(Reading.name) private readingModel: Model<Reading>,
  ) {}

  async addMessage(toUserId: string, fromUserId: string, messageContent: string, messageId: string): Promise<void> {
    try {
      this.logger.log(`Adding message ${messageId} from ${fromUserId} to ${toUserId}`);
      
      const message = {
        id: messageId,
        msg: messageContent,
        date: new Date(),
      };

      // Try to update existing conversation using messageId (not _id)
      const updateResult = await this.messageModel.updateOne(
        { messageId: toUserId, 'users.userId': fromUserId },
        {
          $push: { 'users.$.messages': message },
        }
      );

      if (updateResult.matchedCount === 0) {
        // No existing conversation found, check if document exists
        const existingConversation = await this.messageModel.findOne({ messageId: toUserId });
        
        if (!existingConversation) {
          // Create new conversation document - let MongoDB auto-generate _id
          await this.messageModel.create({
            messageId: toUserId,
            users: [{
              userId: fromUserId,
              messages: [message]
            }]
          });
          this.logger.log(`Created new conversation for ${toUserId}`);
        } else {
          // Document exists but user doesn't, add new user
          await this.messageModel.updateOne(
            { messageId: toUserId },
            {
              $push: {
                users: {
                  userId: fromUserId,
                  messages: [message]
                }
              }
            }
          );
          this.logger.log(`Added new user ${fromUserId} to conversation ${toUserId}`);
        }
      }

      this.logger.log(`Message added successfully: ${messageId}`);
    } catch (error) {
      this.logger.error(`Error adding message to database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMessagesFromUser(toUserId: string, fromUserId: string): Promise<any[]> {
    try {
      this.logger.log(`Getting messages from ${fromUserId} to ${toUserId}`);
      
      const userMessages = await this.messageModel.findOne(
        { messageId: toUserId, 'users.userId': fromUserId },
        { 'users.$': 1 }
      );

      if (!userMessages || !userMessages.users.length) {
        this.logger.log(`No messages found from ${fromUserId} to ${toUserId}`);
        return [];
      }

      const messages = userMessages.users[0].messages;
      this.logger.log(`Found ${messages.length} messages from ${fromUserId} to ${toUserId}`);
      return messages;
    } catch (error) {
      this.logger.error(`Error retrieving messages: ${error.message}`, error.stack);
      return [];
    }
  }

  async getAllMessagesForUser(toUserId: string): Promise<any> {
    try {
      this.logger.log(`Getting all messages for user ${toUserId}`);
      
      const userMessages = await this.messageModel.findOne({ messageId: toUserId });
      
      if (!userMessages) {
        this.logger.log(`No messages found for user ${toUserId}`);
        return null;
      }

      this.logger.log(`Found conversations with ${userMessages.users.length} users for ${toUserId}`);
      return userMessages;
    } catch (error) {
      this.logger.error(`Error retrieving all messages: ${error.message}`, error.stack);
      return null;
    }
  }

  async storePendingMessage(id: string, message: any): Promise<void> {
    try {
      this.logger.log(`Storing pending message for ${id}`);
      
      // Try to update existing document
      const updateResult = await this.pendingMessageModel.updateOne(
        { pendingId: id },
        { $push: { messages: message } }
      );

      if (updateResult.matchedCount === 0) {
        // Create new document - let MongoDB auto-generate _id
        await this.pendingMessageModel.create({
          pendingId: id,
          messages: [message]
        });
        this.logger.log(`Created new pending message document for ${id}`);
      } else {
        this.logger.log(`Updated existing pending message document for ${id}`);
      }
    } catch (error) {
      this.logger.error(`Error storing pending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPendingMessages(id: string): Promise<any[]> {
    try {
      this.logger.log(`Getting pending messages for ${id}`);
      
      const userMessages = await this.pendingMessageModel.findOne({ pendingId: id }).select('messages');

      if (!userMessages) {
        this.logger.log(`No pending messages found for ${id}`);
        return [];
      }

      this.logger.log(`Found ${userMessages.messages.length} pending messages for ${id}`);
      return userMessages.messages;
    } catch (error) {
      this.logger.error(`Error retrieving pending messages: ${error.message}`, error.stack);
      return [];
    }
  }

  async deleteAllPendingMessages(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting pending messages for ${id}`);
      
      await this.pendingMessageModel.updateOne(
        { pendingId: id },
        { $set: { messages: [] } }
      );
      
      this.logger.log(`All pending messages deleted for user: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting pending messages: ${error.message}`, error.stack);
    }
  }

  async deleteMessage(id: string, messageId: string): Promise<void> {
    try {
      this.logger.log(`Deleting pending message ${messageId} for ${id}`);
      
      const result = await this.pendingMessageModel.updateOne(
        { pendingId: id },
        { $pull: { messages: { id: messageId } } }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Message with ID ${messageId} successfully deleted for user ${id}`);
      } else {
        this.logger.log(`No message found with ID ${messageId} for user ${id}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
    }
  }

  // Reading/Receipt Management
  async storeInReading(to: string, pendingMessages: any[]): Promise<void> {
    try {
      this.logger.log(`Storing reading receipts for ${to}`);
      
      if (pendingMessages.length === 0) {
        this.logger.log('No pending messages to process for reading');
        return;
      }

      const usersData = {};

      pendingMessages.forEach(({ id, from }) => {
        if (!usersData[from]) {
          usersData[from] = [];
        }
        usersData[from].push({ id });
      });

      const usersArray = Object.entries(usersData).map(([userId, messages]) => ({
        userId,
        messages,
      }));

      // Try to update existing document
      const updateResult = await this.readingModel.updateOne(
        { readingId: to },
        { $push: { users: { $each: usersArray } } }
      );

      if (updateResult.matchedCount === 0) {
        // Create new document - let MongoDB auto-generate _id
        await this.readingModel.create({
          readingId: to,
          users: usersArray
        });
        this.logger.log(`Created new reading document for ${to}`);
      }

      this.logger.log(`Reading receipts stored successfully for ${to}`);
    } catch (error) {
      this.logger.error(`Error storing reading receipts: ${error.message}`, error.stack);
    }
  }

  async getToReadMessages(to: string, from: string): Promise<any[]> {
    try {
      this.logger.log(`Getting to-read messages for ${to} from ${from}`);
      
      const result = await this.readingModel.findOne(
        { readingId: to, 'users.userId': from },
        { 'users.$': 1 }
      );

      if (!result || result.users.length === 0) {
        this.logger.log(`No to-read messages found for ${to} from ${from}`);
        return [];
      }

      const messages = result.users[0].messages;
      this.logger.log(`Found ${messages.length} to-read messages for ${to} from ${from}`);
      return messages;
    } catch (error) {
      this.logger.error(`Error retrieving to-read messages: ${error.message}`, error.stack);
      return [];
    }
  }

  async deleteToReadMessages(to: string, from: string): Promise<void> {
    try {
      this.logger.log(`Deleting to-read messages for ${to} from ${from}`);
      
      const result = await this.readingModel.updateOne(
        { readingId: to },
        { $pull: { users: { userId: from } } }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`To-read messages from user ${from} successfully deleted for ${to}`);
      } else {
        this.logger.log(`No to-read messages found for user ${from} and ${to}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting to-read messages: ${error.message}`, error.stack);
    }
  }

  // Health check method
  async checkConnection(): Promise<boolean> {
    try {
      const state = this.messageModel.db.readyState;
      this.logger.log(`MongoDB connection state: ${state}`);
      return state === 1;
    } catch (error) {
      this.logger.error(`MongoDB connection failed: ${error.message}`);
      return false;
    }
  }

  // Collection stats method
  async getCollectionStats(): Promise<any> {
    try {
      const messageCount = await this.messageModel.countDocuments();
      const pendingCount = await this.pendingMessageModel.countDocuments();
      const readingCount = await this.readingModel.countDocuments();

      return {
        messages: {
          count: messageCount,
          status: 'available'
        },
        pendingMessages: {
          count: pendingCount,
          status: 'available'
        },
        reading: {
          count: readingCount,
          status: 'available'
        }
      };
    } catch (error) {
      this.logger.error(`Error getting collection stats: ${error.message}`, error.stack);
      return {
        messages: { count: 0, status: 'error' },
        pendingMessages: { count: 0, status: 'error' },
        reading: { count: 0, status: 'error' }
      };
    }
  }
}