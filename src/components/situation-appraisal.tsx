"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Brain, AlertCircle } from "lucide-react"

export function SituationAppraisal() {
  const [customerIssue, setCustomerIssue] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState("")

  const analyzeIssue = async () => {
    if (!customerIssue.trim()) {
      setError("Please enter a customer issue to analyze")
      return
    }

    setIsAnalyzing(true)
    setError("")

    try {
      // Placeholder for future implementation
      console.log('Analyzing issue:', customerIssue)
      // TODO: Implement problem analysis logic
    } catch (err) {
      console.error('Analysis error:', err)
      setError("Analysis feature coming soon.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClear = () => {
    setCustomerIssue("")
    setError("")
  }

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Customer Issue Description
        </label>
        <Textarea
          placeholder="Paste the customer's question or issue description here..."
          value={customerIssue}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomerIssue(e.target.value)}
          className="min-h-[120px]"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={analyzeIssue}
          disabled={isAnalyzing || !customerIssue.trim()}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Problem Analysis
            </>
          )}
        </Button>
        <Button 
          onClick={handleClear}
          variant="outline"
          disabled={isAnalyzing}
        >
          Clear
        </Button>
      </div>


    </div>
  )
} 