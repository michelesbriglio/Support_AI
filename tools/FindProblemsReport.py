import re
import xml.etree.ElementTree as ET
import sys

if len(sys.argv) < 2:
    print("Usage: python FindProblemsReport.py <input_file>")
    sys.exit(1)

input_file = sys.argv[1]
tree = ET.parse(input_file)
root = tree.getroot()
idcheck = re.compile('[a-z]{2}[0-9]+')
idintext = re.compile('(?<![A-Za-z0-9#])[a-z]{2}[0-9]+')
idUsed = set()
idReferenced = set()
idDups = set()

# First pass: collect all IDs used in name attributes
for el in root.iter():
    name = el.get('name')
    if name:  # Only consider elements with a name attribute
        if name in idUsed:
            idDups.add(name)
        idUsed.add(name)

# Second pass: collect all references
for el in root.iter():
    for k,v in el.attrib.items():
        if k != 'name':  # Skip name attributes as they're not references
            for word in v.split():
                if re.match(idcheck,word) is not None:
                    idReferenced.add(word)
    if el.text is not None:
        results = re.findall(idintext,el.text)
        if results is not None:
            for found in results:
                idReferenced.add(found)

print("Null candidates: ", idReferenced.difference(idUsed))
print("Known false positives include labels, html colors")
if len(idDups)>0:
    print("Duplicates (in name attributes): ", idDups)
prNotUsed = set()
for k in idUsed.difference(idReferenced):
    if k.startswith("pr"):
        prNotUsed.add(k)
print("Prompts not used: ", prNotUsed)
