#!/usr/bin/env python3

import sys
import re
from typing import List, Optional, TextIO


class ExampleDoc:
    def __init__(self, kind: str, label: Optional[str]):
        self.kind = kind  # "valid" or "invalid"
        self.label = label
        self.content: List[str] = []


class RuleDoc:
    def __init__(self, name: str, severity: str):
        self.name = name
        self.severity = severity
        self.description: List[str] = []
        self.examples: List[ExampleDoc] = []


class SectionDoc:
    def __init__(self, name: str):
        self.name = name
        self.description: List[str] = []
        self.rules: List[RuleDoc] = []


def strip_comment(line: str) -> str:
    return re.sub(r"^\s*#\s?", "", line.rstrip())


def emit(out: TextIO, text: str = ""):
    out.write(text + "\n")


def format_severity(severity: str) -> str:
    sev = severity.upper()
    if severity.lower() == "error":
        return f'<span style="color:red">{sev}</span>'
    if severity.lower() == "warn":
        return f'<span style="color:goldenrod">{sev}</span>'
    return sev


EXAMPLE_HEADER_RE = re.compile(
    r"^(valid|invalid)\s+example(?:\s*\(([^)]+)\))?:$",
    re.IGNORECASE,
)


def emit_section(out: TextIO, section: SectionDoc):
    emit(out, f"## {section.name}")
    emit(out)
    for l in section.description:
        emit(out, l)
    emit(out)
    emit(out, "---")
    emit(out)

    for r in section.rules:
        emit(out, f"### {r.name}")
        emit(out, f"#### Severity: {format_severity(r.severity)}")
        emit(out)

        for d in r.description:
            emit(out, d)
        emit(out)

        for ex in r.examples:
            label = f" ({ex.label})" if ex.label else ""
            emit(out, f"**{ex.kind.capitalize()} example{label}:**")
            for l in ex.content:
                emit(out, l)
            emit(out)

        emit(out, "---")
        emit(out)


def generate_styleguide(input_path: str, output: Optional[str] = None):
    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    out: TextIO = open(output, "w", encoding="utf-8") if output else sys.stdout

    title = None
    doc_description: List[str] = []

    sections: List[SectionDoc] = []
    current_section: Optional[SectionDoc] = None

    in_rules_block = False
    collecting_section_description = False
    pending_comments: List[str] = []

    for line in lines:
        stripped = line.strip()

        # Title
        if stripped.startswith("# Title:"):
            title = stripped.replace("# Title:", "").strip()
            continue

        # Document description
        if stripped.startswith("#") and not sections and not stripped.startswith("# Section:"):
            doc_description.append(strip_comment(line) + "  ")
            continue

        # Section
        if stripped.startswith("# Section:"):
            current_section = SectionDoc(
                stripped.replace("# Section:", "").strip()
            )
            sections.append(current_section)
            collecting_section_description = True
            continue

        # Section description
        if collecting_section_description and stripped.startswith("#"):
            current_section.description.append(strip_comment(line) + "  ")
            continue

        if collecting_section_description and not stripped.startswith("#"):
            collecting_section_description = False

        # Rules block
        if stripped == "rules:":
            in_rules_block = True
            pending_comments = []
            continue

        if not in_rules_block or not current_section:
            continue

        # Rule comments
        if stripped.startswith("#"):
            pending_comments.append(strip_comment(line))
            continue

        # Rule definition
        rule_match = re.match(r"^\s{2}([a-zA-Z0-9\-$]+)\s*:\s*(\w+)", line)
        if rule_match:
            name, severity = rule_match.groups()
            rule = RuleDoc(name, severity)

            current_example: Optional[ExampleDoc] = None

            for c in pending_comments:
                m = EXAMPLE_HEADER_RE.match(c.lower())
                if m:
                    kind, label = m.group(1), m.group(2)
                    current_example = ExampleDoc(kind, label)
                    rule.examples.append(current_example)
                    continue

                if current_example:
                    current_example.content.append(c)
                else:
                    rule.description.append(c)

            current_section.rules.append(rule)
            pending_comments = []
            continue

        pending_comments = []

    # Emit document
    if title:
        emit(out, f"# {title}")
        emit(out)

    for l in doc_description:
        emit(out, l)
    emit(out)

    for section in sections:
        emit_section(out, section)

    if output:
        out.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: generate_styleguide.py <ruleset.yaml> [output.md]", file=sys.stderr)
        sys.exit(1)

    generate_styleguide(
        sys.argv[1],
        sys.argv[2] if len(sys.argv) > 2 else None,
    )
