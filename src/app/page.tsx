import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Zap, Heart, Star } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { RepairReportUpload } from "@/components/repair-report-upload";
import Link from 'next/link';

export default function Home() {
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
          {/* Card 1 - Repair Report */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-primary/20 hover:border-primary/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Repair Report</CardTitle>
              <CardDescription>
                This Tool repairs the VA Reports that contain duplicates Items or unused Prompts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RepairReportUpload />
            </CardContent>
          </Card>

          {/* Card 2 - 24/7 Support */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-secondary/20 hover:border-secondary/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                <Heart className="h-6 w-6 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">24/7 Support</CardTitle>
              <CardDescription>
                Round-the-clock assistance whenever you need it, no matter the time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">Always On</Badge>
                  <Badge variant="outline" className="text-xs">Reliable</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Never wait for business hours again. Get help instantly, day or night.
                </p>
                <Button variant="ghost" size="sm" className="w-full mt-4">
                  Try Now →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 - Personalized Experience */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-accent/20 hover:border-accent/40">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Star className="h-6 w-6 text-accent-foreground" />
              </div>
              <CardTitle className="text-xl">Personalized</CardTitle>
              <CardDescription>
                Tailored responses and recommendations based on your preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="default" className="text-xs">Custom</Badge>
                  <Badge variant="default" className="text-xs">Adaptive</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Learns from your interactions to provide increasingly relevant assistance.
                </p>
                <Button variant="ghost" size="sm" className="w-full mt-4">
                  Explore →
                </Button>
              </div>
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
              SupportAI is built with the latest artificial intelligence technology to provide 
              intelligent, responsive, and personalized support solutions. Our platform combines 
              natural language processing, machine learning, and human-centered design to create 
              an experience that feels both powerful and approachable.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-muted-foreground">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                <div className="text-muted-foreground">Availability</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">10k+</div>
                <div className="text-muted-foreground">Happy Users</div>
              </div>
            </div>
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
              href="mailto:michele.sbriglio@sas.com?subject=SupportAI%20Feedback"
              style={{ textDecoration: 'none' }}
            >
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <Coffee className="mr-2 h-4 w-4" />
                Feedback (Email App)
              </Button>
            </a>
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
            <Button size="lg" variant="outline">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Coffee className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">SupportAI</span>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2024 SupportAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
