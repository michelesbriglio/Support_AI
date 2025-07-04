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
  nullCandidates: number;
  hasDuplicates: boolean;
  hasPrompts: boolean;
  hasNullCandidates: boolean;
  totalObjects: number;
}

// Helper to convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBufferLike) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// --- XML Repair Logic Ported from Python ---
function fixXmlReport(xmlText: string): { xml: string, results: RepairResultsData } {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");
  let duplicates = 0;
  let prompts = 0;
  let hasDuplicates = false;
  let hasPrompts = false;

  // Helper: collect all ids used as name attributes and referenced elsewhere
  function collectIds(root: Element) {
    const idUsed: Record<string, Element[]> = {};
    const idReferenced = new Set<string>();
    const idDups = new Set<string>();
    // Pass 1: collect all ids used as name attributes
    for (const el of Array.from(root.getElementsByTagName('*'))) {
      const name = el.getAttribute('name');
      if (name) {
        if (!idUsed[name]) idUsed[name] = [];
        idUsed[name].push(el);
        if (idUsed[name].length > 1) idDups.add(name);
      }
    }
    // Pass 2: collect all ids referenced outside name attributes
    for (const el of Array.from(root.getElementsByTagName('*'))) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name === 'name') continue;
        // Find all ids in attribute value
        const matches = attr.value.match(/[a-z]+\d+/g);
        if (matches) matches.forEach(m => idReferenced.add(m));
      }
      if (el.textContent) {
        const matches = el.textContent.match(/[a-z]+\d+/g);
        if (matches) matches.forEach(m => idReferenced.add(m));
      }
    }
    return { idUsed, idReferenced, idDups };
  }

  // Fix duplicates
  function fixDuplicates(root: Element): number {
    const { idUsed, idDups } = collectIds(root);
    if (idDups.size === 0) return 0;
    // Get nextUniqueNameIndex from root
    let nextUnique = parseInt(root.getAttribute('nextUniqueNameIndex') || '0', 10);
    let changed = 0;
    for (const dupName of Array.from(idDups)) {
      const elements = idUsed[dupName];
      for (let i = 1; i < elements.length; i++) {
        const el = elements[i];
        const prefixMatch = dupName.match(/^[a-z]+/);
        if (!prefixMatch) continue;
        const prefix = prefixMatch[0];
        const newName = `${prefix}${nextUnique}`;
        nextUnique++;
        // Update name attribute
        el.setAttribute('name', newName);
        // Update all references in attributes and text
        for (const el2 of Array.from(root.getElementsByTagName('*'))) {
          for (const attr of Array.from(el2.attributes)) {
            if (attr.value.includes(dupName)) {
              el2.setAttribute(attr.name, attr.value.replace(new RegExp(dupName, 'g'), newName));
            }
          }
          if (el2.textContent && el2.textContent.includes(dupName)) {
            el2.textContent = el2.textContent.replace(new RegExp(dupName, 'g'), newName);
          }
        }
        changed++;
      }
    }
    if (changed) root.setAttribute('nextUniqueNameIndex', String(nextUnique));
    return changed;
  }

  // Remove unused prompts
  function removeUnusedPrompts(root: Element): number {
    const { idUsed, idReferenced } = collectIds(root);
    const unusedPrompts = Object.keys(idUsed).filter(
      pid => pid.startsWith('pr') && !idReferenced.has(pid)
    );
    if (unusedPrompts.length === 0) return 0;
    let removed = 0;
    for (const pid of unusedPrompts) {
      for (const el of idUsed[pid]) {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
          removed++;
        }
      }
    }
    return removed;
  }

  // Run repairs
  duplicates = fixDuplicates(xmlDoc.documentElement);
  hasDuplicates = duplicates > 0;
  prompts = removeUnusedPrompts(xmlDoc.documentElement);
  hasPrompts = prompts > 0;

  // Serialize back to string
  const xml = serializer.serializeToString(xmlDoc);
  return {
    xml,
    results: { duplicates, prompts, hasDuplicates, hasPrompts }
  };
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
      setAnalysisOutput("")
    } else if (selectedFile) {
      setError("Please select a valid XML file")
    }
  }

  const handleRepair = async () => {
    if (!file) return
    setIsProcessing(true)
    setError("")
    
    try {
      // Create FormData to send file to API
      const formData = new FormData()
      formData.append('file', file)

      // Call the API endpoint
      const response = await fetch('/api/repair-report', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to repair file')
      }

      const data = await response.json()
      
      setRepairedFile(data.file)
      setRepairResults(data.results)
      setAnalysisOutput(data.analysis || "")
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
    setAnalysisOutput("")
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
          Repair Report (Enhanced)
        </Button>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Processing XML file with enhanced repair tool...</span>
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