import { Schema, model, models, type InferSchemaType } from 'mongoose';


const ProjectSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    fingerprint: { type: String, required: true, index: true },
    techStack: { type: [String], default: [] },
    impactScore: { type: Number, min: 1, max: 10, required: true },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], default: [], required: true },
  },
  { timestamps: true }
);

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

const UserProfileSchema = new Schema(
  {
    userId:    { type: String, required: true, unique: true, index: true },
    name:      { type: String, default: '' },
    title:     { type: String, default: '' },
    email:     { type: String, default: '' },
    phone:     { type: String, default: '' },
    location:  { type: String, default: '' },
    linkedin:  { type: String, default: '' },
    github:    { type: String, default: '' },
    portfolio: { type: String, default: '' },
    summary:   { type: String, default: '' },
    languages: [
      {
        name:        { type: String, default: '' },
        proficiency: { type: String, default: '' },
      },
    ],
    professionalInterests: { type: String, default: '' },
    education: [
      {
        degree:      { type: String, default: '' },
        institution: { type: String, default: '' },
        startDate:   { type: String, default: '' },
        endDate:     { type: String, default: '' },
        year:        { type: String, default: '' },
        location:    { type: String, default: '' },
        honors:      { type: String, default: '' },
        coursework:  { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export type ProjectDoc             = InferSchemaType<typeof ProjectSchema>;
export type PortfolioGenerationDoc = InferSchemaType<typeof PortfolioGenerationSchema>;
export type PortfolioFeedbackDoc   = InferSchemaType<typeof PortfolioFeedbackSchema>;
export type UserProfileDoc         = InferSchemaType<typeof UserProfileSchema>;

export const Project = models.Project || model('Project', ProjectSchema);
export const PortfolioGeneration =
  models.PortfolioGeneration ||
  model('PortfolioGeneration', PortfolioGenerationSchema);
export const PortfolioFeedback =
  models.PortfolioFeedback || model('PortfolioFeedback', PortfolioFeedbackSchema);
export const UserProfile =
  models.UserProfile || model('UserProfile', UserProfileSchema);
