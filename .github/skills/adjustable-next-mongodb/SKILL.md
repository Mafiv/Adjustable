---
name: adjustable-next-mongodb
description: 'Generate dynamic portfolio content for the Adjustable Next.js 15 + MongoDB app. Use when mapping job descriptions to user projects with vector search, embeddings, and LLM prompts; includes data model checks, retrieval steps, and content generation outputs.'
argument-hint: 'Provide job description text, target user id, and desired output format (e.g., page sections, resume bullets, JSON)'
---

# Adjustable: Dynamic Portfolio Generation

## When to Use
- Create or update portfolio content based on a job description
- Map job requirements to user projects with vector search
- Design the LLM prompt and output schema for generated sections
- Validate MongoDB vector indexing and retrieval quality

## Inputs to Gather
- Job description text and role level
- Target user id and project ids (or criteria to select them)
- Output format: page sections, resume bullets, JSON schema, or markdown
- Constraints: tone, length, target audience, and must-include keywords

## Procedure
1. Confirm scope and data sources
   - Identify the collections for users, projects, embeddings, and generated content
   - Verify where embeddings are stored (MongoDB vector index vs external store)
2. Validate vector search readiness
   - Check embedding model name, vector size, and similarity metric
   - Confirm the MongoDB vector index name and fields
   - Decide the top-k value and any filters (tags, dates, roles)
3. Create the retrieval plan
   - Build a query embedding from the job description
   - Retrieve candidate projects with vector search
   - Re-rank or filter results based on explicit criteria (must-have skills)
4. Draft the LLM prompt and schema
   - Specify inputs (job description, top projects, user bio)
   - Define the output schema (sections, bullets, metadata)
   - Add constraints for tone, length, and prohibited claims
5. Generate and validate content
   - Run the LLM call with retrieval context
   - Validate output against schema and length constraints
   - Add a brief rationale per section if requested
6. Persist and expose results
   - Save generated content with provenance (job id, project ids, prompt hash)
   - Expose via API or server action for Next.js 15
   - Log feedback metrics (clicks, edits, success rate)

## Decision Points
- If vector recall is weak: increase top-k, add hybrid keyword filters, or improve embeddings
- If outputs are too generic: enforce structured schema and add explicit project evidence
- If results need personalization: include user goals and preferred industries in the prompt

## Quality Checks
- Each generated claim is grounded in an actual project
- Output follows the requested schema exactly
- Content uses role-specific terminology from the job description
- No unsupported metrics or fabricated achievements

## Deliverables
- Retrieval plan and query parameters
- LLM prompt and output schema
- Generated portfolio content ready for rendering
- Storage/update notes for MongoDB and Next.js 15 integration
