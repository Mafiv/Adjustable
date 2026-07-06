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

export type ProjectDoc = InferSchemaType<typeof ProjectSchema>;
export const Project = models.Project || model('Project', ProjectSchema);
