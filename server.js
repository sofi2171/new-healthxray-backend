require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check route (Render ke liye zaroori)
app.get("/", (req,res)=>{
  res.send("HealthXRay Backend Running");
});

// ===== API Route =====
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const diagnosisText = completion.choices[0].message.content;

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
    symptoms.forEach((s,i)=> doc.text(`${i+1}. ${s}`));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});