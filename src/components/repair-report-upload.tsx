"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download, Wrench, AlertCircle } from "lucide-react"
import { RepairResults } from "@/components/repair-results"
import { repairReportSmart } from "@/lib/repair-dispatch"

interface RepairResultsData {
  duplicates: number;
  prompts: number;
  nullCandidates: number;
  hasDuplicates: boolean;
  hasPrompts: boolean;
  hasNullCandidates: boolean;
  totalObjects: number;
}





export function RepairReportUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [repairedFile, setRepairedFile] = useState<string | null>(null)
  const [repairResults, setRepairResults] = useState<RepairResultsData | null>(null)
  const [analysisOutput, setAnalysisOutput] = useState<string>("")
  const [repairedFileName, setRepairedFileName] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && (selectedFile.type === "text/xml" || selectedFile.type === "application/json" || selectedFile.name.endsWith('.xml') || selectedFile.name.endsWith('.json'))) {
      setFile(selectedFile)
      setFileName(selectedFile.name)
      setIsCompleted(false)
      setError("")
      setRepairedFile(null)
      setRepairResults(null)
      setAnalysisOutput("")
    } else if (selectedFile) {
      setError("Please select a valid XML or JSON file")
    }
  }

  const handleRepair = async () => {
    if (!file) return
    setIsProcessing(true)
    setError("")
    
    try {
      // Use smart dispatcher (server-side on Vercel, client-side elsewhere)
      const data = await repairReportSmart(file)
      
      setRepairedFile(data.file)
      setRepairResults(data.results)
      setAnalysisOutput(data.analysis || "")
      setRepairedFileName(data.filename || "")
      setIsCompleted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsCompleted(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!repairedFile || !repairedFileName) return
    const binaryString = atob(repairedFile)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = repairedFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsCompleted(false)
    setRepairedFile(null)
    setRepairResults(null)
    setAnalysisOutput("")
    setRepairedFileName("")
    setFile(null)
    setFileName("")
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <div className="space-y-2">
        <Label htmlFor="xml-file" className="text-sm font-medium">
          Upload XML or JSON File
        </Label>
        <div className="flex items-center space-x-2">
          <Input
            ref={fileInputRef}
            id="xml-file"
            type="file"
            accept=".xml,.json"
            onChange={handleFileChange}
            className="flex-1"
          />
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
        {fileName && (
          <p className="text-xs text-muted-foreground">
            Selected: {fileName}
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Repair Button */}
      {file && !isProcessing && !isCompleted && (
        <Button 
          onClick={handleRepair}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <Wrench className="mr-2 h-4 w-4" />
          Repair VA Report
        </Button>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Analyzing and repairing XML file...</span>
        </div>
      )}

      {/* Repair Results */}
      {isCompleted && repairResults && (
        <RepairResults results={repairResults} />
      )}

      {/* Analysis Output */}
      {isCompleted && analysisOutput && (
        <div className="bg-muted/50 p-4 rounded-md">
          <h4 className="text-sm font-medium mb-2">Analysis Details:</h4>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
            {analysisOutput}
          </pre>
        </div>
      )}

      {/* Download Button - show if any issues were found and fixed */}
      {isCompleted && repairedFile && (repairResults?.hasDuplicates || repairResults?.hasPrompts || repairResults?.hasNullCandidates) && (
        <Button 
          onClick={handleDownload}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Repaired Report
        </Button>
      )}
    </div>
  )
} 