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

  // Known locations in Meru County and major markets
  const knownLocations = {
    // Growing areas
    'maua': { lat: 0.2333, lng: 37.9667, region: 'Meru County' },
    'laare': { lat: 0.1667, lng: 37.9667, region: 'Meru County' },
    'kangeta': { lat: 0.1000, lng: 37.9667, region: 'Meru County' },
    'igembe': { lat: 0.1333, lng: 37.9833, region: 'Meru County' },
    'tigania': { lat: 0.1000, lng: 37.9000, region: 'Meru County' },
    'meru town': { lat: 0.0500, lng: 37.6500, region: 'Meru County' },
    // Markets
    'isiolo': { lat: 0.3546, lng: 37.5822, region: 'Isiolo County' },
    'kilifi': { lat: -3.6304, lng: 39.8499, region: 'Kilifi County' },
    'nairobi': { lat: -1.2921, lng: 36.8219, region: 'Nairobi' },
    'eastleigh': { lat: -1.2700, lng: 36.8700, region: 'Nairobi' },
    'mombasa': { lat: -4.0435, lng: 39.6682, region: 'Mombasa' },
    'likoni': { lat: -4.0990, lng: 39.6620, region: 'Mombasa' },
    'kisumu': { lat: -0.1022, lng: 34.7617, region: 'Kisumu' },
    'nakuru': { lat: -0.3031, lng: 36.0800, region: 'Nakuru' },
    'eldoret': { lat: 0.5143, lng: 35.2698, region: 'Uasin Gishu' },
  };

  // Haversine formula to calculate distance in km
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate cost based on distance and quantity
  function calculateCost(distance, quantity, isUrgent = false) {
    // Base cost per kg per km (in KES)
    const baseRate = 1.2;
    // Additional cost for urgent delivery
    const urgencyMultiplier = isUrgent ? 1.3 : 1.0;
    // Minimum cost per kg for very short distances
    const minRate = 10;
    
    let ratePerKg = Math.max(minRate, distance * baseRate * 0.8);
    let totalCost = ratePerKg * quantity * urgencyMultiplier;
    
    // Add road condition factor for rough routes
    if (distance > 200 && distance < 400) {
      totalCost *= 1.15; // 15% extra for long distance rough roads
    }
    
    return {
      ratePerKg: Math.round(ratePerKg),
      totalCost: Math.round(totalCost),
      distance: Math.round(distance),
      urgencyMultiplier: urgencyMultiplier
    };
  }

  const systemPrompt = `You are MiraaBot, a helpful logistics assistant for MiraaTrans — a miraa (khat) transport service operating in Kenya.

You help farmers, buyers, and transporters with transport logistics. You can calculate costs for ANY location in Kenya:

KNOWN LOCATIONS:
- Growing areas: Maua, Laare, Kangeta, Igembe, Tigania, Meru Town
- Markets: Isiolo, Kilifi, Eastleigh (Nairobi), Likoni (Mombasa), Nairobi, Mombasa, Kisumu, Nakuru, Eldoret

For ANY other location, I will calculate the real distance and provide accurate pricing.

PRICING CALCULATION:
- Base rate: KES 1.2 per kg per km
- Minimum: KES 10 per kg
- Urgent delivery: +30% surcharge
- Rough roads (200-400km): +15% surcharge

TRANSIT TIMES (estimated from Meru):
- Isiolo: 1.5-2 hours
- Nairobi/Eastleigh: 4-5 hours  
- Nakuru: 5-6 hours
- Kisumu: 6-7 hours
- Kilifi: 7-9 hours
- Mombasa/Likoni: 8-10 hours

FRESHNESS RULE: Miraa must reach market within 48 hours of harvest.

Answer concisely and helpfully. For cost calculations, ALWAYS:
1. Identify the source and destination
2. Calculate distance using real coordinates
3. Provide cost per kg and total cost
4. Suggest the best transport option

If the user mentions ANY location (even one not in the list), calculate the distance and cost based on real geography.`;

  // Extract location and quantity from user message
  function extractDetails(message) {
    const lowerMsg = message.toLowerCase();
    let source = null;
    let destination = null;
    let quantity = null;
    let isUrgent = false;

    // Check for urgency keywords
    if (lowerMsg.includes('urgent') || lowerMsg.includes('emergency') || lowerMsg.includes('express')) {
      isUrgent = true;
    }

    // Extract quantity
    const qtyMatch = message.match(/(\d+)\s*(?:kg|kgs|kilogram|kilograms?)/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1]);
    }

    // Find source and destination
    const locationKeys = Object.keys(knownLocations);
    let foundLocations = [];
    
    for (const key of locationKeys) {
      if (lowerMsg.includes(key)) {
        foundLocations.push(key);
      }
    }

    // If we found multiple locations, try to determine which is source and destination
    if (foundLocations.length >= 2) {
      // Check for "from X to Y" pattern
      const fromToMatch = lowerMsg.match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
      if (fromToMatch) {
        const fromMatch = locationKeys.find(k => fromToMatch[1].includes(k));
        const toMatch = locationKeys.find(k => fromToMatch[2].includes(k));
        if (fromMatch) source = fromMatch;
        if (toMatch) destination = toMatch;
      }
      
      // If still not clear, assume first is source, second is destination
      if (!source) source = foundLocations[0];
      if (!destination) destination = foundLocations[foundLocations.length - 1];
    } else if (foundLocations.length === 1) {
      // If only one location found, assume it's the destination from Meru
      source = 'maua'; // Default source
      destination = foundLocations[0];
    }

    return { source, destination, quantity, isUrgent };
  }

  // List of models to try
  const modelOptions = [
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'llama3-70b-8192',
    'llama3-8b-8192'
  ];

  // Process user message
  const userMessage = messages[messages.length - 1]?.content || '';
  const { source, destination, quantity, isUrgent } = extractDetails(userMessage);
  
  let costInfo = null;
  let responsePrefix = '';

  // If we have source and destination, calculate cost
  if (source && destination && knownLocations[source] && knownLocations[destination]) {
    const src = knownLocations[source];
    const dst = knownLocations[destination];
    const distance = calculateDistance(src.lat, src.lng, dst.lat, dst.lng);
    const qty = quantity || 100; // Default to 100kg if not specified
    const cost = calculateCost(distance, qty, isUrgent);
    costInfo = cost;

    responsePrefix = `📊 **Cost Calculation for ${qty}kg from ${source} to ${destination}:**\n`;
    responsePrefix += `- Distance: ${cost.distance} km\n`;
    responsePrefix += `- Rate: KES ${cost.ratePerKg}/kg\n`;
    if (isUrgent) responsePrefix += `- ⚡ URGENT delivery (+30% surcharge)\n`;
    responsePrefix += `- 💰 **Total: KES ${cost.totalCost.toLocaleString()}**\n\n`;
  }

  // Try each model
  let lastError = null;
  
  for (const model of modelOptions) {
    try {
      console.log(`Attempting with model: ${model}`);
      
      // Enhance the user message with cost info if available
      let enhancedMessages = [...messages];
      if (costInfo && userMessage) {
        // Add a system message with the cost calculation
        const costMessage = {
          role: 'system',
          content: `I calculated the real distance between ${source} and ${destination}: ${costInfo.distance} km. Cost is KES ${costInfo.ratePerKg}/kg, total KES ${costInfo.totalCost.toLocaleString()} for ${quantity || 100}kg. ${isUrgent ? 'Urgent surcharge applied.' : ''}`
        };
        enhancedMessages = [costMessage, ...messages];
      }

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
          max_tokens: 512,
          temperature: 0.7,
        }),
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        let reply = data.choices?.[0]?.message?.content ?? 'No response from model.';
        
        // Prepend cost info if we have it
        if (costInfo && !reply.includes('KES')) {
          reply = responsePrefix + reply;
        }
        
        console.log(`Success with model: ${model}`);
        return res.status(200).json({ reply });
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

  // If all models fail, return a fallback response with the cost info
  if (costInfo) {
    return res.status(200).json({
      reply: `${responsePrefix}\n\n⚠️ I couldn't connect to the AI service, but here's your cost calculation based on real distance. For more details, please try again later.`
    });
  }

  console.error('All models failed. Last error:', lastError);
  return res.status(502).json({ 
    error: 'All available AI models are currently unavailable. Please try again later.',
    details: lastError
  });
}