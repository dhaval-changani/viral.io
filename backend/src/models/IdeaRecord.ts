import mongoose, { Document, Schema } from 'mongoose';
import type { IdeationResponse } from '../agents/schemas';

export interface IIdeaRecord extends Document {
  userId: mongoose.Types.ObjectId | null;
  topic: string;
  modelId: string;
  temperature: number;
  result: IdeationResponse;
  createdAt: Date;
  updatedAt: Date;
}

const ideaRecordSchema = new Schema<IIdeaRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    modelId: {
      type: String,
      required: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

export const IdeaRecord = mongoose.model<IIdeaRecord>('IdeaRecord', ideaRecordSchema);
