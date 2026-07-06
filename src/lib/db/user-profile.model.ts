import { Schema, model, models, type InferSchemaType } from 'mongoose';

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

export type UserProfileDoc = InferSchemaType<typeof UserProfileSchema>;
export const UserProfile =
  models.UserProfile || model('UserProfile', UserProfileSchema);
