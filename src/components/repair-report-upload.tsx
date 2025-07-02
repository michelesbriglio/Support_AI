"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download, Wrench, CheckCircle, AlertCircle } from "lucide-react"
import { RepairResults } from "@/components/repair-results"

interface RepairResultsData {
  duplicates: number;
  prompts: number;
  hasDuplicates: boolean;
  hasPrompts: boolean;
}

export function RepairReportUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [repairedFile, setRepairedFile] = useState<string | null>(null)
  const [repairResults, setRepairResults] = useState<RepairResultsData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === "text/xml") {
      setFile(selectedFile)
      setFileName(selectedFile.name)
      setIsCompleted(false)
      setError("")
      setRepairedFile(null)
      setRepairResults(null)
    } else if (selectedFile) {
      setError("Please select a valid XML file")
    }
  }

  const handleRepair = async () => {
    if (!file) return

    setIsProcessing(true)
    setError("")
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/repair-report', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to repair report')
      }

      const data = await response.json()
      setRepairedFile(data.file)
      setRepairResults(data.results)
      setIsCompleted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsCompleted(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!repairedFile || !fileName) return

    const blob = new Blob([Buffer.from(repairedFile, 'base64')], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `repaired_${fileName}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Reset everything after download - hide both buttons and clear file input
    setIsCompleted(false)
    setRepairedFile(null)
    setRepairResults(null)
    setFile(null)
    setFileName("")
    setError("")
    
    // Reset the file input element so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <div className="space-y-2">
        <Label htmlFor="xml-file" className="text-sm font-medium">
          Upload XML File
        </Label>
        <div className="flex items-center space-x-2">
          <Input
            ref={fileInputRef}
            id="xml-file"
            type="file"
            accept=".xml"
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
          Repair Report
        </Button>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Processing XML file...</span>
        </div>
      )}

      {/* Repair Results */}
      {isCompleted && repairResults && (
        <RepairResults results={repairResults} />
      )}

      {/* Download Button - only show if issues were found and fixed */}
      {isCompleted && repairedFile && (repairResults?.hasDuplicates || repairResults?.hasPrompts) && (
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