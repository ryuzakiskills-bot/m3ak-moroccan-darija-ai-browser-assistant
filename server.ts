import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildAnalyzePagePrompt,
  buildNextActionPrompt,
  buildVerifyActionPrompt,
  SYSTEM_INSTRUCTION_DARIJA_AGENT,
} from './src/ai/prompts.js';
import {
  validateAIActionResponse,
  validatePageAnalysisResponse,
  validateVerificationResponse,
} from './src/ai/schemas.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supported Gemini model via @google/genai, configurable via environment
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const AI_TIMEOUT_MS = 15000;

function hasValidApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(
    key &&
      key.trim().length > 5 &&
      key.trim() !== 'MY_GEMINI_API_KEY' &&
      key.trim() !== 'YOUR_GEMINI_API_KEY'
  );
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new Error('AI request timed out');
      (err as any).status = 504;
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseScreenshotInlineData(screenshotDataUrl?: unknown) {
  if (
    typeof screenshotDataUrl !== 'string' ||
    !screenshotDataUrl.startsWith('data:image/')
  ) {
    return null;
  }
  // Reject excessively large screenshots (> 4MB base64)
  if (screenshotDataUrl.length > 4 * 1024 * 1024) {
    return null;
  }
  const match = screenshotDataUrl.match(
    /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/
  );
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}

function handleApiError(res: Response, endpointLabel: string, error: unknown): void {
  const errObj = error as Record<string, any> | undefined;
  const rawStatus =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.statusCode === 'number'
      ? errObj.statusCode
      : 500;

  const message =
    error instanceof Error ? error.message : 'Internal AI service error';

  // Map rate-limit / quota / auth / model errors to standard HTTP status codes
  let status = rawStatus;
  if (
    message.includes('429') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('quota')
  ) {
    status = 429;
  } else if (
    message.includes('401') ||
    message.toLowerCase().includes('api key not valid')
  ) {
    status = 401;
  } else if (message.includes('403')) {
    status = 403;
  } else if (message.includes('404')) {
    status = 404;
  }

  console.error(`[Server ${endpointLabel}] AI request failed: ${status}`);
  res.status(status).json({
    error: 'AI request failed',
    status,
  });
}

const ACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description:
        'Natural Moroccan Darija instruction for this single step (1 to 3 short lines).',
    },
    action: {
      type: Type.STRING,
      description:
        'Browser action type: click, focus, type, input, select, scroll, or none.',
    },
    targetElementId: {
      type: Type.STRING,
      description:
        'Exact element ID from PageContext (e.g. "element_3"), or empty string if none/completed.',
    },
    requiresConfirmation: {
      type: Type.BOOLEAN,
      description:
        'True if this action submits a payment, purchase, deletion, password change, or official form.',
    },
    taskCompleted: {
      type: Type.BOOLEAN,
      description: 'True if the user goal is completely finished.',
    },
    estimatedTotalSteps: {
      type: Type.INTEGER,
      description: 'Estimated total steps for this task (e.g. 3 or 4).',
    },
    currentStepNumber: {
      type: Type.INTEGER,
      description: 'Current step number (1-indexed).',
    },
    stepTitle: {
      type: Type.STRING,
      description: 'Short Darija title for the current step card.',
    },
  },
  required: [
    'message',
    'action',
    'targetElementId',
    'requiresConfirmation',
    'taskCompleted',
  ],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. POST /api/ai/analyze-page
  app.post('/api/ai/analyze-page', async (req: Request, res: Response) => {
    try {
      const { pageContext, screenshotDataUrl } = req.body || {};
      if (
        !pageContext ||
        typeof pageContext !== 'object' ||
        !Array.isArray(pageContext.elements)
      ) {
        res.status(400).json({ error: 'Invalid or missing pageContext' });
        return;
      }

      if (!hasValidApiKey()) {
        res.status(401).json({ error: 'GEMINI_API_KEY is not configured' });
        return;
      }

      const ai = getGenAIClient();
      const promptText = buildAnalyzePagePrompt(pageContext);
      const imagePart = parseScreenshotInlineData(screenshotDataUrl);

      const contents = imagePart
        ? { parts: [imagePart, { text: promptText }] }
        : promptText;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_DARIJA_AGENT,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryDarija: {
                  type: Type.STRING,
                  description:
                    'Concise, friendly explanation in Moroccan Darija of what this webpage is and what fields/buttons exist.',
                },
                pageType: {
                  type: Type.STRING,
                  description: 'Short category label for the webpage.',
                },
                keyElements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      purposeDarija: { type: Type.STRING },
                    },
                    required: ['id', 'label', 'purposeDarija'],
                  },
                },
                suggestedTasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      labelDarija: { type: Type.STRING },
                      command: { type: Type.STRING },
                    },
                    required: ['labelDarija', 'command'],
                  },
                },
              },
              required: [
                'summaryDarija',
                'pageType',
                'keyElements',
                'suggestedTasks',
              ],
            },
          },
        }),
        AI_TIMEOUT_MS
      );

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText.trim());
      const validated = validatePageAnalysisResponse(parsed);
      res.status(200).json(validated);
    } catch (error) {
      handleApiError(res, '/api/ai/analyze-page', error);
    }
  });

  // 2. POST /api/ai/next-action
  app.post('/api/ai/next-action', async (req: Request, res: Response) => {
    try {
      const {
        userGoal,
        gatheredContext,
        pageContext,
        currentStep = 1,
        completedSteps = [],
        userFollowUp,
        screenshotDataUrl,
      } = req.body || {};

      if (typeof userGoal !== 'string' || !userGoal.trim()) {
        res.status(400).json({ error: 'Invalid or missing userGoal' });
        return;
      }

      if (!hasValidApiKey()) {
        res.status(401).json({ error: 'GEMINI_API_KEY is not configured' });
        return;
      }

      const ai = getGenAIClient();
      const promptText = buildNextActionPrompt({
        userGoal: userGoal.trim().slice(0, 500),
        gatheredContext,
        pageContext,
        currentStep: Number(currentStep) || 1,
        completedSteps: Array.isArray(completedSteps) ? completedSteps : [],
        userFollowUp:
          typeof userFollowUp === 'string'
            ? userFollowUp.slice(0, 500)
            : undefined,
      });

      const imagePart = parseScreenshotInlineData(screenshotDataUrl);
      const contents = imagePart
        ? { parts: [imagePart, { text: promptText }] }
        : promptText;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_DARIJA_AGENT,
            responseMimeType: 'application/json',
            responseSchema: ACTION_RESPONSE_SCHEMA,
          },
        }),
        AI_TIMEOUT_MS
      );

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText.trim());
      if (!parsed.targetElementId || parsed.targetElementId === '') {
        parsed.targetElementId = null;
      }
      if (gatheredContext?.routedIntent) {
        parsed.intent = parsed.intent || gatheredContext.routedIntent.intent;
        parsed.skillId = parsed.skillId || gatheredContext.routedIntent.skillId;
        parsed.skillLabel =
          parsed.skillLabel || gatheredContext.routedIntent.skillLabel;
        parsed.explanationDepth =
          parsed.explanationDepth ||
          gatheredContext.routedIntent.explanationDepth;
        parsed.topic =
          parsed.topic || gatheredContext.routedIntent.inferredTopic;
      }
      const validated = validateAIActionResponse(parsed);
      res.status(200).json(validated);
    } catch (error) {
      handleApiError(res, '/api/ai/next-action', error);
    }
  });

  // 3. POST /api/ai/verify-action
  app.post('/api/ai/verify-action', async (req: Request, res: Response) => {
    try {
      const {
        userGoal,
        previousInstruction,
        previousTargetId,
        interactionDescription,
        updatedPageContext,
        currentStep = 1,
        completedSteps = [],
      } = req.body || {};

      if (
        typeof userGoal !== 'string' ||
        !userGoal.trim() ||
        !updatedPageContext ||
        typeof updatedPageContext !== 'object' ||
        !Array.isArray(updatedPageContext.elements)
      ) {
        res
          .status(400)
          .json({ error: 'Invalid verification request parameters' });
        return;
      }

      if (!hasValidApiKey()) {
        res.status(401).json({ error: 'GEMINI_API_KEY is not configured' });
        return;
      }

      const ai = getGenAIClient();
      const promptText = buildVerifyActionPrompt({
        userGoal: userGoal.trim().slice(0, 500),
        previousInstruction:
          typeof previousInstruction === 'string' ? previousInstruction : '',
        previousTargetId:
          typeof previousTargetId === 'string' ? previousTargetId : null,
        interactionDescription:
          typeof interactionDescription === 'string'
            ? interactionDescription
            : 'User interacted with page',
        updatedPageContext,
        currentStep: Number(currentStep) || 1,
        completedSteps: Array.isArray(completedSteps) ? completedSteps : [],
      });

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: promptText,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_DARIJA_AGENT,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verified: {
                  type: Type.BOOLEAN,
                  description: 'True if the previous step was completed.',
                },
                messageDarija: {
                  type: Type.STRING,
                  description: 'Short Darija feedback on step completion.',
                },
                taskCompleted: {
                  type: Type.BOOLEAN,
                  description:
                    'True if the entire user goal is now complete.',
                },
                nextAction: ACTION_RESPONSE_SCHEMA,
              },
              required: [
                'verified',
                'messageDarija',
                'taskCompleted',
                'nextAction',
              ],
            },
          },
        }),
        AI_TIMEOUT_MS
      );

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText.trim());
      if (parsed.nextAction && !parsed.nextAction.targetElementId) {
        parsed.nextAction.targetElementId = null;
      }
      const validated = validateVerificationResponse(parsed);
      res.status(200).json(validated);
    } catch (error) {
      handleApiError(res, '/api/ai/verify-action', error);
    }
  });

  // 4. POST /api/ai/web-research (Google Search Grounding via @google/genai)
  app.post('/api/ai/web-research', async (req: Request, res: Response) => {
    try {
      const { userGoal, searchQuery, preferredLanguage = 'darija' } =
        req.body || {};

      if (typeof userGoal !== 'string' || !userGoal.trim()) {
        res.status(400).json({ error: 'Invalid or missing userGoal' });
        return;
      }

      if (!hasValidApiKey()) {
        res.status(401).json({ error: 'GEMINI_API_KEY is not configured' });
        return;
      }

      const ai = getGenAIClient();
      const queryToSearch =
        typeof searchQuery === 'string' && searchQuery.trim()
          ? searchQuery.trim()
          : userGoal.trim();

      const langLabel =
        preferredLanguage === 'en'
          ? 'English'
          : preferredLanguage === 'fr'
          ? 'French'
          : 'natural Moroccan Darija (الدارجة المغربية)';

      const researchPrompt = `
You are M3ak (معاك), a voice-first JARVIS-style AI browser research companion.
Perform a multi-source web research for the user's objective:
USER REQUEST: "${userGoal.trim().slice(0, 500)}"
SEARCH QUERY: "${queryToSearch.slice(0, 300)}"

RESEARCH QUALITY RULES:
1. Do not trust a single search result blindly; compare multiple authoritative sources.
2. Prefer official websites (universities, manufacturers, official organizations) over advertisements.
3. Extract only relevant, verified facts and compare conflicting details if present.
4. Mention uncertainty or variable pricing/dates honestly when applicable.
5. Never fabricate a source or claim a page was visited if not inspected.
6. Respond concisely in ${langLabel} (3 to 5 clear sentences suitable for voice output, without markdown symbols like ** or #).
`.trim();

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: researchPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_DARIJA_AGENT,
            tools: [{ googleSearch: {} }],
          },
        }),
        AI_TIMEOUT_MS
      );

      const answerText = (response.text || '').trim();
      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const extractedSources: Array<{
        title: string;
        url: string;
        snippet: string;
        isOfficial: boolean;
      }> = [];

      for (const chunk of chunks) {
        const webObj = (chunk as Record<string, any>)?.web;
        if (webObj && typeof webObj.uri === 'string' && webObj.uri.startsWith('http')) {
          const uri = webObj.uri;
          const title =
            typeof webObj.title === 'string' && webObj.title.trim()
              ? webObj.title.trim()
              : uri;
          if (!extractedSources.some((s) => s.url === uri)) {
            extractedSources.push({
              title,
              url: uri,
              snippet: `Verified source inspected via Google Search Grounding (${title}).`,
              isOfficial: /\.(edu|gov|org|ma|es|ac)\b/i.test(uri),
            });
          }
        }
      }

      res.status(200).json({
        answer: answerText,
        searchQuery: queryToSearch,
        sources: extractedSources,
      });
    } catch (error) {
      handleApiError(res, '/api/ai/web-research', error);
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `M3ak AI Browser Assistant server running on http://localhost:${PORT} (Model: ${GEMINI_MODEL})`
    );
  });
}

startServer();
