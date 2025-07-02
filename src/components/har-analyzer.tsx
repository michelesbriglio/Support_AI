"use client"

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle, Clock, Shield, Wifi, Activity } from "lucide-react";

interface HAREntry {
  request: {
    url: string;
    method: string;
  };
  response: {
    status: number;
    bodySize: number;
    headers: Array<{ name: string; value: string }>;
  };
  time: number;
  timings: {
    dns: number;
    connect: number;
  };
}

interface HARData {
  log: {
    entries: HAREntry[];
  };
}

interface AnalysisIssue {
  type: 'error' | 'performance' | 'security' | 'resource' | 'network';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  details: Record<string, unknown>;
}

interface AnalysisStats {
  total_requests: number;
  average_response_time: number;
  max_response_time: number;
  min_response_time: number;
  successful_requests: number;
  error_requests: number;
  unique_domains: number;
}

interface AnalysisResult {
  issues: AnalysisIssue[];
  stats: AnalysisStats;
}

export function HARAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeHARFile = (harData: HARData): AnalysisResult => {
    const issues: AnalysisIssue[] = [];
    const entries = harData.log?.entries || [];

    if (!entries.length) {
      issues.push({
        type: 'error',
        severity: 'medium',
        title: 'Empty HAR file',
        description: 'No HTTP requests found in the HAR file',
                 details: { message: 'The HAR file contains no entries to analyze' }
      });
      return { issues, stats: getEmptyStats() };
    }

    // Analyze HTTP errors
    const errorEntries = entries.filter(entry => {
      const status = entry.response?.status || 0;
      return status >= 400;
    });

    if (errorEntries.length > 0) {
      const statusGroups: { [key: number]: HAREntry[] } = {};
      errorEntries.forEach(entry => {
        const status = entry.response?.status || 0;
        if (!statusGroups[status]) statusGroups[status] = [];
        statusGroups[status].push(entry);
      });

      Object.entries(statusGroups).forEach(([status, entriesList]) => {
        issues.push({
          type: 'error',
          severity: parseInt(status) >= 500 ? 'high' : 'medium',
          title: `HTTP ${status} Errors Detected`,
          description: `Found ${entriesList.length} requests returning HTTP ${status} status`,
          details: {
            count: entriesList.length,
            methods: [...new Set(entriesList.map(e => e.request.method))]
          }
        });
      });
    }

    // Calculate response time statistics for overall stats
    const responseTimes = entries.map(entry => entry.time || 0);
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);

    // Analyze security issues
    const securityIssues: Array<{ type: string; url: string; description: string }> = [];
    entries.forEach(entry => {
      const url = entry.request.url;
      if (url.startsWith('http://') && !url.startsWith('https://')) {
        securityIssues.push({
          type: 'insecure_protocol',
          url: url,
          description: 'HTTP request detected (should use HTTPS)'
        });
      }

      const headers = entry.response?.headers || [];
      const headerNames = headers.map(h => h.name.toLowerCase());
      
      if (!headerNames.includes('content-security-policy')) {
        securityIssues.push({
          type: 'missing_security_header',
          url: url,
          description: 'Missing Content-Security-Policy header'
        });
      }
    });

    if (securityIssues.length > 0) {
      const insecureProtocols = securityIssues.filter(issue => issue.type === 'insecure_protocol');
      if (insecureProtocols.length > 0) {
        issues.push({
          type: 'security',
          severity: 'high',
          title: 'Insecure HTTP Requests Detected',
          description: `Found ${insecureProtocols.length} HTTP requests (should use HTTPS)`,
          details: {
            count: insecureProtocols.length
          }
        });
      }
    }

    // Generate statistics
    const statusCodes = entries.map(entry => entry.response?.status || 0);
    const uniqueDomains = new Set(entries.map(entry => {
      try {
        return new URL(entry.request.url).hostname;
      } catch {
        return 'unknown';
      }
    }));

         const stats: AnalysisStats = {
       total_requests: entries.length,
       average_response_time: Math.round((avgTime / 1000) * 100) / 100,
       max_response_time: Math.round((maxTime / 1000) * 100) / 100,
       min_response_time: Math.round((Math.min(...responseTimes) / 1000) * 100) / 100,
       successful_requests: statusCodes.filter(s => s >= 200 && s < 300).length,
       error_requests: statusCodes.filter(s => s >= 400).length,
       unique_domains: uniqueDomains.size
     };

    return { issues, stats };
  };

  const getEmptyStats = (): AnalysisStats => ({
    total_requests: 0,
    average_response_time: 0,
    max_response_time: 0,
    min_response_time: 0,
    successful_requests: 0,
    error_requests: 0,
    unique_domains: 0
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.har')) {
      setError('Please select a valid .har file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const text = await file.text();
      const harData: HARData = JSON.parse(text);
      
      const result = analyzeHARFile(harData);
      setAnalysisResult(result);
    } catch {
      setError('Failed to parse HAR file. Please ensure it\'s a valid JSON file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'performance': return <Activity className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'network': return <Wifi className="h-4 w-4" />;
      case 'resource': return <FileText className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload HAR File
          </CardTitle>
          <CardDescription>
            Select a .har file to analyze for HTTP errors, performance issues, security vulnerabilities, and network problems.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".har"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose HAR File
                </>
              )}
            </Button>
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Analysis Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
                             <div className="grid grid-cols-3 gap-4">
                 <div className="text-center">
                   <div className="text-2xl font-bold text-primary break-words">{analysisResult.stats.total_requests}</div>
                   <div className="text-sm text-muted-foreground break-words">Total Requests</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-green-600 break-words">{analysisResult.stats.successful_requests}</div>
                   <div className="text-sm text-muted-foreground break-words">Successful</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-red-600 break-words">{analysisResult.stats.error_requests}</div>
                   <div className="text-sm text-muted-foreground break-words">Errors</div>
                 </div>
               </div>
               <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="text-center">
                   <div className="text-lg font-semibold break-words">{analysisResult.stats.average_response_time}s</div>
                   <div className="text-sm text-muted-foreground break-words">Avg Response Time</div>
                 </div>
                 <div className="text-center">
                   <div className="text-lg font-semibold break-words">{analysisResult.stats.max_response_time}s</div>
                   <div className="text-sm text-muted-foreground break-words">Max Response Time</div>
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {analysisResult.issues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Issues Found ({analysisResult.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                                     {analysisResult.issues.map((issue, index) => (
                     <div key={index} className="border rounded-lg p-4">
                       <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                         <div className="flex items-center gap-2 min-w-0">
                           {getTypeIcon(issue.type)}
                           <h4 className="font-semibold break-words">{issue.title}</h4>
                         </div>
                         <Badge className={`${getSeverityColor(issue.severity)} shrink-0`}>
                           {issue.severity}
                         </Badge>
                       </div>
                       <p className="text-sm text-muted-foreground mb-3 break-words">{issue.description}</p>
                      
                      {issue.details && typeof issue.details === 'object' && (
                                                 <div className="space-y-2">
                           {Object.entries(issue.details).map(([key, value]) => (
                             <div key={key} className="break-words">
                               <div className="text-sm font-medium text-foreground capitalize break-words">{key}:</div>
                                                             {Array.isArray(value) ? (
                                 <div className="text-sm text-muted-foreground ml-2">
                                   {value.slice(0, 3).map((item, i) => (
                                     <div key={i} className="break-all">
                                       {typeof item === 'object' && item.url ? item.url : String(item)}
                                     </div>
                                   ))}
                                   {value.length > 3 && (
                                     <div className="text-xs text-muted-foreground">
                                       ... and {value.length - 3} more
                                     </div>
                                   )}
                                 </div>
                               ) : (
                                 <div className="text-sm text-muted-foreground ml-2 break-words">{String(value)}</div>
                               )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Issues Found!</h3>
                  <p className="text-muted-foreground">Your HAR file looks good with no detected problems.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
} 