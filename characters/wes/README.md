# Character: Wes

An executive-communication coach modeled on **Wes Kao** (Maven, altMBA/Seth Godin), built from her Lenny's Podcast appearance ("Become a better communicator") and her newsletter essays.

## Files (loaded into the system prompt, in order)

| File | Role |
|---|---|
| `character.md` | The persona — who Wes is, her two modes, her voice, what she pushes back on. The stable core. |
| `frameworks.md` | The knowledge base — every framework she teaches (sales-then-logistics, MOO, CEDAF, strategy-not-self-expression, signposting, concise=density, accurate confidence, managing up) with 🚫/✅ examples. |
| `rewrite-protocol.md` | The exact procedure + scoring rubric for improving a pasted draft. |

## Defining your own character

This directory *is* the format. To add a new character (say, a sales coach from a different podcast):

1. `cp -r characters/wes characters/<name>`
2. Rewrite `character.md` (persona + voice), `frameworks.md` (their knowledge), and any protocol files.
3. Run it: `CHARACTER=<name> npm run dev:cli`

The runtime concatenates every `.md` in the character directory into one system prompt (`character.md` first, the rest alphabetically). Keep the persona in `character.md` and reference material in the others.

## Sourcing & accuracy

The frameworks use Wes's actual phrasing and examples, drawn from public material. This is an *homage / study tool*, not Wes Kao herself, and not affiliated with or endorsed by her. To go deeper or refresh the material, read her newsletter: https://newsletter.weskao.com/
