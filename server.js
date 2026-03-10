require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;



// ===== Home =====
app.get("/", (req, res) => {
  res.send("HealthXRay Backend Running with Groq AI");
});



// ===== Ping Route (Prevent Render Sleep) =====
app.get("/ping", (req, res) => {
  res.send("Server alive");
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



// ===== AI Symptoms Analysis =====
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

      if (data.choices && data.choices[0]) {
        diagnosisText = data.choices[0].message.content;
      }

    }

    catch (apiErr) {

      console.error("Groq error:", apiErr);

    }

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



// ===== Professional PDF Generator =====
app.post("/api/generate-pdf", (req, res) => {

  try {

    const { symptoms, age, gender, diagnosis } = req.body;

    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=HealthXRay_Medical_Report.pdf'
    );

    doc.pipe(res);


    // ===== THEME COLORS =====
    const primary = "#226653";
    const dark = "#1e2f4a";
    const light = "#8fc1b0";


    // ===== HEADER =====
    doc.rect(0, 0, 600, 70).fill(primary);

    try {
      doc.image("favicon/favicon.png", 40, 18, { width: 35 });
    } catch {}

    doc
      .fillColor("white")
      .fontSize(20)
      .text("HealthXRay Medical Report", 90, 25);

    doc
      .fontSize(10)
      .text("AI Powered Health Analysis", 90, 45);



    // ===== PATIENT INFO =====
    doc.moveDown(4);

    doc
      .fillColor(dark)
      .fontSize(16)
      .text("Patient Information", { underline: true });

    doc.moveDown();

    doc.fontSize(12);

    doc.text(`Age: ${age || "N/A"}`);
    doc.text(`Gender: ${gender || "N/A"}`);



    // ===== SYMPTOMS TABLE =====
    doc.moveDown();

    doc
      .fontSize(16)
      .fillColor(dark)
      .text("Reported Symptoms", { underline: true });

    doc.moveDown();

    let y = doc.y;

    doc.rect(40, y, 520, 20).fill(light);

    doc.fillColor("black");

    doc.text("No", 50, y + 5);
    doc.text("Symptom", 120, y + 5);

    y += 20;

    symptoms.forEach((s, i) => {

      doc.rect(40, y, 520, 20).stroke();

      doc.text(i + 1, 50, y + 5);
      doc.text(s, 120, y + 5);

      y += 20;

    });



    // ===== DIAGNOSIS =====
    doc.moveDown(2);

    doc
      .fillColor(dark)
      .fontSize(16)
      .text("Possible Medical Conditions", { underline: true });

    doc.moveDown();

    doc
      .fontSize(12)
      .fillColor("black")
      .text(diagnosis);



    // ===== AI PRESCRIPTION =====
    doc.moveDown(2);

    doc
      .fontSize(16)
      .fillColor(dark)
      .text("AI Health Recommendations", { underline: true });

    doc.moveDown();

    doc.fontSize(12);

    doc.list([
      "Stay hydrated and drink plenty of water",
      "Get adequate rest and sleep",
      "Take mild pain relief medication if needed",
      "Maintain balanced nutrition",
      "Consult a licensed doctor if symptoms persist"
    ]);



    // ===== DISCLAIMER =====
    doc.moveDown(2);

    doc
      .fillColor("#a94442")
      .fontSize(14)
      .text("Medical Disclaimer", { underline: true });

    doc.moveDown();

    doc
      .fillColor(dark)
      .fontSize(11)
      .text(
        "This AI generated report is for informational purposes only. "+
        "It does not replace professional medical advice, diagnosis, "+
        "or treatment. Always consult a qualified healthcare provider."
      );



    // ===== FOOTER =====
    doc.moveDown(4);

    doc
      .strokeColor(light)
      .moveTo(40, 750)
      .lineTo(550, 750)
      .stroke();

    doc
      .fillColor("#555")
      .fontSize(10)
      .text("Contact: healthxray14@gmail.com", 40, 760);

    doc
      .text("Website: https://healthxray.online", 350, 760);



    doc.end();

  }

  catch (err) {

    console.error("PDF error:", err);

    res.status(500).json({
      error: "PDF generation failed"
    });

  }

});



// ===== Start Server =====
app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});