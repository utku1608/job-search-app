class JobPosting {
  constructor(id, title, company, city, description, createdAt) {
    this.id = id;
    this.title = title;
    this.company = company;
    this.city = city;
    this.description = description;
    this.createdAt = createdAt || new Date().toISOString();
  }
}

module.exports = JobPosting;
