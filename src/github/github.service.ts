// github/github.service.ts

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';

@Injectable()
export class GithubService {
  private token = process.env.GITHUB_TOKEN;
  
  async generateAndSendMusic(
    username: string,
    res: Response,
    isStream: boolean,
  ) {
    const token = process.env.GITHUB_TOKEN; // Token'ı ortam değişkeninden alın

    try {
      // Kullanıcının katkı verilerini almak için GraphQL sorgusu
      const query = `
        query ($username: String!) {
          user(login: $username) {
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

      const variables = { username };

      const response = await axios.post(
        'https://api.github.com/graphql',
        { query, variables },
        {
          headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Music-App',
          },
        },
      );

      const weeks =
        response.data.data.user.contributionsCollection.contributionCalendar
          .weeks;

      if (!weeks || weeks.length === 0) {
        return res
          .status(404)
          .send('Kullanıcının katkı verileri bulunamadı.');
      }

      // Katkı günlerini düz bir diziye dönüştür
      const contributionDays = weeks.flatMap((week) => week.contributionDays);

      // Katkı verilerini müzik notalarına dönüştür
      const frequencies = contributionDays.map((day) => {
        const count = day.contributionCount;
        // Katkı sayısına göre nota seçimi
        return this.getFrequencyFromContribution(count);
      });

      // PCM verisini oluştur
      const sampleRate = 44100; // Örnekleme oranı
      const duration = 0.1; // Her notanın süresi (saniye)
      const samples = [];

      frequencies.forEach((freq) => {
        const sampleCount = sampleRate * duration;
        for (let i = 0; i < sampleCount; i++) {
          const sample =
            Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5; // Amplitüdü 0.5'e düşür
          samples.push(sample);
        }
      });

      // PCM verisini 16-bit'e dönüştür
      const buffer = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(s * 32767, i * 2);
      }

      // Geçici WAV dosyasını oluştur
      const wavHeader = this.getWavHeader(samples.length, sampleRate);
      const wavData = Buffer.concat([wavHeader, buffer]);

      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const wavPath = path.join(tempDir, `${username}.wav`);
      const mp3Path = path.join(tempDir, `${username}.mp3`);

      fs.writeFileSync(wavPath, wavData);

      // ffmpeg ayarlarını yapılandır
      await new Promise<void>((resolve, reject) => {
        ffmpeg(wavPath)
          .setFfmpegPath(ffmpegStatic)
          .format('mp3')
          .on('error', (err) => {
            console.error(err);
            res.status(500).send('Müzik oluşturulurken hata oluştu');
            reject(err);
          })
          .on('end', () => {
            // MP3 dosyasını yanıt olarak gönder
            res.setHeader('Content-Type', 'audio/mpeg');
            if (isStream) {
              res.setHeader('Content-Disposition', 'inline');
            } else {
              res.setHeader(
                'Content-Disposition',
                'attachment; filename=music.mp3',
              );
            }
            const fileStream = fs.createReadStream(mp3Path);
            fileStream.pipe(res).on('finish', () => {
              // Geçici dosyaları sil
              fs.unlinkSync(wavPath);
              fs.unlinkSync(mp3Path);
              resolve();
            });
          })
          .save(mp3Path);
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Müzik oluşturulurken hata oluştu');
    }
  }



  async generateMusicByYear(
    username: string,
    year: string,
    res: Response,
  ) {
    const token = process.env.GITHUB_TOKEN;
    try {
      // Kullanıcının mevcut yıllarını al
      const years = await this.getUserYears(username);

      // Yıl seçilmemişse, yıl seçme sayfasını göster
      if (!year) {
        return res.render('select-year', { username, years });
      }

      // Seçilen yıl kullanıcının mevcut yılları arasında değilse hata döndür
      if (!years.includes(parseInt(year))) {
        return res
          .status(400)
          .send('Geçersiz yıl seçimi. Lütfen mevcut yıllardan birini seçin.');
      }

      // Seçilen yılın tarih aralığını belirle
      const currentYear = new Date().getFullYear();
      const currentDate = new Date();

      const fromDate = new Date(`${year}-01-01T00:00:00Z`);
      let toDate: Date;

      if (parseInt(year) >= currentYear) {
        toDate = currentDate; // Gelecek bir yıl seçilmişse bugünün tarihini kullan
      } else {
        toDate = new Date(`${year}-12-31T23:59:59Z`);
      }

      // Kullanıcının katkı verilerini almak için GraphQL sorgusu
      const query = `
        query ($username: String!) {
          user(login: $username) {
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

      const variables = { username };

      const response = await axios.post(
        'https://api.github.com/graphql',
        { query, variables },
        {
          headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Music-App',
          },
        },
      );

      const weeks =
        response.data.data.user.contributionsCollection.contributionCalendar
          .weeks;

      if (!weeks || weeks.length === 0) {
        return res
          .status(404)
          .send('Kullanıcının katkı verileri bulunamadı.');
      }

      // Katkı günlerini düz bir diziye dönüştür
      const contributionDays = weeks.flatMap((week) => week.contributionDays);

      // Katkı günlerini seçilen yılın tarih aralığına göre filtrele
      const filteredContributionDays = contributionDays.filter((day) => {
        const dayDate = new Date(day.date);
        return dayDate >= fromDate && dayDate <= toDate;
      });

      // Filtrelenmiş katkı günlerini kontrol et
      if (filteredContributionDays.length === 0) {
        return res
          .status(404)
          .send('Seçilen yılda kullanıcının katkı verileri bulunamadı.');
      }

      // Katkı verilerini müzik notalarına dönüştür
      const frequencies = filteredContributionDays.map((day) => {
        const count = day.contributionCount;
        return this.getFrequencyFromContribution(count);
      });

      // PCM verisini oluştur
      const sampleRate = 44100; // Örnekleme oranı
      const duration = 0.1; // Her notanın süresi (saniye)
      const samples = [];

      frequencies.forEach((freq) => {
        const sampleCount = sampleRate * duration;
        for (let i = 0; i < sampleCount; i++) {
          const sample =
            Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.5;
          samples.push(sample);
        }
      });

      // PCM verisini 16-bit'e dönüştür
      const buffer = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(s * 32767, i * 2);
      }

      // Geçici WAV dosyasını oluştur
      const wavHeader = this.getWavHeader(samples.length, sampleRate);
      const wavData = Buffer.concat([wavHeader, buffer]);

      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const wavPath = path.join(tempDir, `${username}-${year}.wav`);
      const mp3Path = path.join(tempDir, `${username}-${year}.mp3`);

      fs.writeFileSync(wavPath, wavData);

      // ffmpeg ile MP3'e dönüştür
      await new Promise<void>((resolve, reject) => {
        ffmpeg(wavPath)
          .setFfmpegPath(ffmpegStatic)
          .format('mp3')
          .on('error', (err) => {
            console.error(err);
            res.status(500).send('Müzik oluşturulurken hata oluştu');
            reject(err);
          })
          .on('end', () => {
            // HTML dosyasını render et
            const mp3Data = fs.readFileSync(mp3Path).toString('base64');
            res.render('play-music', { username, year, mp3Data });
            // Geçici dosyaları sil
            fs.unlinkSync(wavPath);
            fs.unlinkSync(mp3Path);
            resolve();
          })
          .save(mp3Path);
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Müzik oluşturulurken hata oluştu');
    }
  }
 
  // Kullanıcının mevcut yıllarını döndüren fonksiyon
  async getUserYears(username: string): Promise<number[]> {
    try {
      const userInfoQuery = `
        query ($username: String!) {
          user(login: $username) {
            createdAt
          }
        }
      `;

      const userInfoResponse = await axios.post(
        'https://api.github.com/graphql',
        { query: userInfoQuery, variables: { username } },
        {
          headers: {
            Authorization: `bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Music-App',
          },
        },
      );

      const createdAt = new Date(
        userInfoResponse.data.data.user.createdAt,
      );
      const currentYear = new Date().getFullYear();
      const startYear = createdAt.getFullYear();

      const years = [];
      for (let y = startYear; y <= currentYear; y++) {
        years.push(y);
      }

      return years;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async generateCustomMusic(
    username: string,
    instrumentId: number,
    tempo: number,
    volume: number,
    res: Response,
  ) {
    const token = this.token;

    // Varsayılan değerler
    tempo = tempo || 120; // BPM
    volume = volume !== undefined ? volume : 0.5; // 0.0 - 1.0

    try {
      // Kullanıcının katkı verilerini almak için GraphQL sorgusu
      const query = `
        query ($username: String!) {
          user(login: $username) {
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

      const variables = { username };

      const response = await axios.post(
        'https://api.github.com/graphql',
        { query, variables },
        {
          headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Music-App',
          },
        },
      );

      const weeks =
        response.data.data.user.contributionsCollection.contributionCalendar
          .weeks;

      if (!weeks || weeks.length === 0) {
        return res
          .status(404)
          .send('Kullanıcının katkı verileri bulunamadı.');
      }

      // Katkı günlerini düz bir diziye dönüştür
      const contributionDays = weeks.flatMap((week) => week.contributionDays);

      // Katkı verilerini müzik notalarına dönüştür
      const frequenciesAndDurations = contributionDays.map((day) => {
        const count = day.contributionCount;
        // Katkı sayısına göre frekans ve süre belirle
        const freq = this.getFrequencyFromContribution(count);
        const noteDuration = this.getNoteDurationFromContribution(count, tempo);
        const chord = this.getChordFromContribution(count, freq);
        return { freq, noteDuration, chord };
      });

      // PCM verisini oluştur
      const sampleRate = 44100; // Örnekleme oranı
      const samples = [];

      frequenciesAndDurations.forEach(({ freq, noteDuration, chord }) => {
        const sampleCount = Math.floor(sampleRate * noteDuration);

        // Enstrüman dalga formunu al
        const instrumentWaveform = this.getInstrumentWaveform(instrumentId);

        for (let i = 0; i < sampleCount; i++) {
          let sample = 0;
          const t = i / sampleRate;
          if (chord) {
            // Akor varsa, frekanslar dizisi
            chord.forEach((chordFreq) => {
              sample += instrumentWaveform(chordFreq, t);
            });
            sample /= chord.length; // Ortalama
          } else {
            // Tek frekans
            sample = instrumentWaveform(freq, t);
          }
          sample *= volume; // Ses seviyesini uygula
          samples.push(sample);
        }
      });

      // PCM verisini 16-bit'e dönüştür
      const buffer = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(s * 32767, i * 2);
      }

      // Geçici WAV dosyasını oluştur
      const wavHeader = this.getWavHeader(samples.length, sampleRate);
      const wavData = Buffer.concat([wavHeader, buffer]);

      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const wavPath = path.join(tempDir, `${username}-custom.wav`);
      const mp3Path = path.join(tempDir, `${username}-custom.mp3`);

      fs.writeFileSync(wavPath, wavData);

      // ffmpeg ile MP3'e dönüştür
      await new Promise<void>((resolve, reject) => {
        ffmpeg(wavPath)
          .setFfmpegPath(ffmpegStatic)
          .format('mp3')
          .on('error', (err) => {
            console.error(err);
            res.status(500).send('Müzik oluşturulurken hata oluştu');
            reject(err);
          })
          .on('end', () => {
            // MP3 dosyasını yanıt olarak gönder
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader(
              'Content-Disposition',
              'attachment; filename=music.mp3',
            );
            const fileStream = fs.createReadStream(mp3Path);
            fileStream.pipe(res).on('finish', () => {
              // Geçici dosyaları sil
              fs.unlinkSync(wavPath);
              fs.unlinkSync(mp3Path);
              resolve();
            });
          })
          .save(mp3Path);
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Müzik oluşturulurken hata oluştu');
    }
  }

  // Enstrüman dalga formlarını tanımlayan fonksiyon
  private getInstrumentWaveform(
    instrumentId: number,
  ): (freq: number, t: number) => number {
    switch (instrumentId) {
      case 1: // Piyano (Sine wave)
        return (freq, t) => Math.sin(2 * Math.PI * freq * t);
      case 2: // Flüt (Sine wave with harmonics)
        return (freq, t) =>
          (Math.sin(2 * Math.PI * freq * t) +
            0.5 * Math.sin(2 * Math.PI * freq * 2 * t)) /
          1.5;
      case 3: // Gitar (Triangle wave)
        return (freq, t) => {
          const period = 1 / freq;
          return (
            (2 / Math.PI) *
            Math.asin(Math.sin(2 * Math.PI * freq * t))
          );
        };
      case 4: // Keman (Sawtooth wave)
        return (freq, t) => {
          const period = 1 / freq;
          return (2 * (t % period)) / period - 1;
        };
      case 5: // Klarnet (Square wave)
        return (freq, t) =>
          Math.sign(Math.sin(2 * Math.PI * freq * t));
      case 6: // Davul (Noise burst)
        return (freq, t) => (Math.random() * 2 - 1) * Math.exp(-t * 5);
      case 7: // Bağlama (Custom waveform)
        return (freq, t) =>
          Math.sin(2 * Math.PI * freq * t) *
          Math.sin(2 * Math.PI * freq * t * 0.5);
      case 8: // Keman Vibrato (Violin with vibrato)
        return (freq, t) =>
          Math.sin(
            2 * Math.PI * freq * t + 5 * Math.sin(2 * Math.PI * 5 * t),
          );
      default:
        // Varsayılan olarak sine wave kullan
        return (freq, t) => Math.sin(2 * Math.PI * freq * t);
    }
  }

  // Katkı sayısına göre notanın süresini belirleyen fonksiyon
  private getNoteDurationFromContribution(
    count: number,
    tempo: number,
  ): number {
    // Temel olarak her bir vuruşun süresi (beat duration)
    const beatDuration = 60 / tempo; // saniye cinsinden
    // Katkı sayısına göre nota değeri (örneğin, çok katkı varsa daha uzun notalar)
    if (count >= 50) return beatDuration * 4; // whole note
    if (count >= 25) return beatDuration * 2; // half note
    if (count >= 10) return beatDuration; // quarter note
    if (count >= 5) return beatDuration / 2; // eighth note
    return beatDuration / 4; // sixteenth note
  }

  // Katkı sayısına göre akor oluşturan fonksiyon
  private getChordFromContribution(
    count: number,
    baseFreq: number,
  ): number[] | null {
    if (count >= 50) {
      // Major chord
      return [baseFreq, baseFreq * (5 / 4), baseFreq * (3 / 2)];
    } else if (count >= 25) {
      // Minor chord
      return [baseFreq, baseFreq * (6 / 5), baseFreq * (3 / 2)];
    } else if (count >= 10) {
      // Power chord
      return [baseFreq, baseFreq * (3 / 2)];
    } else {
      // Tek nota
      return null;
    }
  }

  // Katkı sayısına göre frekans belirleyen fonksiyon
  private getFrequencyFromContribution(count: number): number {
    const minFreq = 261.63; // C4
    const maxFreq = 1046.5; // C6

    // Daha geniş bir frekans aralığı kullanabiliriz
    const freq =
      count > 0
        ? (count / 100) * (maxFreq - minFreq) + minFreq
        : minFreq;
    return Math.min(freq, maxFreq);
  }

  // WAV header oluşturma fonksiyonu
  private getWavHeader(samplesLength: number, sampleRate: number) {
    const blockAlign = 2; // 16-bit mono
    const byteRate = sampleRate * blockAlign;
    const dataSize = samplesLength * blockAlign;

    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0); // ChunkID
    buffer.writeUInt32LE(36 + dataSize, 4); // ChunkSize
    buffer.write('WAVE', 8); // Format
    buffer.write('fmt ', 12); // Subchunk1ID
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(byteRate, 28); // ByteRate
    buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    buffer.write('data', 36); // Subchunk2ID
    buffer.writeUInt32LE(dataSize, 40); // Subchunk2Size

    return buffer;
  }
}