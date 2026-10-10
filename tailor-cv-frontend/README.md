# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Environment variables

Copy `.env.example` to `.env`:
- `VITE_API_URL`: URL of the Flask gateway (default: `http://localhost:5000`).
- `VITE_NODE_API_URL`: URL of the Node API for Fact Bank (default: `http://localhost:5001`).

### RAG Test Panel (Development Only)

In development builds (`npm run dev`), a **RAG Test (dev)** panel appears at the top of the left section in the Workspace. It allows you to:
1. Build / Ingest the active document into the Fact Bank (with an optional Force toggle).
2. Inspect ingestion status, section chunk counts, and any warnings or errors.
3. Browse stored chunks by section (`header`, `education`, `experience`, `certification`, `skills`, `project`).
4. Perform similarity search across sections with custom query and `topK`.


## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
