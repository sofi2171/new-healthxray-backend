require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. SMART 5-KEY FAILOVER SYSTEM ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) throw new Error("All AI nodes are currently busy.");
    try {
        console.log(`🚀 [LOG] Attempting AI Analysis with Key #${keyIndex + 1}`);
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2, // Clinical precision
        });
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.warn(`⚠️ [FAIL] Key #${keyIndex + 1} failed. Retrying with next...`);
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. MULTI-LANGUAGE SMART ANALYSIS ROUTE ---
app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;
    
    const prompt = `
        Act as a Senior Clinical Consultant.
        Patient: ${age}yr ${gender}. Symptoms: ${symptoms.join(', ')}. Note: "${description}"
        
        INSTRUCTIONS:
        1. Default language is Professional English. 
        2. However, if the patient's note is in another language (like Urdu), respond in that language.
        3. Structure the response clearly with:
           - Potential Conditions (with probabilities %)
           - Detailed Clinical Advice
           - Next Steps & Urgency Level
        4. Use plain professional text. NO stars (**).
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. PROFESSIONAL PDF GENERATOR (Auto-Fitting & Repeat Elements) ---
app.post('/api/generate-pdf', async (req, res) => {
    const { age, gender, symptoms, diagnosis } = req.body;
    
    // Auto-detection for Language (RTL support for Urdu/Arabic/Persian)
    const isRTL = /[\u0600-\u06FF]/.test(diagnosis);
    
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Reusable Header
    const drawHeader = () => {
        doc.rect(0, 0, 612, 85).fill('#1e2f4a'); // Deep Professional Blue
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('HealthXRay Clinical Report', 45, 25);
        doc.fontSize(10).font('Helvetica').text('Advanced AI Diagnostic Assessment | https://healthxray.online', 45, 52);
    };

    // Reusable Footer
    const drawFooter = (p, t) => {
        doc.moveTo(40, 770).lineTo(572, 770).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8).font('Helvetica');
        doc.text('Authorized by HealthXRay AI Engine', 45, 780);
        doc.text(`Page ${p} of ${t}`, 0, 780, { align: 'center', width: 612 });
        doc.text('Contact: healthxray14@gmail.com', 400, 780, { align: 'right', width: 160 });
    };

    drawHeader();
    doc.moveDown(5);

    // --- Patient Details Card ---
    doc.fillColor('#1e2f4a').fontSize(12).font('Helvetica-Bold').text('1. PATIENT SUMMARY', 45);
    doc.rect(45, doc.y + 2, 522, 1).fill('#e2e8f0');
    doc.moveDown(1);
    
    doc.fillColor('#333').fontSize(10).font('Helvetica')
       .text(`Age: ${age} Years`)
       .text(`Gender: ${gender.toUpperCase()}`)
       .text(`Date of Report: ${new Date().toLocaleString()}`);
    
    doc.moveDown(2);

    // --- Symptoms Table ---
    const table = {
        headers: [
            { label: "ID", property: 'id', width: 40 },
            { label: "Reported Symptom", property: 'name', width: 482 }
        ],
        rows: symptoms.map((s, i) => [(i + 1).toString(), s.toUpperCase()])
    };

    await doc.table(table, {
        prepareHeader: () => doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e2f4a'),
        prepareRow: () => doc.fontSize(10).font('Helvetica').fillColor('#333')
    });

    doc.moveDown(2);

    // --- Clinical Analysis (Dynamic Page Fitting) ---
    doc.fillColor('#226653').fontSize(12).font('Helvetica-Bold').text('2. CLINICAL ASSESSMENT & ADVICE', 45);
    doc.rect(45, doc.y + 2, 522, 1.5).fill('#226653');
    doc.moveDown(1.5);

    // Text Auto-Fitting logic
    doc.fillColor('#333').fontSize(10.5).font('Helvetica').text(diagnosis, {
        width: 522,
        align: isRTL ? 'right' : 'justify',
        lineGap: 4,
        paragraphGap: 10,
        features: isRTL ? ['rtla'] : []
    });

    // --- Final Step: Header/Footer Injection ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        if (i > 0) drawHeader(); // Repeat header on new pages
        drawFooter(i + 1, range.count);
    }

    doc.end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 HealthXRay Backend: ONLINE (Port ${PORT})`));
