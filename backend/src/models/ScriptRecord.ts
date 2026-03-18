import mongoose, { Document, Schema } from 'mongoose';
import type { FullVideoScript, ViralVideo } from '../agents/schemas';

export interface IScriptRecord extends Document {
  userId: mongoose.Types.ObjectId | null;
  ideaRecordId: mongoose.Types.ObjectId | null;
  idea: ViralVideo;
  modelId: string;
  temperature: number;
  result: FullVideoScript;
  audioUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

const scriptRecordSchema = new Schema<IScriptRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    ideaRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'IdeaRecord',
      default: null,
    },
    idea: {
      type: Schema.Types.Mixed,
      required: true,
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
    audioUrls: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

export const ScriptRecord = mongoose.model<IScriptRecord>('ScriptRecord', scriptRecordSchema);
