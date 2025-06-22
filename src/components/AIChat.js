import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const AIChat = ({ isOpen, onClose, user }) => {
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      content: 'Merhaba! İş arama konusunda size nasıl yardımcı olabilirim? İstanbul\'da web developer pozisyonu gibi aramalar yapabilirim! 👋'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [jobSuggestions, setJobSuggestions] = useState([]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // OpenAI API çağrısı
  const callOpenAI = async (userMessage) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Sen bir iş arama asistanısın. Kullanıcıların iş bulmasına yardım ediyorsun. 
              Eğer kullanıcı iş arıyorsa, pozisyon, şehir ve beceriler hakkında soru sor.
              Kısa ve yararlı cevaplar ver. Türkçe konuş.
              
              Available job search parameters:
              - title: pozisyon adı
              - city: şehir 
              - country: ülke
              - preference: uzaktan/ofis/hibrit
              
              Eğer kullanıcı belirli bir iş arıyorsa, "JOB_SEARCH:" ile başlayan bir satır ekle ve parametreleri JSON formatında ver.
              Örnek: JOB_SEARCH: {"title": "react developer", "city": "istanbul", "country": "türkiye"}`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.';
    }
  };

  // Backend'den iş arama
  const searchJobs = async (searchParams) => {
    try {
      const params = new URLSearchParams();
      if (searchParams.title) params.append('title', searchParams.title);
      if (searchParams.city) params.append('city', searchParams.city);
      if (searchParams.country) params.append('country', searchParams.country);
      if (searchParams.preference) params.append('preference', searchParams.preference);

      const response = await axios.get(`http://localhost:5000/api/jobs/search?${params}`);
      return response.data;
    } catch (error) {
      console.error('Job search error:', error);
      return [];
    }
  };

  // Mesaj gönderme
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Kullanıcı mesajını ekle
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      // OpenAI'dan cevap al
      const aiResponse = await callOpenAI(userMessage);
      
      // İş arama komutu var mı kontrol et
      if (aiResponse.includes('JOB_SEARCH:')) {
        const lines = aiResponse.split('\n');
        const jobSearchLine = lines.find(line => line.includes('JOB_SEARCH:'));
        const otherLines = lines.filter(line => !line.includes('JOB_SEARCH:')).join('\n');
        
        try {
          const searchParamsStr = jobSearchLine.split('JOB_SEARCH:')[1].trim();
          const searchParams = JSON.parse(searchParamsStr);
          
          // Backend'den iş ara
          const jobs = await searchJobs(searchParams);
          
          // AI cevabını ekle
          setMessages(prev => [...prev, { type: 'ai', content: otherLines || 'İşte size uygun pozisyonlar:' }]);
          
          // İş ilanlarını ekle
          if (jobs.length > 0) {
            setJobSuggestions(jobs);
            setMessages(prev => [...prev, { 
              type: 'ai', 
              content: `${jobs.length} adet uygun pozisyon buldum! Hangi pozisyona başvurmak istersiniz?`,
              jobs: jobs.slice(0, 3) // İlk 3 işi göster
            }]);
          } else {
            setMessages(prev => [...prev, { 
              type: 'ai', 
              content: 'Üzgünüm, bu kriterlere uygun bir pozisyon bulamadım. Başka bir arama yapmak ister misiniz?' 
            }]);
          }
        } catch (parseError) {
          console.error('Search params parse error:', parseError);
          setMessages(prev => [...prev, { type: 'ai', content: aiResponse }]);
        }
      } else {
        // Normal AI cevabı
        setMessages(prev => [...prev, { type: 'ai', content: aiResponse }]);
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' 
      }]);
    }

    setIsLoading(false);
  };

  // İş ilanına başvuru
  const handleApplyToJob = async (job) => {
    if (!user) {
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'Başvuru yapabilmek için lütfen giriş yapın.' 
      }]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/jobs/${job.id}/apply`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: `✅ ${job.title} pozisyonuna başarıyla başvurdunuz! Başvurunuz ${job.company} şirketine iletildi.` 
      }]);
    } catch (error) {
      console.error('Apply error:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'Başvuru sırasında bir hata oluştu. Lütfen tekrar deneyin.' 
      }]);
    }
  };

  // Enter tuşu ile mesaj gönder
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      height: '600px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      border: '1px solid #e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#007bff',
        color: 'white',
        padding: '1rem',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <span style={{ fontWeight: 'bold' }}>İş Arama Asistanı</span>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1'
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        backgroundColor: '#f8f9fa'
      }}>
        {messages.map((message, index) => (
          <div key={index} style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '0.75rem',
              borderRadius: '12px',
              backgroundColor: message.type === 'user' ? '#007bff' : 'white',
              color: message.type === 'user' ? 'white' : '#333',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              whiteSpace: 'pre-wrap'
            }}>
              {message.content}
              
              {/* İş ilanları varsa göster */}
              {message.jobs && message.jobs.map((job, jobIndex) => (
                <div key={jobIndex} style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#007bff', marginBottom: '0.25rem' }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>
                    🏢 {job.company}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                    📍 {job.city}, {job.country}
                  </div>
                  <button
                    onClick={() => handleApplyToJob(job)}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Başvur
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '1rem'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '0.75rem',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <span>💭 Düşünüyorum...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: 'white',
        borderRadius: '0 0 12px 12px'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Mesajınızı yazın..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading || !inputMessage.trim() ? 0.6 : 1
            }}
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;