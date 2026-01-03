import { type Request, type Response } from "express";
import axios from 'axios';
const CHAR_LIMIT = 2500;

const generateAnalysis = async (req: Request, res: Response) => {
    try {
        let { tc_data } = req.body;


        if (!tc_data) {
            console.log("T&C Data not available");
            return res.status(400).json({ message: "T&C Data not availabe" });
        }

        if (tc_data.length > CHAR_LIMIT) {
            console.log(`Text too large (${tc_data.leng} chars. Truncating to ${CHAR_LIMIT}`);
            tc_data = tc_data.substring(0, CHAR_LIMIT);
            tc_data += "\n\n[TEXT TRUNCATED DUE TO LENGTH LIMIT]";
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
${tc_data}
`;
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [
                    { role: 'user', content: prompt }
                ],
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
        return res.status(200).json({ success: true, data: analysisData });


    } catch (error: any) { // Temporary: cast to 'any' so we can see everything

        // 1. Log the FULL structure to your VS Code Terminal
        console.error("🔥 FULL ERROR OBJECT:", JSON.stringify(error, null, 2));

        // 2. Check if it's a Groq/Axios API error
        if (error.response) {
            console.error("API Response Data:", error.response.data);
        }

        // 3. Send a safe response to the frontend
        return res.status(500).json({
            message: "Analysis failed",
            // Fallback: If .message is missing, turn the whole error into a string
            details: error.message || String(error)
        });
    }
}

const checkSimilarity = async (req: Request, res: Response) => {

    try {

        // get old and new tc_data
        let { oldTcData, newTcData } = req.body;

        if (!oldTcData || !newTcData) {
            return res.status(400).json({ message: "Old or New T&C data missing" });
        }

        if (oldTcData.length > CHAR_LIMIT) {
            console.log(`Text too large (${oldTcData.length} chars. Truncating to ${CHAR_LIMIT}`);
            oldTcData = oldTcData.substring(0, CHAR_LIMIT);
            oldTcData += "\n\n[TEXT TRUNCATED DUE TO LENGTH LIMIT]";
        }

        if (newTcData.length > CHAR_LIMIT) {
            console.log(`Text too large (${newTcData.length} chars. Truncating to ${CHAR_LIMIT}`);
            newTcData = newTcData.substring(0, CHAR_LIMIT);
            newTcData += "\n\n[TEXT TRUNCATED DUE TO LENGTH LIMIT]";
        }

        // semantic comparison using low cost ai model
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'openai/gpt-oss-120b',
                messages: [
                    {
                        role: 'system', content: `You are a semantic diff tool.
    Compare the two provided legal texts.
    Ignore changes in formatting, whitespaces, HTML structures or contact addresses.
    Focus only on the legal meanings, obligations, terms, caluses, conditions and user rights.
    RULES:
  1. IGNORE vocabulary shifts (e.g., 'Company' vs 'Organization', 'Law' vs 'Statutes').
  2. IGNORE formatting (e.g., 'Section 4' vs '4.').
  3. FOCUS on the result: If a user sues, is the outcome the same in both versions?
  4. SYMBOLIC EQUIVALENCE: Treat 'held harmless' as semantically equivalent to 'not liable' in the context of liability caps.
  5. PRAGMATISM: If the financial cap ($100) and the core exclusions (profits, data, indirect damages) are present, they are IDENTICAL.
    Return JSON only: {"isSemanticallyIdentical": boolean}
    Don't return anything else other than the JSON object.
    `},
                    {
                        role: "user",
                        content: `OLD TEXT: ${oldTcData} \n\n NEW TEXT: ${newTcData}`
                    }
                ],
                temperature: 0.1,
                max_tokens: 10000
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        return res.status(200).json({success: true, data: response.data.choices[0].message.content});

    } catch (error: any) {

        // 1. Log the FULL structure to Terminal
        console.error("🔥 FULL ERROR OBJECT:", JSON.stringify(error, null, 2));

        // 2. Check if it's a Groq/Axios API error
        if (error.response) {
            console.error("API Response Data:", error.response.data);
        }

        // 3. Send a safe response to the frontend
        return res.status(500).json({
            message: "Analysis failed",
            // Fallback: If .message is missing, turn the whole error into a string
            details: error.message || String(error)
        });

    }
}

export { generateAnalysis, checkSimilarity };