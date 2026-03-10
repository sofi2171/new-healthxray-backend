// server.js
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

// ===== Initialize Stripe =====
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ===== Home =====
app.get("/", (req, res) => {
  res.send("HealthXRay Backend Running with Groq AI");
});

// ===== Ping Route =====
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
        messages: [{ role: "user", content: "Say hello" }]
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
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();

      if (data.choices && data.choices[0]) {
        diagnosisText = data.choices[0].message.content;
      }
    } catch (apiErr) {
      console.error("Groq error:", apiErr);
    }

    res.json({
      age,
      gender,
      symptoms,
      diagnosis: diagnosisText
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ===== Professional PDF Generator =====
app.post("/api/generate-pdf", (req, res) => {
  try {
    const { symptoms, age, gender, diagnosis } = req.body;

    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: false });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=HealthXRay_Medical_Report.pdf');

    doc.pipe(res);

    const primary = "#226653";
    const dark = "#1e2f4a";
    const light = "#8fc1b0";

    const addHeader = () => {
      doc.rect(0, 0, 595, 70).fill(primary);
      try { doc.image("favicon/favicon.png", 40, 18, { width: 35 }); } catch {}
      doc.fillColor("white").fontSize(20).text("HealthXRay Medical Report", 90, 25);
      doc.fontSize(10).text("AI Powered Health Analysis", 90, 45);
      doc.moveDown(4);
      doc.fillColor(dark);
    };

    const addFooter = () => {
      const bottom = doc.page.height - 50;
      doc.strokeColor(light).moveTo(40, bottom).lineTo(555, bottom).stroke();
      doc.fillColor("#555").fontSize(10).text("Contact: healthxray14@gmail.com", 40, bottom + 10);
      doc.text("Website: https://healthxray.online", 350, bottom + 10);
    };

    doc.addPage();
    addHeader();

    doc.fontSize(16).text("Patient Information", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Age: ${age || "N/A"}`);
    doc.text(`Gender: ${gender || "N/A"}`);
    doc.moveDown();

    doc.fontSize(16).text("Reported Symptoms", { underline: true });
    doc.moveDown();

    let y = doc.y;
    doc.rect(40, y, 520, 20).fill(light);
    doc.fillColor("black");
    doc.text("No", 50, y + 5);
    doc.text("Symptom", 120, y + 5);
    y += 20;

    symptoms.forEach((s, i) => {
      if (y + 40 > doc.page.height - 100) {
        addFooter();
        doc.addPage();
        addHeader();
        y = doc.y;
        doc.rect(40, y, 520, 20).fill(light);
        doc.fillColor("black");
        doc.text("No", 50, y + 5);
        doc.text("Symptom", 120, y + 5);
        y += 20;
      }

      doc.rect(40, y, 520, 20).stroke();
      doc.text(i + 1, 50, y + 5);
      doc.text(s, 120, y + 5);
      y += 20;
    });

    doc.moveDown(2);
    doc.fontSize(16).text("Possible Medical Conditions", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(diagnosis);

    doc.moveDown(2);
    doc.fontSize(16).text("AI Health Recommendations", { underline: true });
    doc.moveDown();
    doc.fontSize(12).list([
      "Stay hydrated and drink plenty of water",
      "Get adequate rest and sleep",
      "Take mild pain relief medication if needed",
      "Maintain balanced nutrition",
      "Consult a licensed doctor if symptoms persist"
    ]);

    doc.moveDown(2);
    doc.fillColor("#a94442").fontSize(14).text("Medical Disclaimer", { underline: true });
    doc.moveDown();
    doc.fillColor(dark).fontSize(11).text(
      "This AI generated report is for informational purposes only. " +
      "It does not replace professional medical advice, diagnosis, or treatment. " +
      "Always consult a qualified healthcare provider."
    );

    addFooter();
    doc.end();

  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

// ===== ===== New Subscription + Stripe Payment API ===== =====

const packages = [
  { id: 1, name: "Basic Plan", price: 500 },
  { id: 2, name: "Standard Plan", price: 1000 },
  { id: 3, name: "Premium Plan", price: 2000 }
];

app.post("/api/subscribe", async (req, res) => {
  try {
    const { email, packageId } = req.body;

    if (!email || !packageId) {
      return res.status(400).json({ error: "Email and packageId are required" });
    }

    const selectedPackage = packages.find(p => p.id === packageId);
    if (!selectedPackage) {
      return res.status(404).json({ error: "Package not found" });
    }

    // ===== Stripe Payment Intent =====
    const paymentIntent = await stripe.paymentIntents.create({
      amount: selectedPackage.price,
      currency: "usd",
      receipt_email: email,
      metadata: {
        packageId: selectedPackage.id.toString(),
        packageName: selectedPackage.name
      }
    });

    res.json({
      success: true,
      message: `Subscription created for ${email}`,
      package: selectedPackage,
      clientSecret: paymentIntent.client_secret
    });

  } catch (err) {
    console.error("Stripe subscribe error:", err);
    res.status(500).json({ error: "Subscription failed" });
  }
});

// ===== Optional Stripe Webhook =====
app.post("/webhook", express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    console.log("Payment succeeded for:", paymentIntent.metadata.packageName);
    // TODO: Update subscription status in DB
  }

  res.json({ received: true });
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});