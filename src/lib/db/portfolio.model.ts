import { Schema, model, models, type InferSchemaType } from 'mongoose';

const PortfolioGenerationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    jobDescription: { type: String, required: true },
    outputFormat: { type: String, required: true },
    projectIds: { type: [Schema.Types.ObjectId], default: [] },
    content: { type: Schema.Types.Mixed, required: true },
    promptHash: { type: String, required: true },
    model: { type: String, required: true },
    vectorIndex: { type: String, required: true },
    topK: { type: Number, required: true },
    mustHaveSkills: { type: [String], default: [] },
  },
  { timestamps: true }
);

const PortfolioFeedbackSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    generationId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: ['view', 'edit', 'export_pdf', 'apply', 'positive', 'negative'],
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export type PortfolioGenerationDoc = InferSchemaType<typeof PortfolioGenerationSchema>;
export type PortfolioFeedbackDoc = InferSchemaType<typeof PortfolioFeedbackSchema>;

export const PortfolioGeneration =
  models.PortfolioGeneration ||
  model('PortfolioGeneration', PortfolioGenerationSchema);

export const PortfolioFeedback =
  models.PortfolioFeedback || model('PortfolioFeedback', PortfolioFeedbackSchema);
