  require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch'); // Deepseek API ke liye

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ===== Health Check =====
app.get("/", (req, res) => {
  res.send("HealthXRay Backend Running with Deepseek AI");
});

// ===== Check Symptoms API =====
app.post('/api/check-symptoms', async (req, res) => {
  try {
    const { symptoms, age, gender } = req.body;

    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({ error: "No symptoms provided" });
    }

    const prompt = `
Patient symptoms: ${symptoms.join(", ")}
Age: ${age || "N/A"}
Gender: ${gender || "N/A"}

Suggest 5 possible medical conditions with probability.
Format:
Condition - %
`;

    // ===== Deepseek API Call =====
    const response = await fetch("https://api.deepseek.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-mini", // ya available model
        input: prompt
      })
    });

    const data = await response.json();
    const diagnosisText = data.output_text || "No result from Deepseek.";

    // ===== Generate PDF =====
    const doc = new PDFDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=SymptomsReport.pdf');

    doc.pipe(res);

    doc.fontSize(20).text('HealthXRay - Symptoms Report', { underline: true });
    doc.moveDown();

    doc.fontSize(14).text(`Age: ${age || 'N/A'} | Gender: ${gender || 'N/A'}`);
    doc.moveDown();

    doc.text("Symptoms:");
    symptoms.forEach((s, i) => doc.text(`${i + 1}. ${s}`));

    doc.moveDown();
    doc.text("Possible Conditions:");
    doc.moveDown();
    doc.text(diagnosisText);

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});