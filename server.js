require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// 5 Groq API Keys Failover System
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        throw new Error("All Groq API keys exhausted.");
    }

    try {
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3, // Accuracy ke liye temperature thoda kam kiya
            max_tokens: 1500,
        });

        // Response se markdown stars (**) ko clean karna
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.error(`Key #${keyIndex + 1} Error:`, error.message);
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;

    const prompt = `
        Act as a Senior Medical Expert. 
        Patient Data: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        Patient Additional Description: "${description}"
        
        Instructions:
        1. Analyze thoroughly. Respond in Urdu if the patient description is in Urdu.
        2. Format: Possible Conditions (with %), Professional Advice, and Urgency Level.
        3. STRICT: No markdown stars (**) or bold symbols. Use plain professional text.
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: "System overload. Please try again." });
    }
});

app.post('/api/generate-pdf', async (req, res) => {
    const { age, gender, symptoms, diagnosis } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Green Professional Header
    doc.rect(0, 0, 612, 85).fill('#226653');
    doc.fillColor('#ffffff').fontSize(22).text('HealthXray Medical Report', 40, 25);
    doc.fontSize(10).text('AI Powered Clinical Assessment | www.healthxray.online', 40, 52);

    doc.moveDown(5);

    // Patient Information Section
    doc.fillColor('#1e2f4a').fontSize(12).text('Patient Information', { underline: true });
    doc.fillColor('#333').fontSize(10).text(`Age: ${age}`);
    doc.text(`Gender: ${gender}`);
    doc.moveDown();

    // Symptoms Table (As seen in Screenshot)
    const table = {
        title: "Reported Symptoms",
        headers: ["No", "Symptom"],
        rows: symptoms.map((s, i) => [i + 1, s])
    };
    await doc.table(table, { 
        width: 500,
        prepareHeader: () => doc.fontSize(10).fillColor('#226653').font('Helvetica-Bold'),
        prepareRow: () => doc.fontSize(10).fillColor('#333')
    });

    // Clinical Analysis Section
    doc.moveDown();
    doc.fillColor('#226653').fontSize(12).text('Clinical Analysis & Recommendations', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(10).text(diagnosis, { align: 'justify', lineGap: 3 });

    // Footer with Email & URL
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 770).lineTo(570, 770).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8);
        doc.text('Contact: healthxray14@gmail.com', 40, 785);
        doc.text('Website: https://healthxray.online', 400, 785, { align: 'right' });
    }

    doc.end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Live on Port ${PORT}`));
