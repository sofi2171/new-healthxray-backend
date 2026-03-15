require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. 5-KEY AUTOMATIC FAILOVER SYSTEM ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) {
        console.error("❌ [CRITICAL] All API keys failed or exhausted.");
        throw new Error("All AI nodes are currently busy. Please try again in 1-2 minutes.");
    }

    try {
        console.log(`🚀 [LOG] Analysis Attempt with Key #${keyIndex + 1}...`);
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2, // Higher accuracy
            max_tokens: 1200,
        });

        console.log(`✅ [SUCCESS] Result obtained from Key #${keyIndex + 1}`);
        // Clean markdown stars (**) for professional clinical display
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.warn(`⚠️ [RETRY] Key #${keyIndex + 1} Error: ${error.message}. Switching to next key...`);
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. AI ANALYSIS ROUTE (With Data Filtering) ---
app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;
    console.log(`📩 [INCOMING] New Analysis Request for ${age}yr ${gender}`);

    const prompt = `
        Act as a Senior Clinical Expert. 
        Patient Info: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        Note: "${description}"
        
        Instructions:
        1. List 5 Possible Medical Conditions with probabilities (%).
        2. Provide exactly 5 AI Health Recommendations in bullet points.
        3. Professional Urgency Level.
        4. STRICT: No markdown stars (**). Use clean professional plain text only.
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. PROFESSIONAL PDF GENERATOR (Auto-Fitting & Repeat Header/Footer) ---
app.post('/api/generate-pdf', async (req, res) => {
    console.log("📄 [LOG] Generating Multi-Page Professional PDF...");
    const { age, gender, symptoms, diagnosis } = req.body;
    
    // bufferPages: true allows us to add headers/footers to all pages after generation
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Reusable Header Helper
    const drawHeader = () => {
        doc.rect(0, 0, 612, 90).fill('#226653'); 
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('HealthXRay Medical Report', 50, 30);
        doc.fontSize(10).font('Helvetica').text('AI Powered Clinical Assessment | www.healthxray.online', 50, 58);
    };

    // Reusable Footer Helper
    const drawFooter = (pageNum, totalPages) => {
        doc.moveTo(50, 770).lineTo(562, 770).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8);
        doc.text('Contact: healthxray14@gmail.com', 50, 780);
        doc.text(`Page ${pageNum} of ${totalPages}`, 0, 780, { align: 'center', width: 612 });
        doc.text('https://healthxray.online', 400, 780, { align: 'right' });
    };

    // --- Page 1 Content ---
    drawHeader();
    doc.moveDown(5);

    // Patient Info Section
    doc.fillColor('#1e2f4a').fontSize(13).font('Helvetica-Bold').text('Patient Information');
    doc.rect(50, doc.y + 2, 512, 1).fill('#1e2f4a'); // Professional lining
    doc.moveDown(1);
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(`Age: ${age} Years | Gender: ${gender.toUpperCase()}`);
    doc.moveDown(2);

    // Symptoms Table (Exact Presentation)
    const table = {
        headers: [
            { label: "No", property: 'id', width: 40 },
            { label: "Reported Symptom", property: 'name', width: 472 }
        ],
        rows: symptoms.map((s, i) => [(i + 1).toString(), s.toUpperCase()])
    };

    await doc.table(table, { 
        prepareHeader: () => doc.fontSize(10).fillColor('#1e2f4a').font('Helvetica-Bold'),
        prepareRow: () => doc.fontSize(10).fillColor('#333')
    });

    doc.moveDown(2);

    // Clinical Advice Section
    doc.fillColor('#226653').fontSize(13).font('Helvetica-Bold').text('Clinical Assessment & Recommendations');
    doc.rect(50, doc.y + 2, 512, 1).fill('#226653');
    doc.moveDown(1.5);

    // Smart Text Fitting: Prevents text from being squeezed or cut
    doc.fillColor('#333').fontSize(10).font('Helvetica').text(diagnosis, {
        align: 'justify',
        lineGap: 4,
        paragraphGap: 10,
        width: 512
    });

    // --- Final Step: Footer & Header Injection on all pages ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        if (i > 0) drawHeader(); // Only repeat header if it's a new page
        drawFooter(i + 1, range.count);
    }

    doc.end();
    console.log("✅ [SUCCESS] Corrected PDF Sent to Client.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🏥 HealthXray Server Live on Port ${PORT}`);
});
