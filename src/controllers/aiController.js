// src/controllers/aiController.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// OpenAI API çağrısı
async function chatWithAI(req, res) {
  try {
    const { message } = req.body;
    
    console.log('🤖 AI Chat request:', message);
    console.log('🔑 OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

    // API Key kontrolü
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API Key not found!');
      return res.status(500).json({ 
        error: 'Üzgünüm, OpenAI API anahtarı yapılandırılmamış veya geçersiz. Lütfen sistem yöneticisi ile iletişime geçin.'
      });
    }

    // OpenAI API çağrısı
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Sen bir iş arama asistanısın. Türkçe konuş ve kullanıcıların iş bulmasına yardım et.

ÖNEMLI: Kullanıcı bir iş aradığında MUTLAKA şu formatı kullan:

1. Önce kısa bir açıklama yap (örn: "İstanbul'da React Developer pozisyonları arıyorum.")
2. Sonra yeni satırda "JOB_SEARCH:" yaz ve JSON formatında parametreleri ver
3. Sonra tekrar normal konuşmaya devam et

Örnekler:
- "İstanbul'da React Developer iş arıyorum" → 
  İstanbul'da React Developer pozisyonları için arama yapıyorum.
  JOB_SEARCH: {"title": "react developer", "city": "istanbul", "country": "türkiye"}
  Size uygun pozisyonları bulacağım!

- "Ankara'da frontend pozisyonu" → 
  Ankara'da frontend developer pozisyonları arıyorum.
  JOB_SEARCH: {"title": "frontend developer", "city": "ankara", "country": "türkiye"}
  İşte size uygun pozisyonlar!

- "uzaktan web developer" → 
  Uzaktan web developer pozisyonları için arama yapıyorum.
  JOB_SEARCH: {"title": "web developer", "preference": "uzaktan", "country": "türkiye"}
  Uzaktan çalışma imkanı olan pozisyonları buluyorum!

Kullanılabilir parametreler:
- title: pozisyon adı (küçük harflerle: react developer, frontend developer, backend developer, web developer, vb)
- city: şehir (küçük harflerle: istanbul, ankara, izmir, vb)
- country: ülke (varsayılan: türkiye)
- preference: çalışma türü (uzaktan, ofis, hibrit)

Her iş aramasında MUTLAKA JOB_SEARCH satırını ekle ve JSON'u doğru formatta yaz!`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    console.log('📡 OpenAI Response status:', response.status);
    
    if (!response.ok) {
      console.error('❌ OpenAI API Error:', data);
      
      if (response.status === 401) {
        return res.status(500).json({ 
          error: 'Üzgünüm, OpenAI API anahtarı yapılandırılmamış veya geçersiz. Lütfen sistem yöneticisi ile iletişime geçin.'
        });
      }
      
      return res.status(500).json({ 
        error: 'AI service error',
        details: data.error?.message || 'Unknown error'
      });
    }

    const aiResponse = data.choices[0].message.content;
    console.log('🤖 AI Full Response:', aiResponse);

    // İş arama komutu var mı kontrol et
    let jobs = [];
    let cleanResponse = aiResponse;

    if (aiResponse.includes('JOB_SEARCH:')) {
      console.log('🔍 JOB_SEARCH detected!');
      
      try {
        // JOB_SEARCH satırını bul
        const lines = aiResponse.split('\n');
        const jobSearchLine = lines.find(line => line.trim().startsWith('JOB_SEARCH:'));
        
        if (jobSearchLine) {
          // JOB_SEARCH satırını response'dan çıkar
          cleanResponse = lines
            .filter(line => !line.trim().startsWith('JOB_SEARCH:'))
            .join('\n')
            .trim();
          
          // JSON'u parse et
          const jsonStr = jobSearchLine.split('JOB_SEARCH:')[1].trim();
          console.log('🔍 Raw JSON string:', jsonStr);
          
          const searchParams = JSON.parse(jsonStr);
          console.log('🔍 Parsed search params:', searchParams);
          
          // İş ara
          jobs = await searchJobs(searchParams);
          console.log('💼 Found jobs count:', jobs.length);
          
        } else {
          console.log('❌ JOB_SEARCH line not found properly');
        }
        
      } catch (parseError) {
        console.error('❌ Search params parse error:', parseError);
        console.error('❌ Failed to parse:', parseError.message);
      }
    } else {
      console.log('ℹ️ No JOB_SEARCH in response');
    }

    res.json({
      message: cleanResponse,
      jobs: jobs.slice(0, 5), // İlk 5 işi gönder
      jobCount: jobs.length
    });

  } catch (error) {
    console.error('❌ AI Chat error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
}

// İş arama fonksiyonu - geliştirilmiş versiyon
async function searchJobs(searchParams) {
  try {
    console.log('🔍 Starting job search with params:', searchParams);
    
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Title arama - hem title hem description'da ara
    if (searchParams.title) {
      query += ` AND (LOWER(title) LIKE LOWER($${paramIndex}) OR LOWER(description) LIKE LOWER($${paramIndex}))`;
      params.push(`%${searchParams.title}%`);
      paramIndex++;
    }

    // City arama
    if (searchParams.city) {
      query += ` AND LOWER(city) LIKE LOWER($${paramIndex})`;
      params.push(`%${searchParams.city}%`);
      paramIndex++;
    }

    // Country arama
    if (searchParams.country) {
      query += ` AND LOWER(country) LIKE LOWER($${paramIndex})`;
      params.push(`%${searchParams.country}%`);
      paramIndex++;
    }

    // Preference arama (uzaktan, ofis, hibrit)
    if (searchParams.preference) {
      query += ` AND LOWER(preference) LIKE LOWER($${paramIndex})`;
      params.push(`%${searchParams.preference}%`);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC LIMIT 10';

    console.log('🔍 Final SQL query:', query);
    console.log('🔍 Query parameters:', params);

    const result = await pool.query(query, params);
    console.log('💼 Database returned:', result.rows.length, 'jobs');
    
    // Eğer hiç iş bulunamadıysa, daha geniş arama yap
    if (result.rows.length === 0 && searchParams.title) {
      console.log('🔍 No jobs found, trying broader search...');
      
      // Sadece title ile daha geniş arama
      const broaderQuery = 'SELECT * FROM jobs WHERE LOWER(title) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1) ORDER BY created_at DESC LIMIT 10';
      const broaderParams = [`%${searchParams.title.split(' ')[0]}%`]; // İlk kelimeyi al
      
      const broaderResult = await pool.query(broaderQuery, broaderParams);
      console.log('💼 Broader search returned:', broaderResult.rows.length, 'jobs');
      
      return broaderResult.rows;
    }
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Job search database error:', error);
    return [];
  }
}

// Test fonksiyonu - veritabanında iş olup olmadığını kontrol et
async function testDatabase() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM jobs');
    console.log('📊 Total jobs in database:', result.rows[0].count);
    
    const sampleResult = await pool.query('SELECT title, city, company FROM jobs LIMIT 3');
    console.log('📋 Sample jobs:', sampleResult.rows);
    
    return {
      count: result.rows[0].count,
      sample: sampleResult.rows
    };
  } catch (error) {
    console.error('❌ Database test error:', error);
    return { error: error.message };
  }
}

module.exports = {
  chatWithAI,
  testDatabase // Debug için export et
};