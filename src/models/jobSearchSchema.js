// src/models/jobSearchSchema.js

const mongoose = require('mongoose');

// Job Search History Schema for MongoDB
const jobSearchSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  searchQuery: {
    term: String,
    city: String,
    country: String,
    preference: {
      type: String,
      enum: ['Uzaktan', 'Ofis', 'Hibrit', 'Yarı Zamanlı', 'Tam Zamanlı']
    },
    company: String,
    minSalary: Number,
    maxSalary: Number
  },
  resultsCount: {
    type: Number,
    default: 0
  },
  searchResults: [{
    jobId: Number,
    title: String,
    company: String,
    city: String,
    country: String,
    preference: String,
    clickedAt: Date
  }],
  searchMetadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    source: {
      type: String,
      enum: ['homepage', 'search_page', 'related_search', 'ai_agent'],
      default: 'homepage'
    }
  },
  searchedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'job_searches'
});

// Compound indexes for better query performance
jobSearchSchema.index({ userId: 1, searchedAt: -1 });
jobSearchSchema.index({ 'searchQuery.city': 1, 'searchQuery.country': 1 });
jobSearchSchema.index({ 'searchQuery.term': 'text', 'searchQuery.company': 'text' });

// TTL index - Keep search history for 1 year (optional)
jobSearchSchema.index({ searchedAt: 1 }, { expireAfterSeconds: 31536000 });

// Virtual for search summary
jobSearchSchema.virtual('searchSummary').get(function() {
  const parts = [];
  if (this.searchQuery.term) parts.push(this.searchQuery.term);
  if (this.searchQuery.city) parts.push(this.searchQuery.city);
  if (this.searchQuery.preference) parts.push(this.searchQuery.preference);
  return parts.join(' • ');
});

// Static method to find similar searches
jobSearchSchema.statics.findSimilarSearches = function(userId, searchQuery, limit = 10) {
  const query = { userId };
  
  // Build similarity query
  const orConditions = [];
  
  if (searchQuery.term) {
    orConditions.push({
      'searchQuery.term': { $regex: searchQuery.term, $options: 'i' }
    });
  }
  
  if (searchQuery.city) {
    orConditions.push({
      'searchQuery.city': searchQuery.city
    });
  }
  
  if (searchQuery.country) {
    orConditions.push({
      'searchQuery.country': searchQuery.country
    });
  }
  
  if (orConditions.length > 0) {
    query.$or = orConditions;
  }
  
  return this.find(query)
    .sort({ searchedAt: -1 })
    .limit(limit)
    .select('searchQuery resultsCount searchedAt');
};

// Instance method to track result click
jobSearchSchema.methods.trackClick = function(jobId, jobDetails) {
  const clickedResult = {
    jobId,
    title: jobDetails.title,
    company: jobDetails.company,
    city: jobDetails.city,
    country: jobDetails.country,
    preference: jobDetails.preference,
    clickedAt: new Date()
  };
  
  this.searchResults.push(clickedResult);
  this.lastAccessedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('JobSearch', jobSearchSchema);