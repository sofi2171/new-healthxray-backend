require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;



// ===== Home =====
app.get("/", (req, res) => {
  res.send("HealthXRay Backend Running with Groq AI");
});



// ===== Test API Key =====
app.get("/test-key", async (req, res) => {

  try {

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },

      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: "Say hello" }
        ]
      })

    });

    const data = await response.json();

    res.json({
      status: "success",
      groq_response: data
    });

  }

  catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});



// ===== Check Symptoms (Return JSON Result) =====
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

    let diagnosisText = "AI response not available.";

    try {

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },

        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "user", content: prompt }
          ]
        })

      });

      const data = await response.json();

      console.log("Groq response:", JSON.stringify(data, null, 2));

      if (data.choices && data.choices[0]) {
        diagnosisText = data.choices[0].message.content;
      }

    }

    catch (apiErr) {

      console.error("Groq error:", apiErr);

    }

    // Return result for frontend
    res.json({
      age,
      gender,
      symptoms,
      diagnosis: diagnosisText
    });

  }

  catch (err) {

    console.error("Server error:", err);

    res.status(500).json({
      error: "Server Error"
    });

  }

});



// ===== Generate PDF =====
app.post("/api/generate-pdf", (req, res) => {

  try {

    const { symptoms, age, gender, diagnosis } = req.body;

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=HealthXRay_Report.pdf');

    doc.pipe(res);

    // Header
    doc
      .fontSize(24)
      .fillColor("#0a7cff")
      .text("HealthXRay Medical Report", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(12)
      .fillColor("black")
      .text(`Age: ${age || 'N/A'}`);

    doc.text(`Gender: ${gender || 'N/A'}`);

    doc.moveDown();

    doc
      .fontSize(16)
      .fillColor("#0a7cff")
      .text("Symptoms");

    doc.moveDown(0.5);

    symptoms.forEach((s, i) => {
      doc.fontSize(12).fillColor("black").text(`${i + 1}. ${s}`);
    });

    doc.moveDown();

    doc
      .fontSize(16)
      .fillColor("#0a7cff")
      .text("Possible Conditions");

    doc.moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor("black")
      .text(diagnosis);

    doc.moveDown();

    doc
      .fontSize(10)
      .fillColor("gray")
      .text("Disclaimer: This AI analysis is not a medical diagnosis. Please consult a doctor.", { align: "center" });

    doc.end();

  }

  catch (err) {

    console.error("PDF error:", err);

    res.status(500).json({
      error: "PDF generation failed"
    });

  }

});



// ===== Ping Route (Prevent Render Sleep) =====
app.get("/ping", (req, res) => {
  res.send("Server alive");
});



// ===== Start Server =====
app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});