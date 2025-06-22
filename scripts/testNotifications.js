// scripts/testNotifications.js

const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

// Test kullanıcısı credentials
const TEST_USER = {
  name: 'Test User',
  email: `test${Date.now()}@example.com`,
  password: 'testpassword123'
};

class NotificationTester {
  constructor() {
    this.token = null;
    this.userId = null;
  }

  // Test kullanıcısı oluştur veya giriş yap
  async setupTestUser() {
    try {
      console.log('🔐 Setting up test user...');
      
      // Önce giriş yapmayı dene
      try {
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: TEST_USER.email,
          password: TEST_USER.password
        });
        
        this.token = loginResponse.data.token;
        this.userId = loginResponse.data.user.id;
        console.log(`✅ Logged in as existing user: ${loginResponse.data.user.name}`);
        
      } catch (loginError) {
        // Kullanıcı yoksa oluştur
        console.log('👤 Creating new test user...');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
        
        this.token = registerResponse.data.token;
        this.userId = registerResponse.data.user.id;
        console.log(`✅ Created new user: ${registerResponse.data.user.name}`);
      }
      
      // Debug: Token kontrolü
      console.log('🔑 Token received:', this.token ? 'Yes' : 'No');
      
    } catch (error) {
      console.error('❌ Failed to setup test user:', error.response?.data || error.message);
      throw error;
    }
  }

  // Test iş alarmı oluştur
  async createTestJobAlert() {
    try {
      console.log('🔔 Creating test job alert...');
      
      // API'ye uygun format
      const alertData = {
        alert_name: 'Test React Developer Alert',
        keywords: 'React, JavaScript, Frontend',
        city: 'Istanbul',
        country: 'Türkiye',
        preference: 'Uzaktan',
        min_salary: 15000,
        max_salary: 35000,
        frequency: 'immediate', // Eksikti
        is_active: true // Eksikti
      };

      console.log('📤 Sending alert data:', alertData);

      const response = await axios.post(`${BASE_URL}/api/notifications/alerts`, alertData, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Created job alert: ${response.data.alert.alert_name}`);
      return response.data.alert;
      
    } catch (error) {
      console.error('❌ Failed to create job alert:', error.response?.data || error.message);
      console.error('❌ Status:', error.response?.status);
      throw error;
    }
  }

  // Test iş ilanı oluştur
  async createTestJobPosting() {
    try {
      console.log('💼 Creating test job posting...');
      
      const jobData = {
        title: 'React Developer',
        company: 'Test Company',
        city: 'Istanbul',
        country: 'Türkiye',
        preference: 'Uzaktan',
        description: 'We are looking for a React developer with JavaScript experience. Remote work available.',
        job_type: 'Tam Zamanlı', // Eksikti
        salary_min: 18000, // Eksikti
        salary_max: 30000, // Eksikti
        experience_level: 'Orta Seviye' // Eksikti
      };

      const response = await axios.post(`${BASE_URL}/api/jobs`, jobData, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Created job posting: ${response.data.title} at ${response.data.company}`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Failed to create job posting:', error.response?.data || error.message);
      throw error;
    }
  }

  // Test arama geçmişi oluştur
  async createTestSearchHistory() {
    try {
      console.log('🔍 Creating test search history...');
      
      const searchData = {
        searchQuery: {
          term: 'React Developer',
          city: 'Istanbul',
          country: 'Türkiye',
          preference: 'Uzaktan'
        },
        resultsCount: 5,
        searchResults: [
          {
            jobId: 1,
            title: 'React Developer',
            company: 'Tech Company',
            city: 'Istanbul',
            country: 'Türkiye',
            preference: 'Uzaktan'
          }
        ],
        searchMetadata: {
          userAgent: 'Test User Agent',
          ipAddress: '127.0.0.1',
          source: 'test_script'
        }
      };

      const response = await axios.post(`${BASE_URL}/api/notifications/searches`, searchData, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Created search history entry`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Failed to create search history:', error.response?.data || error.message);
      throw error;
    }
  }

  // Manuel job alert tetikle
  async triggerJobAlerts() {
    try {
      console.log('🚀 Triggering job alerts manually...');
      
      const response = await axios.post(`${BASE_URL}/api/notifications/trigger/job-alerts`, {}, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Job alerts triggered: ${response.data.message}`);
      
    } catch (error) {
      console.error('❌ Failed to trigger job alerts:', error.response?.data || error.message);
      throw error;
    }
  }

  // Manuel related jobs tetikle
  async triggerRelatedJobs() {
    try {
      console.log('🚀 Triggering related jobs notifications...');
      
      const response = await axios.post(`${BASE_URL}/api/notifications/trigger/related-jobs`, {}, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Related jobs triggered: ${response.data.message}`);
      
    } catch (error) {
      console.error('❌ Failed to trigger related jobs:', error.response?.data || error.message);
      throw error;
    }
  }

  // Scheduler durumunu kontrol et
  async checkSchedulerStatus() {
    try {
      console.log('📊 Checking scheduler status...');
      
      const response = await axios.get(`${BASE_URL}/api/notifications/scheduler/status`, {
        headers: { 
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('✅ Scheduler Status:');
      console.log(`   - Running: ${response.data.isRunning}`);
      console.log(`   - Active Tasks: ${response.data.activeTasks.join(', ')}`);
      console.log(`   - Task Count: ${response.data.taskCount}`);
      
    } catch (error) {
      console.error('❌ Failed to check scheduler status:', error.response?.data || error.message);
      throw error;
    }
  }

  // Kullanıcının job alert'lerini listele
  async listUserJobAlerts() {
    try {
      console.log('📋 Listing user job alerts...');
      
      const response = await axios.get(`${BASE_URL}/api/notifications/alerts`, {
        headers: { 
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log(`✅ Found ${response.data.length} job alerts:`);
      response.data.forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.alert_name} (${alert.is_active ? 'Active' : 'Inactive'})`);
      });
      
    } catch (error) {
      console.error('❌ Failed to list job alerts:', error.response?.data || error.message);
      throw error;
    }
  }

  // API health check
  async checkApiHealth() {
    try {
      console.log('🏥 Checking API health...');
      
      const response = await axios.get(`${BASE_URL}/api/health`);
      
      console.log('✅ API Health Status:');
      console.log(`   - Status: ${response.data.status}`);
      console.log(`   - PostgreSQL: ${response.data.services.postgresql}`);
      console.log(`   - MongoDB: ${response.data.services.mongodb}`);
      console.log(`   - Scheduler: ${response.data.services.scheduler}`);
      console.log(`   - Queue: ${response.data.services.queue}`);
      
    } catch (error) {
      console.error('❌ API health check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Queue durumunu kontrol et
  async checkQueueStatus() {
    try {
      console.log('📦 Checking queue status...');
      
      const response = await axios.get(`${BASE_URL}/api/notifications/queue/status`, {
        headers: { 
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('✅ Queue Status:');
      console.log(`   - Pending Jobs: ${response.data.pending}`);
      console.log(`   - Processing Jobs: ${response.data.processing}`);
      console.log(`   - Completed Jobs: ${response.data.completed}`);
      console.log(`   - Failed Jobs: ${response.data.failed}`);
      
    } catch (error) {
      console.error('❌ Failed to check queue status:', error.response?.data || error.message);
      // Queue endpoint yoksa hata vermesin
    }
  }

  // Tam test sürecini çalıştır
  async runFullTest() {
    console.log('🧪 Starting full notification system test...\n');
    
    try {
      // 1. Setup
      await this.setupTestUser();
      await this.checkApiHealth();
      
      // 2. Create test data
      await this.createTestJobAlert();
      await this.createTestSearchHistory();
      
      // 3. List current alerts
      await this.listUserJobAlerts();
      
      // 4. Check scheduler
      await this.checkSchedulerStatus();
      
      // 5. Check queue (optional)
      await this.checkQueueStatus();
      
      // 6. Create a job that should trigger notifications
      await this.createTestJobPosting();
      
      // 7. Manually trigger notifications for immediate testing
      await this.triggerJobAlerts();
      await this.triggerRelatedJobs();
      
      console.log('\n✅ Full notification test completed successfully!');
      console.log('📧 Check console for DEMO email notifications');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      if (error.response) {
        console.error('❌ Response data:', error.response.data);
        console.error('❌ Status code:', error.response.status);
      }
      process.exit(1);
    }
  }
}

// Komut satırı argümanlarına göre test çalıştır
async function main() {
  const tester = new NotificationTester();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🧪 Running full notification test suite...');
    await tester.runFullTest();
    return;
  }
  
  const command = args[0];
  
  try {
    await tester.setupTestUser();
    
    switch (command) {
      case 'health':
        await tester.checkApiHealth();
        break;
      case 'create-alert':
        await tester.createTestJobAlert();
        break;
      case 'create-job':
        await tester.createTestJobPosting();
        break;
      case 'create-search':
        await tester.createTestSearchHistory();
        break;
      case 'trigger-alerts':
        await tester.triggerJobAlerts();
        break;
      case 'trigger-related':
        await tester.triggerRelatedJobs();
        break;
      case 'status':
        await tester.checkSchedulerStatus();
        break;
      case 'list-alerts':
        await tester.listUserJobAlerts();
        break;
      case 'queue':
        await tester.checkQueueStatus();
        break;
      default:
        console.log('❓ Unknown command. Available commands:');
        console.log('   health, create-alert, create-job, create-search');
        console.log('   trigger-alerts, trigger-related, status, list-alerts, queue');
        console.log('   (no args for full test)');
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
      console.error('❌ Status code:', error.response.status);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = NotificationTester;