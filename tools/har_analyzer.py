#!/usr/bin/env python3
"""
HAR File Analyzer
Analyzes HTTP Archive (HAR) files to detect potential issues including:
- HTTP errors (4xx, 5xx)
- Performance issues (slow responses, large payloads)
- Security issues (missing headers, insecure protocols)
- Resource loading problems
- Network connectivity issues
"""

import json
import argparse
import sys
from datetime import datetime
from typing import Dict, List, Any
from urllib.parse import urlparse
import statistics

class HARAnalyzer:
    def __init__(self, har_data: Dict[str, Any]):
        self.har_data = har_data
        self.issues = []
        self.stats = {}
        
    def analyze(self) -> List[Dict[str, Any]]:
        """Main analysis function"""
        if 'log' not in self.har_data:
            self.issues.append({
                'type': 'error',
                'severity': 'high',
                'title': 'Invalid HAR file structure',
                'description': 'HAR file is missing required "log" section',
                'details': 'The HAR file does not contain the expected structure'
            })
            return self.issues
            
        entries = self.har_data['log'].get('entries', [])
        if not entries:
            self.issues.append({
                'type': 'warning',
                'severity': 'medium',
                'title': 'Empty HAR file',
                'description': 'No HTTP requests found in the HAR file',
                'details': 'The HAR file contains no entries to analyze'
            })
            return self.issues
            
        self._analyze_http_errors(entries)
        self._analyze_performance_issues(entries)
        self._analyze_security_issues(entries)
        self._analyze_resource_issues(entries)
        self._analyze_network_issues(entries)
        self._generate_statistics(entries)
        
        return self.issues
    
    def _analyze_http_errors(self, entries: List[Dict[str, Any]]):
        """Analyze HTTP error responses"""
        error_entries = []
        
        for entry in entries:
            response = entry.get('response', {})
            status = response.get('status', 0)
            
            if status >= 400:
                error_entries.append({
                    'url': entry.get('request', {}).get('url', 'Unknown'),
                    'status': status,
                    'method': entry.get('request', {}).get('method', 'Unknown'),
                    'time': entry.get('time', 0),
                    'size': response.get('bodySize', 0)
                })
        
        if error_entries:
            # Group by status code
            status_groups = {}
            for entry in error_entries:
                status = entry['status']
                if status not in status_groups:
                    status_groups[status] = []
                status_groups[status].append(entry)
            
            for status, entries_list in status_groups.items():
                self.issues.append({
                    'type': 'error',
                    'severity': 'high' if status >= 500 else 'medium',
                    'title': f'HTTP {status} Errors Detected',
                    'description': f'Found {len(entries_list)} requests returning HTTP {status} status',
                    'details': {
                        'count': len(entries_list),
                        'urls': [e['url'] for e in entries_list[:5]],  # Show first 5 URLs
                        'methods': list(set(e['method'] for e in entries_list))
                    }
                })
    
    def _analyze_performance_issues(self, entries: List[Dict[str, Any]]):
        """Analyze performance-related issues"""
        response_times = [entry.get('time', 0) for entry in entries]
        
        if response_times:
            avg_time = statistics.mean(response_times)
            max_time = max(response_times)
            slow_threshold = 3000  # 3 seconds
            
            # Find slow requests
            slow_requests = [
                entry for entry in entries 
                if entry.get('time', 0) > slow_threshold
            ]
            
            if slow_requests:
                self.issues.append({
                    'type': 'performance',
                    'severity': 'medium',
                    'title': 'Slow Response Times Detected',
                    'description': f'Found {len(slow_requests)} requests taking longer than {slow_threshold}ms',
                    'details': {
                        'slow_requests': [
                            {
                                'url': entry.get('request', {}).get('url', 'Unknown'),
                                'time': entry.get('time', 0),
                                'method': entry.get('request', {}).get('method', 'Unknown')
                            }
                            for entry in slow_requests[:5]  # Show first 5
                        ],
                        'average_response_time': round(avg_time, 2),
                        'max_response_time': max_time
                    }
                })
            
            # Check for large payloads
            large_payloads = []
            for entry in entries:
                response = entry.get('response', {})
                body_size = response.get('bodySize', 0)
                if body_size > 1024 * 1024:  # 1MB
                    large_payloads.append({
                        'url': entry.get('request', {}).get('url', 'Unknown'),
                        'size': body_size,
                        'method': entry.get('request', {}).get('method', 'Unknown')
                    })
            
            if large_payloads:
                self.issues.append({
                    'type': 'performance',
                    'severity': 'low',
                    'title': 'Large Response Payloads Detected',
                    'description': f'Found {len(large_payloads)} responses larger than 1MB',
                    'details': {
                        'large_responses': large_payloads[:5]  # Show first 5
                    }
                })
    
    def _analyze_security_issues(self, entries: List[Dict[str, Any]]):
        """Analyze security-related issues"""
        security_issues = []
        
        for entry in entries:
            request = entry.get('request', {})
            response = entry.get('response', {})
            url = request.get('url', '')
            
            # Check for HTTP (non-HTTPS) requests
            if url.startswith('http://') and not url.startswith('https://'):
                security_issues.append({
                    'type': 'insecure_protocol',
                    'url': url,
                    'description': 'HTTP request detected (should use HTTPS)'
                })
            
            # Check for missing security headers
            headers = response.get('headers', [])
            header_names = [h.get('name', '').lower() for h in headers]
            
            if 'content-security-policy' not in header_names:
                security_issues.append({
                    'type': 'missing_security_header',
                    'url': url,
                    'description': 'Missing Content-Security-Policy header'
                })
            
            if 'x-frame-options' not in header_names:
                security_issues.append({
                    'type': 'missing_security_header',
                    'url': url,
                    'description': 'Missing X-Frame-Options header'
                })
        
        if security_issues:
            # Group by issue type
            issue_groups = {}
            for issue in security_issues:
                issue_type = issue['type']
                if issue_type not in issue_groups:
                    issue_groups[issue_type] = []
                issue_groups[issue_type].append(issue)
            
            for issue_type, issues_list in issue_groups.items():
                if issue_type == 'insecure_protocol':
                    self.issues.append({
                        'type': 'security',
                        'severity': 'high',
                        'title': 'Insecure HTTP Requests Detected',
                        'description': f'Found {len(issues_list)} HTTP requests (should use HTTPS)',
                        'details': {
                            'urls': [issue['url'] for issue in issues_list[:5]]
                        }
                    })
                elif issue_type == 'missing_security_header':
                    self.issues.append({
                        'type': 'security',
                        'severity': 'medium',
                        'title': 'Missing Security Headers',
                        'description': f'Found {len(issues_list)} responses missing security headers',
                        'details': {
                            'missing_headers': list(set(issue['description'] for issue in issues_list))
                        }
                    })
    
    def _analyze_resource_issues(self, entries: List[Dict[str, Any]]):
        """Analyze resource loading issues"""
        failed_resources = []
        blocked_resources = []
        
        for entry in entries:
            response = entry.get('response', {})
            status = response.get('status', 0)
            url = entry.get('request', {}).get('url', '')
            
            # Check for failed resource loads
            if status == 0 or status >= 400:
                failed_resources.append({
                    'url': url,
                    'status': status,
                    'method': entry.get('request', {}).get('method', 'Unknown')
                })
            
            # Check for blocked resources (CORS, etc.)
            if status == 0:
                blocked_resources.append({
                    'url': url,
                    'method': entry.get('request', {}).get('method', 'Unknown')
                })
        
        if failed_resources:
            self.issues.append({
                'type': 'resource',
                'severity': 'medium',
                'title': 'Failed Resource Loads',
                'description': f'Found {len(failed_resources)} failed resource requests',
                'details': {
                    'failed_resources': failed_resources[:5]  # Show first 5
                }
            })
        
        if blocked_resources:
            self.issues.append({
                'type': 'resource',
                'severity': 'medium',
                'title': 'Blocked Resource Requests',
                'description': f'Found {len(blocked_resources)} blocked resource requests (likely CORS issues)',
                'details': {
                    'blocked_resources': blocked_resources[:5]  # Show first 5
                }
            })
    
    def _analyze_network_issues(self, entries: List[Dict[str, Any]]):
        """Analyze network connectivity issues"""
        # Check for DNS resolution issues
        dns_issues = []
        connection_issues = []
        
        for entry in entries:
            timings = entry.get('timings', {})
            url = entry.get('request', {}).get('url', '')
            
            # DNS resolution issues
            dns_time = timings.get('dns', -1)
            if dns_time > 1000:  # DNS taking more than 1 second
                dns_issues.append({
                    'url': url,
                    'dns_time': dns_time
                })
            
            # Connection issues
            connect_time = timings.get('connect', -1)
            if connect_time > 2000:  # Connection taking more than 2 seconds
                connection_issues.append({
                    'url': url,
                    'connect_time': connect_time
                })
        
        if dns_issues:
            self.issues.append({
                'type': 'network',
                'severity': 'low',
                'title': 'Slow DNS Resolution',
                'description': f'Found {len(dns_issues)} requests with slow DNS resolution (>1s)',
                'details': {
                    'slow_dns': dns_issues[:5]  # Show first 5
                }
            })
        
        if connection_issues:
            self.issues.append({
                'type': 'network',
                'severity': 'medium',
                'title': 'Slow Connection Establishment',
                'description': f'Found {len(connection_issues)} requests with slow connection establishment (>2s)',
                'details': {
                    'slow_connections': connection_issues[:5]  # Show first 5
                }
            })
    
    def _generate_statistics(self, entries: List[Dict[str, Any]]):
        """Generate overall statistics"""
        total_requests = len(entries)
        response_times = [entry.get('time', 0) for entry in entries]
        status_codes = [entry.get('response', {}).get('status', 0) for entry in entries]
        
        self.stats = {
            'total_requests': total_requests,
            'average_response_time': round(statistics.mean(response_times), 2) if response_times else 0,
            'max_response_time': max(response_times) if response_times else 0,
            'min_response_time': min(response_times) if response_times else 0,
            'successful_requests': len([s for s in status_codes if 200 <= s < 300]),
            'error_requests': len([s for s in status_codes if s >= 400]),
            'unique_domains': len(set(urlparse(entry.get('request', {}).get('url', '')).netloc for entry in entries))
        }

def load_har_file(file_path: str) -> Dict[str, Any]:
    """Load and parse HAR file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in HAR file: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading HAR file: {e}")
        sys.exit(1)

def print_issues(issues: List[Dict[str, Any]], stats: Dict[str, Any]):
    """Print analysis results in a formatted way"""
    print("=" * 80)
    print("HAR FILE ANALYSIS REPORT")
    print("=" * 80)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Print statistics
    print("📊 OVERALL STATISTICS")
    print("-" * 40)
    print(f"Total Requests: {stats['total_requests']}")
    print(f"Successful Requests (2xx): {stats['successful_requests']}")
    print(f"Error Requests (4xx/5xx): {stats['error_requests']}")
    print(f"Average Response Time: {stats['average_response_time']}ms")
    print(f"Max Response Time: {stats['max_response_time']}ms")
    print(f"Unique Domains: {stats['unique_domains']}")
    print()
    
    if not issues:
        print("✅ No issues detected!")
        return
    
    # Group issues by severity
    severity_order = ['high', 'medium', 'low']
    severity_colors = {
        'high': '🔴',
        'medium': '🟡', 
        'low': '🟢'
    }
    
    for severity in severity_order:
        severity_issues = [issue for issue in issues if issue['severity'] == severity]
        if severity_issues:
            print(f"{severity_colors[severity]} {severity.upper()} SEVERITY ISSUES")
            print("-" * 40)
            
            for i, issue in enumerate(severity_issues, 1):
                print(f"{i}. {issue['title']}")
                print(f"   Type: {issue['type'].title()}")
                print(f"   Description: {issue['description']}")
                
                if 'details' in issue and issue['details']:
                    if isinstance(issue['details'], dict):
                        for key, value in issue['details'].items():
                            if isinstance(value, list) and len(value) > 0:
                                print(f"   {key.title()}: {len(value)} items")
                                for item in value[:3]:  # Show first 3 items
                                    if isinstance(item, dict):
                                        if 'url' in item:
                                            print(f"     - {item['url']}")
                                        elif 'description' in item:
                                            print(f"     - {item['description']}")
                                    else:
                                        print(f"     - {item}")
                            else:
                                print(f"   {key.title()}: {value}")
                    else:
                        print(f"   Details: {issue['details']}")
                print()

def main():
    parser = argparse.ArgumentParser(
        description='Analyze HAR files for potential issues',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python har_analyzer.py network_log.har
  python har_analyzer.py -o report.json network_log.har
  python har_analyzer.py -v network_log.har
        """
    )
    
    parser.add_argument('har_file', help='Path to the HAR file to analyze')
    parser.add_argument('-o', '--output', help='Output results to JSON file')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    # Load HAR file
    har_data = load_har_file(args.har_file)
    
    # Analyze
    analyzer = HARAnalyzer(har_data)
    issues = analyzer.analyze()
    
    # Print results
    print_issues(issues, analyzer.stats)
    
    # Save to file if requested
    if args.output:
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'har_file': args.har_file,
            'statistics': analyzer.stats,
            'issues': issues
        }
        
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"📄 Results saved to: {args.output}")
        except Exception as e:
            print(f"Error saving results: {e}")

if __name__ == '__main__':
    main() 