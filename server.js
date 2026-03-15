require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit-table');
const Groq = require('groq-sdk');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. 5-KEY AUTO FAILOVER SYSTEM ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

async function callGroqWithFailover(prompt, keyIndex = 0) {
    if (keyIndex >= API_KEYS.length) throw new Error("Tamam AI nodes busy hain.");
    try {
        const groq = new Groq({ apiKey: API_KEYS[keyIndex] });
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
        });
        // Filtering: Stars (**) aur Markdown remove karna
        return chatCompletion.choices[0]?.message?.content.replace(/\*\*/g, '') || "";
    } catch (error) {
        console.log(`Key ${keyIndex + 1} failed, switching...`);
        return callGroqWithFailover(prompt, keyIndex + 1);
    }
}

// --- 2. SMART ANALYSIS ROUTE ---
app.post('/api/check-symptoms', async (req, res) => {
    const { age, gender, symptoms, description } = req.body;
    
    // AI ko sakht hidayat taake data hamesha filter ho kar aaye
    const prompt = `
        Act as a Senior Clinical Expert.
        Analyze: Age ${age}, Gender ${gender}, Symptoms: ${symptoms.join(', ')}.
        User Input: "${description}"
        
        STRICT RULES:
        1. If user input is in Urdu, provide the 'Clinical Advice' and 'Recommendations' in Urdu.
        2. Use plain professional text. NO markdown stars (**).
        3. Structure: 
           - Possible Conditions (with %)
           - Professional Advice
           - Next Steps
           - Urgency Level
    `;

    try {
        const aiResponse = await callGroqWithFailover(prompt);
        res.json({ diagnosis: aiResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. PRO PDF GENERATOR (Urdu & English Compatible) ---
app.post('/api/generate-pdf', async (req, res) => {
    const { age, gender, symptoms, diagnosis } = req.body;
    
    // Check if diagnosis contains Urdu characters
    const isUrdu = /[\u0600-\u06FF]/.test(diagnosis);
    
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // --- Font Registration (Zaroori: Urdu ke liye) ---
    // Note: Aapko apne server par ek Urdu font file (e.g., JameelNoori.ttf) rakhni hogi
    // doc.registerFont('UrduFont', path.join(__dirname, 'fonts', 'JameelNoori.ttf'));

    const drawHeader = () => {
        doc.rect(0, 0, 612, 90).fill('#226653');
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('HealthXRay Medical Report', 50, 30);
        doc.fontSize(10).font('Helvetica').text('AI-Powered Clinical Analysis', 50, 58);
    };

    const drawFooter = (p, t) => {
        doc.moveTo(50, 770).lineTo(562, 770).stroke('#e2e8f0');
        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(`Page ${p} of ${t}`, 0, 780, { align: 'center', width: 612 });
    };

    drawHeader();
    doc.moveDown(5);

    // Patient Info Table
    doc.fillColor('#1e2f4a').fontSize(14).font('Helvetica-Bold').text(isUrdu ? 'مریض کی معلومات (Patient Info)' : 'Patient Information');
    doc.rect(50, doc.y + 2, 512, 1).fill('#1e2f4a').moveDown(1);
    
    doc.fillColor('#333').fontSize(11).font('Helvetica')
       .text(`Age: ${age} | Gender: ${gender.toUpperCase()}`);
    
    doc.moveDown(2);

    // Symptoms Table
    const table = {
        headers: [
            { label: isUrdu ? "نمبر" : "No", property: 'id', width: 40 },
            { label: isUrdu ? "علامات (Symptoms)" : "Symptoms", property: 'name', width: 472 }
        ],
        rows: symptoms.map((s, i) => [(i + 1).toString(), s.toUpperCase()])
    };

    await doc.table(table, {
        prepareHeader: () => doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e2f4a'),
        prepareRow: () => doc.fontSize(10).font('Helvetica').fillColor('#333')
    });

    doc.moveDown(2);

    // AI Assessment (Clinical Section)
    doc.fillColor('#226653').fontSize(14).font('Helvetica-Bold').text(isUrdu ? 'طبی تجزیہ (Clinical Analysis)' : 'Clinical Analysis');
    doc.rect(50, doc.y + 2, 512, 1.5).fill('#226653').moveDown(1.5);

    // Urdu handling: Agar Urdu hai toh right-to-left alignment aur font change
    const textOptions = {
        width: 512,
        align: isUrdu ? 'right' : 'justify',
        lineGap: 5,
        features: isUrdu ? ['rtla'] : []
    };

    // Agar aapne Urdu font register kiya hai toh use yahan apply karein:
    // if(isUrdu) doc.font('UrduFont'); else doc.font('Helvetica');

    doc.fillColor('#333').fontSize(11).text(diagnosis, textOptions);

    // Apply Header/Footer to all pages
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);
        if (i > 0) drawHeader();
        drawFooter(i + 1, range.count);
    }

    doc.end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend Active on ${PORT}`));
