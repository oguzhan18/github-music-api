import { Injectable } from '@nestjs/common';
import e, { Response } from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';

@Injectable()
export class GithubService {
  private token = process.env.GITHUB_TOKEN;

  /**
   * Generates music for all contributions (any year) and sends the resulting MP3 file in the HTTP response.
   *
   * @param username - GitHub username
   * @param res - Express response object
   * @param isStream - Whether the MP3 should be streamed (`true`) or sent as an attachment (`false`)
   * @returns A promise that resolves once the MP3 has been sent or rejects if any errors occur
   */
  async generateAndSendMusic(
    username: string,
    res: Response,
    isStream: boolean,
  ): Promise<e.Response<any, Record<string, any>>> {
    const contributionDays = await this.fetchContributionDays(username);

    if (!contributionDays) {
      return res
        .status(404)
        .send("User's contribution data could not be found.");
    }

    // Convert contributions to WAV samples, then produce an MP3
    const samples = this.createSamplesFromContributions(contributionDays);
    const wavData = this.createWavData(samples);
    const tempDir = this.createTempDirectory();
    const wavPath = path.join(tempDir, `${username}.wav`);
    const mp3Path = path.join(tempDir, `${username}.mp3`);

    fs.writeFileSync(wavPath, wavData);

    // Convert WAV to MP3 and pipe to response
    await this.convertWavToMp3(wavPath, mp3Path, res, isStream);
  }

  /**
   * Generates music using custom parameters (instrumentId, tempo, volume), then sends the MP3 in the HTTP response.
   * Currently reuses the same `generateAndSendMusic` logic for simplicity.
   *
   * @param username - GitHub username
   * @param instrumentId - Numeric ID for the instrument (e.g., 1 = Piano, 2 = Flute, etc.)
   * @param tempo - Tempo in BPM (default: 120)
   * @param volume - Volume level from 0.0 to 1.0 (default: 0.5)
   * @param res - Express response object
   * @returns A promise that resolves once the MP3 has been sent or rejects if any errors occur
   */
  async generateCustomMusic(
    username: string,
    instrumentId: number,
    tempo = 120,
    volume = 0.5,
    res: Response,
  ): Promise<void> {
    // Example: Could apply custom logic based on instrumentId, tempo, volume
    // For simplicity, just reuse the same function:
    await this.generateAndSendMusic(username, res, false);
  }

  /**
   * Generates year-based music, embeds it as a Base64 MP3 in an HTML page, and sends the HTML response.
   *
   * @param username - GitHub username
   * @param year - Optional year to filter contributions (e.g. "2023")
   * @param res - Express response object
   * @returns A promise that resolves once the HTML is sent
   */
  async generateMusicByYear(
    username: string,
    year: string,
    res: Response,
  ): Promise<e.Response<any, Record<string, any>>> {
    // 1. Fetch all contributions
    const allDays = await this.fetchContributionDays(username);

    if (!allDays || allDays.length === 0) {
      return res
        .status(404)
        .send(
          "User's contribution data could not be found or user is invalid.",
        );
    }

    // 2. Filter by the selected year (if provided)
    let filteredDays = allDays;
    if (year) {
      filteredDays = allDays.filter((day) => day.date.startsWith(year));
    }

    if (!filteredDays.length) {
      return res
        .status(404)
        .send(`No contribution data found for the selected year: ${year}`);
    }

    // 3. Create samples/MP3 for that year
    const samples = this.createSamplesFromContributions(filteredDays);
    const wavData = this.createWavData(samples);

    // 4. Save to a temporary folder
    const tempDir = this.createTempDirectory();
    const wavPath = path.join(tempDir, `${username}_${year}.wav`);
    const mp3Path = path.join(tempDir, `${username}_${year}.mp3`);
    fs.writeFileSync(wavPath, wavData);

    // 5. Convert WAV to MP3
    await new Promise<void>((resolve, reject) => {
      ffmpeg(wavPath)
        .setFfmpegPath(ffmpegStatic)
        .format('mp3')
        .on('error', (err) => {
          console.error(err);
          res.status(500).send('An error occurred while generating music');
          reject(err);
        })
        .on('end', () => {
          resolve();
        })
        .save(mp3Path);
    });

    // 6. Read MP3 and convert it to Base64
    const mp3Data = fs.readFileSync(mp3Path);
    const mp3Base64 = mp3Data.toString('base64');

    // 7. Clean up (delete the temp WAV/MP3 files)
    fs.unlinkSync(wavPath);
    fs.unlinkSync(mp3Path);

    // 8. Build an HTML page with an <audio> player
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${username} - ${year || 'All'} GitHub Music</title>
        </head>
        <body style="font-family: sans-serif; margin: 20px;">
          <h1>${username} - ${year || 'All Years'} GitHub Music</h1>
          <p>On this page, you can listen to the music generated from the contribution data for the selected year.</p>
          
          <audio controls style="width: 300px;">
            <source src="data:audio/mpeg;base64,${mp3Base64}" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </body>
      </html>
    `;

    // 9. Send HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Returns an array of years in which the user has contributions.
   *
   * @param username - GitHub username
   * @returns A promise that resolves to an array of years (strings)
   */
  async getUserYears(username: string): Promise<string[]> {
    const contributionDays = await this.fetchContributionDays(username);

    if (!contributionDays || contributionDays.length === 0) {
      // Return an empty array instead of throwing an error
      return [];
    }

    // Extract unique years
    const yearsSet = new Set<string>();
    for (const day of contributionDays) {
      const y = new Date(day.date).getFullYear().toString();
      yearsSet.add(y);
    }
    return Array.from(yearsSet).sort();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetches all contribution days for the specified user via GitHub's GraphQL API.
   * Returns null if no data is found.
   *
   * @param username - GitHub username
   * @returns A promise that resolves to an array of contribution-day objects, or null if none
   * @private
   */
  private async fetchContributionDays(username: string) {
    const query = this.createGraphQLQuery(username);

    // Increase timeout to mitigate potential 504 issues
    const response = await axios.post(
      'https://api.github.com/graphql',
      { query },
      {
        headers: {
          Authorization: `bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GitHub-Music-App',
        },
        timeout: 20000, // 20 seconds
      },
    );

    const weeks =
      response.data.data.user?.contributionsCollection?.contributionCalendar
        ?.weeks;

    if (!weeks) {
      return null;
    }

    // Flatten all weeks into a single array of contributionDays
    return weeks.flatMap((week) => week.contributionDays) || null;
  }

  /**
   * Builds a GraphQL query string for fetching contribution data for a given username.
   *
   * @param username - GitHub username
   * @returns A string containing the GraphQL query
   * @private
   */
  private createGraphQLQuery(username: string): string {
    return `
      query {
        user(login: "${username}") {
          contributionsCollection {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;
  }

  /**
   * Creates an array of audio samples (as floating point values) from the given contributions.
   *
   * @param contributionDays - Array of contribution days
   * @returns An array of samples representing a sine wave for each day
   * @private
   */
  private createSamplesFromContributions(contributionDays: any[]): number[] {
    const frequencies = contributionDays.map((day) =>
      this.getFrequencyFromContribution(day.contributionCount),
    );
    const sampleRate = 44100;
    const duration = 0.1; // 0.1 seconds for each day
    const samples: number[] = [];

    frequencies.forEach((freq) => {
      const sampleCount = sampleRate * duration;
      for (let i = 0; i < sampleCount; i++) {
        // Basic sine wave
        const sample = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5;
        samples.push(sample);
      }
    });

    return samples;
  }

  /**
   * Converts an array of floating point samples into a 16-bit PCM WAV file (as a Buffer).
   *
   * @param samples - Array of audio samples (floats)
   * @returns A Buffer containing the WAV data
   * @private
   */
  private createWavData(samples: number[]): Buffer {
    // 16-bit PCM WAV
    const buffer = Buffer.alloc(samples.length * 2);

    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      // Scale the float sample [-1..1] to a 16-bit integer
      buffer.writeInt16LE(s * 32767, i * 2);
    }

    // Prepend the WAV header
    const wavHeader = this.getWavHeader(samples.length, 44100);
    return Buffer.concat([wavHeader, buffer]);
  }

  /**
   * Creates (if necessary) and returns the path to a temporary directory.
   *
   * @returns The path to the temp directory
   * @private
   */
  private createTempDirectory(): string {
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    return tempDir;
  }

  /**
   * Converts a WAV file to MP3 using ffmpeg, then sends or streams it via the given response.
   *
   * @param wavPath - Path to the WAV file
   * @param mp3Path - Desired path for the generated MP3 file
   * @param res - Express response object
   * @param isStream - Whether to stream (inline) or download (attachment)
   * @private
   */
  private async convertWavToMp3(
    wavPath: string,
    mp3Path: string,
    res: Response,
    isStream: boolean,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(wavPath)
        .setFfmpegPath(ffmpegStatic)
        .format('mp3')
        .on('error', (err) => {
          console.error('ffmpeg error:', err);
          res.status(500).send('An error occurred while generating music');
          reject(err);
        })
        .on('end', () => {
          this.sendMp3Response(mp3Path, res, isStream);
          // Remove the WAV file after conversion
          fs.unlinkSync(wavPath);
          resolve();
        })
        .save(mp3Path);
    });
  }

  /**
   * Pipes the generated MP3 file to the HTTP response and then deletes it.
   *
   * @param mp3Path - Path to the MP3 file
   * @param res - Express response object
   * @param isStream - Whether to stream (inline) or download (attachment)
   * @private
   */
  private sendMp3Response(
    mp3Path: string,
    res: Response,
    isStream: boolean,
  ): void {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      isStream ? 'inline' : 'attachment; filename=music.mp3',
    );

    const fileStream = fs.createReadStream(mp3Path);

    fileStream.pipe(res).on('finish', () => {
      // Cleanup the MP3 file after sending
      fs.unlinkSync(mp3Path);
    });
  }

  /**
   * Constructs a 44-byte WAV header for 16-bit mono audio at the specified sample rate.
   *
   * @param samplesLength - Number of samples
   * @param sampleRate - Audio sample rate in Hz
   * @returns A Buffer containing the WAV header
   * @private
   */
  private getWavHeader(samplesLength: number, sampleRate: number): Buffer {
    const blockAlign = 2; // 16-bit mono
    const byteRate = sampleRate * blockAlign;
    const dataSize = samplesLength * blockAlign;

    // Allocate 44 bytes for the WAV header
    const buffer = Buffer.alloc(44);

    // ChunkID: 'RIFF'
    buffer.write('RIFF', 0);
    // ChunkSize: 36 + dataSize
    buffer.writeUInt32LE(36 + dataSize, 4);
    // Format: 'WAVE'
    buffer.write('WAVE', 8);
    // Subchunk1ID: 'fmt '
    buffer.write('fmt ', 12);
    // Subchunk1Size: 16 (PCM)
    buffer.writeUInt32LE(16, 16);
    // AudioFormat: 1 (PCM)
    buffer.writeUInt16LE(1, 20);
    // NumChannels: 1 (mono)
    buffer.writeUInt16LE(1, 22);
    // SampleRate
    buffer.writeUInt32LE(sampleRate, 24);
    // ByteRate
    buffer.writeUInt32LE(byteRate, 28);
    // BlockAlign
    buffer.writeUInt16LE(blockAlign, 32);
    // BitsPerSample: 16
    buffer.writeUInt16LE(16, 34);
    // Subchunk2ID: 'data'
    buffer.write('data', 36);
    // Subchunk2Size: dataSize
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
  }

  /**
   * Maps a contribution count to a frequency (Hz) within a specified range (C4 ~261.63 Hz to C6 ~1046.5 Hz).
   *
   * @param count - The contribution count (commits, etc.)
   * @returns The corresponding frequency value in Hz
   * @private
   */
  private getFrequencyFromContribution(count: number): number {
    // Map contribution count to a frequency between C4 (261.63 Hz) and C6 (~1046.5 Hz)
    const minFreq = 261.63;
    const maxFreq = 1046.5;
    if (count <= 0) {
      return minFreq;
    }
    const freq = (count / 100) * (maxFreq - minFreq) + minFreq;
    return Math.min(freq, maxFreq);
  }
}
