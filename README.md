# SupportAI

A modern Next.js application with AI-powered support tools, featuring a beautiful Caffeine theme and repair report functionality.

## 🌟 Features

- **Modern UI**: Built with Next.js 15 and styled with Tailwind CSS
- **Dark Theme**: Elegant dark mode with theme toggle
- **Repair Report Tool**: Upload XML files, automatically repair them, and download the fixed version
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **GitHub Pages**: Automatically deployed to GitHub Pages

## 🚀 Live Demo

Visit the live site: [https://michelesbriglio.github.io/supportAI/](https://michelesbriglio.github.io/supportAI/)

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with Caffeine theme
- **UI Components**: shadcn/ui components
- **Theme**: next-themes for dark/light mode
- **Backend**: Python script for XML processing
- **Deployment**: GitHub Pages with GitHub Actions

## 📁 Project Structure

```
support-ai/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   └── lib/                 # Utility functions
├── tools/                   # Python scripts
├── public/                  # Static assets
└── .github/workflows/       # GitHub Actions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/michelesbriglio/supportAI.git
cd supportAI/support-ai
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 📝 Usage

### Repair Report Tool

1. Click on the "Repair Report" card
2. Upload an XML file using the file input
3. The system will automatically process the file using the Python script
4. View the repair results (duplicates removed, unused prompts)
5. Download the repaired file if issues were found

## 🎨 Customization

The app uses the Caffeine theme with customizable components. You can modify:
- Colors in `tailwind.config.js`
- Components in `src/components/ui/`
- Layout in `src/app/layout.tsx`

## 📦 Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. Every push to the main branch triggers a new deployment.

## 👨‍💻 Created by

**Michele Sbriglio**

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
