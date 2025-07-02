# Tools Directory

This directory contains utility tools for analyzing and troubleshooting various file formats and network issues.

## HAR Analyzer (`har_analyzer.py`)

A comprehensive Python tool that analyzes HTTP Archive (HAR) files to detect potential issues including errors, performance problems, security vulnerabilities, and network connectivity issues.

### Features

- **HTTP Error Detection**: Identifies 4xx and 5xx status codes
- **Performance Analysis**: Detects slow responses and large payloads
- **Security Scanning**: Finds insecure protocols and missing security headers
- **Resource Issues**: Identifies failed resource loads and CORS problems
- **Network Analysis**: Detects DNS and connection issues
- **Statistical Reporting**: Provides comprehensive metrics

### Usage

```bash
# Basic analysis
python har_analyzer.py network_log.har

# Save results to JSON file
python har_analyzer.py -o report.json network_log.har

# Verbose output
python har_analyzer.py -v network_log.har
```

### What It Detects

#### 🔴 High Severity Issues
- HTTP 5xx server errors
- Invalid HAR file structure
- Critical security vulnerabilities

#### 🟡 Medium Severity Issues
- HTTP 4xx client errors
- Slow response times (>3 seconds)
- Missing security headers
- Blocked resource requests (CORS issues)
- Slow connection establishment

#### 🟢 Low Severity Issues
- Large response payloads (>1MB)
- Slow DNS resolution
- Performance optimizations

### Output Format

The tool provides:
1. **Console Output**: Formatted report with emojis and color coding
2. **JSON Export**: Structured data for further processing
3. **Statistics**: Overall metrics about the HAR file

### Example Output

```
================================================================================
HAR FILE ANALYSIS REPORT
================================================================================
Generated: 2025-01-27 14:30:15

📊 OVERALL STATISTICS
----------------------------------------
Total Requests: 156
Successful Requests (2xx): 142
Error Requests (4xx/5xx): 8
Average Response Time: 245.67ms
Max Response Time: 3200ms
Unique Domains: 12

🔴 HIGH SEVERITY ISSUES
----------------------------------------
1. HTTP 500 Errors Detected
   Type: Error
   Description: Found 3 requests returning HTTP 500 status
   Count: 3
   Urls: 3 items
     - https://api.example.com/users
     - https://api.example.com/data
     - https://api.example.com/config
```

### Requirements

- Python 3.6+
- No external dependencies (uses only standard library)

### Getting HAR Files

HAR files can be captured from:
- **Chrome DevTools**: Network tab → Right-click → "Save all as HAR"
- **Firefox DevTools**: Network tab → Right-click → "Save All As HAR"
- **Browser Extensions**: Various HAR capture extensions
- **Selenium**: Automated browser testing
- **Charles Proxy**: Network debugging tool

## XML Report Fixer (`fix_report_xml.py`)

A tool for repairing SAS Visual Analytics XML reports that contain duplicate items or unused prompts.

### Usage

```bash
python fix_report_xml.py input_report.xml
```

This will create a repaired version of the XML file with duplicates removed and unused prompts cleaned up. 