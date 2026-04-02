/**
 * 🎯 Smart Task Finder
 * Handles case-insensitive, fuzzy, and partial matching
 */

const Task = require("../models/Task");
const { escapeRegex, escapeRegexTruncated } = require("./regexSafe");

async function findTaskByTitle(user, title, context = {}) {
  try {
    if (!title || !user) return null;
    
    // Clean and normalize title
    const cleanTitle = title.trim().toLowerCase();
    const esc = escapeRegex(cleanTitle);
    const prefix =
      cleanTitle.length >= 3
        ? escapeRegex(cleanTitle.substring(0, 3))
        : esc;
    const fuzzyParts = cleanTitle.split(/\s+/).filter(Boolean).map(escapeRegex);
    const fuzzyPattern = fuzzyParts.length ? fuzzyParts.join(".*") : esc;

    const searchStrategies = [
      { title: { $regex: `^${esc}$`, $options: "i" } },
      { title: { $regex: esc, $options: "i" } },
      { title: { $regex: prefix, $options: "i" } },
      { title: { $regex: fuzzyPattern, $options: "i" } },
    ];
    
    // Search with user context
    const baseQuery = {
      $or: searchStrategies,
      assignedTo: user.id
    };
    
    // Add status filters if available
    if (context.status) {
      baseQuery.$or = searchStrategies.map(strategy => ({
        ...strategy,
        status: context.status
      }));
    }
    
    // Add recent task priority
    const tasks = await Task.find(baseQuery)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(10); // Limit to 10 results
    
    if (tasks.length === 0) {
      console.log(`[TASK-FINDER] No tasks found for "${title}"`);
      return null;
    }
    
    // Score and rank results
    const scoredTasks = tasks.map(task => {
      const taskTitleLower = task.title.toLowerCase();
      let score = 0;
      
      // Exact match bonus
      if (taskTitleLower === cleanTitle) score += 100;
      
      // Contains match bonus
      if (taskTitleLower.includes(cleanTitle)) score += 50;
      
      // Partial match bonus
      if (taskTitleLower.startsWith(cleanTitle.substring(0, 3))) score += 25;
      
      // Recent task bonus
      const daysOld = (Date.now() - task.createdAt) / (1000 * 60 * 60 * 24);
      if (daysOld < 7) score += 10;
      
      return { ...task.toObject(), score };
    });
    
    // Return best match
    const bestMatch = scoredTasks.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    console.log(`[TASK-FINDER] Found "${title}" → "${bestMatch.title}" (score: ${bestMatch.score})`);
    
    return bestMatch;
    
  } catch (error) {
    console.error('[TASK-FINDER] Error:', error.message);
    return null;
  }
}

async function findMultipleTasksByTitles(user, titles) {
  try {
    const cleanTitles = titles.map(t => t.trim().toLowerCase()).filter(Boolean);
    
    if (cleanTitles.length === 0) return [];
    
    // Build OR query for multiple titles
    const titleQueries = cleanTitles.map((t) => ({
      title: { $regex: escapeRegexTruncated(t), $options: "i" },
    }));
    
    const tasks = await Task.find({
      $or: titleQueries,
      assignedTo: user.id
    })
    .sort({ createdAt: -1 })
    .limit(20);
    
    console.log(`[TASK-FINDER] Found ${tasks.length} tasks for ${titles.length} titles`);
    
    return tasks;
    
  } catch (error) {
    console.error('[TASK-FINDER] Multiple search error:', error.message);
    return [];
  }
}

module.exports = {
  findTaskByTitle,
  findMultipleTasksByTitles
};
