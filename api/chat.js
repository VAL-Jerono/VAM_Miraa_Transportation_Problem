// file: api/chat.js
export default async function handler(req, res) {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  const systemPrompt = `You are MiraaBot, a helpful logistics assistant for MiraaTrans — a miraa (khat) transport service operating in Kenya.

You help farmers, buyers, and transporters with:
- Transport routes: Maua, Laare, Kangeta → Isiolo, Kilifi, Eastleigh Nairobi, Likoni Mombasa
- Pricing (per kg): 
    Maua → Isiolo: KES 10/kg, Kilifi: KES 21/kg, Eastleigh: KES 18/kg, Likoni: KES 23/kg
    Laare → Isiolo: KES 11/kg, Kilifi: KES 22/kg, Eastleigh: KES 16/kg, Likoni: KES 23/kg
    Kangeta → Isiolo: KES 10/kg, Kilifi: KES 21/kg, Eastleigh: KES 17/kg, Likoni: KES 23/kg
- Transit times: Isiolo ~1.5-2 hrs, Kilifi ~7-9 hrs, Eastleigh ~4-5 hrs, Likoni ~8-10 hrs
- Freshness urgency: miraa must reach market within 48 hours of harvest
- Vehicles used: Probox pickup, Ventilated lorry, 5-tonne lorry

Answer concisely and helpfully. Use KES for all prices. If unsure, suggest the user use the Cost Calculator tab or contact a transporter directly.`;

  try {
    console.log('Sending request to Groq API with messages:', messages.length);
    
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',  // Updated model
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    const responseText = await groqRes.text();
    
    if (!groqRes.ok) {
      console.error('Groq API error response:', responseText);
      
      // Try to parse the error as JSON
      try {
        const errorData = JSON.parse(responseText);
        return res.status(502).json({ 
          error: `Groq API error: ${errorData.error?.message || groqRes.status}` 
        });
      } catch (e) {
        return res.status(502).json({ 
          error: `Groq API error: ${groqRes.status} - ${responseText.substring(0, 200)}` 
        });
      }
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Groq response:', responseText);
      return res.status(502).json({ error: 'Invalid response from Groq API' });
    }

    const reply = data.choices?.[0]?.message?.content ?? 'No response from model.';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}