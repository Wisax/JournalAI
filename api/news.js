export default async function handler(req, res) {
  // Allow CORS from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};

  const systemPrompt = `Tu es AI PULSE, un agrégateur de nouvelles IA. Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, juste le JSON brut.

Format exact :
{
  "items": [
    {
      "title": "Titre accrocheur de la news",
      "summary": "Résumé factuel de 2-3 phrases expliquant l'essentiel de la nouvelle.",
      "source": "NOM SOURCE",
      "url": "https://...",
      "time": "Il y a 2h",
      "tags": ["LLM", "OpenAI"]
    }
  ]
}

Règles :
- Titres percutants style presse
- Résumés factuels et informatifs en français
- Sources réelles (TechCrunch, The Verge, Wired, Reuters, Le Monde, etc.)
- URLs plausibles des vraies sources
- Tags pertinents parmi : LLM, Vision, Audio, Robotique, Réglementation, Recherche, Startup, Open Source, Hardware, Multimodal, Agent, Sécurité
- Temps relatif : "Il y a Xh", "Il y a Xmin", "Aujourd'hui"
- Actualités des dernières 48h maximum
- Variété de sujets et d'entreprises`;

  const userPrompt = query
    ? `Tu es un journaliste spécialisé en intelligence artificielle. L'utilisateur recherche des nouvelles sur : "${query}". Génère 5 actualités récentes et crédibles sur ce sujet dans le monde de l'IA.`
    : `Tu es un journaliste spécialisé en intelligence artificielle. Liste les 8 actualités les plus importantes et récentes dans le monde de l'IA (nouvelles sorties de modèles, recherches, lancements produits, réglementations, levées de fonds, partenariats...). Couvre des entreprises variées : OpenAI, Google DeepMind, Anthropic, Meta AI, Mistral, xAI, Microsoft, Hugging Face, startups, recherche académique, etc.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erreur API' });
    }

    // Extract text blocks only
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Extract JSON robustly
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Pas de JSON dans la réponse' });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
