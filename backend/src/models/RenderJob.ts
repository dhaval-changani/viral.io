import mongoose, { Document, Schema } from 'mongoose';

export type RenderJobStatus =
  | 'pending'
  | 'tts_processing'
  | 'broll_processing'
  | 'rendering'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface IRenderJob extends Document {
  userId: mongoose.Types.ObjectId | null;
  scriptRecordId: mongoose.Types.ObjectId;
  status: RenderJobStatus;
  videoTitle: string;
  error: string | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const renderJobSchema = new Schema<IRenderJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    scriptRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'ScriptRecord',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'tts_processing',
        'broll_processing',
        'rendering',
        'uploading',
        'completed',
        'failed',
      ],
      default: 'pending',
      required: true,
    },
    videoTitle: {
      type: String,
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
    youtubeVideoId: {
      type: String,
      default: null,
    },
    youtubeUrl: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const RenderJob = mongoose.model<IRenderJob>('RenderJob', renderJobSchema);
