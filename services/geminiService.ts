
import { GoogleGenAI, Type } from "@google/genai";
import { ChaosAnalysis, FolderNode, CompareResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    entropyScore: { type: Type.NUMBER },
    summary: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          priority: { type: Type.STRING },
          timeEstimation: { type: Type.STRING },
          category: { type: Type.STRING },
        },
        required: ['title', 'priority', 'timeEstimation', 'category'],
      },
    },
    topInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedFocus: { type: Type.STRING },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weight: { type: Type.NUMBER },
        },
        required: ['name', 'weight'],
      },
    }
  },
  required: ['entropyScore', 'summary', 'tasks', 'topInsights', 'suggestedFocus', 'categories'],
};

export const analyzeChaos = async (input: string): Promise<ChaosAnalysis> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this digital debris and rescue mission notes: "${input}"`,
    config: { responseMimeType: "application/json", responseSchema: analysisSchema },
  });
  return JSON.parse(response.text || '{}') as ChaosAnalysis;
};

export const analyzeFolderStructure = async (structure: string): Promise<{ projectType: string; entropy: number; insights: string[]; rescuePlan: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `You are an expert digital archeologist. Analyze this potentially fragmented or sabotaged file structure. Identify the project type and provide a 'Rescue Plan' to clean it up:\n${structure}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectType: { type: Type.STRING, description: "e.g., 'Fragmented AI Studio Project', 'Firebase Recovery Node'" },
          entropy: { type: Type.NUMBER },
          insights: { type: Type.ARRAY, items: { type: Type.STRING } },
          rescuePlan: { type: Type.STRING, description: "Step by step instructions to restore order to this specific node." }
        },
        required: ['projectType', 'entropy', 'insights', 'rescuePlan']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const compareNodes = async (nodeA: string, nodeB: string): Promise<CompareResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `CRITICAL COMPARE: Node A is a historical archive. Node B is a new dump. Detect version drift, logical duplicates, and evidence of 'muckery' or corruption. A: ${nodeA} vs B: ${nodeB}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: { type: Type.NUMBER, description: "Logical similarity score 0-100" },
          diffSummary: { type: Type.STRING },
          uniqueToA: { type: Type.ARRAY, items: { type: Type.STRING } },
          uniqueToB: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendation: { type: Type.STRING, description: "Should the user Merge, Replace, or Quarantine B?" }
        },
        required: ['matchScore', 'diffSummary', 'uniqueToA', 'uniqueToB', 'recommendation']
      }
    }
  });
  return JSON.parse(response.text || '{}');
};
