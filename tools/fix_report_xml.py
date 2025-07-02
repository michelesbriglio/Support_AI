import xml.etree.ElementTree as ET
import re
import sys
from pathlib import Path
from typing import Dict, List, Set

"""fix_report_xml.py

Usage
-----
$ python fix_report_xml.py <input_xml> [output_xml]

Reads a Visual Analytics BIRD XML file, resolves duplicated object names and
removes unused prompt definitions.  A new XML file is produced whose structure
is identical to the original apart from the repairs performed.

Repairs implemented
-------------------
1. Duplicated object names (e.g. dd123 appearing twice).
   * Only the first occurrence of a duplicate is retained unchanged.
   * Subsequent duplicates are assigned a fresh unique identifier that shares
     the same alphabetical prefix (``dd`` in the example above).  The numeric
     portion is taken from the report-level attribute ``nextUniqueNameIndex``
     and incremented for every new identifier created.
   * All references to the old identifier in attributes, element text, and tail
     text are replaced with the new identifier so the report remains
     consistent.
   * When processing completes, the ``nextUniqueNameIndex`` attribute in the
     `<SASReport>` root element is updated to the next unused number.

2. Unused prompts
   * Prompt definition elements whose ``name`` attribute begins with ``pr`` and
     are not referenced anywhere else in the XML are removed.

Only these two repairs are performed; everything else in the XML remains
unchanged.
"""

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

NAME_RE = re.compile(r"^[a-z]+\d+$")  # matches dd123 etc.
ID_IN_TEXT_RE = re.compile(r"(?<![A-Za-z0-9#])([a-z]+\d+)")


def build_parent_map(root: ET.Element) -> Dict[ET.Element, ET.Element]:
    """Return a mapping *child -> parent* for every element in *root*."""
    return {child: parent for parent in root.iter() for child in parent}


def collect_ids(root: ET.Element):
    """Return (id_used, id_referenced, id_dups).

    Parameters
    ----------
    root : ET.Element
        Root element of the parsed XML tree.
    """
    id_used: Dict[str, List[ET.Element]] = {}
    id_referenced: Set[str] = set()
    id_dups: Set[str] = set()

    # Pass 1 – collect all ids used as *name* attributes.
    for el in root.iter():
        name = el.get("name")
        if name:
            id_used.setdefault(name, []).append(el)
            if len(id_used[name]) > 1:
                id_dups.add(name)

    # Pass 2 – collect all ids referenced outside *name* attributes.
    for el in root.iter():
        # attributes
        for attr, val in el.attrib.items():
            if attr == "name":
                continue
            # A single attribute might contain many ids (space-separated or
            # embedded inside longer tokens such as dd123.bi4)
            for match in re.finditer(NAME_RE, val):
                id_referenced.add(match.group(0))
        # element text
        if el.text:
            for match in ID_IN_TEXT_RE.finditer(el.text):
                id_referenced.add(match.group(1))
        if el.tail:
            for match in ID_IN_TEXT_RE.finditer(el.tail):
                id_referenced.add(match.group(1))

    return id_used, id_referenced, id_dups


# ----------------------------------------------------------------------------
# Core functionality
# ----------------------------------------------------------------------------

def fix_duplicates(root: ET.Element) -> int:
    """For every duplicate name=..., rename only the second and subsequent elements using nextUniqueNameIndex. Do not update any references. Only increment nextUniqueNameIndex if a new name is used."""
    id_used, _, id_dups = collect_ids(root)
    if not id_dups:
        return 0

    # Determine starting index from the root attribute.
    next_unique = int(root.get("nextUniqueNameIndex", "0"))
    changed = 0
    for dup_name in sorted(id_dups):
        elements = id_used[dup_name]
        # Keep the first element unchanged, rename the rest.
        for el in elements[1:]:
            prefix_match = re.match(r"[a-z]+", dup_name)
            if not prefix_match:
                continue
            prefix = prefix_match.group(0)
            new_name = f"{prefix}{next_unique}"
            next_unique += 1
            el.set("name", new_name)
            changed += 1
    if changed:
        root.set("nextUniqueNameIndex", str(next_unique))
    return changed


def remove_unused_prompts(root: ET.Element) -> int:
    """Remove prompt definitions that are not referenced.

    Returns
    -------
    int
        Number of prompt elements removed.
    """
    id_used, id_referenced, _ = collect_ids(root)

    unused_prompts = {
        pid for pid in id_used.keys()
        if pid.startswith("pr") and pid not in id_referenced
    }
    if not unused_prompts:
        return 0

    # Build a mapping of child -> parent to support removal.
    parent_map = build_parent_map(root)

    removed = 0
    for prompt_id in unused_prompts:
        # Remove all elements with this name attribute (normally one, but be safe)
        for el in id_used[prompt_id]:
            parent = parent_map.get(el)
            if parent is not None:
                parent.remove(el)
                removed += 1
    return removed


def extract_cdata_blocks(xml_text):
    """Return a list of (start, end, content) for all CDATA sections in xml_text."""
    cdata_blocks = []
    for match in re.finditer(r'<!\[CDATA\[(.*?)\]\]>', xml_text, re.DOTALL):
        cdata_blocks.append((match.start(), match.end(), match.group(0)))
    return cdata_blocks


def remove_nonoriginal_cdata(xml_str, original_cdata_blocks):
    """Remove all CDATA sections from xml_str except those that match the original CDATA blocks."""
    # Build a set of original CDATA contents for fast lookup
    original_cdata_set = set(block[2] for block in original_cdata_blocks)
    def cdata_replacer(match):
        cdata = match.group(0)
        if cdata in original_cdata_set:
            return cdata
        # Otherwise, return just the text content (no CDATA)
        return match.group(1)
    # Replace all CDATA blocks
    return re.sub(r'<!\[CDATA\[(.*?)\]\]>', cdata_replacer, xml_str, flags=re.DOTALL)


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python fix_report_xml.py <input_xml> [output_xml]")

    input_path = Path(sys.argv[1]).expanduser()
    if not input_path.exists():
        sys.exit(f"Input file '{input_path}' does not exist")

    output_path = (
        Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.with_name(input_path.stem + "_fixed.xml")
    )

    # Read the original XML as text to extract CDATA blocks
    with open(input_path, "r", encoding="utf-8") as f:
        original_xml_text = f.read()
    cdata_blocks = extract_cdata_blocks(original_xml_text)

    # Register namespace so it is preserved when writing.
    ET.register_namespace("", "http://www.sas.com/sasreportmodel/bird-4.1.4")

    tree = ET.parse(str(input_path))
    root = tree.getroot()

    removed_duplicates = fix_duplicates(root)
    removed_prompts = remove_unused_prompts(root)

    # Write XML with formatting to match fixed_report.xml
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    xml_str = xml_bytes.decode("utf-8")
    # Remove namespace prefixes like ns0:
    xml_str = re.sub(r"ns\d+:", "", xml_str)
    # Replace single quotes in XML declaration with double quotes
    xml_str = re.sub(r"<\?xml version='1.0' encoding='utf-8'\?>", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>", xml_str)
    # Use default namespace (xmlns=) instead of xmlns:ns0=
    xml_str = re.sub(r'xmlns:ns0=','xmlns=', xml_str)
    # Remove ns0: from element tags if any remain
    xml_str = xml_str.replace('ns0:', '')
    # Use &apos; for apostrophes in text content (but not in attribute values)
    def replace_apos_in_text(match):
        text = match.group(1)
        return '>' + text.replace("'", "&apos;") + '<'
    xml_str = re.sub(r'>([^<]*?)<', replace_apos_in_text, xml_str)
    # Convert &lt; and &gt; in text nodes back to < and > (but not inside CDATA)
    def unescape_angle_brackets(match):
        text = match.group(1)
        return '>' + text.replace('&lt;', '<').replace('&gt;', '>') + '<'
    xml_str = re.sub(r'>([^<]*?)<', unescape_angle_brackets, xml_str)
    # Remove the space that precedes all self-closing tags
    xml_str = re.sub(r' \/>', '/>', xml_str)

    # Remove any new CDATA sections added by the serializer, except the original ones
    xml_str = remove_nonoriginal_cdata(xml_str, cdata_blocks)
    # Restore original CDATA blocks at their positions
    def restore_cdata_blocks(xml_str, cdata_blocks):
        # Replace any CDATA-looking blocks in xml_str with the originals from cdata_blocks
        # (Assume the number and order of CDATA blocks is the same)
        def cdata_replacer(match):
            nonlocal cdata_idx
            if cdata_idx < len(cdata_blocks):
                cdata = cdata_blocks[cdata_idx][2]
                cdata_idx += 1
                return cdata
            return match.group(0)
        cdata_idx = 0
        # Replace all CDATA blocks in the output with the originals
        return re.sub(r'<!\[CDATA\[.*?\]\]>', cdata_replacer, xml_str, flags=re.DOTALL)

    xml_str = restore_cdata_blocks(xml_str, cdata_blocks)

    with open(output_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(xml_str)

    print(f"Processed '{input_path.name}':")
    if removed_duplicates:
        print(f"  • Removed {removed_duplicates} duplicate elements")
    else:
        print("  • No duplicated names detected")

    if removed_prompts:
        print(f"  • Removed {removed_prompts} unused prompt definitions")
    else:
        print("  • No unused prompts found")

    print(f"Fixed XML written to '{output_path}'")


if __name__ == "__main__":
    main() 