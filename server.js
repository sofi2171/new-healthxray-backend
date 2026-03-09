require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const { Configuration, OpenAIApi } = require('openai');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ===== OpenAI Setup =====
const configuration = new Configuration({ apiKey: OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// ===== API Route: Check Symptoms & Generate PDF =====
app.post('/api/check-symptoms', async (req, res) => {
    try {
        const { symptoms, age, gender } = req.body;

        if (!symptoms || symptoms.length === 0) {
            return res.status(400).json({ error: "No symptoms provided" });
        }

        // ===== OpenAI Call =====
        let diagnosisText = "";
        try {
            const prompt = `
            You are a medical assistant. Based on the following symptoms, suggest possible conditions:
            Symptoms: ${symptoms.join(", ")}
            Age: ${age || 'N/A'}, Gender: ${gender || 'N/A'}
            List 5 most likely conditions with short probability estimate.
            Format: Condition Name (approx %)
            `;

            const completion = await openai.createChatCompletion({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            });

            diagnosisText = completion.data.choices[0].message.content;
            console.log("OpenAI Response:", diagnosisText);
        } catch (err) {
            console.error("OpenAI API Error:", err);
            diagnosisText = "Unable to fetch conditions from AI. Consult a doctor.";
        }

        // ===== Generate PDF =====
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=SymptomsReport.pdf');

        doc.pipe(res); // PDF stream frontend ko bhej raha hai

        doc.fontSize(20).text('HealthXRay - Symptoms Report', { underline: true });
        doc.moveDown();
        doc.fontSize(14).text(`Age: ${age || 'N/A'}  |  Gender: ${gender || 'N/A'}`);
        doc.moveDown();
        doc.text('Symptoms Provided:');
        symptoms.forEach((symptom, i) => doc.text(`${i + 1}. ${symptom}`));
        doc.moveDown();
        doc.text('Potential Conditions (AI Generated):', { underline: true });
        doc.moveDown();
        doc.text(diagnosisText);

        doc.end(); // PDF send to frontend

    } catch (err) {
        console.error("Backend Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});