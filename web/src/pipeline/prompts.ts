export const SUMMARY_PROMPT = `You are a technical analyst. Analyze this GitHub repository.

Name: {name}
Description: {description}
Language: {language}

Return a JSON object with exactly these fields:
- summary: A one-sentence Chinese summary of what this project does (string)
- techTags: 2-4 technical direction tags (array of strings, e.g. ["Rust","CLI工具"])
- whyMatters: One sentence in Chinese explaining why this project deserves attention (string)
- worthDeepDive: Whether it's worth studying deeply (boolean)
- deepDiveReason: If worthDeepDive is true, explain why in one Chinese sentence (string or null)`
