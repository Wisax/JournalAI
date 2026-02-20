export default async function handler(req, res) {
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
- Actualités des dernières semaines
- Variété de sujets et d'entreprises`;

  const userPrompt = query
    ? `Tu es journaliste IA. Liste 5 actualités récentes et importantes sur : "${query}" dans le monde de l'IA.`
    : `Tu es journaliste IA. Liste les 8 actualités les plus importantes et récentes dans le monde de l'IA (sorties de modèles, recherches, produits, réglementations, levées de fonds...). Couvre : OpenAI, Google DeepMind, Anthropic, Meta AI, Mistral, xAI, Microsoft, Hugging Face, startups, académique.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Erreur ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    const text = data?.choices?.[0]?.message?.content || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Pas de JSON dans la réponse', raw: text });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
