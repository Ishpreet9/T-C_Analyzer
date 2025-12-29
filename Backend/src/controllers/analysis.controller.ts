import { type Request, type Response } from "express";
import axios from 'axios';

const generateAnalysis = async (req: Request, res: Response) => {
    try {
        let { tc_data } = req.body;

        const CHAR_LIMIT = 2500;
        
        if (!tc_data) {
            console.log("T&C Data not available");
            return res.status(400).json({ message: "T&C Data not availabe" });
        }

        if(tc_data.length > CHAR_LIMIT)
        {
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
                    {role: 'user', content: prompt}
                ],
                temperature: 0.2,
                seed: 142,
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
        return res.status(200).json({success: true, data: analysisData});


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

export {generateAnalysis};