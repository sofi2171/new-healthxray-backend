
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');
const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ===== 1. Multiple API Keys for Failover =====
const GROQ_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
];

// Helper Function to call Groq with Auto-Retry (Failover)
async function callGroqAI(prompt) {
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${GROQ_KEYS[i]}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { 
                            role: "system", 
                            content: "You are a professional medical assistant. You understand English, Urdu, and Hindi. Analyze symptoms and provide a detailed clinical report in English." 
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.5
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content;
            }
            console.warn(`Key ${i+1} failed, trying next...`);
        } catch (err) {
            console.error(`Error with Key ${i+1}:`, err.message);
        }
    }
    throw new Error("All Groq API Keys failed.");
}

// ===== 2. AI Symptoms Analysis (Updated Prompt) =====
app.post('/api/check-symptoms', async (req, res) => {
    try {
        const { symptoms, age, gender, description } = req.body;

        const aiPrompt = `
        ACT AS A MEDICAL DIAGNOSTIC AI.
        PATIENT DATA:
        - Age: ${age}
        - Gender: ${gender}
        - Selected Symptoms: ${symptoms.join(", ")}
        - Patient's Own Words: "${description || "None"}"

        TASK:
        1. Analyze the symptoms and the patient's description (it might be in Urdu/Hindi).
        2. Provide 3-5 possible conditions with confidence percentages.
        3. Give professional medical advice and urgency level.
        4. Provide the output in a clean, professional structured format.
        `;

        const diagnosis = await callGroqAI(aiPrompt);

        res.json({
            status: "success",
            diagnosis: diagnosis,
            age,
            gender,
            symptoms
        });
    } catch (err) {
        res.status(500).json({ error: "AI Analysis Failed: " + err.message });
    }
});

// ===== 3. Professional PDF Generator =====
app.post("/api/generate-pdf", (req, res) => {
    try {
        const { symptoms, age, gender, diagnosis, description } = req.body;
        const doc = new PDFDocument({ size: "A4", margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=HealthXRay_Report.pdf');
        doc.pipe(res);

        // Styling Colors
        const primaryColor = "#226653";
        const secondaryColor = "#1e2f4a";

        // Header
        doc.rect(0, 0, 600, 80).fill(primaryColor);
        doc.fillColor("#ffffff").fontSize(24).text("HealthXRay AI", 50, 25);
        doc.fontSize(10).text("Clinical Triage Report | www.healthxray.online", 50, 55);

        doc.moveDown(4);
        doc.fillColor(secondaryColor).fontSize(16).text("Patient Summary", { underline: true });
        doc.fontSize(12).text(`Age: ${age} | Gender: ${gender}`, 50, 120);
        doc.moveDown();

        doc.fontSize(14).text("Selected Symptoms:");
        doc.fontSize(11).text(symptoms.join(", ") || "No specific tags selected");
        
        if (description) {
            doc.moveDown().fontSize(14).text("Patient Narrative:");
            doc.fontSize(11).fillColor("#444").text(`"${description}"`);
        }

        doc.moveDown(2);
        doc.rect(45, doc.y, 500, 2).fill(primaryColor);
        doc.moveDown();

        doc.fillColor(secondaryColor).fontSize(16).text("AI Clinical Analysis", { underline: true });
        doc.moveDown();
        doc.fillColor("#000").fontSize(11).text(diagnosis, { align: 'justify' });

        // Footer & Disclaimer
        const footerY = doc.page.height - 100;
        doc.fontSize(8).fillColor("red").text("DISCLAIMER: This is an AI-generated report for informational purposes only. Consult a doctor immediately for medical emergencies.", 50, footerY, { align: 'center' });
        
        doc.end();
    } catch (err) {
        res.status(500).send("PDF Generation Error");
    }
});

// (Stripe code remains same as your previous version)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
app.post("/api/subscribe", async (req, res) => { /* Your Stripe Logic */ });

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
