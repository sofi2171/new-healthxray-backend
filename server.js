require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ===== Health Check =====
app.get("/", (req, res) => {
  res.send("HealthXRay Backend Running with Groq AI");
});

// ===== API Key Test Endpoint =====
app.get("/test-key", async (req, res) => {
  try {
    const response = await fetch("https://api.groq.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "groq-mini",
        input: "Test if API key works"
      })
    });

    if (response.ok) {
      const data = await response.json();
      res.json({ status: "success", groq_response: data });
    } else {
      const text = await response.text();
      res.status(response.status).json({ status: "error", message: text });
    }
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ===== Check Symptoms API =====
app.post('/api/check-symptoms', async (req, res) => {
  try {
    const { symptoms, age, gender } = req.body;
    console.log("Request received:", req.body);

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

    let diagnosisText = "No result from Groq AI.";
    try {
      const response = await fetch("https://api.groq.ai/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "groq-mini",
          input: prompt
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Groq raw response:", JSON.stringify(data, null, 2));

        if (data.output_text) diagnosisText = data.output_text;
        else if (data.result && data.result[0] && data.result[0].text) diagnosisText = data.result[0].text;
      } else {
        const text = await response.text();
        console.error("Groq API error:", response.status, text);
      }
    } catch (apiErr) {
      console.error("Groq call failed:", apiErr);
    }

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
    console.error("Server error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});