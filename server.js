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

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});



// ===== Check Symptoms =====
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
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      const data = await response.json();

      console.log("Groq response:", JSON.stringify(data, null, 2));

      if (data.choices && data.choices[0]) {
        diagnosisText = data.choices[0].message.content;
      }

    } catch (apiErr) {

      console.error("Groq error:", apiErr);

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

    symptoms.forEach((s, i) => {
      doc.text(`${i + 1}. ${s}`);
    });

    doc.moveDown();

    doc.text("Possible Conditions:");

    doc.moveDown();

    doc.text(diagnosisText);

    doc.end();

  }

  catch (err) {

    console.error("Server error:", err);

    res.status(500).json({
      error: "Server Error"
    });

  }

});



// ===== Start Server =====
app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);

});