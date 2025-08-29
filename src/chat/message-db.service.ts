import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from './schemas/message.schema';
import { PendingMessage } from './schemas/pending-message.schema';
import { Reading } from './schemas/reading.schema';

@Injectable()
export class MessageDbService {
  private readonly logger = new Logger(MessageDbService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(PendingMessage.name) private pendingMessageModel: Model<PendingMessage>,
    @InjectModel(Reading.name) private readingModel: Model<Reading>,
  ) {}

  // Helper method to generate conversation ID from participants
  private generateConversationId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  async addMessage(
    toUserId: string, 
    fromUserId: string, 
    messageContent: string, 
    messageBackContent: string,
    messageId: string
  ): Promise<void> {
    try {
      this.logger.log(`Adding message ${messageId} from ${fromUserId} to ${toUserId}`);
      
      const conversationId = this.generateConversationId(fromUserId, toUserId);
      const message = {
        id: messageId,
        from: fromUserId,
        to: toUserId,
        message: messageContent, // Encrypted for recipient
        messageBack: messageBackContent, // Encrypted for sender
        createdAt: new Date(),
        status: 'sent'
      };

      // Try to update existing conversation
      const updateResult = await this.conversationModel.updateOne(
        { conversationId },
        {
          $push: { messages: message },
          $set: { updatedAt: new Date() }
        }
      );

      if (updateResult.matchedCount === 0) {
        // Create new conversation
        await this.conversationModel.create({
          conversationId,
          participants: [fromUserId, toUserId],
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        this.logger.log(`Created new conversation ${conversationId}`);
      }

      this.logger.log(`Message added successfully: ${messageId}`);
    } catch (error) {
      this.logger.error(`Error adding message to database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    try {
      this.logger.log(`Marking message ${messageId} as delivered`);
      
      const updateResult = await this.conversationModel.updateOne(
        { 'messages.id': messageId },
        {
          $set: {
            'messages.$.deliveredAt': new Date(),
            'messages.$.status': 'delivered'
          }
        }
      );

      if (updateResult.matchedCount > 0) {
        this.logger.log(`Message ${messageId} marked as delivered`);
      } else {
        this.logger.log(`Message ${messageId} not found for delivery update`);
      }
    } catch (error) {
      this.logger.error(`Error marking message as delivered: ${error.message}`, error.stack);
    }
  }

  async markMessageAsSeen(messageId: string): Promise<void> {
    try {
      this.logger.log(`Marking message ${messageId} as seen`);
      
      const updateResult = await this.conversationModel.updateOne(
        { 'messages.id': messageId },
        {
          $set: {
            'messages.$.seenAt': new Date(),
            'messages.$.status': 'seen'
          }
        }
      );

      if (updateResult.matchedCount > 0) {
        this.logger.log(`Message ${messageId} marked as seen`);
      } else {
        this.logger.log(`Message ${messageId} not found for seen update`);
      }
    } catch (error) {
      this.logger.error(`Error marking message as seen: ${error.message}`, error.stack);
    }
  }

  async getConversationMessages(userId1: string, userId2: string): Promise<any[]> {
    try {
      this.logger.log(`Getting conversation messages between ${userId1} and ${userId2}`);
      
      const conversationId = this.generateConversationId(userId1, userId2);
      const conversation = await this.conversationModel.findOne(
        { conversationId },
        { messages: 1 }
      );

      if (!conversation || !conversation.messages.length) {
        this.logger.log(`No conversation found between ${userId1} and ${userId2}`);
        return [];
      }

      this.logger.log(`Found ${conversation.messages.length} messages in conversation`);
      return conversation.messages;
    } catch (error) {
      this.logger.error(`Error retrieving conversation messages: ${error.message}`, error.stack);
      return [];
    }
  }

  async getMessagesFromUser(toUserId: string, fromUserId: string): Promise<any[]> {
    try {
      this.logger.log(`Getting messages from ${fromUserId} to ${toUserId}`);
      
      const conversationId = this.generateConversationId(fromUserId, toUserId);
      const conversation = await this.conversationModel.findOne(
        { conversationId },
        { messages: { $elemMatch: { from: fromUserId, to: toUserId } } }
      );

      if (!conversation || !conversation.messages.length) {
        this.logger.log(`No messages found from ${fromUserId} to ${toUserId}`);
        return [];
      }

      this.logger.log(`Found ${conversation.messages.length} messages from ${fromUserId} to ${toUserId}`);
      return conversation.messages;
    } catch (error) {
      this.logger.error(`Error retrieving messages: ${error.message}`, error.stack);
      return [];
    }
  }

  async getAllConversationsForUser(userId: string): Promise<any[]> {
    try {
      this.logger.log(`Getting all conversations for user ${userId}`);
      
      const conversations = await this.conversationModel.find(
        { participants: userId },
        { conversationId: 1, participants: 1, messages: 1, updatedAt: 1 }
      ).sort({ updatedAt: -1 });
      
      if (!conversations.length) {
        this.logger.log(`No conversations found for user ${userId}`);
        return [];
      }

      this.logger.log(`Found ${conversations.length} conversations for ${userId}`);
      return conversations;
    } catch (error) {
      this.logger.error(`Error retrieving all conversations: ${error.message}`, error.stack);
      return [];
    }
  }

  async getAllMessagesForUser(toUserId: string): Promise<any> {
    // Backward compatibility - return conversations in old format
    const conversations = await this.getAllConversationsForUser(toUserId);
    
    if (!conversations.length) {
      return null;
    }

    // Transform to old format for backward compatibility
    const users = conversations.map(conv => {
      const otherUser = conv.participants.find(p => p !== toUserId);
      return {
        userId: otherUser,
        messages: conv.messages.filter(m => m.to === toUserId)
      };
    }).filter(u => u.messages.length > 0);

    return {
      messageId: toUserId,
      users
    };
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

  async deliverPendingMessage(
    toUserId: string,
    fromUserId: string, 
    messageContent: string,
    messageBackContent: string,
    messageId: string
  ): Promise<void> {
    try {
      this.logger.log(`Delivering pending message ${messageId} from ${fromUserId} to ${toUserId}`);
      
      // First, store the message in the conversation
      await this.addMessage(toUserId, fromUserId, messageContent, messageBackContent, messageId);
      
      // Mark the message as delivered
      await this.markMessageAsDelivered(messageId);
      
      // Remove from pending messages
      await this.deleteMessage(toUserId, messageId);
      
      this.logger.log(`Pending message ${messageId} successfully delivered and stored`);
    } catch (error) {
      this.logger.error(`Error delivering pending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deliverAllPendingMessages(toUserId: string): Promise<void> {
    try {
      this.logger.log(`Delivering all pending messages for ${toUserId}`);
      
      const pendingMessages = await this.getPendingMessages(toUserId);
      
      if (pendingMessages.length === 0) {
        this.logger.log(`No pending messages to deliver for ${toUserId}`);
        return;
      }

      let deliveredCount = 0;
      for (const pendingMsg of pendingMessages) {
        try {
          // Assuming pending messages have encrypted content for both directions
          // You may need to adjust based on your actual pending message structure
          await this.addMessage(
            toUserId, 
            pendingMsg.from, 
            pendingMsg.msg, // message content
            pendingMsg.msg, // messageBack - adjust as needed
            pendingMsg.id
          );
          
          await this.markMessageAsDelivered(pendingMsg.id);
          deliveredCount++;
        } catch (error) {
          this.logger.error(`Error delivering individual pending message ${pendingMsg.id}: ${error.message}`);
        }
      }
      
      // Clear all pending messages after delivery
      await this.deleteAllPendingMessages(toUserId);
      
      this.logger.log(`Delivered ${deliveredCount} out of ${pendingMessages.length} pending messages for ${toUserId}`);
    } catch (error) {
      this.logger.error(`Error delivering all pending messages: ${error.message}`, error.stack);
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
      const state = this.conversationModel.db.readyState;
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
      const conversationCount = await this.conversationModel.countDocuments();
      const pendingCount = await this.pendingMessageModel.countDocuments();
      const readingCount = await this.readingModel.countDocuments();

      // Count total messages across all conversations
      const totalMessagesResult = await this.conversationModel.aggregate([
        { $project: { messageCount: { $size: '$messages' } } },
        { $group: { _id: null, totalMessages: { $sum: '$messageCount' } } }
      ]);
      const totalMessages = totalMessagesResult.length > 0 ? totalMessagesResult[0].totalMessages : 0;

      return {
        conversations: {
          count: conversationCount,
          status: 'available'
        },
        totalMessages: {
          count: totalMessages,
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
        conversations: { count: 0, status: 'error' },
        totalMessages: { count: 0, status: 'error' },
        pendingMessages: { count: 0, status: 'error' },
        reading: { count: 0, status: 'error' }
      };
    }
  }
}