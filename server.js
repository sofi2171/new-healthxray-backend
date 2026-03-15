require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. 5 GROQ API KEYS FAILOVER SYSTEM ---
const API_KEYS = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        throw new Error("All Groq API keys exhausted or rate-limited.");
    }

    try {
        console.log(`Groq Attempt with Key #${keyIndex + 1}`);
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile", // Ya aapka pasandida Groq model
            temperature: 0.5,
            max_tokens: 1024,
        });

        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.error(`Groq Key #${keyIndex + 1} Failed:`, error.message);
        // Rate limit (429) ya kisi bhi error par agli key try karein
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. ANALYSIS ROUTE ---
app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;

    const prompt = `
        Act as a Senior Medical Expert. 
        Patient Data: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        Patient Description: "${description}"
        
        Instructions:
        1. Analyze thoroughly. If the patient description is in Urdu/Hindi, answer that part in the same language.
        2. Output structure: Possible Conditions (with %), Clinical Advice, and Urgency Level.
        3. STRICT: Do not use any markdown stars (**) or special symbols.
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: "All AI nodes are busy. Please try again in 1 minute." });
    }
});

// --- 3. PROFESSIONAL PDF ROUTE ---
app.post('/api/generate-pdf', async (req, res) => {
    const { age, gender, symptoms, description, diagnosis } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=HealthXray_Report.pdf');
    doc.pipe(res);

    // Green Professional Header
    doc.rect(0, 0, 612, 85).fill('#226653');
    doc.fillColor('#ffffff').fontSize(22).text('HealthXray Medical Report', 40, 25);
    doc.fontSize(10).text('High-Speed AI Triage | Powered by Groq', 40, 52);
    doc.text(`Report ID: HXR-${Date.now().toString().slice(-6)}`, 450, 40);

    doc.moveDown(5);

    // Patient Summary Table
    const table = {
        title: "Patient Summary",
        headers: ["Category", "Details"],
        rows: [
            ["Age / Gender", `${age} Years / ${gender}`],
            ["Symptoms", symptoms.join(', ')],
            ["Patient Note", description || "No additional notes"]
        ]
    };
    await doc.table(table, { width: 500, prepareHeader: () => doc.fontSize(10).fillColor('#226653').font('Helvetica-Bold') });

    // AI Analysis Section
    doc.moveDown();
    doc.fillColor('#1e2f4a').fontSize(14).text('Clinical Analysis', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(10).text(diagnosis, { align: 'justify', lineGap: 3 });

    // Footer with your Details
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 780).lineTo(570, 780).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8);
        doc.text('Email: healthxray14@gmail.com', 40, 790);
        doc.text('Website: https://healthxray.online', 400, 790, { align: 'right' });
    }

    doc.end();
});

app.listen(5000, () => console.log('Groq-Powered Server running on port 5000'));
