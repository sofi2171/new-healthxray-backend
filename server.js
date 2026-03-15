require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. SMART FAILOVER SYSTEM ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        throw new Error("All AI nodes are currently busy.");
    }
    try {
        console.log(`🚀 [LOG] Analysis Attempt with Key #${keyIndex + 1}...`);
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2, // Clinical accuracy ke liye temperature mazeed kam kiya
            max_tokens: 1500,
        });
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. ANALYSIS ROUTE (AI Extraction Logic) ---
app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;
    
    // AI ko specific instructions di hain taake data exact format mein aaye
    const prompt = `
        Act as a Senior Clinical Expert. 
        Patient Info: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        Note: "${description}"
        
        Instructions:
        1. List 5 Possible Medical Conditions with their corresponding probabilities (%).
        2. Provide exactly 5 AI Health Recommendations in bullet points.
        3. Include a Professional Urgency Level.
        4. Use plain text, NO stars (**).
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. THE "PERFECT MATCH" PDF GENERATOR ---
app.post('/api/generate-pdf', async (req, res) => {
    const { age, gender, symptoms, diagnosis } = req.body;
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // --- Header (Deep Green like your screenshot) ---
    doc.rect(0, 0, 612, 100).fill('#226653'); 
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('HealthXRay Medical Report', 50, 35);
    doc.fontSize(10).font('Helvetica').text('AI Powered Health Analysis', 50, 65);

    doc.moveDown(5);

    // --- Patient Info Section ---
    doc.fillColor('#1e2f4a').fontSize(12).font('Helvetica-Bold').text('Patient Information', 50);
    doc.rect(50, doc.y + 2, 100, 1).fill('#1e2f4a');
    doc.moveDown(1);
    doc.fillColor('#333').fontSize(10).font('Helvetica')
       .text(`Age: ${age}`)
       .text(`Gender: ${gender}`);

    doc.moveDown(2);

    // --- Symptoms Table (Exact Layout) ---
    doc.fillColor('#1e2f4a').fontSize(12).font('Helvetica-Bold').text('Reported Symptoms', 50);
    doc.moveDown(0.5);

    const table = {
        headers: [
            { label: "No", property: 'id', width: 50, headerColor: '#95c2b3' },
            { label: "Symptom", property: 'name', width: 450, headerColor: '#95c2b3' }
        ],
        rows: symptoms.map((s, i) => [(i + 1).toString(), s])
    };

    await doc.table(table, { 
        x: 50,
        prepareHeader: () => doc.fontSize(10).fillColor('#1e2f4a').font('Helvetica-Bold'),
        prepareRow: () => doc.fontSize(10).fillColor('#333').font('Helvetica')
    });

    doc.moveDown(2);

    // --- AI Assessment (Split by Headers) ---
    // Diagnosis text ko filter karke headers ke mutabiq split karna
    doc.fillColor('#1e2f4a').fontSize(12).font('Helvetica-Bold').text('Possible Medical Conditions', 50);
    doc.rect(50, doc.y + 2, 160, 1).fill('#1e2f4a');
    doc.moveDown(1);

    doc.fillColor('#333').fontSize(10).font('Helvetica').text(diagnosis, {
        width: 500,
        align: 'justify',
        lineGap: 4
    });

    // --- Footer & Disclaimer (Bottom of Page) ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        // Horizontal Line
        doc.moveTo(50, 750).lineTo(562, 750).stroke('#e2e8f0');
        
        doc.fillColor('#64748b').fontSize(8);
        doc.text('Contact: healthxray14@gmail.com', 50, 765);
        doc.text('Website: https://healthxray.online', 400, 765, { align: 'right' });
        
        doc.fillColor('#e74c3c').fontSize(7);
        doc.text('Medical Disclaimer: This AI report is for informational purposes only. Consult a doctor for diagnosis.', 50, 785, { align: 'center', width: 512 });
    }

    doc.end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
