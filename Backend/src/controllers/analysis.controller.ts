import { response, type Request, type Response } from "express";
import axios from 'axios';
import type { MeasureMemoryMode } from "node:vm";
import { defaultMaxListeners } from "node:events";
import { AnalysisModel } from "../models/models.analysis.js";
import * as Diff from 'diff';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const CHAR_LIMIT = 15000;

type messageType = {
    role: 'user' | 'system' | 'assistant',
    content: string
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

const generateHash = (text: string) => {
    return crypto.createHash('sha256').update(text).digest('hex');
}

const compress = (text: string) => {
    return zlib.gzipSync(Buffer.from(text));
}

const decompress = (buffer: Buffer) => {
    return zlib.gunzipSync(buffer).toString('utf-8');
}

const getParagraphDiff = (oldText: string, newText: string) => {
    // splitting based on newlines
    const oldParas = oldText.split(/\n\s*\n/).map(normalize);
    const newParas = newText.split(/\n\s*\n/).map(normalize);
    // diff the arrays of paragraphs
    const changes = Diff.diffArrays(oldParas, newParas);
    let changedParas: number = 0;
    const changeLog: string[] = [];

    changes.forEach((part) => {
        // changes is an array of objects and part.value is an array of strings
        if (part.added) {
            part.value.forEach(p => changeLog.push(`[ADDED CLAUSE]: "${p}"`));
            changedParas += part.value.length;
        }
        else if (part.removed) {
            part.value.forEach(p => changeLog.push(`[REMOVED CLAUSE]: "${p}"`));
            changedParas += part.value.length;
        }
    })
    // impact percentage
    const totalParas = oldParas.length;
    const changePercent = totalParas > 0 ? (changedParas / totalParas) * 100 : 100; // If old was empty, it's 100% new
    return { changePercent, changes: changeLog.join('\n\n') };

}

const generateAnalysis = async (messages: messageType[]) => {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: messages,
                temperature: 0.2,
                // seed: 142,
                max_tokens: 10000
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        )
        console.log(JSON.stringify(response.data, null, 2));
        let analysisData = response.data.choices[0].message.content;
        return analysisData;


    } catch (error: any) { // Temporary: cast to 'any' so we can see everything

        // 1. Log the FULL structure to your VS Code Terminal
        console.error("🔥 FULL ERROR OBJECT:", JSON.stringify(error, null, 2));

        // 2. Check if it's a Groq/Axios API error
        if (error.response) {
            console.error("API Response Data:", error.response.data);
        }

        // 3. Send a safe response to the frontend
        return "Analysis Failed: " + (error.message || String(error));
    }
}

const getAnalysis = async (req: Request, res: Response) => {
    let { tc_data, url } = req.body;

    try {

        const textHash = generateHash(tc_data);

        // validate input
        if (!tc_data || !url) {
            return res.status(400).json({ message: "T&C Data or URL not available" });
        }
        // check if analysis exists in db
        let analysisData = await AnalysisModel.findOne({ textHash: textHash });
        if (!analysisData) {
            analysisData = await AnalysisModel.findOne({ url: url });
        }
        // increment scan count
        if (analysisData) {
            await AnalysisModel.findOneAndUpdate(
                { $or: [{ textHash: textHash }, { url: url }] },
                { $inc: { scanCount: 1 } },
                { new: true, upsert: true }
            );
        }
        // if analysis exist in db and hash matches and scanCount is more than 5, return cached analysis
        if (analysisData && analysisData.textHash === textHash && analysisData.analysis && analysisData.scanCount > 5) {
            console.log("Analysis found in DB for hash: " + textHash);
            return res.status(200).json({ success: true, message: "Cached Analysis", data: analysisData.analysis });
        }

        // if analysis exist, url match but hash doesn't match and scan count is more than 5, check semantic similarity using myer's diff, if semantically different then update analysis
        else if (analysisData && analysisData.url === url && analysisData.textHash !== textHash && analysisData.scanCount > 5) {
            // getting changed paragraphs using myers diff
            const decompressedTcData = decompress(analysisData.tc_data);
            const paraDiff = getParagraphDiff(decompressedTcData, tc_data);
            const paraChanges = paraDiff.changes;

            console.log("Existing analysis found, checking semantic similarity for hash: " + textHash);
            const messages: messageType[] = [
                {
                    role: 'system',
                    content: `You are a Legal Semantic Diff Tool.
Your job is to update an existing analysis based on text changes.

RULES:
1. IGNORE vocabulary shifts (e.g., 'Company' vs 'Organization').
2. IGNORE formatting (e.g., 'Section 4' vs '4.').
3. FOCUS on the result: If a user sues, is the outcome the same?
4. SYMBOLIC EQUIVALENCE: Treat 'held harmless' as 'not liable'.
5. PRAGMATISM: If the financial cap and exclusions are unchanged, they are IDENTICAL.
6. NO DATABASE FIELDS: Never include "_id", "__v", "createdAt", or "updatedAt" in your output.

OUTPUT FORMAT (JSON ONLY):
- If semantically identical: 
  { "isSemanticallyIdentical": true }

- If semantically DIFFERENT:
  { 
    "isSemanticallyIdentical": false, 
    "updatedAnalysis": { 
       "score": number, 
       "fairness": string, 
       "redFlags": string[], 
       "yellowFlags": string[], 
       "greenFlags": string[], 
       "summary": string 
    } 
  }

CRITICAL: Return strictly valid JSON. Do not return markdown, code blocks, or explanations.`
                },
                {
                    role: "user",
                    // 👇 See Step 2 below for why we change this variable
                    content: `OLD ANALYSIS: ${JSON.stringify(analysisData.analysis)} \n\n PARAGRAPH CHANGES: ${paraChanges}`
                }
            ];
            const similarityResponse = await generateAnalysis(messages);
            const parsedResponse = JSON.parse(similarityResponse);
            if (parsedResponse.isSemanticallyIdentical) {
                console.log("Semantically identical T&C. Returning cached analysis.");
                // increment scan count and update tc_data and textHash
                const newTcData = compress(tc_data);
                const newTextHash = generateHash(tc_data);
                // update textHash, scan count, tc_data and url without updating analysis
                await AnalysisModel.findOneAndUpdate(
                    { _id: analysisData._id },
                    {
                        $set: {
                            url: url,
                            textHash: newTextHash,
                            tc_data: newTcData
                        },
                        // $inc: { scanCount: 1 }
                    },
                    { new: true }
                );

                return res.status(200).json({ success: true, message: "Cached Analysis", data: analysisData.analysis });
            } else {
                console.log("Semantically different T&C. Updated new analysis.");
                const newTextHash = generateHash(tc_data);
                const newTcData = compress(tc_data);
                // update textHash, scan count, tc_data and url along with analysis
                await AnalysisModel.findOneAndUpdate(
                    { _id: analysisData._id },
                    {
                        $set: {
                            url: url,
                            textHash: newTextHash,
                            tc_data: newTcData,
                            analysis: parsedResponse.updatedAnalysis
                        },
                        // $inc: { scanCount: 1 }
                    },
                    { new: true }
                );
                return res.status(200).json({ success: true, message: "Updated Analysis", data: parsedResponse.updatedAnalysis });
            }
        }

        let tc_data_truncated = tc_data;
        if (tc_data.length > CHAR_LIMIT) {
            console.log(`Text too large (${tc_data.length} chars. Truncating to ${CHAR_LIMIT}`);
            tc_data_truncated = tc_data.substring(0, CHAR_LIMIT);
            tc_data_truncated += "\n\n[TEXT TRUNCATED DUE TO LENGTH LIMIT]";
        }

        const prompt = `
You are an expert "Terms & Conditions Auditor". Your job is to protect the user.
Analyze the provided legal text and return a strictly valid JSON object following this TypeScript interface:

interface Response {
  score: number; // 0-100 (100 is perfect, 0 is predatory)
  fairness: "Safe" | "Standard" | "Suspicious" | "Predatory";
  redFlags: string[]; // List of dangerous clauses. Max 5 items.
  yellowFlags: string[]; // List of potential concerns/cautions. Max 5 items.
  greenFlags: string[]; // List of consumer-friendly clauses. Max 5 items.
  summary: string; // Concise 2-sentence summary.
}

CRITICAL: Return ONLY raw JSON matching this structure. Do not use Markdown blocks.
Note : If there is not data, then simply return a one word response: none
RETURN JSON ONLY

Here is the data for the terms and conditions : 
${tc_data_truncated}
`;

        const messages: messageType[] = [
            { role: 'user', content: prompt }
        ]

        const result = await generateAnalysis(messages);
        const parsedResult = JSON.parse(result);
        const newTextHash = generateHash(tc_data);
        const compressedTcData = compress(tc_data);

        // if analysisData doesn't exist, create new entry with scanCount = 1 without analysis or data
        if (!analysisData) {
            console.log("No existing analysis found. Scan count set to 1 for new analysis.");
            const savedDoc = await AnalysisModel.findOneAndUpdate(
                { url: url },
                {
                    textHash: newTextHash,
                    url: url,
                    scanCount: 1,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )
            console.log("New analysis saved in savedDoc: ", savedDoc);
        }
        // if analysisData existed, update with scanCount + 1 without any other data
        else if (analysisData.scanCount <= 5) {
            // save analysis to db
            const savedDoc = await AnalysisModel.findOneAndUpdate(
                { url: url },
                {
                    $set: {

                        textHash: newTextHash,
                        url: url,
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )
            console.log("New analysis saved in savedDoc: ", savedDoc);
        }
        // if analysisData existed and scanCount > 5, update full analysis
        else if (analysisData.scanCount > 5) {
            // save analysis to db
            const savedDoc = await AnalysisModel.findOneAndUpdate(
                { url: url },
                {
                    $set: {

                        textHash: newTextHash,
                        url: url,
                        tc_data: compressedTcData,
                        analysis: parsedResult
                    },
                    // $inc: { scanCount: 1 }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )
        }


        return res.status(200).json({ success: true, message: "Generated Analysis", data: JSON.parse(result) });

    } catch (error: any) {
        console.log("Error in getAnalysis:", error);
        return res.status(500).json({ message: "Analysis failed", details: error })
    }
}


export { getAnalysis };