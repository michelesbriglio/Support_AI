# SAS Visual Analytics BIRD XML Repair Tool

A comprehensive Python tool for detecting and repairing common issues in SAS Visual Analytics BIRD XML report files. This tool can handle both individual XML files and SAS Viya transfer JSON files containing multiple reports.

## 🎯 What is this tool?

The SAS Visual Analytics BIRD XML Repair Tool is designed to fix corrupted or problematic SAS Visual Analytics report files that may contain:

- **Null Candidates**: Object IDs that are referenced but not defined in the XML
- **Duplicate Object IDs**: Multiple elements with the same unique identifier
- **Unused Prompts**: Prompt definitions that are defined but never referenced
- **Corrupted Report Structure**: Malformed XML that prevents reports from opening

## ✨ Features

### 🔍 **Comprehensive Analysis**
- Detects all types of issues in BIRD XML files
- Provides detailed analysis reports with object counts and issue summaries
- Identifies potential problems before they cause report failures

### 🔧 **Automatic Repair**
- **Null Candidates**: Removes references to undefined objects
- **Duplicate Objects**: Renames duplicate IDs to maintain uniqueness
- **Unused Prompts**: Removes prompt definitions that aren't referenced
- **Corrupted Reports**: Repairs malformed XML structure

### 📁 **Multiple Input Formats**
- **XML Files**: Direct repair of individual BIRD XML files
- **JSON Files**: Extract and repair all reports from SAS Viya transfer files
- **Auto-detection**: Automatically detects file type and processes accordingly

### 🎨 **Clean Output**
- Preserves XML formatting and namespaces
- Removes problematic namespace prefixes (ns0:)
- Fixes self-closing tag formatting
- Maintains proper XML structure

## 🚀 Installation

### Prerequisites
- Python 3.6 or higher
- Required packages (install via `pip install -r requirements.txt`):
  - `xml.etree.ElementTree` (built-in)
  - `argparse` (built-in)
  - `logging` (built-in)
  - `json` (built-in)
  - `base64` (built-in)
  - `zlib` (built-in)
  - `re` (built-in)
  - `os` (built-in)
  - `sys` (built-in)
  - `pathlib` (built-in)

### Quick Start
```bash
# Clone or download the tool
cd nullcandidate

# Install dependencies (if needed)
pip install -r requirements.txt

# Make the tool executable (optional)
chmod +x sas_va_xml_repair.py
```

## 📖 Usage

### Basic Usage

#### Repair a single XML file:
```bash
python sas_va_xml_repair.py report.xml
```

#### Repair all reports in a JSON transfer file:
```bash
python sas_va_xml_repair.py transfer.json
```

#### Auto-detect and repair (uses first XML file in current directory):
```bash
python sas_va_xml_repair.py
```

### Advanced Options

#### Analysis only (no repairs):
```bash
python sas_va_xml_repair.py report.xml --analyze
```

#### Specific repairs:
```bash
# Repair only duplicate objects
python sas_va_xml_repair.py report.xml --repair-duplicates

# Repair only null candidates
python sas_va_xml_repair.py report.xml --repair-null-candidates

# Repair only unused prompts
python sas_va_xml_repair.py report.xml --repair-unused-prompts

# Repair corrupted report structure
python sas_va_xml_repair.py report.xml --repair-corrupted
```

#### Custom output path:
```bash
python sas_va_xml_repair.py report.xml --output fixed_report.xml
```

## 📋 Examples

### Example 1: Repair a corrupted XML file
```bash
$ python sas_va_xml_repair.py corrupted_report.xml

============================================================
SAS Visual Analytics BIRD XML Analysis
============================================================
File: corrupted_report.xml
Total Objects: 3143
Next Unique Name Index: 6062966

Object Counts by Type:
  DataDefinition: 68
  RelationalDataItem: 540
  PromptDefinition: 68
  ...

Null Candidates (1):
  bi2: Referenced but not defined

Unused Prompts (27):
  pr1016968: Defined but not referenced
  pr1072758: Defined but not referenced
  ...

Potential Issues:
  ⚠️  Found 1 null candidates
  ⚠️  Found 27 unused prompts
============================================================

🔧 Auto-repair mode: Issues detected, performing repairs...
🔧 Repairing null candidates...
🔧 Removing unused prompts...
✅ Repaired XML saved successfully
```

### Example 2: Process a JSON transfer file
```bash
$ python sas_va_xml_repair.py Paket.json

--- Repairing report: Vertriebsreporting ---
============================================================
SAS Visual Analytics BIRD XML Analysis
============================================================
File: /path/to/Vertriebsreporting.xml
Total Objects: 203
...

Null Candidates (7):
  vi1645: Referenced but not defined
  vi183: Referenced but not defined
  ...

🔧 Repairing null candidates...
✅ Repaired XML saved to: /path/to/Vertriebsreporting_repaired.xml

All reports in Paket.json have been processed.
```

## 📁 Output Files

### For XML Input:
- **Original**: `report.xml`
- **Repaired**: `report_repaired.xml` (in same directory)

### For JSON Input:
- **Original**: `transfer.json`
- **Repaired**: `report_name_repaired.xml` (in same directory as JSON)

## 🔧 How It Works

### 1. **Analysis Phase**
The tool performs a comprehensive analysis of the XML structure:
- Counts all objects by type
- Identifies duplicate object IDs
- Finds null candidates (referenced but not defined)
- Detects unused prompt definitions
- Validates XML structure integrity

### 2. **Repair Phase**
Based on the analysis, the tool automatically repairs issues:

#### Null Candidates
- Removes elements that reference undefined objects
- Cleans up expressions and attributes containing null references
- Performs iterative cleanup until all null candidates are resolved

#### Duplicate Objects
- Keeps the first occurrence of each duplicate ID
- Renames subsequent duplicates with unique identifiers
- Updates all references to maintain consistency

#### Unused Prompts
- Identifies prompt definitions that aren't referenced anywhere
- Removes unused prompt elements from the XML
- Maintains report functionality while reducing file size

### 3. **Output Generation**
- Preserves the original XML structure and formatting
- Removes problematic namespace prefixes
- Fixes XML formatting issues (self-closing tags, etc.)
- Saves the repaired file with `_repaired.xml` suffix

## 🛠️ Technical Details

### Supported File Formats
- **BIRD XML**: SAS Visual Analytics report files (`.xml`)
- **Viya Transfer JSON**: SAS Viya transfer files (`.json`)

### Supported SAS Versions
- SAS Visual Analytics 4.1.4+
- SAS Viya 3.5+

### XML Namespace Handling
- Automatically detects and preserves default namespaces
- Removes problematic `ns0:` prefixes
- Maintains proper namespace declarations

## 🐛 Troubleshooting

### Common Issues

#### "No XML files found in current directory"
- Ensure you're in the correct directory with XML files
- Or specify the file path explicitly: `python sas_va_xml_repair.py path/to/file.xml`

#### "Failed to load XML file"
- Check if the file is a valid BIRD XML file
- Ensure the file isn't corrupted or empty
- Verify file permissions

#### "No reports found in JSON"
- Ensure the JSON file is a valid SAS Viya transfer file
- Check if the file contains report objects in `transferDetails`

### Logging
The tool provides detailed logging output. For more verbose logging, you can modify the logging level in the script.

## 🤝 Contributing

This tool is designed to be extensible. You can add new repair methods by:

1. Adding a new detection method (e.g., `find_new_issue()`)
2. Adding a corresponding repair method (e.g., `repair_new_issue()`)
3. Integrating it into the main analysis and repair workflow

## 📄 License

This tool is provided as-is for repairing SAS Visual Analytics BIRD XML files. Use at your own risk and always backup original files before repair.

## 🔗 Related Tools

- **ReportExtractor.py**: Extracts XML reports from Viya transfer files
- **fix_report_xml copy.py**: Reference implementation for XML repair logic

---

**Note**: Always backup your original files before running repairs. While the tool is designed to be safe, it's good practice to keep backups of important report files. 