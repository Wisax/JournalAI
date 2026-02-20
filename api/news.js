export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};

  try {
    // STEP 1 : Tavily search pour de vraies actus
    const searchQuery = query
      ? `AI intelligence artificielle ${query} actualités 2025`
      : 'intelligence artificielle actualités dernières nouvelles LLM modèles 2025';

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: searchQuery,
        search_depth: 'basic',
        max_results: 10,
        include_answer: false
      })
    });

    const tavilyData = await tavilyRes.json();
    if (!tavilyRes.ok) return res.status(500).json({ error: tavilyData.message || 'Erreur Tavily' });

    const results = tavilyData.results || [];
    const searchContext = results.map(r => `TITRE: ${r.title}\nURL: ${r.url}\nRÉSUMÉ: ${r.content}`).join('\n\n---\n\n');

    // STEP 2 : Groq formate les résultats en JSON propre
    const systemPrompt = `Tu es AI PULSE, un agrégateur de nouvelles IA. Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, juste le JSON brut.

Format exact :
{
  "items": [
    {
      "title": "Titre accrocheur de la news",
      "summary": "Résumé factuel de 2-3 phrases en français.",
      "source": "NOM SOURCE",
      "url": "https://... (URL EXACTE fournie)",
      "time": "Aujourd'hui",
      "tags": ["LLM", "OpenAI"]
    }
  ]
}

Règles :
- Utilise UNIQUEMENT les articles fournis
- Garde les URLs EXACTES telles quelles
- Résumés en français
- Tags parmi : LLM, Vision, Audio, Robotique, Réglementation, Recherche, Startup, Open Source, Hardware, Multimodal, Agent, Sécurité
- Sélectionne les articles les plus intéressants`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Voici les articles trouvés sur le web. Formate-les en JSON :\n\n${searchContext}` }
        ]
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) return res.status(500).json({ error: groqData?.error?.message || 'Erreur Groq' });

    const text = groqData?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Pas de JSON dans la réponse', raw: text });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
