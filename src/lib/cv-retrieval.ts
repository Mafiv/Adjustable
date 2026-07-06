import { Project } from '@/lib/db/project.model';

export type RetrievedProject = {
  _id: { toString: () => string };
  title: string;
  description: string;
  techStack?: string[];
  impactScore: number;
  tags?: string[];
  score?: number;
};

export type RetrievalResult = {
  candidates: RetrievedProject[];
  retrievalMode: 'vector' | 'vault_fallback';
  vectorIndex: string;
  numCandidates: number;
  vaultProjectCount: number;
  projectsWithEmbeddings: number;
};

function hasValidEmbedding(embedding: unknown) {
  return Array.isArray(embedding) && embedding.length > 0;
}

function scoreByKeywordOverlap(
  project: RetrievedProject,
  jobDescription: string
): number {
  const jd = jobDescription.toLowerCase();
  const tokens = [
    project.title,
    project.description,
    ...(project.techStack ?? []),
    ...(project.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 2);

  let score = project.impactScore ?? 0;
  for (const token of new Set(tokens)) {
    if (jd.includes(token)) score += 2;
  }
  return score;
}

export async function retrieveProjectsForJob(input: {
  userId: string;
  jobDescription: string;
  queryVector: number[];
  topK: number;
  vectorIndex?: string;
}): Promise<RetrievalResult> {
  const { userId, jobDescription, queryVector, topK } = input;
  const vectorIndex = input.vectorIndex ?? process.env.MONGODB_VECTOR_INDEX ?? 'adjustable-vectors';
  const numCandidates = Math.max(topK * 20, 100);

  const [vaultProjects, vectorCandidates] = await Promise.all([
    Project.find({ userId }).lean(),
    Project.aggregate<RetrievedProject>([
      {
        $vectorSearch: {
          index: vectorIndex,
          path: 'embedding',
          queryVector,
          numCandidates,
          limit: topK,
          filter: { userId: { $eq: userId } },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          techStack: 1,
          impactScore: 1,
          tags: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).catch(() => [] as RetrievedProject[]),
  ]);

  const vaultProjectCount = vaultProjects.length;
  const projectsWithEmbeddings = vaultProjects.filter((project) =>
    hasValidEmbedding(project.embedding)
  ).length;

  if (vectorCandidates.length > 0) {
    return {
      candidates: vectorCandidates,
      retrievalMode: 'vector',
      vectorIndex,
      numCandidates,
      vaultProjectCount,
      projectsWithEmbeddings,
    };
  }

  if (vaultProjectCount === 0) {
    return {
      candidates: [],
      retrievalMode: 'vault_fallback',
      vectorIndex,
      numCandidates,
      vaultProjectCount,
      projectsWithEmbeddings,
    };
  }

  const fallbackCandidates = vaultProjects
    .map((project) => ({
      _id: project._id,
      title: project.title as string,
      description: project.description as string,
      techStack: (project.techStack as string[] | undefined) ?? [],
      impactScore: project.impactScore as number,
      tags: (project.tags as string[] | undefined) ?? [],
      score: scoreByKeywordOverlap(
        {
          _id: project._id,
          title: project.title as string,
          description: project.description as string,
          techStack: (project.techStack as string[] | undefined) ?? [],
          impactScore: project.impactScore as number,
          tags: (project.tags as string[] | undefined) ?? [],
        },
        jobDescription
      ),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);

  return {
    candidates: fallbackCandidates,
    retrievalMode: 'vault_fallback',
    vectorIndex,
    numCandidates,
    vaultProjectCount,
    projectsWithEmbeddings,
  };
}
