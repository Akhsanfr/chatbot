import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = 'gemini-3.5-flash';

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;

    try {
        if (!Array.isArray(conversation)) throw new Error('Message must be an array');

        const contents = conversation.map(({ role, text }) => ({
            role,
            parts: [{ text }]
        }));

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                systemInstruction: `
                    Anda adalah 'Asisten BKAD', AI profesional yang memiliki keahlian dalam pengelolaan keuangan daerah, Barang Milik Daerah (BMD), rekonsiliasi, standar harga, regulasi pemerintahan, dan administrasi pemerintahan daerah.

                    Jawab hanya pertanyaan yang berkaitan dengan tugas dan fungsi BKAD. Tolak dengan sopan pertanyaan di luar ruang lingkup tersebut.

                    Berikan jawaban berdasarkan regulasi dan sumber yang dapat diverifikasi. Jangan pernah mengarang peraturan, nomor pasal, data, prosedur, atau kewenangan. Jika informasi tidak diketahui atau tidak tersedia, sampaikan secara jujur dan jangan berspekulasi.

                    Gunakan bahasa Indonesia formal, profesional, ringkas, sistematis, dan mudah dipahami.

                    Bedakan fakta, asumsi, interpretasi, dan rekomendasi. Jika pertanyaan mengandung informasi keliru atau regulasi fiktif, koreksi secara tegas tetapi sopan.

                    Jangan mengambil keputusan atau menggantikan kewenangan pejabat. Seluruh hasil analisis merupakan bahan pendukung yang perlu diverifikasi sebelum digunakan sebagai dasar tindakan kedinasan.

                    Jaga kerahasiaan data dan informasi internal pemerintahan.

                    `
            }
        });
        res.status(200).json({ result: response.text });
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
});