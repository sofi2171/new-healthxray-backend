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
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        console.error("CRITICAL: All Groq API keys exhausted!");
        throw new Error("All AI nodes are currently busy.");
    }

    try {
        console.log(`[LOG] Attempting AI Analysis with Key #${keyIndex + 1}...`);
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 1500,
        });

        console.log(`[SUCCESS] AI Response received using Key #${keyIndex + 1}`);
        // Cleaning stars for both Frontend and PDF
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.warn(`[RETRY] Key #${keyIndex + 1} failed: ${error.message}`);
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. ANALYSIS ROUTE ---
app.post('/api/check-symptoms', async (req, res) => {
    console.log(`[INCOMING] Request received for Age: ${req.body.age}, Gender: ${req.body.gender}`);
    const { age, gender, symptoms, description } = req.body;

    const prompt = `
        Act as a Senior Clinical Consultant. 
        Patient Info: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        Note: "${description}"
        
        Instructions:
        1. Analyze and provide professional insights. If note is in Urdu, use Urdu for the advice.
        2. Sections: Possible Conditions (%), Clinical Advice, Urgency Level.
        3. Do NOT use markdown stars (**). Use clear, professional spacing.
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. HIGH-QUALITY PROFESSIONAL PDF ROUTE ---
app.post('/api/generate-pdf', async (req, res) => {
    console.log("[LOG] Starting PDF Generation...");
    const { age, gender, symptoms, diagnosis } = req.body;
    
    // Create Document with better margins
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // --- Header Section ---
    doc.rect(0, 0, 612, 90).fill('#226653'); // Green Bar
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('HealthXray Medical Report', 50, 30);
    doc.fontSize(10).font('Helvetica').text('AI-Powered Clinical Triage System | www.healthxray.online', 50, 60);
    
    // Report Date & ID
    const reportDate = new Date().toLocaleDateString();
    doc.fontSize(9).text(`Date: ${reportDate}`, 480, 35);
    doc.text(`ID: HXR-${Math.floor(1000 + Math.random() * 9000)}`, 480, 50);

    doc.moveDown(5);

    // --- Patient Details ---
    doc.fillColor('#1e2f4a').fontSize(14).font('Helvetica-Bold').text('Patient Information', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(11).font('Helvetica')
       .text(`Age: ${age} Years`)
       .text(`Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1)}`);
    
    doc.moveDown(2);

    // --- Symptoms Table ---
    const table = {
        title: "Reported Clinical Symptoms",
        headers: [
            { label: "No.", property: 'id', width: 50 },
            { label: "Symptom Description", property: 'name', width: 450 }
        ],
        rows: symptoms.map((s, i) => [ (i + 1).toString(), s.toUpperCase() ])
    };

    await doc.table(table, { 
        width: 500,
        prepareHeader: () => doc.fontSize(10).fillColor('#226653').font('Helvetica-Bold'),
        prepareRow: (row, index) => doc.fontSize(10).fillColor('#444').font('Helvetica')
    });

    doc.moveDown(2);

    // --- Clinical Analysis ---
    doc.fillColor('#226653').fontSize(14).font('Helvetica-Bold').text('Clinical Assessment & Recommendations');
    doc.rect(40, doc.y, 520, 1.5).fill('#226653');
    doc.moveDown(1);

    // Justified text for professional look
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(diagnosis, {
        align: 'justify',
        lineGap: 4,
        paragraphGap: 10
    });

    // --- Footer Logic (Every Page) ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        
        doc.moveTo(40, 770).lineTo(570, 770).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8);
        doc.text('Email: healthxray14@gmail.com', 40, 785);
        doc.text('This is an AI assessment and not a final medical diagnosis.', 40, 800, { align: 'center', width: 520 });
        doc.text('Website: https://healthxray.online', 400, 785, { align: 'right' });
    }

    doc.end();
    console.log("[SUCCESS] PDF Generated and sent to user.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`-------------------------------------------`);
    console.log(`  HEALTHXRAY SERVER LIVE ON PORT: ${PORT}  `);
    console.log(`  STATUS: Waiting for Patient Data...     `);
    console.log(`-------------------------------------------`);
});
