import { db } from "./db";
import { students } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(students);
  if (existing.length > 0) return;

  await db.insert(students).values([
    { fullName: "Emily Rodriguez", classDayTime: "Monday 4:00 PM", ratePerClass: "35.00" },
    { fullName: "Jake Thompson", classDayTime: "Wednesday 5:30 PM", ratePerClass: "40.00" },
    { fullName: "Sophia Chen", classDayTime: "Saturday 10:00 AM", ratePerClass: "35.00" },
    { fullName: "Liam O'Brien", classDayTime: "Tuesday 6:00 PM", ratePerClass: "38.00" },
  ]);

  console.log("Seeded 4 students");
}
