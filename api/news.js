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
- URLs réelles issues de ta recherche web
- Tags pertinents parmi : LLM, Vision, Audio, Robotique, Réglementation, Recherche, Startup, Open Source, Hardware, Multimodal, Agent, Sécurité
- Temps relatif : "Il y a Xh", "Il y a Xmin", "Aujourd'hui"
- Actualités des dernières 48h maximum
- Variété de sujets et d'entreprises`;

  const userPrompt = query
    ? `Recherche des actualités récentes sur : "${query}" dans le monde de l'IA. Génère 5 actualités récentes et crédibles sur ce sujet.`
    : `Recherche et liste les 8 actualités les plus importantes et récentes dans le monde de l'IA (nouvelles sorties de modèles, recherches, lancements produits, réglementations, levées de fonds, partenariats...). Couvre des entreprises variées : OpenAI, Google DeepMind, Anthropic, Meta AI, Mistral, xAI, Microsoft, Hugging Face, startups, recherche académique, etc.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] }
          ],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Erreur ${response.status}`;
      return res.status(response.status).json({ error: errMsg });
    }

    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('\n') || '';

    // Extract JSON robustly
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Pas de JSON dans la réponse', raw: text });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
