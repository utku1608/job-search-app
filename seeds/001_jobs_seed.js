// seeds/001_jobs_seed.js

exports.seed = async function(knex) {
  // Önce mevcut verileri temizle
  await knex('jobs').del();
  
  // Örnek veri ekle
  await knex('jobs').insert([
    {
      title: 'React Developer',
      company: 'TechCorp',
      city: 'Istanbul',
      country: 'Türkiye',
      preference: 'Hibrit',
      description: 'React ve Redux deneyimi olan geliştirici aranıyor. Modern JavaScript, ES6+, Hook\'lar ve state management konularında deneyim gerekli.',
      applications: 15
    },
    {
      title: 'Backend Developer',
      company: 'DevCompany',
      city: 'Ankara',
      country: 'Türkiye',
      preference: 'Uzaktan',
      description: 'Node.js ve PostgreSQL ile backend geliştirme. RESTful API tasarımı ve mikroservis mimarisi deneyimi tercih edilir.',
      applications: 8
    },
    {
      title: 'Full Stack Developer',
      company: 'StartupInc',
      city: 'Izmir',
      country: 'Türkiye',
      preference: 'Tam Zamanlı',
      description: 'MERN stack ile full stack geliştirme pozisyonu. MongoDB, Express.js, React ve Node.js teknolojilerinde deneyim.',
      applications: 23
    },
    {
      title: 'Frontend Developer',
      company: 'WebStudio',
      city: 'Berlin',
      country: 'Almanya',
      preference: 'Ofis',
      description: 'Vue.js ve TypeScript deneyimi gerekli. Modern CSS framework\'leri ve responsive design konularında bilgi sahibi.',
      applications: 12
    },
    {
      title: 'Mobile Developer',
      company: 'AppWorks',
      city: 'London',
      country: 'İngiltere',
      preference: 'Hibrit',
      description: 'React Native ile mobil uygulama geliştirme. iOS ve Android platformlarında yayınlama deneyimi.',
      applications: 7
    },
    {
      title: 'Data Analyst',
      company: 'DataCorp',
      city: 'Paris',
      country: 'Fransa',
      preference: 'Uzaktan',
      description: 'Python ve SQL ile veri analizi pozisyonu. Pandas, NumPy, Matplotlib kütüphanelerinde deneyim.',
      applications: 19
    },
    {
      title: 'DevOps Engineer',
      company: 'CloudTech',
      city: 'Amsterdam',
      country: 'Hollanda',
      preference: 'Tam Zamanlı',
      description: 'AWS ve Docker deneyimi olan DevOps mühendisi. CI/CD pipeline\'ları ve Kubernetes deneyimi artı.',
      applications: 5
    },
    {
      title: 'UI/UX Designer',
      company: 'DesignHub',
      city: 'Zürich',
      country: 'İsviçre',
      preference: 'Yarı Zamanlı',
      description: 'Kullanıcı deneyimi ve arayüz tasarımı uzmanı. Figma, Adobe XD ve prototyping araçlarında deneyim.',
      applications: 11
    },
    {
      title: 'Software Engineer',
      company: 'BigTech',
      city: 'Toronto',
      country: 'Kanada',
      preference: 'Hibrit',
      description: 'Java ve Spring Boot ile enterprise geliştirme. Mikroservis mimarisi ve cloud native aplikasyon geliştirme.',
      applications: 31
    },
    {
      title: 'Project Manager',
      company: 'ManageCorp',
      city: 'Istanbul',
      country: 'Türkiye',
      preference: 'Ofis',
      description: 'Agile metodolojileri ile proje yönetimi deneyimi. Scrum Master sertifikası tercih edilir.',
      applications: 9
    },
    {
      title: 'Python Developer',
      company: 'AITech',
      city: 'Bursa',
      country: 'Türkiye',
      preference: 'Uzaktan',
      description: 'Django ve Flask ile web geliştirme. Machine Learning projeleri deneyimi artı.',
      applications: 14
    },
    {
      title: 'QA Engineer',
      company: 'TestCorp',
      city: 'Antalya',
      country: 'Türkiye',
      preference: 'Hibrit',
      description: 'Manuel ve otomatik test süreçleri. Selenium, Jest ve test stratejileri konularında deneyim.',
      applications: 6
    }
  ]);
};