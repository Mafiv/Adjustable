export async function getEmbedding(text: string) {
  const modelName = process.env.GITHUB_EMBEDDING_MODEL || "text-embedding-3-small";
  
  const response = await fetch("https://models.github.ai/inference/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GITHUB_MODELS_TOKEN}`,
    },
    body: JSON.stringify({
      input: text,
      model: modelName,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding; // This is an array of ~1536 numbers
}