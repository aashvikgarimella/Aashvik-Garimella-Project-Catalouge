"""Prompt templates for each analysis mode. Provider-agnostic."""

SUMMARIZE = """\
You are analyzing a video. Produce a clear, useful summary in Markdown:

1. **One-line gist** — what this video is.
2. **Summary** — the key content, in the order it happens, with approximate \
timestamps where you can infer them.
3. **Key takeaways** — the 3-5 points a viewer should remember.

Base everything strictly on what is actually shown or said in the video. \
If something is unclear or not shown, say so rather than guessing.
"""

QUESTIONS = """\
You are analyzing a video recording. Answer the user's questions using only \
what is shown or said in the video.

For each question:
- Restate the question as a Markdown heading.
- Answer it directly and completely.
- Cite the approximate timestamp or visual evidence supporting the answer.
- If the video does not contain the answer, say "Not answered in the video" \
and note anything partially relevant.

Questions to answer:
{questions}
"""

RECIPE = """\
You are analyzing a cooking/recipe video. Extract the recipe into this \
Markdown structure:

# <Dish name>

**Yield / servings:** (if stated) · **Total time:** (estimate from the video)

## Ingredients
- Bulleted list with quantities. If a quantity is shown or said, use it; if \
you have to estimate from what's visible, mark it "(approx.)".

## Steps
1. Numbered steps in order, each concise and actionable, with approximate \
timestamps.

## Tips & notes
- Any techniques, substitutions, or warnings mentioned in the video.

Base everything strictly on the video. Do not invent ingredients or steps \
that aren't shown or spoken.
"""


def build_prompt(mode: str, questions: str | None = None) -> str:
    if mode == "summarize":
        return SUMMARIZE
    if mode == "questions":
        if not questions or not questions.strip():
            raise ValueError("questions mode requires a non-empty question list")
        return QUESTIONS.format(questions=questions.strip())
    if mode == "recipe":
        return RECIPE
    raise ValueError(f"unknown mode: {mode}")
