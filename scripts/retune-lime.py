"""Retune the Lime design system for Fairseat: blue accent, Inter for text and numbers.

Installing a Lime component with `shadcn add --overwrite` rewrites
components/lime/tokens.css and the skill files back to stock. Run this again
afterwards:

    python3 scripts/retune-lime.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKENS = ROOT / "components/lime/tokens.css"
STYLES = ROOT / "components/lime/styles.css"
SKILLS = [ROOT / ".claude/skills/lime/SKILL.md", ROOT / ".agents/skills/lime/SKILL.md"]
DARK_START = '[data-system="lime"][data-theme="dark"]'

# The blue is the creator-ops brand ramp: 500 #356ed8, 600 #2a5bc0, 700 #23499b.
LIGHT = {
    "on-accent": ("#ffffff", "text and icons on the blue, 4.8:1 on --accent | primary button, selected chip"),
    "glow-accent-fg": ("#ffffff", "text and icons on the blue glow: white on the light body, ink on the lighter dark one | primary button, balance chip, featured card"),
    "accent": ("#356ed8", "the mark: the fill of a primary action, 4.8:1 with --on-accent | primary button, selected segment, switch on, slider fill, progress"),
    "accent-hover": ("#2a5bc0", "the mark on hover, 6.5:1 with --on-accent | primary button"),
    "accent-active": ("#23499b", "the mark pressed, 8.7:1 with --on-accent | primary button"),
    "accent-wash": ("#eff5ff", "a soft highlight, 17:1 with --fg | selected row, highlighted option, the current answer"),
    "accent-line": ("#2a5bc0", "blue line step, 6.5:1 on --page | focus ring, outline, icon on white"),
    "glow-accent-from": ("#2f66d2", "top of the blue body, a step under the mark | primary button, balance chip, featured card"),
    "glow-accent-to": ("#5e93f0", "bottom of the blue body, lit from inside like the stock lime | primary button, balance chip, featured card"),
    "glow-accent-cast": ("35 73 155", "the blue outer cast, an RGB triplet | glow-accent"),
    "glow-accent-light": ("1", "strength of the white sheen and bloom on the body, stock value | glow-accent"),
    "glow-accent-from-lit": ("#356ed8", "top of the body when powered on (hover) | glow-accent"),
    "glow-accent-to-lit": ("#76a4f4", "bottom of the body when powered on | glow-accent"),
    "glow-accent-from-press": ("#2a5bc0", "top of the body while pressed, a darker body | glow-accent"),
    "glow-accent-to-press": ("#4a82e6", "bottom of the body while pressed | glow-accent"),
    "font-sans": ('var(--font-inter), "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', "every word and number, Inter | all text"),
    "font-mono": ('ui-monospace, "SF Mono", Menlo, Consolas, monospace', "code and keys only, Lime's stock value | code, shortcut"),
}

DARK = {
    "on-accent": ("#0f0f0d", "ink on the lighter blue, 6.3:1 on --accent"),
    "accent": ("#5e93f0", "the blue a step lighter for a dark page, 6.3:1 with --on-accent"),
    "accent-hover": ("#76a4f4", None),
    "accent-active": ("#4a82e6", None),
    "accent-wash": ("#14244a", "12:1 with --fg"),
    "accent-line": ("#5e93f0", "the line step is the mark on dark"),
    "glow-accent-fg": ("#0f0f0d", None),
    "glow-accent-from": ("#5288e8", None),
    "glow-accent-to": ("#76a4f4", None),
    "glow-accent-from-lit": ("#5e93f0", None),
    "glow-accent-to-lit": ("#8fb6fa", None),
    "glow-accent-from-press": ("#4a82e6", None),
    "glow-accent-to-press": ("#5e93f0", None),
}

HANKEN_IMPORT = '@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&display=swap");\n'
FONT_NOTE_OLD = "Font: Hanken Grotesk, SIL OFL, from Google Fonts. */"
FONT_NOTE_NEW = (
    "Font: Inter, SIL OFL, loaded by next/font in app/layout.tsx in place of the stylesheet import.\n\n"
    "   Retuned for Fairseat by scripts/retune-lime.py: the accent is blue (the creator-ops brand ramp,\n"
    "   #356ed8) in place of the acid lime, with white text on it in the light theme. Comments below that\n"
    "   still say lime mean the accent. */"
)

# Lime only scans its own folders for classes. The app's screens live in app/, so that is added.
SOURCE_ANCHOR = '@source "../../lib/lime";\n'
SOURCE_APP = '@source "../../app";\n'

SKILL_NOTE = (
    "\nProject override (Fairseat): the accent is blue (#356ed8), not acid lime, and the font is Inter, for "
    "words and numbers alike. Text on the accent is white in the light theme (--on-accent). Wherever these rules say "
    'lime, read the blue accent. The "No blue" line in the reject list does not apply to the accent. '
    "After installing a Lime component, run python3 scripts/retune-lime.py.\n"
)


def apply(css: str, tokens: dict) -> str:
    for name, (value, comment) in tokens.items():
        pattern = re.compile(r"^(\s*)--" + re.escape(name) + r":[^\n]*$", re.M)
        if not pattern.search(css):
            raise SystemExit(f"token --{name} not found in {TOKENS}")
        tail = f" /* {comment} */" if comment else ""
        css = pattern.sub(lambda m: f"{m.group(1)}--{name}: {value};{tail}", css, count=1)
    return css


def main() -> None:
    css = TOKENS.read_text()
    split = css.index(DARK_START)
    light, dark = apply(css[:split], LIGHT), apply(css[split:], DARK)
    light = light.replace(HANKEN_IMPORT, "").replace(FONT_NOTE_OLD, FONT_NOTE_NEW)
    light = light.replace("== Accent: acid lime ==", "== Accent: blue ==")
    TOKENS.write_text(light + dark)

    styles = STYLES.read_text()
    if SOURCE_APP not in styles:
        STYLES.write_text(styles.replace(SOURCE_ANCHOR, SOURCE_ANCHOR + SOURCE_APP, 1))

    for skill in SKILLS:
        if not skill.exists():
            continue
        text = skill.read_text()
        if "Project override (Fairseat)" not in text:
            skill.write_text(text.replace("# Lime\n", "# Lime\n" + SKILL_NOTE, 1))
    print("Lime retuned: blue accent, Inter.")


if __name__ == "__main__":
    main()
