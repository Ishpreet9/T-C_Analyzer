import mongoose, {Document, Schema} from "mongoose";

export interface AnalysisInterface extends Document {
  textHash: string;
  url: string;
  scanCount: number;
  analysis?: { // The '?' means it is optional (can be undefined)
    score: number;
    fairness: string;
    redFlags: string[];
    yellowFlags: string[];
    greenFlags: string[];
    summary: string;
  };
}

const AnalysisSchema = new Schema<AnalysisInterface>({

    textHash: { type: String, required: true, unique: true },

    url: { type: String, required: true },

    scanCount: { type: Number, default: 1 },

    analysis: {
        type: {
            score: Number,
            fairness: String,
            redFlags: [String],
            yellowFlags: [String],
            greenFlags: [String],
            summary: String
        },
        required: false
    }
})

export const AnalysisModel = mongoose.model<AnalysisInterface>('Analysis', AnalysisSchema);