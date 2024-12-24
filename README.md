# GitHub Music API

A NestJS application that generates MP3 music from GitHub user contributions.  
It fetches a user's GitHub contribution data via the GraphQL API, converts that data into audio samples (using sine waves), and finally streams or returns MP3 files to the client.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Usage](#usage)
6. [API Endpoints](#api-endpoints)
7. [Project Structure](#project-structure)
8. [Known Issues](#known-issues)
---

## Overview

This project demonstrates how to create music based on a GitHub user's activity (commits, pull requests, etc.). It uses:

- **NestJS** as the main application framework
- **Axios** to call the GitHub GraphQL API
- **fluent-ffmpeg** (with **ffmpeg-static**) to convert WAV files into MP3
- **TypeScript** for type safety

When you request a GitHub username, the application:

1. Calls the GitHub GraphQL API to retrieve contribution data (daily commit counts).
2. Maps these counts to sine wave frequencies.
3. Renders audio samples in WAV format.
4. Converts the WAV to MP3 using FFmpeg.
5. Returns or streams the MP3 file in the response.

---

## Prerequisites

1. **Node.js** (version 16 or higher recommended).
2. **npm** or **yarn** as a package manager.
3. **FFmpeg** is **not** required separately—this project bundles **ffmpeg-static**, so it should work out of the box.
4. A valid **GitHub Token** with at least `read:user` or basic scope to access public contribution data.

---

## Installation

1. **Clone** the repository:
   ```bash
   git clone https://github.com/oguzhan18/github-music-api.git
   cd github-music-api
    ```
2. **Install** dependencies:
   ```bash
    npm install
    # or
    yarn install
   ```
3. **Build** the project:
   ```bash
    npm run build
    # or
    yarn build
    ```
4. **Run** the project:
    ```bash
    npm run start
    # or
    yarn start
    ```
5. **For development** with auto-reload:
    ```bash
    npm run start:dev
    # or
    yarn start:dev
    ```
## Environment Variables
Create a file named `.env` (or set the variables in your environment) and add:
```makefile
GITHUB_TOKEN=your_personal_access_token
```
## Usage
1.**Run the server** (in production or development mode).
2.**Send a request** to one of the defined endpoints (e.g., ``GET /github/music?username=octocat``).

3.**The application will**:
 * Fetch the GitHub user's contribution data.
    * Generate a WAV file based on the contribution data.
    * Convert the WAV file to MP3.

---
## API Endpoints
All endpoints are under the ``/github`` route. For example: ``http://localhost:3000/github/music``.
1.  GET ``/github/music?username=USERNAME``
   * Required query param: username
   * Fetches all contributions for the user and returns an MP3 file
2. GET ``/github/music/custom?username=USERNAME&instrumentId=1&tempo=120&volume=0.5``
    * Required: username, instrumentId
    * Optional: tempo, volume
    * Fetches all contributions for the user and returns an MP3 file
3. GET ``/github/music/stream?username=USERNAME``
   * Returns a JSON list of all the years in which the user has contributions.
---
## Project Structure
```bash
├── src
│   ├── github
│   │   ├── github.controller.ts   # NestJS controller defining the routes
│   │   ├── github.service.ts      # Main service with logic for fetching data and generating music
│   │   └── ...
│   ├── app.module.ts              # Main application module
│   └── main.ts                    # Entry point (NestFactory)
├── temp                           # A directory created at runtime for WAV/MP3 files
├── .env                           # Environment variables file (not committed)
├── package.json
├── tsconfig.json
└── README.md                      # This document
```
---
## Known Issues
- **Audio quality** can be improved by using a higher sample rate (e.g., 44100 Hz).
- **Performance** can be improved by caching the generated MP3 files.
- **Error handling** can be improved by adding more checks and logging.
- **Security** can be improved by validating user input and using HTTPS.
- **Testing** is missing in this project. It's recommended to add unit and integration tests.
- **Documentation** can be improved by adding more comments and explanations.
- **Code quality** can be improved by following best practices and design patterns.


