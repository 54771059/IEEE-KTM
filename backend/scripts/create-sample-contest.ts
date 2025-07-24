#!/usr/bin/env npx ts-node

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function createSampleContest(): Promise<void> {
  const mongoURI = process.env["DB_URI"] || "mongodb://localhost:27017";
  const dbName = process.env["DB_NAME"] || "monkeytype";

  console.log("Database configuration:");
  console.log("URI:", mongoURI);
  console.log("Database name:", dbName);

  const client = new MongoClient(mongoURI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);
    console.log("Using database:", db.databaseName);
    const contestsCollection = db.collection("contests");

    // Check if contest already exists
    const existingContest = await contestsCollection.findOne({
      name: "IEEE MGA Typing Contest",
    });
    if (existingContest) {
      console.log("Contest already exists:", existingContest["name"]);
      return;
    }

    // Create a contest that starts now and ends in 1 week
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    const contest = {
      name: "IEEE Test Typing Contest",
      description: "This is a sample typing contest.",
      startTime: now,
      endTime: oneWeekFromNow,
      isActive: true,
      options: {
        mode: "time",
        mode2: "60",
        punctuation: false,
        numbers: false,
      },
    };

    const result = await contestsCollection.insertOne(contest);
    console.log("Sample contest created successfully!");
    console.log("Contest ID:", result.insertedId);
    console.log("Contest Name:", contest.name);
    console.log("Start Time:", new Date(contest.startTime).toISOString());
    console.log("End Time:", new Date(contest.endTime).toISOString());
    console.log("Language: English (fixed)");
  } catch (error) {
    console.error("Error creating contest:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

// Run the script
createSampleContest().catch(console.error);
