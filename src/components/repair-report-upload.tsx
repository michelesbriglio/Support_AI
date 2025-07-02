"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download, Wrench, AlertCircle } from "lucide-react"
import { RepairResults } from "@/components/repair-results"

interface RepairResultsData {
  duplicates: number;
  prompts: number;
  hasDuplicates: boolean;
  hasPrompts: boolean;
}

// Helper to convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

  // Placeholder repair logic: just return the file as-is
  const handleRepair = async () => {
    if (!file) return
    setIsProcessing(true)
    setError("")
    try {
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      // Use safe base64 conversion
      const base64 = arrayBufferToBase64(arrayBuffer)
      setRepairedFile(base64)
      setRepairResults({
        duplicates: 0,
        prompts: 0,
        hasDuplicates: false,
        hasPrompts: false
      })
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
    a.download = `repaired_${fileName}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsCompleted(false)
    setRepairedFile(null)
    setRepairResults(null)
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