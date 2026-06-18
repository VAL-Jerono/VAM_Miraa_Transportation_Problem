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

  const { messages, source, destination, quantity, isUrgent } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'API key is not configured on the server.' });
  }

  // VAM Cost Matrix from the report
  const VAM_COST_MATRIX = {
    sources: ['Maua', 'Laare', 'Kangeta'],
    destinations: ['Isiolo', 'Kilifi', 'Eastleigh, Nairobi', 'Likoni, Mombasa'],
    costs: [
      [10, 21, 18, 23],  // Maua
      [11, 22, 16, 23],  // Laare
      [10, 21, 17, 23]   // Kangeta
    ],
    transit: [
      ['1.5-2h', '7-9h', '4-5h', '8-10h'],
      ['1.5-2h', '7-9h', '4-5h', '8-10h'],
      ['1.5-2h', '7-9h', '4-5h', '8-10h']
    ],
    vehicles: ['Probox pickup', 'Ventilated lorry', '5-tonne lorry', 'Ventilated lorry'],
    urgency: ['Urgent same-day', 'Planned overnight', 'City congestion', 'Planned overnight']
  };

  // Calculate cost using VAM matrix
  function calculateVAMCost(src, dst, qty) {
    const srcIndex = VAM_COST_MATRIX.sources.findIndex(s => s.toLowerCase() === src.toLowerCase());
    const dstIndex = VAM_COST_MATRIX.destinations.findIndex(d => d.toLowerCase().includes(dst.toLowerCase()));
    
    if (srcIndex === -1 || dstIndex === -1) {
      return null;
    }
    
    const unitCost = VAM_COST_MATRIX.costs[srcIndex][dstIndex];
    const totalCost = unitCost * qty;
    const transit = VAM_COST_MATRIX.transit[srcIndex][dstIndex];
    const vehicle = VAM_COST_MATRIX.vehicles[dstIndex];
    const urgency = VAM_COST_MATRIX.urgency[dstIndex];
    
    return { unitCost, totalCost, transit, vehicle, urgency, srcIndex, dstIndex };
  }

  // Extract location and quantity from user message
  function extractDetails(message) {
    const lowerMsg = message.toLowerCase();
    let source = null;
    let destination = null;
    let quantity = null;
    let isUrgent = false;

    const sourceNames = ['maua', 'laare', 'kangeta'];
    const destNames = ['isiolo', 'kilifi', 'eastleigh', 'likoni', 'nairobi', 'mombasa'];

    // Check for urgency keywords
    if (lowerMsg.includes('urgent') || lowerMsg.includes('emergency') || lowerMsg.includes('express') || lowerMsg.includes('same day')) {
      isUrgent = true;
    }

    // Extract quantity
    const qtyMatch = message.match(/(\d+)\s*(?:kg|kgs|kilogram|kilograms?)/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1]);
    }

    // Find source
    for (const name of sourceNames) {
      if (lowerMsg.includes(name)) {
        source = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }

    // Find destination
    for (const name of destNames) {
      if (lowerMsg.includes(name)) {
        if (name === 'nairobi' && lowerMsg.includes('eastleigh')) {
          destination = 'Eastleigh, Nairobi';
        } else if (name === 'nairobi') {
          destination = 'Eastleigh, Nairobi';
        } else if (name === 'mombasa' && lowerMsg.includes('likoni')) {
          destination = 'Likoni, Mombasa';
        } else if (name === 'mombasa') {
          destination = 'Likoni, Mombasa';
        } else {
          destination = name.charAt(0).toUpperCase() + name.slice(1);
        }
        break;
      }
    }

    return { source, destination, quantity, isUrgent };
  }

  const userMessage = messages[messages.length - 1]?.content || '';
  const extracted = extractDetails(userMessage);
  
  // Use provided params or extracted
  const finalSource = source || extracted.source || 'Maua';
  const finalDestination = destination || extracted.destination || 'Isiolo';
  const finalQuantity = quantity || extracted.quantity || 100;
  const finalUrgent = isUrgent || extracted.isUrgent || false;

  // Calculate cost
  const costInfo = calculateVAMCost(finalSource, finalDestination, finalQuantity);
  
  let responsePrefix = '';
  if (costInfo) {
    responsePrefix = `VAM OPTIMAL TRANSPORT COST\n`;
    responsePrefix += `Route: ${finalSource} to ${finalDestination}\n`;
    responsePrefix += `Quantity: ${finalQuantity} kg\n`;
    responsePrefix += `Unit Cost: KES ${costInfo.unitCost}/kg\n`;
    responsePrefix += `Total Cost: KES ${costInfo.totalCost.toLocaleString()}\n`;
    responsePrefix += `Transit Time: ${costInfo.transit}\n`;
    responsePrefix += `Vehicle: ${costInfo.vehicle}\n`;
    responsePrefix += `Urgency: ${costInfo.urgency}\n`;
    if (finalUrgent) responsePrefix += `URGENT DELIVERY APPLIED\n`;
    responsePrefix += `---\n\n`;
  }

  const systemPrompt = `You are MiraaBot, a professional logistics assistant for MiraaTrans - a miraa transport service operating in Meru County, Kenya.

VAM OPTIMAL COST MATRIX (KES/kg):
Maua → Isiolo: 10, Kilifi: 21, Eastleigh: 18, Likoni: 23
Laare → Isiolo: 11, Kilifi: 22, Eastleigh: 16, Likoni: 23
Kangeta → Isiolo: 10, Kilifi: 21, Eastleigh: 17, Likoni: 23

TRANSIT TIMES:
Isiolo: 1.5-2h | Kilifi: 7-9h | Eastleigh: 4-5h | Likoni: 8-10h

VEHICLES:
Isiolo: Probox pickup | Kilifi: Ventilated lorry | Eastleigh: 5-tonne lorry | Likoni: Ventilated lorry

URGENCY LEVELS:
Isiolo: Urgent same-day | Kilifi: Planned overnight | Eastleigh: City congestion | Likoni: Planned overnight

FRESHNESS WINDOW: 48 hours from harvest

Provide professional, concise, and actionable responses. Always reference the VAM cost matrix. Suggest the most cost-effective route when relevant. Be helpful to both farmers and buyers.`;

  // Enhanced messages with cost info
  let enhancedMessages = [...messages];
  if (costInfo) {
    const costMessage = {
      role: 'system',
      content: `I calculated using the VAM model: ${finalSource} to ${finalDestination} costs KES ${costInfo.unitCost}/kg, total KES ${costInfo.totalCost.toLocaleString()} for ${finalQuantity}kg. Transit: ${costInfo.transit}.`
    };
    enhancedMessages = [costMessage, ...messages];
  }

  // Model fallback chain
  const modelOptions = [
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'llama3-70b-8192',
    'llama3-8b-8192'
  ];

  let lastError = null;
  
  for (const model of modelOptions) {
    try {
      console.log(`Attempting with model: ${model}`);
      
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...enhancedMessages,
          ],
          max_tokens: 600,
          temperature: 0.3,
        }),
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        let reply = data.choices?.[0]?.message?.content ?? 'No response from model.';
        
        // Prepend cost info if not already included
        if (costInfo && !reply.includes('VAM OPTIMAL') && !reply.includes('KES')) {
          reply = responsePrefix + reply;
        }
        
        console.log(`Success with model: ${model}`);
        return res.status(200).json({ 
          reply,
          costInfo: costInfo ? {
            unitCost: costInfo.unitCost,
            totalCost: costInfo.totalCost,
            transit: costInfo.transit,
            vehicle: costInfo.vehicle,
            urgency: costInfo.urgency
          } : null
        });
      }

      if (groqRes.status === 400 || groqRes.status === 404) {
        const errorText = await groqRes.text();
        console.warn(`Model ${model} failed (${groqRes.status}):`, errorText.substring(0, 100));
        lastError = `Model ${model} failed: ${errorText.substring(0, 100)}`;
        continue;
      }

      const errorText = await groqRes.text();
      console.warn(`Model ${model} failed with status ${groqRes.status}:`, errorText.substring(0, 100));
      lastError = `Model ${model} failed: HTTP ${groqRes.status}`;
      continue;

    } catch (err) {
      console.error(`Error with model ${model}:`, err.message);
      lastError = `Error with model ${model}: ${err.message}`;
      continue;
    }
  }

  // If all models fail, return cost info
  if (costInfo) {
    return res.status(200).json({
      reply: `${responsePrefix}\n\nCost calculation is based on the Vogel's Approximation Method (VAM) optimal transport model. For more details, please try again later.`,
      costInfo: {
        unitCost: costInfo.unitCost,
        totalCost: costInfo.totalCost,
        transit: costInfo.transit,
        vehicle: costInfo.vehicle,
        urgency: costInfo.urgency
      }
    });
  }

  console.error('All models failed. Last error:', lastError);
  return res.status(502).json({ 
    error: 'Service temporarily unavailable. Please try again later.',
    details: lastError
  });
}