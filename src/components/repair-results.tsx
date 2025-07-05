"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Bug } from "lucide-react";

interface RepairResultsProps {
  results: {
    duplicates: number;
    prompts: number;
    nullCandidates: number;
    hasDuplicates: boolean;
    hasPrompts: boolean;
    hasNullCandidates: boolean;
    totalObjects: number;
  };
  debug?: string[];
}

export function RepairResults({ results, debug }: RepairResultsProps) {
  const hasIssues = results.hasDuplicates || results.hasPrompts || results.hasNullCandidates;

  return (
    <div className="space-y-4">
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/20 dark:border-green-800">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-800 dark:text-green-200">
              Repair Results
            </CardTitle>
          </div>
          <CardDescription className="text-green-700 dark:text-green-300">
            {hasIssues ? "Analysis completed successfully" : "No issues found"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total Objects Summary */}
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Analyzed {results.totalObjects} total objects
            </span>
          </div>

          {/* Null Candidates Section */}
          <div className="flex items-center space-x-3">
            {results.hasNullCandidates ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm text-green-800 dark:text-green-200">
              {results.hasNullCandidates 
                ? `Removed ${results.nullCandidates} null candidate references`
                : "No null candidates detected"
              }
            </span>
          </div>

          {/* Duplicates Section */}
          <div className="flex items-center space-x-3">
            {results.hasDuplicates ? (
              <AlertCircle className="h-4 w-4 text-orange-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm text-green-800 dark:text-green-200">
              {results.hasDuplicates 
                ? `Fixed ${results.duplicates} duplicate elements`
                : "No duplicated names detected"
              }
            </span>
          </div>

          {/* Prompts Section */}
          <div className="flex items-center space-x-3">
            {results.hasPrompts ? (
              <AlertCircle className="h-4 w-4 text-orange-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm text-green-800 dark:text-green-200">
              {results.hasPrompts 
                ? `Removed ${results.prompts} unused prompt definitions`
                : "No unused prompts found"
              }
            </span>
          </div>

          {/* Summary - only show if there were issues */}
          {hasIssues && (
            <div className="pt-2 border-t border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400">
                Your XML file has been successfully processed and cleaned using the repair tool.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Information */}
      {debug && debug.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/20 dark:border-orange-800">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Bug className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg text-orange-800 dark:text-orange-200">
                Debug Information
              </CardTitle>
            </div>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              Backend processing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white dark:bg-gray-900 p-3 rounded border text-xs font-mono overflow-x-auto">
              {debug.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 