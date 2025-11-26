# Three Questions - Life Interview

A Next.js application that conducts a friendly interview using Claude AI and generates a newsletter-style summary.

## Features

- Interactive chat interface with Claude AI
- Automatic interview flow with three main questions
- Real-time typing detection with 5-second debounce
- Newsletter article generation at the end
- Copy to clipboard functionality
- Responsive design with Tailwind CSS

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`
   - Add your Anthropic API key:
     ```
     ANTHROPIC_API_KEY=your_api_key_here
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. **Push your code to GitHub** (or your preferred Git provider)

2. **Import your repository to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository

3. **Add environment variable:**
   - In your Vercel project settings, go to "Environment Variables"
   - Add `ANTHROPIC_API_KEY` with your API key value
   - Make sure to add it for all environments (Production, Preview, Development)

4. **Deploy:**
   - Vercel will automatically deploy your project
   - Your app will be live at `your-project.vercel.app`

## Project Structure

```
├── app/
│   ├── api/
│   │   └── claude/
│   │       └── route.js      # API route for Claude API calls
│   ├── globals.css           # Global styles with Tailwind
│   ├── layout.js             # Root layout component
│   └── page.js               # Main page component
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore file
├── jsconfig.json             # JavaScript configuration
├── next.config.js            # Next.js configuration
├── package.json              # Dependencies and scripts
├── postcss.config.js         # PostCSS configuration
└── tailwind.config.js        # Tailwind CSS configuration
```

## Technologies Used

- **Next.js 14** - React framework
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Anthropic Claude API** - AI interview assistant

## Notes

- The API key is kept secure on the server side via Next.js API routes
- The interview automatically starts when the page loads
- Type "GENERATE_SUMMARY" to manually end the interview early
- The AI responds 5 seconds after you stop typing

