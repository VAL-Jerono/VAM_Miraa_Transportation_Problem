export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  }

  const systemPrompt = `You are MiraaBot, a helpful logistics assistant for MiraaTrans — a miraa (khat) transport service operating in Kenya.

You help farmers, buyers, and transporters with:
- Transport routes: Maua, Igembe, Tigania → Nairobi, Mombasa, Kisumu, Isiolo
- Pricing (per kg): 
    Maua → Nairobi: KES 14/kg, Mombasa: KES 22/kg, Kisumu: KES 18/kg, Isiolo: KES 9/kg
    Igembe → Nairobi: KES 16/kg, Mombasa: KES 25/kg, Kisumu: KES 20/kg, Isiolo: KES 11/kg
    Tigania → Nairobi: KES 13/kg, Mombasa: KES 21/kg, Kisumu: KES 17/kg, Isiolo: KES 8/kg
- Transit times: Nairobi ~4–5 hrs, Mombasa ~8–10 hrs, Kisumu ~6–7 hrs, Isiolo ~2–3 hrs
- Isiolo has a higher charge from Igembe due to rougher road conditions on the B6 route
- Freshness urgency: miraa must reach market within 24 hours of harvest
- Vehicles used: refrigerated vans for long-haul, pickups for Isiolo
- Shipment IDs follow the format MT-XXXX

Answer concisely and helpfully. Use KES for all prices. If unsure, suggest the user use the Cost Calculator tab or contact a transporter directly.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 512,
        temperature: 0.5,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ error: `Groq API error: ${groqRes.status}` });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content ?? 'No response from model.';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}