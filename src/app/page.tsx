"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Zap, Star, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { RepairReportUpload } from "@/components/repair-report-upload";
import { SituationAppraisal } from "@/components/situation-appraisal";
import { HARAnalyzer } from "@/components/har-analyzer";
import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <Coffee className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">SupportAI</h1>
            </Link>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex space-x-6">
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
                <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
                <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <h2 className="text-4xl md:text-6xl font-bold text-foreground">
            Welcome to <span className="text-primary">SupportAI</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your intelligent companion for seamless support and assistance.
            <br />
            Created by Michele Sbriglio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              <Zap className="mr-2 h-4 w-4" />
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-foreground mb-4">Key Features</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover what makes SupportAI the perfect solution for your needs
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 - Repair VA Report */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-primary/20 hover:border-primary/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Repair VA Report</CardTitle>
              <CardDescription>
                Tool that repairs VA Reports containing null candidates, duplicate items, unused prompts, and corrupted structure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RepairReportUpload />
            </CardContent>
          </Card>

          {/* Card 2 - HAR File Analyzer */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-primary/20 hover:border-primary/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">.HAR File Analyzer</CardTitle>
              <CardDescription>
                Analyze HTTP Archive files to detect errors, performance issues, and security vulnerabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HARAnalyzer />
            </CardContent>
          </Card>

          {/* Card 3 - Personalized Experience */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-accent/20 hover:border-accent/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Star className="h-6 w-6 text-accent-foreground" />
              </div>
              <CardTitle className="text-xl">Problem Analysis</CardTitle>
              <CardDescription>
                Analyze customer issues using structured and analytical thinking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SituationAppraisal />
            </CardContent>
          </Card>

          {/* Card 4 - Seamless Integration */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-muted/20 hover:border-muted/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-muted/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-muted/20 transition-colors">
                <Coffee className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">Easy Integration</CardTitle>
              <CardDescription>
                Simple setup and seamless integration with your existing workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">Simple</Badge>
                  <Badge variant="secondary" className="text-xs">Fast</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get up and running in minutes with our intuitive setup process.
                </p>
                <Button variant="ghost" size="sm" className="w-full mt-4">
                  Setup Guide →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h3 className="text-3xl font-bold text-foreground">About SupportAI</h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              This website offers a collection of tools designed to support users of SAS® Visual Analytics. Whether you&apos;re diagnosing a problem, exploring system behavior, or seeking ways to improve efficiency, these resources provide practical support to enhance your SAS® Visual Analytics experience.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Please note: This site is independently developed and is not affiliated with or endorsed by SAS® Institute Inc.
            </p>

          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <h3 className="text-3xl font-bold text-foreground">Get in Touch</h3>
          <p className="text-muted-foreground">
            For questions, bug reports, or issues related to the tools on this site, please contact michele.sbriglio@sas.com
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://outlook.office.com/mail/deeplink/compose?to=michele.sbriglio@sas.com&subject=SupportAI%20Feedback"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <Coffee className="mr-2 h-4 w-4" />
                Feedback (Outlook Web)
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Coffee className="h-6 w-6 text-primary" />
                <span className="font-semibold text-foreground">SupportAI</span>
              </Link>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <button 
                onClick={() => setShowTerms(true)}
                className="hover:text-foreground transition-colors"
              >
                Terms
              </button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 SupportAI. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-foreground">Terms</h3>
              <button 
                onClick={() => setShowTerms(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-muted-foreground space-y-4">
              <p>
                This website is not affiliated with or officially supported by SAS Institute Inc. All content provided here is for informational purposes only and is created independently.
              </p>
              <p>
                SAS® and related trademarks are the property of SAS Institute Inc. Any references to SAS are for descriptive purposes only.
              </p>
              <p>
                SAS Institute Inc. does not endorse, sponsor, or assume any responsibility for the content, functionality, or use of this website.
              </p>
              <p>
                If you have any questions or concerns, please contact michele.sbriglio@sas.com
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
