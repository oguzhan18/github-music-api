# GitHub Music API

![Nest Logo](https://nestjs.com/img/logo-small.svg)

## Description

GitHub Music API is a progressive Node.js framework built with NestJS that transforms GitHub commit history into music. This project allows users to generate music based on their contributions on GitHub, providing a unique way to visualize coding activity through sound.

## Features

- Generate music from GitHub contributions.
- Support for different instruments.
- Customizable tempo and volume settings.
- Stream music directly in the browser.
- Generate music for specific years of contributions.

## Installation

To get started with the GitHub Music API, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/github-music-api.git
   cd github-music-api
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables. Create a `.env` file in the root directory and add your GitHub token:
   ```plaintext
   GITHUB_TOKEN=your_github_token
   ```

## Running the App

To run the application, use the following commands:

- For development mode:
  ```bash
  npm run start:dev
  ```

- For production mode:
  ```bash
  npm run start:prod
  ```

## API Endpoints

### Generate Music

- **Endpoint:** `GET /github/music`
- **Query Parameters:**
  - `username`: GitHub username (required)
- **Response:** Returns an MP3 file generated from the user's contributions.

### Generate Custom Music

- **Endpoint:** `GET /github/music/custom`
- **Query Parameters:**
  - `username`: GitHub username (required)
  - `instrumentId`: Instrument ID (1: Piano, 2: Flute, 3: Guitar, 4: Violin, 5: Clarinet, 6: Drums, 7: Baglama, 8: Violin Vibrato) (required)
  - `tempo`: Tempo in BPM (optional, default: 120)
  - `volume`: Volume level (0.0 - 1.0) (optional, default: 0.5)
- **Response:** Returns an MP3 file generated with custom settings.

### Stream Music

- **Endpoint:** `GET /github/music/stream`
- **Query Parameters:**
  - `username`: GitHub username (required)
- **Response:** Streams the generated MP3 file directly in the browser.

### Generate Music by Year

- **Endpoint:** `GET /github/music/year`
- **Query Parameters:**
  - `username`: GitHub username (required)
  - `year`: Selected year (optional)
- **Response:** Returns an HTML page with the music generated for the selected year.

### Get User Years

- **Endpoint:** `GET /github/years`
- **Query Parameters:**
  - `username`: GitHub username (required)
- **Response:** Returns a JSON object with the years the user has contributions.

## Support

This project is open-source and licensed under the MIT License. Contributions are welcome! If you would like to support the project, please consider becoming a backer or sponsor.

## Stay in Touch

- **Author:** [Kamil Myśliwiec](https://kamilmysliwiec.com)
- **Website:** [nestjs.com](https://nestjs.com/)
- **Twitter:** [@nestframework](https://twitter.com/nestframework)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
